/**
 * Spin360 V2 — öffentliche, reine API (Edge Functions).
 *
 * Dieses Modul ist die einzige Importquelle für V2-Logik in Edge Functions.
 * Es enthält KEINE Netz-, DB- oder Deno-Abhängigkeiten und ist damit
 * vollständig unit-testbar. Legacy-Jobs (Video2Frames, Manifest v1) werden
 * hier bewusst nicht angefasst.
 */

export * from "./spin360-core.ts";

import {
  ANGLE_TOLERANCE_DEG,
  DEFAULT_FRAME_COUNT,
  KEYFRAME_ANGLES,
  SUPPORTED_FRAME_COUNTS,
  aggregateQuality,
  angleForIndex,
  buildBidirectionalOffsets,
  frameIndexForAngle,
  framesPerSector,
  isSupportedFrameCount,
  planAllSectors,
  planSector,
  type FrameQualityInput,
  type PlannedFrame,
  type QualityAggregate,
  type SpinFrameTier,
} from "./spin360-core.ts";

/** Alias mit der im Audit geforderten Benennung. */
export const indexForAngle = frameIndexForAngle;

/**
 * Strikte Validierung: nur 32 (Diagnose) und 48 (Produktion) sind erlaubt.
 * Wirft bewusst, damit kein Job mit einem Fantasieraster startet.
 */
export function validateFrameCount(count: unknown): SpinFrameTier {
  const n = Number(count);
  if (!isSupportedFrameCount(n)) {
    throw new Error(
      `Unsupported target_frame_count: ${String(count)} (allowed: ${SUPPORTED_FRAME_COUNTS.join(", ")})`,
    );
  }
  return n;
}

/** Wie `validateFrameCount`, fällt aber auf den Produktionswert 48 zurück. */
export function validateFrameCountOrDefault(count: unknown): SpinFrameTier {
  try {
    return validateFrameCount(count);
  } catch {
    return DEFAULT_FRAME_COUNT;
  }
}

/**
 * Sektorplan (bidirektional). `sector` 7 ist der Wrap-Sektor 315° → 0°:
 * der End-Keyframe ist Index 0, die Zwischenframes bleiben < frameCount.
 */
export function buildSectorPlan(sector: number, frameCount: number): PlannedFrame[] {
  validateFrameCount(frameCount);
  if (!Number.isInteger(sector) || sector < 0 || sector >= KEYFRAME_ANGLES.length) {
    throw new Error(`Invalid sector: ${sector}`);
  }
  return planSector(sector, frameCount);
}

/** Vollständiger Plan aller Sektoren in Ausführungsreihenfolge. */
export function buildFullPlan(frameCount: number): PlannedFrame[] {
  validateFrameCount(frameCount);
  return planAllSectors(frameCount);
}

export interface CompletionResult extends QualityAggregate {
  /** Fehlende Frame-Indizes (0 … frameCount-1). */
  missingIndices: number[];
  /** Indizes, die existieren, aber die QA nicht bestanden haben. */
  failedIndices: number[];
  /** Indizes, deren Winkel nicht exakt auf dem Raster liegen. */
  offGridIndices: number[];
  status: "completed" | "needs_review";
}

/**
 * Abschluss-Entscheidung — fail closed.
 * "completed" nur bei exakt targetFrameCount eindeutigen Indizes 0…n-1,
 * jedem Frame `passed` und jedem Winkel exakt auf dem Raster (±0.001°).
 */
export function evaluateCompletion(
  frames: FrameQualityInput[],
  targetFrameCount: number,
): CompletionResult {
  validateFrameCount(targetFrameCount);
  const unique = new Map<number, FrameQualityInput>();
  for (const f of frames) if (!unique.has(f.frame_index)) unique.set(f.frame_index, f);

  const missingIndices: number[] = [];
  const failedIndices: number[] = [];
  const offGridIndices: number[] = [];

  for (let i = 0; i < targetFrameCount; i++) {
    const frame = unique.get(i);
    if (!frame) {
      missingIndices.push(i);
      continue;
    }
    if (frame.validation_status !== "passed") failedIndices.push(i);
    const angle = frame.angle_degrees;
    if (angle === null || angle === undefined) {
      offGridIndices.push(i);
      continue;
    }
    const expected = angleForIndex(i, targetFrameCount);
    const diff = Math.abs(Number(angle) - expected);
    if (Math.min(diff, 360 - diff) > ANGLE_TOLERANCE_DEG) offGridIndices.push(i);
  }

  const aggregate = aggregateQuality(frames, targetFrameCount);
  const complete =
    missingIndices.length === 0 &&
    failedIndices.length === 0 &&
    offGridIndices.length === 0 &&
    unique.size === targetFrameCount;

  return {
    ...aggregate,
    complete,
    missingIndices,
    failedIndices,
    offGridIndices,
    status: complete ? "completed" : "needs_review",
  };
}

export { KEYFRAME_ANGLES, buildBidirectionalOffsets, framesPerSector };
