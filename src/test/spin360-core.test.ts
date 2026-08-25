import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FRAME_COUNT,
  KEYFRAME_ANGLES,
  MAX_FRAME_ATTEMPTS,
  QA_IDENTITY_THRESHOLD,
  QA_SECONDARY_THRESHOLD,
  QA_CONFIDENCE_THRESHOLD,
  QA_THRESHOLD_POLICY,
  SPIN_MODELS,
  aggregateQuality,
  angleForIndex,
  angleGrid,
  angleStep,
  buildIntermediatePrompt,
  buildKeyframePrompt,
  buildManifest,
  buildQaPrompt,
  buildQaTelemetry,
  coverageScore,
  deriveRepairInstructionsFromQa,
  frameIndexForAngle,
  framesPerSector,
  getDirectSourceForKeyframe,
  isQaPassed,
  keyframeIndices,
  modelForAttempt,
  normalizeFrameCount,
  parseQaResult,
  planAllSectors,
  planSector,
  buildIdentityProfilePrompt,
  buildRepairPrompt,
  qaFailClosed,
  resolveSourceAngleSelections,
  resolveSourceAngleTruth,
  resolveIdentitySources,
  type QaResult,
} from '../../supabase/functions/_shared/spin360-core';
import * as v2 from '@/lib/spin360-v2';

describe('spin360 angle grid', () => {
  it('defaults to 48 frames and accepts only 32/48', () => {
    expect(DEFAULT_FRAME_COUNT).toBe(48);
    expect(normalizeFrameCount(32)).toBe(32);
    expect(normalizeFrameCount(48)).toBe(48);
    expect(normalizeFrameCount(36)).toBe(48);
    expect(normalizeFrameCount(undefined)).toBe(48);
  });

  it.each([32, 48])('maps the 8 key angles to exact integer indices (%i frames)', (count) => {
    const indices = keyframeIndices(count);
    expect(indices).toHaveLength(8);
    indices.forEach((idx, i) => {
      expect(Number.isInteger(idx)).toBe(true);
      expect(angleForIndex(idx, count)).toBe(KEYFRAME_ANGLES[i]);
    });
  });

  it('produces the documented steps', () => {
    expect(angleStep(48)).toBe(7.5);
    expect(angleStep(32)).toBe(11.25);
    expect(framesPerSector(48)).toBe(6);
    expect(framesPerSector(32)).toBe(4);
    expect(frameIndexForAngle(180, 48)).toBe(24);
    expect(frameIndexForAngle(315, 32)).toBe(28);
  });

  it('generates a full grid with unique indices and 8 keyframes', () => {
    const grid = angleGrid(48);
    expect(grid).toHaveLength(48);
    expect(new Set(grid.map((g) => g.index)).size).toBe(48);
    expect(grid.filter((g) => g.isKeyframe)).toHaveLength(8);
  });
});

describe('spin360 sector planning', () => {
  it('plans every intermediate frame exactly once, without keyframes', () => {
    const plan = planAllSectors(48);
    expect(plan).toHaveLength(48 - 8);
    const indices = plan.map((p) => p.index);
    expect(new Set(indices).size).toBe(indices.length);
    for (const key of keyframeIndices(48)) expect(indices).not.toContain(key);
  });

  it('has no duplicate frame indices for the 32 tier either', () => {
    const indices = planAllSectors(32).map((p) => p.index);
    expect(indices).toHaveLength(24);
    expect(new Set(indices).size).toBe(24);
  });

  it('is bidirectional: outward from both keyframes, midpoint last', () => {
    const plan = planSector(0, 48); // inner indices 1..5
    expect(plan.map((p) => p.index)).toEqual([1, 5, 2, 4, 3]);
    expect(plan[0].direction).toBe('forward');
    expect(plan[1].direction).toBe('backward');
    expect(plan[plan.length - 1].direction).toBe('midpoint');
  });

  it('keeps sector anchors and interpolation fractions consistent', () => {
    const plan = planSector(3, 48); // 135° → 180°
    for (const frame of plan) {
      expect(frame.sectorStartAngle).toBe(135);
      expect(frame.sectorEndAngle).toBe(180);
      expect(frame.fraction).toBeGreaterThan(0);
      expect(frame.fraction).toBeLessThan(1);
      expect(frame.angle).toBeGreaterThan(135);
      expect(frame.angle).toBeLessThan(180);
    }
  });

  it('wraps the last sector back to 0°', () => {
    const plan = planSector(7, 48);
    expect(plan[0].sectorStartIndex).toBe(42);
    expect(plan[0].sectorEndIndex).toBe(0);
  });
});

