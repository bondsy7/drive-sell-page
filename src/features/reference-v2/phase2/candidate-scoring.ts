import { z } from "zod";
import {
  PerspectiveIdSchema,
  isSideSensitivePerspective,
  type PerspectiveId,
} from "../domain/perspectives/types";
import { getPerspectiveSpec } from "../domain/perspectives/registry";
import { circularAzimuthDeltaDeg } from "../domain/angles";
import {
  VisualSurfaceSchema,
  WheelPositionSchema,
  type VisualSurface,
} from "../domain/surfaces";
import {
  MatchComponentScoresSchema,
  computeWeightedMatchScore,
  type MatchComponentScores,
} from "../domain/readiness";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type { ReferenceAssetRecord, VehicleMasterRecord } from "../phase1/vehicle-master";
import { MIN_REQUIRED_SURFACE_VISIBILITY } from "../phase1/ingestion";
import { getPerspectiveMasterEntry } from "../phase1/perspective-master";
import { resolveReferenceGeometryPerspectiveId } from "./planner-contract";
import {
  AssetEligibilityInputSchema,
  AssetEligibilityResultSchema,
  EligibilityIntendedRoleSchema,
  evaluateAssetEligibility,
  type AssetEligibilityInput,
} from "./eligibility";

/**
 * Reference V2 — Phase 2.2: PURE TARGET-RELATIVE CANDIDATE SCORING.
 *
 * Diese Datei bewertet GENAU EIN Asset gegen GENAU EINE Zielperspektive.
 * Sie waehlt NICHTS aus: kein Primary, kein Secondary-Set, kein Ranking,
 * keine Coverage-Aggregation, keine Adjazenz, keine Substitution.
 *
 * KERNPRINZIP: Autoritaeten sind ausschliesslich (a) die aktuelle visuelle
 * Analyse (Vision Intake) und (b) die Ziel-PerspectiveSpec bzw. deren
 * Referenzgeometrie. Gespeicherte Phase-1-Felder (`asset.scores`,
 * `asset.weightedScore`, `asset.outputReadyFormats`,
 * `asset.requestedPerspectiveId`) beeinflussen NICHTS in Phase 2.2.
 *
 * Phase-2.1-Eligibility bleibt das Sicherheits-Gate: ein hoher Score darf
 * niemals Eligibility erzeugen.
 *
 * Reine Funktion: kein I/O, keine Provider-Aufrufe, keine Persistenz.
 */

// --------------------------------------------------------------------------
// Input contract — identisch zu Phase 2.1
// --------------------------------------------------------------------------

export const CandidateScoringInputSchema = AssetEligibilityInputSchema;
export type CandidateScoringInput = AssetEligibilityInput;

// --------------------------------------------------------------------------
// Result contract
// --------------------------------------------------------------------------

export const RequiredSurfaceEvidenceSchema = z
  .object({
    surface: VisualSurfaceSchema,
    visibility: z.number().min(0).max(1),
    met: z.boolean(),
  })
  .strict();
export type RequiredSurfaceEvidence = z.infer<
  typeof RequiredSurfaceEvidenceSchema
>;

export const RequiredWheelEvidenceSchema = z
  .object({
    wheelPosition: WheelPositionSchema,
    visible: z.boolean(),
  })
  .strict();
