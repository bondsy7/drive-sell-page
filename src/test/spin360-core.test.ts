import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FRAME_COUNT,
  KEYFRAME_ANGLES,
  MAX_FRAME_ATTEMPTS,
  QA_IDENTITY_THRESHOLD,
  SPIN_MODELS,
  aggregateQuality,
  angleForIndex,
  angleGrid,
  angleStep,
  buildIntermediatePrompt,
  buildKeyframePrompt,
  buildManifest,
  buildQaPrompt,
  coverageScore,
  frameIndexForAngle,
  framesPerSector,
  isQaPassed,
  keyframeIndices,
  modelForAttempt,
  normalizeFrameCount,
  parseQaResult,
  planAllSectors,
  planSector,
  type QaResult,
} from '../../supabase/functions/_shared/spin360-core';

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
      angle_continuity: 92, camera_continuity: 90, environment: 95, artifact_free: 93,
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
    expect(manifest.direction).toBe('cw');
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
