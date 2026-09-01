import {
  computeWeightedMatchScore,
  evaluateReferenceCandidate,
  type MatchComponentScores,
  type ReferenceHardFailCode,
  type ReferenceReadinessStatus,
} from "../domain/readiness";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type { PerspectiveId } from "../domain/perspectives/types";
import { getPerspectiveSpec } from "../domain/perspectives/registry";
import { isSideSensitivePerspective } from "../domain/perspectives/types";
import { circularAzimuthDeltaDeg } from "../domain/angles";
import type { VehicleClassV2 } from "../domain/vehicle-classes";
import { getPerspectiveMasterEntry, requiredPerspectivesForClass } from "./perspective-master";
import {
  evaluateOutputFormatReadiness,
  isFullyOutputReady,
  type OutputFormat,
  type SourceFramingInput,
} from "./output-format-policy";
import {
  BLOCKER_LABELS_DE,
  type CompletenessWarning,
  type IngestionBlockerCode,
  type PerspectiveCoverage,
  type ReferenceAssetRecord,
  type ReferenceRole,
  type VehicleMasterRecord,
} from "./vehicle-master";

/**
 * Reference V2 — Phase 1: Ingestion Governance.
 *
 * Fail-closed: jeder Blocker (Phase-0-Hard-Fail oder Phase-1-Bildfehler)
 * degradiert das Asset auf `rejected`. Nur exakt passende, blockerfreie
 * Referenzen sind Primary-faehig; alles andere darf ausschliesslich als
 * Secondary-Support im Review erscheinen und wird NIEMALS Primary.
 */

/** Qualitaets-/Framing-Schwellen der Phase-1-Ingestion. */
export const INGESTION_THRESHOLDS = {
  maxOcclusionSeverity: 0.35,
  maxGlareSeverity: 0.4,
  minResolutionAdequacy: 0.5,
  minUsableScore: 0.5,
  /** Ab dieser Abweichung ist eine Perspektive nicht mehr Primary-faehig. */
  secondaryAzimuthFactor: 2,
} as const;

export interface IngestionInput {
  readonly vehicleClass: VehicleClassV2;
  readonly identityClusterId: string;
  readonly requestedPerspectiveId: PerspectiveId;
  readonly intake: VisionIntakeResult;
  readonly framing: SourceFramingInput;
  readonly fileAvailable: boolean;
  /**
   * true nur fuer den automatischen KI-Intake (Phase 1.5). Der manuelle
   * Diagnosepfad ist per Konstruktion NIE Primary-faehig: fehlt dieses Flag,
   * kann das Asset strukturell hoechstens `secondary_support` werden.
   */
  readonly isAutomatic?: boolean;
}

export interface IngestionEvaluation {
  readonly hardFailures: readonly ReferenceHardFailCode[];
  readonly blockers: readonly IngestionBlockerCode[];
  readonly warnings: readonly string[];
  readonly scores: MatchComponentScores;
  readonly weightedScore: number;
  readonly role: Extract<ReferenceRole, "primary_candidate" | "secondary_support" | "rejected">;
  readonly outputReadyFormats: readonly OutputFormat[];
  readonly azimuthErrorDeg: number | null;
}

function surfaceVisibility(intake: VisionIntakeResult, surface: string): number {
  const v = intake.visibility;
  switch (surface) {
    case "front":
      return v.front;
    case "rear":
      return v.rear;
    case "left_side":
      return v.leftSide;
    case "right_side":
      return v.rightSide;
    case "roof":
      return v.roof;
    default:
      return v.surfaces?.[surface as keyof typeof v.surfaces] ?? 1;
  }
}

/** Erwartete Fahrzeugseite einer side-sensitiven Perspektive. */
function requiredSide(perspectiveId: PerspectiveId): "left_side" | "right_side" | null {
  const spec = getPerspectiveSpec(perspectiveId);
  if (!isSideSensitivePerspective(spec)) return null;
  if (spec.requiredVisibleSurfaces.includes("right_side")) return "right_side";
  if (spec.requiredVisibleSurfaces.includes("left_side")) return "left_side";
  return null;
}