describe('spin360 QA evaluation', () => {
  const perfect = (): QaResult => ({
    scores: {
      identity: 98, wheels: 97, lights: 96, paint: 99,
      angle_continuity: 96, camera_continuity: 95, environment: 95, artifact_free: 96,
    },
    verdict: 'pass',
    hard_failures: [],
    repair_instructions: [],
    confidence: 90,
  });

  it('passes only clean frames', () => {
    expect(isQaPassed(perfect())).toBe(true);
  });

  it('never auto-passes when scores are missing', () => {
    const r = perfect();
    delete r.scores.wheels;
    expect(isQaPassed(r)).toBe(false);
    expect(isQaPassed(parseQaResult({}))).toBe(false);
  });

  it('fails below the identity threshold', () => {
    const r = perfect();
    r.scores.identity = QA_IDENTITY_THRESHOLD - 1;
    expect(isQaPassed(r)).toBe(false);
  });

  it('fails on any hard failure even with perfect scores', () => {
    const r = perfect();
    r.hard_failures = ['wrong_spoke_count'];
    expect(isQaPassed(r)).toBe(false);
  });

  it('parses and clamps malformed model output', () => {
    const parsed = parseQaResult({ scores: { identity: 130, wheels: -5 }, verdict: 'weird', hard_failures: 'x' });
    expect(parsed.scores.identity).toBe(100);
    expect(parsed.scores.wheels).toBe(0);
    expect(parsed.verdict).toBe('regenerate');
    expect(parsed.hard_failures).toEqual([]);
  });

  it('uses the pro image model only for the final repair attempt', () => {
    expect(modelForAttempt(1)).toBe(SPIN_MODELS.image);
    expect(modelForAttempt(MAX_FRAME_ATTEMPTS - 1)).toBe(SPIN_MODELS.image);
    expect(modelForAttempt(MAX_FRAME_ATTEMPTS)).toBe(SPIN_MODELS.imagePro);
  });

  it('uses only current, non-deprecated model ids', () => {
    for (const id of Object.values(SPIN_MODELS)) {
      expect(id).not.toContain('preview');
      expect(id).not.toBe('gemini-2.5-flash');
    }
  });
});

describe('spin360 quality aggregation', () => {
  const frames = (count: number, passed: number, score = 96) =>
    Array.from({ length: count }, (_, i) => ({
      frame_index: i,
      quality_score: score,
      validation_status: i < passed ? 'passed' : 'failed',
    }));

  it('derives the score from QA, not from file count', () => {
    const partial = aggregateQuality(frames(48, 24), 48);
    expect(partial.passedCount).toBe(24);
    expect(partial.completeness).toBe(0.5);
    expect(partial.qualityScore).toBe(48);
    expect(partial.complete).toBe(false);
  });

  it('is only complete when every frame exists and passed', () => {
    const full = aggregateQuality(frames(48, 48), 48);
    expect(full.complete).toBe(true);
    expect(full.qualityScore).toBe(96);
  });

  it('ignores duplicate frame indices', () => {
    const dup = aggregateQuality([...frames(4, 4), ...frames(4, 4)], 4);
    expect(dup.uniqueIndexCount).toBe(4);
    expect(dup.passedCount).toBe(4);
  });
});

describe('spin360 manifest', () => {
  it('builds a versioned auto3-spin manifest with ordered frames', () => {
    const manifest = buildManifest({
      jobId: 'job-1',
      vehicleId: 'veh-1',
      vin: 'WVWZZZ',
      targetFrameCount: 48,
      identityHash: 'abc123',
      frames: [
        { frame_index: 2, angle_degrees: 15, image_url: 'b.png', validation_status: 'passed', quality_score: 96 },
        { frame_index: 0, angle_degrees: 0, image_url: 'a.png', validation_status: 'passed', quality_score: 98 },
      ],
    });
    expect(manifest.type).toBe('auto3-spin');
    expect(manifest.version).toBe(2);
    expect(manifest.direction).toBe('clockwise');
    expect(manifest.startAngle).toBe(0);
    expect(manifest.angleStep).toBe(7.5);
    expect(manifest.identityHash).toBe('abc123');
    expect(manifest.frames.map((f) => f.index)).toEqual([0, 2]);
    expect(manifest.frames[0]).toMatchObject({ index: 0, angle: 0, src: 'a.png' });
  });
});