export type RequiredWheelEvidence = z.infer<typeof RequiredWheelEvidenceSchema>;

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export const TargetRelativeCandidateAssessmentSchema = z
  .object({
    assetId: z.string().min(1),
    targetPerspectiveId: PerspectiveIdSchema,
    referenceGeometryPerspectiveId: PerspectiveIdSchema,
    detectedPerspectiveId: PerspectiveIdSchema.nullable(),
    intendedRole: EligibilityIntendedRoleSchema,
    eligibility: AssetEligibilityResultSchema,
    rankable: z.boolean(),
    scores: MatchComponentScoresSchema,
    weightedScore: z.number().min(0).max(100),
    azimuthDeltaDeg: z.number().min(0).max(180).nullable(),
    requiredSurfaceEvidence: z.array(RequiredSurfaceEvidenceSchema),
    provenRequiredSurfaces: z.array(VisualSurfaceSchema),
    unprovenRequiredSurfaces: z.array(VisualSurfaceSchema),
    allRequiredSurfacesMet: z.boolean(),
    requiredWheelEvidence: z.array(RequiredWheelEvidenceSchema),
    allRequiredWheelsVisible: z.boolean(),
    primaryQualityThresholdMet: z.boolean(),
    minimumPerspectiveScoreMet: z.boolean(),
    contributesToTarget: z.boolean(),
    secondaryScopes: z.array(VisualSurfaceSchema),
  })
  .strict()
  .superRefine((v, ctx) => {
    const fail = (path: (string | number)[], message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    };

    // Mirror-Invarianten gegenueber der Eligibility
    if (v.rankable !== v.eligibility.selectable) {
      fail(["rankable"], "rankable must exactly equal eligibility.selectable");
    }
    if (v.assetId !== v.eligibility.assetId) {
      fail(["assetId"], "assetId must mirror eligibility.assetId");
    }
    if (v.targetPerspectiveId !== v.eligibility.targetPerspectiveId) {
      fail(
        ["targetPerspectiveId"],
        "targetPerspectiveId must mirror eligibility.targetPerspectiveId",
      );
    }
    if (
      v.referenceGeometryPerspectiveId !==
      v.eligibility.referenceGeometryPerspectiveId
    ) {
      fail(
        ["referenceGeometryPerspectiveId"],
        "referenceGeometryPerspectiveId must mirror eligibility",
      );
    }
    if (v.detectedPerspectiveId !== v.eligibility.detectedPerspectiveId) {
      fail(
        ["detectedPerspectiveId"],
        "detectedPerspectiveId must mirror eligibility",
      );
    }
    if (v.intendedRole !== v.eligibility.intendedRole) {
      fail(["intendedRole"], "intendedRole must mirror eligibility");
    }

    // Weighted score
    if (v.weightedScore !== computeWeightedMatchScore(v.scores)) {
      fail(
        ["weightedScore"],
        "weightedScore must equal computeWeightedMatchScore(scores)",
      );
    }

    // Surface evidence
    const evidenceSurfaces = v.requiredSurfaceEvidence.map((e) => e.surface);
    if (new Set(evidenceSurfaces).size !== evidenceSurfaces.length) {
      fail(
        ["requiredSurfaceEvidence"],
        "requiredSurfaceEvidence must be unique by surface",
      );
    }
    if (new Set(v.provenRequiredSurfaces).size !== v.provenRequiredSurfaces.length) {
      fail(["provenRequiredSurfaces"], "provenRequiredSurfaces must be unique");
    }
    if (
      new Set(v.unprovenRequiredSurfaces).size !==
      v.unprovenRequiredSurfaces.length
    ) {
      fail(
        ["unprovenRequiredSurfaces"],
        "unprovenRequiredSurfaces must be unique",
      );
    }
    const provenSet = new Set<VisualSurface>(v.provenRequiredSurfaces);
    const unprovenSet = new Set<VisualSurface>(v.unprovenRequiredSurfaces);
    const partitionOk =
      v.provenRequiredSurfaces.length + v.unprovenRequiredSurfaces.length ===
        evidenceSurfaces.length &&
      evidenceSurfaces.every(
        (s) =>
          (provenSet.has(s) ? 1 : 0) + (unprovenSet.has(s) ? 1 : 0) === 1,
      ) &&
      v.provenRequiredSurfaces.every((s) => evidenceSurfaces.includes(s)) &&
      v.unprovenRequiredSurfaces.every((s) => evidenceSurfaces.includes(s));
    if (!partitionOk) {
      fail(
        ["provenRequiredSurfaces"],
        "proven and unproven surfaces must form an exact disjoint partition of the evidence surfaces",
      );
    }
    // Registry-Reihenfolge beibehalten
    if (
      partitionOk &&
      (!sameOrder(
        v.provenRequiredSurfaces,
        evidenceSurfaces.filter((s) => provenSet.has(s)),
      ) ||
        !sameOrder(
          v.unprovenRequiredSurfaces,
          evidenceSurfaces.filter((s) => unprovenSet.has(s)),
        ))
    ) {
      fail(
        ["provenRequiredSurfaces"],
        "proven/unproven surfaces must preserve the evidence (registry) order",
      );
    }
    for (const e of v.requiredSurfaceEvidence) {
      if (e.met !== provenSet.has(e.surface)) {
        fail(
          ["requiredSurfaceEvidence"],
          `met flag for ${e.surface} must match membership in provenRequiredSurfaces`,
        );
      }
    }
    if (v.allRequiredSurfacesMet !== (v.unprovenRequiredSurfaces.length === 0)) {
      fail(
        ["allRequiredSurfacesMet"],
        "allRequiredSurfacesMet must equal unprovenRequiredSurfaces.length === 0",
      );
    }

    // Wheel evidence
    const wheels = v.requiredWheelEvidence.map((w) => w.wheelPosition);
    if (new Set(wheels).size !== wheels.length) {
      fail(
        ["requiredWheelEvidence"],
        "requiredWheelEvidence must be unique by wheelPosition",
      );
    }
    if (
      v.allRequiredWheelsVisible !==
      v.requiredWheelEvidence.every((w) => w.visible)
    ) {
      fail(
        ["allRequiredWheelsVisible"],
        "allRequiredWheelsVisible must equal every(requiredWheelEvidence.visible)",
      );
    }

    // Secondary scopes
    if (new Set(v.secondaryScopes).size !== v.secondaryScopes.length) {
      fail(["secondaryScopes"], "secondaryScopes must be unique");
    }
    if (!v.secondaryScopes.every((s) => provenSet.has(s))) {
      fail(
        ["secondaryScopes"],
        "secondaryScopes must be a subset of provenRequiredSurfaces",
      );
    }
    if (v.intendedRole === "primary" && v.secondaryScopes.length > 0) {
      fail(
        ["secondaryScopes"],
        "primary candidates must not carry secondaryScopes",
      );
    }
    if (
      v.intendedRole === "secondary" &&
      !sameOrder(v.secondaryScopes, v.provenRequiredSurfaces)
    ) {
      fail(
        ["secondaryScopes"],
        "secondary candidates must scope exactly the proven required surfaces (registry order)",
      );
    }

    // Contribution
    if (
      v.contributesToTarget !==
      (v.rankable && v.provenRequiredSurfaces.length > 0)
    ) {
      fail(
        ["contributesToTarget"],
        "contributesToTarget must equal (rankable && provenRequiredSurfaces.length > 0)",
      );
    }
  });