export function evaluateIngestion(input: IngestionInput): IngestionEvaluation {
  const spec = getPerspectiveSpec(input.requestedPerspectiveId);
  const master = getPerspectiveMasterEntry(input.requestedPerspectiveId);
  const intake = input.intake;

  const hardFailures: ReferenceHardFailCode[] = [];
  const extra: IngestionBlockerCode[] = [];
  const warnings: string[] = [];

  // --- Phase 0 hard fails -------------------------------------------------
  if (!input.fileAvailable) hardFailures.push("FILE_UNAVAILABLE");
  if (!intake.vehicleDetected) hardFailures.push("NO_VEHICLE_DETECTED");
  if (intake.vehicleClass && intake.vehicleClass !== input.vehicleClass) {
    hardFailures.push("VEHICLE_CLASS_MISMATCH");
  }
  if (
    intake.identityClusterId &&
    intake.identityClusterId !== input.identityClusterId
  ) {
    hardFailures.push("IDENTITY_CLUSTER_CONFLICT");
  }
  if (intake.issues.some((i) => i.code === "MIRRORED_SUSPECTED")) {
    hardFailures.push("MIRRORED_REFERENCE");
  }

  const side = requiredSide(input.requestedPerspectiveId);
  let sideScore = 100;
  if (side) {
    const wanted = surfaceVisibility(intake, side);
    const opposite = surfaceVisibility(
      intake,
      side === "left_side" ? "right_side" : "left_side",
    );
    if (opposite > wanted) {
      hardFailures.push("WRONG_VEHICLE_SIDE");
      sideScore = 0;
    } else {
      sideScore = Math.round(wanted * 100);
    }
  }

  // --- Phase 1 imagery governance ----------------------------------------
  let azimuthErrorDeg: number | null = null;
  let angleScore = 100;
  if (master.azimuthDeg !== null && intake.pose.azimuthDeg !== undefined) {
    azimuthErrorDeg = circularAzimuthDeltaDeg(
      intake.pose.azimuthDeg,
      master.azimuthDeg,
    );
    const maxError = master.maxAzimuthErrorDeg ?? 10;
    angleScore = Math.max(0, Math.round(100 - (azimuthErrorDeg / maxError) * 50));
    if (azimuthErrorDeg > maxError * INGESTION_THRESHOLDS.secondaryAzimuthFactor) {
      extra.push("PERSPECTIVE_MISMATCH");
    } else if (azimuthErrorDeg > maxError) {
      warnings.push(
        `Perspektive weicht um ${azimuthErrorDeg.toFixed(1)}° ab (Toleranz ${maxError}°) — nur Secondary.`,
      );
    }
  } else if (
    intake.pose.canonicalPerspectiveId &&
    intake.pose.canonicalPerspectiveId !== input.requestedPerspectiveId
  ) {
    extra.push("PERSPECTIVE_MISMATCH");
  }

  if (master.fullVehicle && (intake.framing.cropped || !intake.framing.fullVehicleVisible)) {
    extra.push("CROP_VIOLATION");
  }
  if (intake.quality.occlusion > INGESTION_THRESHOLDS.maxOcclusionSeverity) {
    extra.push("OCCLUSION_VIOLATION");
  }
  if (intake.quality.glare > INGESTION_THRESHOLDS.maxGlareSeverity) {
    extra.push("GLARE_VIOLATION");
  }
  if (
    intake.quality.resolutionAdequacy < INGESTION_THRESHOLDS.minResolutionAdequacy ||
    intake.quality.usableScore < INGESTION_THRESHOLDS.minUsableScore
  ) {
    extra.push("RESOLUTION_VIOLATION");
  }

  // --- Scores (Phase 0 weights) ------------------------------------------
  const coverage =
    spec.requiredVisibleSurfaces.reduce(
      (acc, s) => acc + surfaceVisibility(intake, s),
      0,
    ) / spec.requiredVisibleSurfaces.length;

  const missingWheels = spec.framing.requiredVisibleWheels.filter(
    (w) => !intake.framing.visibleWheelPositions.includes(w),
  );
  if (missingWheels.length > 0) {
    warnings.push(`Nicht sichtbare Pflichträder: ${missingWheels.join(", ")}`);
  }

  const scores: MatchComponentScores = {
    cameraAngle: angleScore,
    sideAndSurfaceCorrectness: sideScore,
    requiredSurfaceCoverage: Math.round(coverage * 100),
    quality: Math.round(
      ((intake.quality.sharpness +
        intake.quality.resolutionAdequacy +
        intake.quality.usableScore +
        (1 - intake.quality.occlusion) +
        (1 - intake.quality.glare)) /
        5) *
        100,
    ),
    framing:
      intake.framing.fullVehicleVisible && !intake.framing.cropped
        ? 100
        : master.fullVehicle
          ? 0
          : 80,
  };

  const evaluation = evaluateReferenceCandidate(scores, hardFailures);
  const blockers: IngestionBlockerCode[] = [...hardFailures, ...extra];

  const formatReadiness = evaluateOutputFormatReadiness(
    input.requestedPerspectiveId,
    input.framing,
  );
  const outputReadyFormats = formatReadiness
    .filter((r) => r.ready)
    .map((r) => r.format);
  for (const r of formatReadiness) {
    if (!r.ready) warnings.push(`${r.format}: ${r.reason ?? "nicht ausgabefähig"}`);
  }
  if (input.isAutomatic !== true) {
    warnings.push(
      "Manuelle Diagnose-Erfassung: kann niemals Primary-Referenz werden.",
    );
  }

  let role: IngestionEvaluation["role"];
  if (blockers.length > 0) {
    role = "rejected";
  } else if (
    input.isAutomatic === true &&
    evaluation.eligible &&
    evaluation.weightedScore >= master.minimumPerspectiveScore &&
    warnings.every((w) => !w.startsWith("Perspektive weicht"))
  ) {
    role = "primary_candidate";
  } else {
    role = "secondary_support";
  }

  return {
    hardFailures,
    blockers,
    warnings,
    scores,
    weightedScore: computeWeightedMatchScore(scores),
    role,
    outputReadyFormats,
    azimuthErrorDeg,
    // isFullyOutputReady bleibt als Convenience fuer die UI verfuegbar
  };
}