describe('spin360 prompt builders', () => {
  const identity = { paint: { primary_colour: { value: 'grey', status: 'CONFIRMED' } } };

  it('keyframe prompt contains all mandatory locks', () => {
    const prompt = buildKeyframePrompt({
      angle: 135,
      identity,
      referenceLabels: ['ORIGINAL photograph at 135°'],
      hasDedicatedWheelReference: true,
      hasDirectPhoto: true,
    });
    for (const tag of ['<TASK>', '<REFERENCE_PRIORITY>', '<IDENTITY_LOCK>', '<CAMERA_LOCK>', '<ROTATION>', '<SCENE_LOCK>', '<WHEEL_LOCK>', '<FORBIDDEN>']) {
      expect(prompt).toContain(tag);
    }
    expect(prompt).toContain('135 degrees');
    expect(prompt).toContain('exactly ONE image');
    expect(prompt).toContain('NEVER mirror');
    expect(prompt).toContain('dedicated wheel reference');
  });

  it('keyframe repair prompt carries the repair instructions', () => {
    const prompt = buildKeyframePrompt({
      angle: 0, identity, referenceLabels: ['ORIGINAL'], hasDedicatedWheelReference: false,
      hasDirectPhoto: false, strictRetry: true, repairInstructions: ['fix spoke count'],
    });
    expect(prompt).toContain('<STRICT_RETRY>');
    expect(prompt).toContain('fix spoke count');
  });

  it('keyframe prompt gives explicit synthesis guidance when the exact angle has no source photo', () => {
    const prompt = buildKeyframePrompt({
      angle: 0,
      identity,
      referenceLabels: ['ORIGINAL IDENTITY #1 at 45°', 'ORIGINAL IDENTITY #2 at 270°'],
      hasDedicatedWheelReference: false,
      hasDirectPhoto: false,
      sourceAngles: [45, 90, 135, 270],
    });
    expect(prompt).toContain('<MISSING_KEYFRAME_SYNTHESIS>');
    expect(prompt).toContain('Available real source angles after vision remapping: 45°, 90°, 135°, 270°');
    expect(prompt).toContain('direct FRONT view');
    expect(prompt).toContain('a 45°/135°/225°/315° three-quarter look is a QA failure');
  });

  it('intermediate prompt states sector, target angle and fraction', () => {
    const frame = planSector(1, 48)[0];
    const prompt = buildIntermediatePrompt({
      frame, frameCount: 48, identity,
      referenceLabels: ['ORIGINAL photograph at 0°', 'verified keyframe A at 45°'],
      hasDedicatedWheelReference: true,
    });
    expect(prompt).toContain(`Sector A = ${frame.sectorStartAngle}°`);
    expect(prompt).toContain(`Sector B = ${frame.sectorEndAngle}°`);
    expect(prompt).toContain(`Target angle = ${frame.angle}°`);
    expect(prompt).toContain(`interpolation fraction ${frame.fraction}`);
    expect(prompt).toContain('<CONTINUITY>');
    expect(prompt).toContain('rigid physical rotation');
    expect(prompt).toContain('<WHEEL_LOCK>');
    expect(prompt).toContain('exactly ONE image');
  });

  it('QA prompt forbids image generation and demands strict JSON', () => {
    const prompt = buildQaPrompt({
      angle: 90, frameIndex: 12, frameCount: 48, isKeyframe: false,
      referenceLabels: ['ORIGINAL photograph at 90°'],
    });
    expect(prompt).toContain('Do NOT generate an image');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('hard_failures');
    expect(prompt).toContain('repair_instructions');
    expect(prompt).toContain('mirrored_side_asymmetry');
    expect(prompt).toContain('ORIGINAL photographs');
  });
});

describe('spin360 coverage score', () => {
  it('rewards real key angles, wheel reference and originals', () => {
    const minimal = coverageScore({ confirmedAngles: [0, 90, 180, 270], hasWheelReference: false, hasOriginals: false });
    const full = coverageScore({ confirmedAngles: [...KEYFRAME_ANGLES], hasWheelReference: true, hasOriginals: true });
    expect(minimal.keyAngles).toBe(4);
    expect(full.score).toBe(100);
    expect(full.label).toBe('exzellent');
    expect(minimal.score).toBeLessThan(full.score);
  });
});

// ─── Phase-A-Korrekturen: reine V2-Module ───────────────────────────────
describe('spin360 v2 module', () => {
  it('exposes the exact bidirectional offsets per tier', () => {
    expect(v2.buildBidirectionalOffsets(32)).toEqual([1, 3, 2]);
    expect(v2.buildBidirectionalOffsets(48)).toEqual([1, 5, 2, 4, 3]);
  });

  it('plans every sector in bidirectional order', () => {
    for (const count of [32, 48] as const) {
      const offsets = v2.buildBidirectionalOffsets(count);
      for (let sector = 0; sector < 8; sector++) {
        const plan = v2.buildSectorPlan(sector, count);
        const per = v2.framesPerSector(count);
        expect(plan.map((f) => f.index - sector * per)).toEqual(offsets);
      }
    }
  });

  it('handles the wrap sector 315° → 0° without leaving the grid', () => {
    const plan = v2.buildSectorPlan(7, 48);
    expect(plan[0].sectorStartAngle).toBe(315);
    expect(plan[0].sectorEndIndex).toBe(0);
    expect(plan.every((f) => f.index > 0 && f.index < 48)).toBe(true);
    expect(plan.every((f) => f.angle > 315 && f.angle < 360)).toBe(true);
  });

  it('produces a full plan without duplicates and without keyframe indices', () => {
    for (const count of [32, 48] as const) {
      const plan = v2.buildFullPlan(count);
      const indices = plan.map((f) => f.index);
      expect(new Set(indices).size).toBe(indices.length);
      expect(indices.length).toBe(count - 8);
      for (const kf of v2.keyframeIndices(count)) expect(indices).not.toContain(kf);
    }
  });

  it('validates the frame count strictly', () => {
    expect(v2.validateFrameCount(48)).toBe(48);
    expect(v2.validateFrameCount(32)).toBe(32);
    expect(() => v2.validateFrameCount(36)).toThrow();
    expect(() => v2.validateFrameCount(undefined)).toThrow();
    expect(v2.validateFrameCountOrDefault(36)).toBe(48);
  });

  it('maps angles back to indices, decimals included', () => {
    expect(v2.indexForAngle(7.5, 48)).toBe(1);
    expect(v2.angleForIndex(1, 48)).toBe(7.5);
    expect(v2.indexForAngle(315, 48)).toBe(42);
  });
});