export type TargetRelativeCandidateAssessment = z.infer<
  typeof TargetRelativeCandidateAssessmentSchema
>;

export class CandidateScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateScoringError";
  }
}

export function parseCandidateScoringInput(
  value: unknown,
): CandidateScoringInput {
  const parsed = CandidateScoringInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new CandidateScoringError(
      `invalid candidate scoring input: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

export function parseTargetRelativeCandidateAssessment(
  value: unknown,
): TargetRelativeCandidateAssessment {
  const parsed = TargetRelativeCandidateAssessmentSchema.safeParse(value);
  if (!parsed.success) {
    throw new CandidateScoringError(
      `invalid target-relative candidate assessment: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

// --------------------------------------------------------------------------
// Surface visibility adapter (fail-closed)
// --------------------------------------------------------------------------

/**
 * Sichtbarkeit einer Flaeche aus dem aktuellen Intake. FAIL-CLOSED: fehlende
 * Detail-/Interior-Beobachtungen zaehlen als 0, niemals optimistisch.
 */
export function surfaceVisibilityFromIntake(
  intake: VisionIntakeResult,
  surface: VisualSurface,
): number {
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
      return v.surfaces?.[surface] ?? 0;
  }
}

// --------------------------------------------------------------------------
// Evaluator
// --------------------------------------------------------------------------

function findAsset(
  master: VehicleMasterRecord,
  assetId: string,
): ReferenceAssetRecord {
  const asset = master.assets.find((a) => a.id === assetId);
  if (!asset) {
    throw new CandidateScoringError(`asset ${assetId} not found in master`);
  }
  return asset;
}

/** Erwartete Fahrzeugseite — exakt wie Phase 1 aus der Registry abgeleitet. */
function requiredSideForGeometry(
  geometryId: PerspectiveId,
): "left_side" | "right_side" | null {
  const spec = getPerspectiveSpec(geometryId);
  if (!isSideSensitivePerspective(spec)) return null;
  if (spec.requiredVisibleSurfaces.includes("right_side")) return "right_side";
  if (spec.requiredVisibleSurfaces.includes("left_side")) return "left_side";
  return null;
}

/**
 * Bewertet EIN Asset gegen EINE Zielperspektive. Rein, deterministisch,
 * ohne I/O. Waehlt nichts aus.
 */
export function assessTargetRelativeCandidate(
  rawInput: unknown,
): TargetRelativeCandidateAssessment {
  const input = parseCandidateScoringInput(rawInput);
  const eligibility = evaluateAssetEligibility(input);

  const asset = findAsset(input.vehicleMaster, input.assetId);
  const intake = asset.intake;

  const referenceGeometryPerspectiveId = resolveReferenceGeometryPerspectiveId(
    input.targetPerspectiveId,
  );
  const spec = getPerspectiveSpec(referenceGeometryPerspectiveId);
  const masterEntry = getPerspectiveMasterEntry(referenceGeometryPerspectiveId);
  const detectedPerspectiveId = intake.pose.canonicalPerspectiveId ?? null;

  // --- A cameraAngle ------------------------------------------------------
  let azimuthDeltaDeg: number | null = null;
  let cameraAngle: number;
  if (masterEntry.azimuthDeg !== null && intake.pose.azimuthDeg !== undefined) {
    azimuthDeltaDeg = circularAzimuthDeltaDeg(
      intake.pose.azimuthDeg,
      masterEntry.azimuthDeg,
    );
    const maxError = masterEntry.maxAzimuthErrorDeg ?? 10;
    cameraAngle = Math.max(
      0,
      Math.round(100 - (azimuthDeltaDeg / maxError) * 50),
    );
  } else {
    cameraAngle =
      detectedPerspectiveId === referenceGeometryPerspectiveId ? 100 : 0;
  }
  // Elevations-Sicherheit: nur bei VORHANDENEM Intake-Profil.
  const intakeElevation = intake.pose.elevationProfile;
  if (
    intakeElevation !== undefined &&
    intakeElevation !== spec.pose.elevationProfile
  ) {
    cameraAngle = Math.min(cameraAngle, 25);
  }

  // --- B sideAndSurfaceCorrectness ---------------------------------------
  const side = requiredSideForGeometry(referenceGeometryPerspectiveId);
  let sideAndSurfaceCorrectness = 100;
  if (side !== null) {
    const wanted = surfaceVisibilityFromIntake(intake, side);
    const opposite = surfaceVisibilityFromIntake(
      intake,
      side === "right_side" ? "left_side" : "right_side",
    );
    sideAndSurfaceCorrectness =
      wanted <= 0 || wanted <= opposite ? 0 : Math.round(wanted * 100);
  }

  // --- Surface evidence (Registry-Reihenfolge) ----------------------------
  const coverageSurfaces = spec.referenceRequirements.requiredCoverageSurfaces;
  if (coverageSurfaces.length === 0) {
    throw new CandidateScoringError(
      `registry invariant broken: ${referenceGeometryPerspectiveId} has an empty requiredCoverageSurfaces set`,
    );
  }
  const requiredSurfaceEvidence: RequiredSurfaceEvidence[] =
    coverageSurfaces.map((surface) => {
      const visibility = surfaceVisibilityFromIntake(intake, surface);
      return {
        surface,
        visibility,
        met: visibility >= MIN_REQUIRED_SURFACE_VISIBILITY,
      };
    });
  const provenRequiredSurfaces = requiredSurfaceEvidence
    .filter((e) => e.met)
    .map((e) => e.surface);
  const unprovenRequiredSurfaces = requiredSurfaceEvidence
    .filter((e) => !e.met)
    .map((e) => e.surface);

  // --- C requiredSurfaceCoverage -----------------------------------------
  const requiredSurfaceCoverage = Math.round(
    (requiredSurfaceEvidence.reduce((acc, e) => acc + e.visibility, 0) /
      requiredSurfaceEvidence.length) *
      100,
  );

  // --- D quality ----------------------------------------------------------
  const q = intake.quality;
  const quality = Math.round(
    ((q.sharpness +
      q.resolutionAdequacy +
      q.usableScore +
      (1 - q.occlusion) +
      (1 - q.glare)) /
      5) *
      100,
  );

  // --- E framing ----------------------------------------------------------
  const framing =
    intake.framing.fullVehicleVisible && !intake.framing.cropped
      ? 100
      : spec.framing.fullVehicle
        ? 0
        : 80;

  const scores: MatchComponentScores = {
    cameraAngle,
    sideAndSurfaceCorrectness,
    requiredSurfaceCoverage,
    quality,
    framing,
  };
  const weightedScore = computeWeightedMatchScore(scores);

  // --- Wheel evidence -----------------------------------------------------
  const requiredWheelEvidence: RequiredWheelEvidence[] =
    spec.framing.requiredVisibleWheels.map((wheelPosition) => ({
      wheelPosition,
      visible: intake.framing.visibleWheelPositions.includes(wheelPosition),
    }));

  const rankable = eligibility.selectable;
  const secondaryScopes: VisualSurface[] =
    input.intendedRole === "secondary" ? [...provenRequiredSurfaces] : [];

  return parseTargetRelativeCandidateAssessment({
    assetId: input.assetId,
    targetPerspectiveId: input.targetPerspectiveId,
    referenceGeometryPerspectiveId,
    detectedPerspectiveId,
    intendedRole: input.intendedRole,
    eligibility,
    rankable,
    scores,
    weightedScore,
    azimuthDeltaDeg,
    requiredSurfaceEvidence,
    provenRequiredSurfaces,
    unprovenRequiredSurfaces,
    allRequiredSurfacesMet: unprovenRequiredSurfaces.length === 0,
    requiredWheelEvidence,
    allRequiredWheelsVisible: requiredWheelEvidence.every((w) => w.visible),
    primaryQualityThresholdMet:
      q.usableScore >= spec.referenceRequirements.minPrimaryQualityScore,
    minimumPerspectiveScoreMet:
      weightedScore >= spec.validationRules.minimumPerspectiveScore,
    contributesToTarget: rankable && provenRequiredSurfaces.length > 0,
    secondaryScopes,
  });
}