export function assetIsFullyOutputReady(asset: ReferenceAssetRecord): boolean {
  return isFullyOutputReady(
    asset.outputReadyFormats.map((format) => ({ format, ready: true })),
  );
}

/**
 * Nur Assets, die als `primary_candidate` bewertet wurden, duerfen Primary
 * werden. Secondary-Support-Assets sind strukturell ausgeschlossen.
 */
export function canBecomePrimary(asset: ReferenceAssetRecord): boolean {
  return (
    asset.blockers.length === 0 &&
    asset.hardFailures.length === 0 &&
    (asset.role === "primary" || asset.role === "primary_candidate")
  );
}

function readinessStatus(
  primary: ReferenceAssetRecord | undefined,
  secondaries: readonly ReferenceAssetRecord[],
  rejected: readonly ReferenceAssetRecord[],
): ReferenceReadinessStatus {
  if (primary && secondaries.length > 0) return "READY_MULTI_REFERENCE";
  if (primary) return "READY_EXACT";
  if (secondaries.length > 0) return "NEEDS_CONFIRMATION";
  if (rejected.some((a) => a.hardFailures.includes("FILE_UNAVAILABLE"))) {
    return "BLOCKED_FILE_UNAVAILABLE";
  }
  if (
    rejected.some((a) =>
      a.hardFailures.some((c) =>
        ["IDENTITY_CLUSTER_CONFLICT", "VEHICLE_CLASS_MISMATCH", "NO_VEHICLE_DETECTED"].includes(c),
      ),
    )
  ) {
    return "BLOCKED_IDENTITY_CONFLICT";
  }
  return "INSUFFICIENT_REFERENCE";
}

export function computeCoverage(
  record: VehicleMasterRecord,
): readonly PerspectiveCoverage[] {
  const required = requiredPerspectivesForClass(record.vehicleClass);
  const ids = new Set<PerspectiveId>([
    ...required,
    ...record.assets.map((a) => a.requestedPerspectiveId),
  ]);
  return [...ids].map((perspectiveId) => {
    const assets = record.assets.filter(
      (a) => a.requestedPerspectiveId === perspectiveId,
    );
    const primary = assets.find((a) => a.role === "primary");
    const secondaries = assets.filter(
      (a) => a.role === "secondary_support" || a.role === "primary_candidate",
    );
    const rejected = assets.filter((a) => a.role === "rejected");
    return {
      perspectiveId,
      required: required.includes(perspectiveId),
      primary,
      secondaries,
      rejected,
      status: readinessStatus(primary, secondaries, rejected),
    };
  });
}

export function computeCompletenessWarnings(
  record: VehicleMasterRecord,
): readonly CompletenessWarning[] {
  const warnings: CompletenessWarning[] = [];
  if (!record.colorFamily) {
    warnings.push({
      code: "MISSING_COLOR_FAMILY",
      message: "Keine Farbfamilie zugewiesen.",
    });
  }
  for (const coverage of computeCoverage(record)) {
    const label = getPerspectiveMasterEntry(coverage.perspectiveId).labelDe;
    if (coverage.required && coverage.primary === undefined) {
      if (coverage.secondaries.length === 0 && coverage.rejected.length === 0) {
        warnings.push({
          code: "MISSING_REQUIRED_PERSPECTIVE",
          perspectiveId: coverage.perspectiveId,
          message: `Pflichtperspektive fehlt: ${label}`,
        });
      } else if (coverage.secondaries.length > 0) {
        warnings.push({
          code: "ONLY_SECONDARY_AVAILABLE",
          perspectiveId: coverage.perspectiveId,
          message: `${label}: nur Secondary-Referenzen — keine Primärreferenz freigegeben.`,
        });
      } else {
        warnings.push({
          code: "NO_PRIMARY_FOR_PERSPECTIVE",
          perspectiveId: coverage.perspectiveId,
          message: `${label}: alle Referenzen abgewiesen.`,
        });
      }
    }
    if (coverage.primary && !assetIsFullyOutputReady(coverage.primary)) {
      warnings.push({
        code: "OUTPUT_FORMAT_NOT_READY",
        perspectiveId: coverage.perspectiveId,
        message: `${label}: Primärreferenz erfüllt 4:5 + 1.91:1 nicht vollständig.`,
      });
    }
    if (coverage.rejected.length > 0) {
      warnings.push({
        code: "REJECTED_ASSETS_PRESENT",
        perspectiveId: coverage.perspectiveId,
        message: `${label}: ${coverage.rejected.length} abgewiesene Referenz(en) — ${coverage.rejected
          .flatMap((a) => a.blockers)
          .map((b) => BLOCKER_LABELS_DE[b])
          .join(", ")}`,
      });
    }
  }
  return warnings;
}