describe('spin360 v2 completion (fail closed)', () => {
  const grid = (count: number, mutate?: (f: any, i: number) => void) =>
    Array.from({ length: count }, (_, i) => {
      const frame = {
        frame_index: i,
        angle_degrees: v2.angleForIndex(i, count),
        validation_status: 'passed',
        quality_score: 97,
      };
      mutate?.(frame, i);
      return frame;
    });

  it('completes only with a full, passed, grid-exact set', () => {
    const result = v2.evaluateCompletion(grid(48), 48);
    expect(result.status).toBe('completed');
    expect(result.complete).toBe(true);
    expect(result.qualityScore).toBe(97);
  });

  it('never completes when a frame is missing', () => {
    const frames = grid(48).filter((f) => f.frame_index !== 17);
    const result = v2.evaluateCompletion(frames, 48);
    expect(result.status).toBe('needs_review');
    expect(result.missingIndices).toEqual([17]);
  });

  it('never completes at 80% coverage', () => {
    const frames = grid(48).slice(0, 39);
    expect(v2.evaluateCompletion(frames, 48).complete).toBe(false);
  });

  it('never completes when one frame failed QA', () => {
    const frames = grid(48, (f, i) => {
      if (i === 3) f.validation_status = 'failed';
    });
    const result = v2.evaluateCompletion(frames, 48);
    expect(result.status).toBe('needs_review');
    expect(result.failedIndices).toEqual([3]);
  });

  it('never completes when an angle is off grid', () => {
    const frames = grid(48, (f, i) => {
      if (i === 5) f.angle_degrees = 37.6;
    });
    const result = v2.evaluateCompletion(frames, 48);
    expect(result.offGridIndices).toEqual([5]);
    expect(result.complete).toBe(false);
  });
});

describe('spin360 QA fail-closed parsing', () => {
  it('never passes without a verdict, scores or confidence', () => {
    expect(isQaPassed(parseQaResult({}))).toBe(false);
    expect(isQaPassed(parseQaResult({ verdict: 'pass' }))).toBe(false);
    expect(isQaPassed(qaFailClosed('network error'))).toBe(false);
    expect(qaFailClosed('network error').verdict).not.toBe('pass');
  });

  it('rejects a pass verdict with hard failures or low scores', () => {
    const scores = {
      identity: 99, wheels: 99, lights: 99, paint: 99,
      angle_continuity: 99, camera_continuity: 99, environment: 99, artifact_free: 99,
    };
    expect(isQaPassed(parseQaResult({ verdict: 'pass', scores, confidence: 95 }))).toBe(true);
    expect(isQaPassed(parseQaResult({
      verdict: 'pass', scores, confidence: 95, hard_failures: ['wrong_spoke_count'],
    }))).toBe(false);
    expect(isQaPassed(parseQaResult({
      verdict: 'pass', scores: { ...scores, wheels: QA_IDENTITY_THRESHOLD - 1 }, confidence: 95,
    }))).toBe(false);
    expect(isQaPassed(parseQaResult({ verdict: 'pass', scores, confidence: 0.8 }))).toBe(false);
    expect(isQaPassed(parseQaResult({ verdict: 'pass', scores, confidence: 0.95 }))).toBe(true);
  });
});

describe('spin360 prompt contracts', () => {
  const TAGS = ['<REFERENCE_PRIORITY>', '<IDENTITY_LOCK>', '<CAMERA_LOCK>', '<ROTATION>',
    '<SCENE_LOCK>', '<WHEEL_LOCK>', '<FORBIDDEN>', '<REFERENCE_TRUTH_PROTOCOL>'];

  it('keyframe, intermediate and repair prompts carry every mandatory tag', () => {
    const common = {
      identity: { paint: { primary_colour: { value: 'grey', status: 'CONFIRMED' } } },
      referenceLabels: ['ORIGINAL IDENTITY #1 at 0°', 'WHEEL REFERENCE'],
      hasDedicatedWheelReference: true,
    };
    const prompts = [
      buildKeyframePrompt({ ...common, angle: 90, hasDirectPhoto: true }),
      buildIntermediatePrompt({ ...common, frame: planSector(0, 48)[0], frameCount: 48 }),
      buildRepairPrompt({
        ...common, angle: 97.5, frameIndex: 13, frameCount: 48, isKeyframe: false, attempt: 2,
        hardFailures: ['wrong_spoke_count'], repairInstructions: ['restore the 5-spoke rim'],
      }),
    ];
    for (const prompt of prompts) for (const tag of TAGS) expect(prompt).toContain(tag);
  });

  it('repair prompt embeds the exact QA feedback and preserves the rest', () => {
    const prompt = buildRepairPrompt({
      angle: 45, frameIndex: 6, frameCount: 48, identity: {},
      referenceLabels: ['ORIGINAL IDENTITY #1 at 0°'], hasDedicatedWheelReference: false,
      isKeyframe: true, attempt: 3,
      hardFailures: ['changed_light_signature'],
      repairInstructions: ['restore the original DRL signature'],
    });
    expect(prompt).toContain('changed_light_signature');
    expect(prompt).toContain('restore the original DRL signature');
    expect(prompt.toLowerCase()).toContain('preserve');
  });

  it('identity prompt forbids catalogue inference and demands CONFIRMED/PARTIAL/UNKNOWN', () => {
    const prompt = buildIdentityProfilePrompt({
      originalPhotoLabels: ['ORIGINAL IDENTITY #1 at 0°'],
      hasDedicatedWheelReference: false,
      identitySourceTier: 'original',
    });
    expect(prompt).toContain('CONFIRMED');
    expect(prompt).toContain('PARTIAL');
    expect(prompt).toContain('UNKNOWN');
    expect(prompt).toMatch(/catalog|catalogue/i);
    expect(prompt).toContain('Do NOT generate an image');
  });

  it('QA prompt forbids generation and requests every score dimension', () => {
    const prompt = buildQaPrompt({
      angle: 7.5, frameIndex: 1, frameCount: 48, isKeyframe: false,
      referenceLabels: ['ORIGINAL IDENTITY #1 at 0°'],
    });
    expect(prompt).toContain('Do NOT generate an image');
    for (const dim of ['identity', 'wheels', 'lights', 'paint', 'angle_continuity',
      'camera_continuity', 'environment', 'artifact_free']) expect(prompt).toContain(dim);
    expect(prompt).toContain('"verdict": "pass"|"regenerate"|"manual_review"');
    expect(prompt).toContain('hard_failures');
    expect(prompt).toContain('repair_instructions');
    expect(prompt).toContain('confidence');
  });
});

describe('spin360 v2 models', () => {
  it('binds exactly the audited model ids', () => {
    expect(SPIN_MODELS.analysis).toBe('gemini-3.7-flash');
    expect(SPIN_MODELS.image).toBe('gemini-3.1-flash-image');
    expect(SPIN_MODELS.imagePro).toBe('gemini-3-pro-image');
    expect(JSON.stringify(SPIN_MODELS)).not.toContain('preview');
    expect(JSON.stringify(SPIN_MODELS)).not.toContain('gemini-2.5');
  });
});

// ─── Quality-Audit-Fix ──────────────────────────────────────────────────
describe('spin360 calibrated QA thresholds', () => {
  const scores = (over: Partial<Record<string, number>> = {}) => ({
    identity: QA_IDENTITY_THRESHOLD, wheels: QA_IDENTITY_THRESHOLD,
    lights: QA_IDENTITY_THRESHOLD, paint: QA_IDENTITY_THRESHOLD,
    angle_continuity: QA_SECONDARY_THRESHOLD, camera_continuity: QA_SECONDARY_THRESHOLD,
    environment: QA_SECONDARY_THRESHOLD, artifact_free: QA_SECONDARY_THRESHOLD,
    ...over,
  });
  const qa = (raw: Record<string, unknown>) => isQaPassed(parseQaResult(raw));

  it('allows calibrated secondary scores but keeps identity-critical dimensions stricter', () => {
    expect(qa({ verdict: 'pass', scores: scores({ camera_continuity: 86, environment: 85 }), confidence: 95 })).toBe(true);
    expect(qa({ verdict: 'pass', scores: scores({ environment: QA_SECONDARY_THRESHOLD - 1 }), confidence: 95 })).toBe(false);
    expect(qa({ verdict: 'pass', scores: scores({ wheels: QA_IDENTITY_THRESHOLD - 1 }), confidence: 95 })).toBe(false);
  });

  it('enforces confidence >= 85 and normalizes decimals', () => {
    expect(qa({ verdict: 'pass', scores: scores(), confidence: QA_CONFIDENCE_THRESHOLD - 1 })).toBe(false);
    expect(qa({ verdict: 'pass', scores: scores(), confidence: QA_CONFIDENCE_THRESHOLD })).toBe(true);
    expect(qa({ verdict: 'pass', scores: scores(), confidence: 95 })).toBe(true);
    expect(qa({ verdict: 'pass', scores: scores(), confidence: 0.84 })).toBe(false);
    expect(qa({ verdict: 'pass', scores: scores(), confidence: 0.85 })).toBe(true);
  });

  it('fails closed on missing dimensions or missing confidence', () => {
    const partial = { ...scores() } as Record<string, number>;
    delete partial.environment;
    expect(qa({ verdict: 'pass', scores: partial, confidence: 99 })).toBe(false);
    expect(qa({ verdict: 'pass', scores: scores() })).toBe(false);
  });

  it('exposes the calibrated QA policy and telemetry payload', () => {
    const result = parseQaResult({
      verdict: 'regenerate',
      scores: scores({ paint: QA_IDENTITY_THRESHOLD - 1 }),
      confidence: 90,
      hard_failures: [],
      repair_instructions: [],
    });
    const telemetry = buildQaTelemetry(result, { raw: true }, false);
    expect(QA_THRESHOLD_POLICY.identityCritical).toBe(90);
    expect(QA_THRESHOLD_POLICY.secondary).toBe(85);
    expect(QA_THRESHOLD_POLICY.confidence).toBe(85);
    expect(QA_THRESHOLD_POLICY.hardFailuresAllowed).toBe(0);
    expect(telemetry).toMatchObject({
      scores: result.scores,
      confidence: 90,
      verdict: 'regenerate',
      hardFailures: [],
      thresholds: QA_THRESHOLD_POLICY,
      policy: QA_THRESHOLD_POLICY,
      passed: false,
    });
    expect(telemetry.derivedRepairInstructions).toEqual([
      'match the original paint colour tone, finish and reflections uniformly without recolouring trim or lights',
    ]);
  });
});

describe('spin360 completion is exact', () => {
  const passedFrames = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      frame_index: i,
      angle_degrees: v2.angleForIndex(i, count),
      validation_status: 'passed',
      quality_score: 96,
    }));

  it('rejects a full set with one wrong angle', () => {
    const frames = passedFrames(48);
    frames[12].angle_degrees = 91; // statt 90
    expect(aggregateQuality(frames, 48).complete).toBe(false);
    expect(v2.evaluateCompletion(frames, 48).status).toBe('needs_review');
  });

  it('rejects an out-of-range index replacing a missing expected index', () => {
    const frames = passedFrames(48);
    frames[47] = { frame_index: 99, angle_degrees: 352.5, validation_status: 'passed', quality_score: 96 };
    expect(aggregateQuality(frames, 48).complete).toBe(false);
    const result = v2.evaluateCompletion(frames, 48);
    expect(result.missingIndices).toEqual([47]);
    expect(result.status).toBe('needs_review');
  });

  it('accepts only the exact decimal grid', () => {
    expect(aggregateQuality(passedFrames(48), 48).complete).toBe(true);
    expect(aggregateQuality(passedFrames(32), 32).complete).toBe(true);
  });

  it('manifest carries targetFrameCount and clockwise direction with exact angles', () => {
    const manifest = buildManifest({
      jobId: 'job-1',
      vehicleId: 'veh-1',
      vin: 'WAU123',
      frames: passedFrames(48).map((f) => ({ ...f, image_url: `f${f.frame_index}.webp` })),
      targetFrameCount: 48,
      identityHash: 'abc',
    });
    expect(manifest.direction).toBe('clockwise');
    expect(manifest.targetFrameCount).toBe(48);
    expect(manifest.frames[1].angle).toBe(7.5);
    expect(manifest.frames.map((f) => f.index)).toEqual(Array.from({ length: 48 }, (_, i) => i));
    expect(JSON.stringify(manifest)).not.toContain('identityProfile');
  });
});

describe('spin360 source coverage', () => {
  it('requires four unique distributed angles, not specifically the four cardinals', () => {
    expect(v2.evaluateSourceCoverage([0, 180]).ok).toBe(false);
    expect(v2.evaluateSourceCoverage([0, 90, 180]).missingRequired).toEqual([270]);
    const full = v2.evaluateSourceCoverage([0, 90, 180, 270]);
    expect(full.ok).toBe(true);
    expect(full.missingOptional).toEqual([45, 135, 225, 315]);
    const diagonalCoverage = v2.evaluateSourceCoverage([45, 90, 180, 270]);
    expect(diagonalCoverage.ok).toBe(true);
    expect(diagonalCoverage.missingRequired).toEqual([0]);
    const provenJobCoverage = v2.evaluateSourceCoverage([45, 90, 225, 270]);
    expect(provenJobCoverage.ok).toBe(true);
    expect(provenJobCoverage.maxGap).toBe(135);
    expect(v2.MIN_SOURCE_ANGLES).toBe(4);
  });

  it('treats circular gap 135 as pass and greater than 135 as fail', () => {
    const boundary = v2.evaluateSourceCoverage([45, 90, 225, 270]);
    expect(boundary.ok).toBe(true);
    expect(boundary.gaps.map((g) => g.size)).toEqual([45, 135, 45, 135]);
    const overBoundary = v2.evaluateSourceCoverage([0, 45, 90, 180]);
    expect(overBoundary.ok).toBe(false);
    expect(overBoundary.maxGap).toBe(180);
    expect(overBoundary.reason).toBe('clustered_angles');
  });

  it('rejects four angles when they are too clustered around one side', () => {
    const clustered = v2.evaluateSourceCoverage([0, 45, 90, 135]);
    expect(clustered.ok).toBe(false);
    expect(clustered.reason).toBe('clustered_angles');
    expect(clustered.maxGap).toBe(225);
  });

  it('ignores wheel reference slot, duplicates and non-grid angles', () => {
    expect(v2.evaluateSourceCoverage([-1, 0, 0, 90, 180, 270, 33]).uniqueAngles).toEqual([0, 90, 180, 270]);
    expect(v2.evaluateSourceCoverage([-1, 0, 90, 180, 270]).ok).toBe(true);
  });
});

describe('spin360 source angle truth', () => {
  it('uses high-confidence detected upload angles over wrong slot declarations', () => {
    const decision = resolveSourceAngleTruth({
      declaredAngle: 0,
      detectedAngle: 45,
      angleConfidence: 92,
      leftRightCertain: true,
      sourceMode: 'upload',
    });
    expect(decision.selectedAngle).toBe(45);
    expect(decision.remapped).toBe(true);
    expect(decision.reason).toBe('detected_truth_upload');
  });

  it('keeps declared mapping when detection is uncertain', () => {
    const decision = resolveSourceAngleTruth({
      declaredAngle: 0,
      detectedAngle: 45,
      angleConfidence: 70,
      leftRightCertain: true,
      sourceMode: 'upload',
    });
    expect(decision.selectedAngle).toBe(0);
    expect(decision.reason).toBe('declared_used_detection_uncertain');
  });

  it('falls back to the declared hint when left/right is explicitly uncertain', () => {
    const decision = resolveSourceAngleTruth({
      declaredAngle: 0,
      detectedAngle: 45,
      angleConfidence: 100,
      leftRightCertain: false,
      sourceMode: 'upload',
    });
    expect(decision.selectedAngle).toBe(0);
    expect(decision.remapped).toBe(false);
    expect(decision.reason).toBe('declared_used_detection_uncertain');
  });

  it('keeps vehicle asset manual mapping unless a high-confidence contradiction is at least 45 degrees', () => {
    const kept = resolveSourceAngleTruth({
      declaredAngle: 90,
      detectedAngle: 90,
      angleConfidence: 100,
      leftRightCertain: true,
      sourceMode: 'vehicle_assets',
    });
    expect(kept.selectedAngle).toBe(90);
    expect(kept.reason).toBe('manual_mapping_kept');

    const contradicted = resolveSourceAngleTruth({
      declaredAngle: 180,
      detectedAngle: 225,
      angleConfidence: 100,
      leftRightCertain: true,
      sourceMode: 'vehicle_assets',
    });
    expect(contradicted.selectedAngle).toBe(225);
    expect(contradicted.remapped).toBe(true);
    expect(contradicted.conflictDegrees).toBe(45);
    expect(contradicted.reason).toBe('manual_conflict_detected_used');
  });

  it('deduplicates remapped sources and keeps the higher-confidence photo', () => {
    const result = resolveSourceAngleSelections(
      [
        { angle: 0, url: 'front-slot' },
        { angle: 45, url: 'diagonal-slot' },
        { angle: 90, url: 'left' },
        { angle: 180, url: 'rear' },
        { angle: 270, url: 'right' },
      ],
      [
        { index: 0, detected_angle: 45, angle_confidence: 92, left_right_certain: true, quality_score: 80 },
        { index: 1, detected_angle: 45, angle_confidence: 88, left_right_certain: true, quality_score: 70 },
      ],
      'upload',
    );
    expect(result.selected.map((s) => s.angle)).toEqual([45, 90, 180, 270]);
    expect(result.selected.find((s) => s.angle === 45)?.source.url).toBe('front-slot');
    expect(v2.evaluateSourceCoverage(result.selected.map((s) => s.angle)).ok).toBe(true);
  });
});

describe('spin360 identity sources', () => {
  it('prefers originals, then uploads, then gallery and never generated frames', () => {
    const rows = [
      { angle_degrees: 0, image_url: 'g0', asset_kind: 'gallery' },
      { angle_degrees: 90, image_url: 'o90', asset_kind: 'original' },
      { angle_degrees: 180, image_url: 'u180', asset_kind: 'upload' },
      { angle_degrees: 270, image_url: 'gen270', asset_kind: 'generated' },
      { angle_degrees: -1, image_url: 'wheel', asset_kind: 'wheel_reference' },
    ];
    const originals = resolveIdentitySources(rows);
    expect(originals.tier).toBe('original');
    expect(originals.sources.map((s) => s.image_url)).toEqual(['o90']);

    const uploads = resolveIdentitySources(rows.filter((r) => r.asset_kind !== 'original'));
    expect(uploads.tier).toBe('upload');
    expect(uploads.sources.map((s) => s.image_url)).toEqual(['u180']);

    const generatedOnly = resolveIdentitySources([
      { angle_degrees: 0, image_url: 'gen0', asset_kind: 'generated_keyframe' },
    ]);
    expect(generatedOnly.tier).toBe('none');
    expect(generatedOnly.sources).toEqual([]);
  });
});

describe('spin360 exact source and targeted repair logic', () => {
  it('detects a direct source only for the exact same keyframe angle', () => {
    const sources = [
      { angle_degrees: 45, image_url: 'front-diagonal' },
      { angle_degrees: 90, image_url: 'side' },
    ];
    expect(getDirectSourceForKeyframe(sources, 0)).toBeUndefined();
    expect(getDirectSourceForKeyframe(sources, 45)?.image_url).toBe('front-diagonal');
  });

  it('derives targeted repairs only from failed dimensions', () => {
    const qa = parseQaResult({
      verdict: 'regenerate',
      scores: {
        identity: 96, wheels: 96, lights: 96, paint: 96,
        angle_continuity: QA_SECONDARY_THRESHOLD - 1,
        camera_continuity: 95, environment: 95, artifact_free: 95,
      },
      confidence: 95,
      hard_failures: [],
      repair_instructions: [],
    });
    const repairs = deriveRepairInstructionsFromQa(qa);
    expect(repairs).toEqual([
      'correct only the rotation angle so it sits on the requested turntable angle and progresses in the correct direction; do not change identity details',
    ]);
    expect(repairs.join(' ')).not.toContain('wheel');
    expect(repairs.join(' ')).not.toContain('paint');
    expect(repairs.join(' ')).not.toContain('light');
  });

  it('repair prompt does not inject raw unrelated hard failures as random edit commands', () => {
    const qa = parseQaResult({
      verdict: 'regenerate',
      scores: {
        identity: 96, wheels: 96, lights: 96, paint: 96,
        angle_continuity: 96, camera_continuity: 96, environment: 96, artifact_free: 96,
      },
      confidence: 95,
      hard_failures: ['opaque_model_note_without_dimension'],
      repair_instructions: [],
    });
    const prompt = buildRepairPrompt({
      frameIndex: 0,
      angle: 0,
      frameCount: 48,
      identity: {},
      referenceLabels: ['ORIGINAL IDENTITY #1 at 45°'],
      hasDedicatedWheelReference: false,
      isKeyframe: true,
      attempt: 2,
      hardFailures: qa.hard_failures,
      repairInstructions: [],
      qaResult: qa,
    });
    expect(prompt).toContain('hard failure: opaque_model_note_without_dimension');
    expect(prompt).toContain('No below-threshold visual dimension was reported');
    expect(prompt).toContain('do not alter wheels, paint, lights');
  });
});

// ─── V2 Orchestrierung / Idempotenz / Guards ───────────────────────────
import {
  advanceFrame,
  advanceKeyframe,
  advanceValidation,
  billingMarker,
  hasBilled,
  isRenderableSpin,
  keyframeModelForAttempt,
  sectorBoundaryLabel,
  shouldSkipUnit,
  withBilling,
  SPIN_MODELS as V2_SPIN_MODELS,
  KEYFRAME_ANGLES as KF_ANGLES,
  buildBidirectionalOffsets as offsets48,
} from '../../supabase/functions/_shared/spin360-core';

describe('spin360 orchestration cursor', () => {
  it('läuft Keyframes einzeln durch und mündet in die Validierung', () => {
    expect(advanceKeyframe(0)).toEqual({ kind: 'next', cursor: { step: 'keyframes', keyframeIndex: 1 } });
    expect(advanceKeyframe(KF_ANGLES.length - 1)).toEqual({
      kind: 'next',
      cursor: { step: 'validate_keyframe', keyframeIndex: 0, attempt: 1 },
    });
  });

  it('validiert Keyframes einzeln und startet danach die Zwischenframes', () => {
    expect(advanceValidation(0, 1, true)).toEqual({
      kind: 'next', cursor: { step: 'validate_keyframe', keyframeIndex: 1, attempt: 1 },
    });
    expect(advanceValidation(7, 2, true)).toEqual({
      kind: 'next', cursor: { step: 'generate_frame', sector: 0, planPosition: 0, attempt: 1 },
    });
  });

  it('wiederholt einen Keyframe bis zum Limit und wird dann terminal', () => {
    expect(advanceValidation(3, 1, false, 4)).toEqual({
      kind: 'next', cursor: { step: 'validate_keyframe', keyframeIndex: 3, attempt: 2 },
    });
    const terminal = advanceValidation(3, 4, false, 4);
    expect(terminal.kind).toBe('terminal');
  });

  it('geht Zwischenframes Position für Position und Sektor für Sektor durch', () => {
    const planLength = offsets48(48).length;
    expect(advanceFrame(0, 0, 1, true, 48)).toEqual({
      kind: 'next', cursor: { step: 'generate_frame', sector: 0, planPosition: 1, attempt: 1 },
    });
    expect(advanceFrame(0, planLength - 1, 1, true, 48)).toEqual({
      kind: 'next', cursor: { step: 'generate_frame', sector: 1, planPosition: 0, attempt: 1 },
    });
    // Sektor 7 (Wrap 315° → 360°/0°) endet in assemble
    expect(advanceFrame(7, planLength - 1, 1, true, 48)).toEqual({
      kind: 'next', cursor: { step: 'assemble' },
    });
  });

  it('wiederholt einen Frame-Versuch und wird nach dem Limit terminal', () => {
    expect(advanceFrame(2, 1, 1, false, 48, 4)).toEqual({
      kind: 'next', cursor: { step: 'generate_frame', sector: 2, planPosition: 1, attempt: 2 },
    });
    expect(advanceFrame(2, 1, 4, false, 48, 4).kind).toBe('terminal');
  });

  it('überspringt bereits bestandene Einheiten (idempotenter Resume)', () => {
    expect(shouldSkipUnit([1, 5, 9], 5)).toBe(true);
    expect(shouldSkipUnit([1, 5, 9], 4)).toBe(false);
  });
});

describe('spin360 sector wrap + model routing', () => {
  it('benennt die Sektor-7-Grenze eindeutig', () => {
    expect(sectorBoundaryLabel(360)).toContain('0°');
    expect(sectorBoundaryLabel(45)).toBe('45°');
  });

  it('nutzt Standardmodell bei direktem Foto, Pro ohne Foto', () => {
    expect(keyframeModelForAttempt(1, true, 3)).toBe(V2_SPIN_MODELS.image);
    expect(keyframeModelForAttempt(3, true, 3)).toBe(V2_SPIN_MODELS.imagePro);
    expect(keyframeModelForAttempt(1, false, 3)).toBe(V2_SPIN_MODELS.imagePro);
  });
});

describe('spin360 billing idempotency', () => {
  it('markiert Abrechnungen genau einmal', () => {
    const marker = billingMarker('keyframe', 90);
    expect(hasBilled({}, marker)).toBe(false);
    const next = withBilling({}, marker);
    expect(hasBilled(next, marker)).toBe(true);
    expect((withBilling(next, marker).billing as string[]).length).toBe(1);
  });
});

describe('spin360 viewer completion guard', () => {
  const fullFrames = (n: number, status = 'passed') =>
    Array.from({ length: n }, (_, i) => ({ frame_index: i, validation_status: status }));

  it('rendert nur vollständige, bestandene Jobs', () => {
    expect(isRenderableSpin({ status: 'completed', targetFrameCount: 48, frames: fullFrames(48) })).toBe(true);
    expect(isRenderableSpin({ status: 'needs_review', targetFrameCount: 48, frames: fullFrames(48) })).toBe(false);
    expect(isRenderableSpin({ status: 'completed', targetFrameCount: 48, frames: fullFrames(47) })).toBe(false);
    expect(isRenderableSpin({ status: 'completed', targetFrameCount: 48, frames: fullFrames(48, 'failed') })).toBe(false);
  });
});
