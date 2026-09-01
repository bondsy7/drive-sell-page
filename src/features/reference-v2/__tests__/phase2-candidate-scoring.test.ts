import { describe, expect, it } from "vitest";
import {
  CandidateScoringError,
  TargetRelativeCandidateAssessmentSchema,
  assessTargetRelativeCandidate,
  parseTargetRelativeCandidateAssessment,
  surfaceVisibilityFromIntake,
  type TargetRelativeCandidateAssessment,
} from "../phase2/candidate-scoring";
import { REFERENCE_V2_PROVIDER_ID } from "../phase1-5/provider-adapter";
import { MIN_REQUIRED_SURFACE_VISIBILITY } from "../phase1/ingestion";
import { computeWeightedMatchScore } from "../domain/readiness";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type {
  IngestionBlockerCode,
  ReferenceAssetRecord,
  ReferenceRole,
  VehicleMasterRecord,
} from "../phase1/vehicle-master";
import type { ReferenceHardFailCode } from "../domain/readiness";
import type { ReferenceAnalysisRecord } from "../phase1-5/analysis-record";

const NOW_ISO = "2026-09-01T11:00:00.000Z";
const FUTURE_ISO = "2026-09-02T11:00:00.000Z";
const CLUSTER = "cluster_a";

const P_34_FRONT_LEFT: PerspectiveId = "EXT_34_FRONT_LEFT";
const P_SIDE_RIGHT: PerspectiveId = "EXT_SIDE_RIGHT";
const P_SIDE_LEFT: PerspectiveId = "EXT_SIDE_LEFT";
const P_FRONT: PerspectiveId = "EXT_FRONT";
const P_REAR: PerspectiveId = "EXT_REAR";
const HERO: PerspectiveId = "HERO_FRONT_LEFT";
const DET_HEADLIGHT_LEFT: PerspectiveId = "DET_HEADLIGHT_LEFT";
const INT_DASH: PerspectiveId = "INT_DASH_CENTER";

function analysis(
  overrides: Partial<ReferenceAnalysisRecord> = {},
): ReferenceAnalysisRecord {
  return {
    fileId: "files/abc",
    providerId: REFERENCE_V2_PROVIDER_ID,
    mimeType: "image/jpeg",
    fileExpiresAtIso: FUTURE_ISO,
    status: "analyzed",
    analyzerSchemaVersion: "1",
    analyzedAtIso: NOW_ISO,
    perspectiveConfidence: 0.92,
    ...overrides,
  };
}

function intake(overrides: Partial<VisionIntakeResult> = {}): VisionIntakeResult {
  return {
    schemaVersion: 1,
    assetId: "asset_1",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: CLUSTER,
    sameVehicleConfidence: 0.95,
    pose: { canonicalPerspectiveId: P_34_FRONT_LEFT, azimuthDeg: -45 },
    visibility: {
      front: 0.9,
      rear: 0.1,
      leftSide: 0.8,
      rightSide: 0.1,
      roof: 0.3,
    },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: ["front_left", "rear_left"],
    },
    quality: {
      sharpness: 0.9,
      occlusion: 0.05,
      glare: 0.05,
      resolutionAdequacy: 0.9,
      usableScore: 0.9,
    },
    classificationConfidence: 0.95,
    issues: [],
    ...overrides,
  };
}

interface AssetOverrides {
  readonly requestedPerspectiveId?: PerspectiveId;
  readonly intake?: VisionIntakeResult;
  readonly analysis?: ReferenceAnalysisRecord | undefined;
  readonly hardFailures?: readonly ReferenceHardFailCode[];
  readonly blockers?: readonly IngestionBlockerCode[];
  readonly role?: ReferenceRole;
  readonly scores?: Record<string, number>;
  readonly weightedScore?: number;
  readonly outputReadyFormats?: readonly string[];
}

function asset(o: AssetOverrides = {}): ReferenceAssetRecord {
  return {
    id: "asset_1",
    vehicleMasterId: "vm_1",
    requestedPerspectiveId: o.requestedPerspectiveId ?? P_34_FRONT_LEFT,
    fileName: "ref.jpg",
    previewUrl: "blob:preview",
    createdAtIso: NOW_ISO,
    intake: o.intake ?? intake(),
    analysis: "analysis" in o ? o.analysis : analysis(),
    scores: o.scores ?? {
      cameraAngle: 90,
      sideAndSurfaceCorrectness: 90,
      requiredSurfaceCoverage: 90,
      quality: 90,
      framing: 90,
    },
    weightedScore: o.weightedScore ?? 90,
    hardFailures: [...(o.hardFailures ?? [])],
    blockers: [...(o.blockers ?? [])],
    warnings: [],
    role: o.role ?? "primary",
    protection: "unprotected",
    outputReadyFormats: [...(o.outputReadyFormats ?? ["4:5"])],
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
  } as unknown as ReferenceAssetRecord;
}

function master(
  assets: readonly ReferenceAssetRecord[],
  overrides: Partial<VehicleMasterRecord> = {},
): VehicleMasterRecord {
  return {
    id: "vm_1",
    label: "Testfahrzeug",
    vehicleClass: "car",
    colorFamily: "grey",
    identityClusterId: CLUSTER,
    createdAtIso: NOW_ISO,
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
    assets: [...assets],
    ...overrides,
  } as unknown as VehicleMasterRecord;
}

function assessPrimary(
  a: ReferenceAssetRecord,
  target: PerspectiveId = P_34_FRONT_LEFT,
): TargetRelativeCandidateAssessment {
  return assessTargetRelativeCandidate({
    vehicleMaster: master([a]),
    assetId: a.id,
    targetPerspectiveId: target,
    intendedRole: "primary",
    nowIso: NOW_ISO,
  });
}

function assessSecondary(
  a: ReferenceAssetRecord,
  target: PerspectiveId = P_34_FRONT_LEFT,
): TargetRelativeCandidateAssessment {
  return assessTargetRelativeCandidate({
    vehicleMaster: master([a]),
    assetId: a.id,
    targetPerspectiveId: target,
    intendedRole: "secondary",
    nowIso: NOW_ISO,
  });
}

// --------------------------------------------------------------------------
// A — score recomputation
// --------------------------------------------------------------------------

describe("Phase 2.2 score recomputation", () => {
  it("computes the exact five components and weighted score for EXT_34_FRONT_LEFT", () => {
    const r = assessPrimary(asset());
    expect(r.scores).toEqual({
      cameraAngle: 100,
      sideAndSurfaceCorrectness: 80,
      requiredSurfaceCoverage: 85,
      quality: 92,
      framing: 100,
    });
    expect(r.weightedScore).toBe(computeWeightedMatchScore(r.scores));
    expect(r.weightedScore).toBe(91.95);
    expect(r.azimuthDeltaDeg).toBe(0);
  });

  it("ignores poisoned stored Phase-1 scores, weightedScore and outputReadyFormats", () => {
    const baseline = assessPrimary(asset());
    const poisoned = assessPrimary(
      asset({
        scores: {
          cameraAngle: 0,
          sideAndSurfaceCorrectness: 0,
          requiredSurfaceCoverage: 0,
          quality: 0,
          framing: 0,
        },
        weightedScore: 0,
        outputReadyFormats: [],
      }),
    );
    expect(poisoned).toEqual(baseline);
  });

  it("ignores asset.requestedPerspectiveId entirely", () => {
    const baseline = assessPrimary(asset());
    const relabelled = assessPrimary(
      asset({ requestedPerspectiveId: "DET_FUEL_FLAP" }),
    );
    expect(relabelled).toEqual(baseline);
  });
});

// --------------------------------------------------------------------------
// B — camera angle
// --------------------------------------------------------------------------

describe("Phase 2.2 camera angle", () => {
  it("scores 100 at the exact target azimuth", () => {
    expect(assessPrimary(asset()).scores.cameraAngle).toBe(100);
  });

  it("applies the exact Phase-1 curve for a known delta on EXT_SIDE_RIGHT", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_SIDE_RIGHT, azimuthDeg: 81 },
        }),
      }),
      P_SIDE_RIGHT,
    );
    // maxAzimuthErrorDeg = 9 => 100 - (9/9)*50 = 50
    expect(r.azimuthDeltaDeg).toBe(9);
    expect(r.scores.cameraAngle).toBe(50);
  });

  it("uses circular distance across the 180/-180 wraparound", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_REAR, azimuthDeg: -175 },
        }),
      }),
      P_REAR,
    );
    expect(r.azimuthDeltaDeg).toBe(5);
    // naive subtraction would be 355 deg and clamp the score to 0
    expect(r.scores.cameraAngle).toBe(72);
  });

  it("scores 100 for a detail target when the canonical perspective matches exactly", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: DET_HEADLIGHT_LEFT },
          visibility: {
            front: 0.4,
            rear: 0,
            leftSide: 0.4,
            rightSide: 0,
            roof: 0,
            surfaces: { headlight_left: 0.9 },
          },
        }),
      }),
      DET_HEADLIGHT_LEFT,
    );
    expect(r.azimuthDeltaDeg).toBeNull();
    expect(r.scores.cameraAngle).toBe(100);
  });

  it("scores 0 for a detail target when the canonical perspective differs", () => {
    const r = assessPrimary(
      asset({
        intake: intake({ pose: { canonicalPerspectiveId: DET_HEADLIGHT_LEFT } }),
      }),
      INT_DASH,
    );
    expect(r.azimuthDeltaDeg).toBeNull();
    expect(r.scores.cameraAngle).toBe(0);
  });

  it("caps the camera angle at 25 when a present elevation profile mismatches", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: {
            canonicalPerspectiveId: P_34_FRONT_LEFT,
            azimuthDeg: -45,
            elevationProfile: "low",
          },
        }),
      }),
    );
    expect(r.scores.cameraAngle).toBe(25);
  });

  it("does not invent an elevation mismatch when the intake profile is absent", () => {
    expect(assessPrimary(asset()).scores.cameraAngle).toBe(100);
  });

  it("does not cap when the present elevation profile matches the target", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: {
            canonicalPerspectiveId: P_34_FRONT_LEFT,
            azimuthDeg: -45,
            elevationProfile: "standard",
          },
        }),
      }),
    );
    expect(r.scores.cameraAngle).toBe(100);
  });
});

// --------------------------------------------------------------------------
// C — surface evidence
// --------------------------------------------------------------------------

describe("Phase 2.2 required surface evidence", () => {
  it("treats a missing non-core surface as 0 and unproven", () => {
    const r = assessPrimary(
      asset({
        intake: intake({ pose: { canonicalPerspectiveId: DET_HEADLIGHT_LEFT } }),
      }),
      DET_HEADLIGHT_LEFT,
    );
    expect(r.requiredSurfaceEvidence).toEqual([
      { surface: "headlight_left", visibility: 0, met: false },
    ]);
    expect(r.provenRequiredSurfaces).toEqual([]);
    expect(r.unprovenRequiredSurfaces).toEqual(["headlight_left"]);
    expect(r.allRequiredSurfacesMet).toBe(false);
  });

  it("counts exact threshold equality as met", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: DET_HEADLIGHT_LEFT },
          visibility: {
            front: 0,
            rear: 0,
            leftSide: 0,
            rightSide: 0,
            roof: 0,
            surfaces: { headlight_left: MIN_REQUIRED_SURFACE_VISIBILITY },
          },
        }),
      }),
      DET_HEADLIGHT_LEFT,
    );
    expect(r.requiredSurfaceEvidence[0].met).toBe(true);
    expect(r.allRequiredSurfacesMet).toBe(true);
  });

  it("uses referenceRequirements.requiredCoverageSurfaces in registry order for an interior target", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: INT_DASH },
          visibility: {
            front: 0,
            rear: 0,
            leftSide: 0,
            rightSide: 0,
            roof: 0,
            surfaces: { dashboard: 0.9, center_console: 0.7 },
          },
        }),
      }),
      INT_DASH,
    );
    expect(r.requiredSurfaceEvidence.map((e) => e.surface)).toEqual([
      "dashboard",
      "infotainment",
      "center_console",
    ]);
    expect(r.provenRequiredSurfaces).toEqual(["dashboard", "center_console"]);
    expect(r.unprovenRequiredSurfaces).toEqual(["infotainment"]);
    expect(r.allRequiredSurfacesMet).toBe(false);
    // exact disjoint partition
    expect(
      [...r.provenRequiredSurfaces, ...r.unprovenRequiredSurfaces].sort(),
    ).toEqual(["center_console", "dashboard", "infotainment"]);
    // mean of 0.9 / 0 / 0.7
    expect(r.scores.requiredSurfaceCoverage).toBe(53);
  });

  it("exposes the surface visibility adapter fail-closed", () => {
    const i = intake();
    expect(surfaceVisibilityFromIntake(i, "front")).toBe(0.9);
    expect(surfaceVisibilityFromIntake(i, "left_side")).toBe(0.8);
    expect(surfaceVisibilityFromIntake(i, "roof")).toBe(0.3);
    expect(surfaceVisibilityFromIntake(i, "steering_wheel")).toBe(0);
  });
});

// --------------------------------------------------------------------------
// D — side score
// --------------------------------------------------------------------------

describe("Phase 2.2 side and surface correctness", () => {
  it("scores wanted*100 when the required right side dominates", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_SIDE_RIGHT, azimuthDeg: 90 },
          visibility: {
            front: 0.2,
            rear: 0.2,
            leftSide: 0.1,
            rightSide: 0.85,
            roof: 0.2,
          },
        }),
      }),
      P_SIDE_RIGHT,
    );
    expect(r.scores.sideAndSurfaceCorrectness).toBe(85);
  });

  it("scores 0 when the opposite side dominates", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_SIDE_RIGHT, azimuthDeg: 90 },
          visibility: {
            front: 0.2,
            rear: 0.2,
            leftSide: 0.9,
            rightSide: 0.2,
            roof: 0.2,
          },
        }),
      }),
      P_SIDE_RIGHT,
    );
    expect(r.scores.sideAndSurfaceCorrectness).toBe(0);
  });

  it("scores 0 when the required side is not visible at all", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_SIDE_LEFT, azimuthDeg: -90 },
          visibility: {
            front: 0,
            rear: 0,
            leftSide: 0,
            rightSide: 0,
            roof: 0,
          },
        }),
      }),
      P_SIDE_LEFT,
    );
    expect(r.scores.sideAndSurfaceCorrectness).toBe(0);
  });

  it("scores 100 for a non-side-sensitive target such as EXT_FRONT", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_FRONT, azimuthDeg: 0 },
          visibility: {
            front: 0.95,
            rear: 0,
            leftSide: 0.5,
            rightSide: 0.5,
            roof: 0.2,
          },
        }),
      }),
      P_FRONT,
    );
    expect(r.scores.sideAndSurfaceCorrectness).toBe(100);
  });

  it("never turns a side score of 0 into a new hard failure", () => {
    const r = assessSecondary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_SIDE_RIGHT, azimuthDeg: 90 },
          visibility: {
            front: 0.2,
            rear: 0.2,
            leftSide: 0.9,
            rightSide: 0.2,
            roof: 0.2,
          },
        }),
      }),
      P_SIDE_RIGHT,
    );
    expect(r.scores.sideAndSurfaceCorrectness).toBe(0);
    expect(r.rankable).toBe(true);
    expect(r.eligibility.hardFailures).toEqual([]);
  });
});

// --------------------------------------------------------------------------
// E — quality and framing
// --------------------------------------------------------------------------

describe("Phase 2.2 quality and framing", () => {
  it("recomputes the exact quality formula from the current intake", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          quality: {
            sharpness: 0.8,
            occlusion: 0.2,
            glare: 0.1,
            resolutionAdequacy: 0.7,
            usableScore: 0.6,
          },
        }),
      }),
    );
    // (0.8 + 0.7 + 0.6 + 0.8 + 0.9) / 5 = 0.76
    expect(r.scores.quality).toBe(76);
  });

  it("scores framing 0 for a cropped image on a full-vehicle target", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          framing: {
            fullVehicleVisible: false,
            cropped: true,
            visibleWheelPositions: [],
          },
        }),
      }),
    );
    expect(r.scores.framing).toBe(0);
  });

  it("scores framing 80 for a cropped image on a detail target", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: DET_HEADLIGHT_LEFT },
          framing: {
            fullVehicleVisible: false,
            cropped: true,
            visibleWheelPositions: [],
          },
        }),
      }),
      DET_HEADLIGHT_LEFT,
    );
    expect(r.scores.framing).toBe(80);
  });
});

// --------------------------------------------------------------------------
// F — wheel evidence
// --------------------------------------------------------------------------

describe("Phase 2.2 wheel evidence", () => {
  it("follows the registry wheel order and reports visibility", () => {
    const r = assessPrimary(asset());
    expect(r.requiredWheelEvidence).toEqual([
      { wheelPosition: "front_left", visible: true },
      { wheelPosition: "rear_left", visible: true },
    ]);
    expect(r.allRequiredWheelsVisible).toBe(true);
  });

  it("reports a missing required wheel", () => {
    const r = assessPrimary(
      asset({
        intake: intake({
          framing: {
            fullVehicleVisible: true,
            cropped: false,
            visibleWheelPositions: ["front_left"],
          },
        }),
      }),
    );
    expect(r.requiredWheelEvidence).toEqual([
      { wheelPosition: "front_left", visible: true },
      { wheelPosition: "rear_left", visible: false },
    ]);
    expect(r.allRequiredWheelsVisible).toBe(false);
  });

  it("treats an empty required wheel set as satisfied", () => {
    const r = assessPrimary(
      asset({
        intake: intake({ pose: { canonicalPerspectiveId: DET_HEADLIGHT_LEFT } }),
      }),
      DET_HEADLIGHT_LEFT,
    );
    expect(r.requiredWheelEvidence).toEqual([]);
    expect(r.allRequiredWheelsVisible).toBe(true);
  });
});

// --------------------------------------------------------------------------
// G — eligibility separation
// --------------------------------------------------------------------------

describe("Phase 2.2 eligibility separation", () => {
  it("keeps a diagnostic score for an intrinsically blocked candidate but rankable=false", () => {
    const r = assessPrimary(
      asset({ blockers: ["CROP_VIOLATION"], role: "rejected" }),
    );
    expect(r.weightedScore).toBe(91.95);
    expect(r.rankable).toBe(false);
    expect(r.eligibility.selectable).toBe(false);
    expect(r.contributesToTarget).toBe(false);
  });

  it("a high score never creates eligibility", () => {
    const r = assessPrimary(
      asset({ hardFailures: ["MIRRORED_REFERENCE"], role: "rejected" }),
    );
    expect(r.weightedScore).toBeGreaterThan(90);
    expect(r.rankable).toBe(false);
  });

  it("a safe secondary with a proven target surface gets scopes and contributes", () => {
    const r = assessSecondary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_34_FRONT_LEFT, azimuthDeg: -45 },
          visibility: {
            front: 0.6,
            rear: 0.1,
            leftSide: 0.2,
            rightSide: 0.9,
            roof: 0.2,
          },
        }),
      }),
      P_SIDE_RIGHT,
    );
    expect(r.rankable).toBe(true);
    expect(r.provenRequiredSurfaces).toEqual(["right_side"]);
    expect(r.secondaryScopes).toEqual(["right_side"]);
    expect(r.contributesToTarget).toBe(true);
  });

  it("a safe secondary proving no target surface stays selectable but does not contribute", () => {
    const r = assessSecondary(asset(), P_SIDE_RIGHT);
    expect(r.rankable).toBe(true);
    expect(r.provenRequiredSurfaces).toEqual([]);
    expect(r.secondaryScopes).toEqual([]);
    expect(r.contributesToTarget).toBe(false);
    expect(r.eligibility.reasons.some((x) => x.severity === "BLOCKING")).toBe(
      false,
    );
  });

  it("primary candidates never carry secondary scopes", () => {
    const r = assessPrimary(asset());
    expect(r.intendedRole).toBe("primary");
    expect(r.secondaryScopes).toEqual([]);
    expect(r.provenRequiredSurfaces).toEqual(["front", "left_side"]);
    expect(r.contributesToTarget).toBe(true);
  });
});

// --------------------------------------------------------------------------
// H — Hero
// --------------------------------------------------------------------------

describe("Phase 2.2 hero geometry", () => {
  it("scores HERO_FRONT_LEFT against EXT_34_FRONT_LEFT geometry", () => {
    const hero = assessPrimary(asset(), HERO);
    const base = assessPrimary(asset(), P_34_FRONT_LEFT);
    expect(hero.referenceGeometryPerspectiveId).toBe(P_34_FRONT_LEFT);
    expect(hero.targetPerspectiveId).toBe(HERO);
    expect(hero.scores).toEqual(base.scores);
    expect(hero.weightedScore).toBe(base.weightedScore);
    expect(hero.azimuthDeltaDeg).toBe(base.azimuthDeltaDeg);
    expect(hero.requiredSurfaceEvidence).toEqual(base.requiredSurfaceEvidence);
    expect(hero.requiredWheelEvidence).toEqual(base.requiredWheelEvidence);
    expect(hero.provenRequiredSurfaces).toEqual(base.provenRequiredSurfaces);
  });
});

// --------------------------------------------------------------------------
// I — thresholds
// --------------------------------------------------------------------------

describe("Phase 2.2 spec thresholds", () => {
  it("uses spec.referenceRequirements.minPrimaryQualityScore", () => {
    expect(assessPrimary(asset()).primaryQualityThresholdMet).toBe(true);
    const low = assessPrimary(
      asset({
        intake: intake({
          quality: {
            sharpness: 0.9,
            occlusion: 0.05,
            glare: 0.05,
            resolutionAdequacy: 0.9,
            usableScore: 0.5,
          },
        }),
      }),
    );
    expect(low.primaryQualityThresholdMet).toBe(false);
  });

  it("uses spec.validationRules.minimumPerspectiveScore", () => {
    // 91.95 < 92
    expect(assessPrimary(asset()).minimumPerspectiveScoreMet).toBe(false);
    const strong = assessPrimary(
      asset({
        intake: intake({
          visibility: {
            front: 1,
            rear: 0.1,
            leftSide: 1,
            rightSide: 0.1,
            roof: 0.3,
          },
        }),
      }),
    );
    expect(strong.minimumPerspectiveScoreMet).toBe(true);
  });
});

// --------------------------------------------------------------------------
// J — contract invariants
// --------------------------------------------------------------------------

describe("Phase 2.2 result contract", () => {
  const valid = (): TargetRelativeCandidateAssessment =>
    JSON.parse(JSON.stringify(assessPrimary(asset())));

  it("accepts a well-formed assessment", () => {
    expect(() => parseTargetRelativeCandidateAssessment(valid())).not.toThrow();
  });

  it("rejects a rankable contradiction", () => {
    const v = { ...valid(), rankable: false };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects a weightedScore contradiction", () => {
    const v = { ...valid(), weightedScore: 12 };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects an overlapping proven/unproven partition", () => {
    const base = valid();
    const v = {
      ...base,
      unprovenRequiredSurfaces: [...base.provenRequiredSurfaces],
    };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects a missing partition member", () => {
    const base = valid();
    const v = { ...base, provenRequiredSurfaces: ["front"] };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects a primary carrying secondaryScopes", () => {
    const base = valid();
    const v = { ...base, secondaryScopes: ["front"] };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects a secondary whose scopes differ from the proven set", () => {
    const base: TargetRelativeCandidateAssessment = JSON.parse(
      JSON.stringify(assessSecondary(asset())),
    );
    const v = { ...base, secondaryScopes: ["front"] };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects a contributesToTarget contradiction", () => {
    const v = { ...valid(), contributesToTarget: false };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects an allRequiredSurfacesMet contradiction", () => {
    const v = { ...valid(), allRequiredSurfacesMet: false };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects an allRequiredWheelsVisible contradiction", () => {
    const v = { ...valid(), allRequiredWheelsVisible: false };
    expect(
      TargetRelativeCandidateAssessmentSchema.safeParse(v).success,
    ).toBe(false);
  });

  it("rejects an invalid input shape loudly", () => {
    expect(() =>
      assessTargetRelativeCandidate({ assetId: "asset_1" }),
    ).toThrow(CandidateScoringError);
  });
});

// --------------------------------------------------------------------------
// K — determinism
// --------------------------------------------------------------------------

describe("Phase 2.2 determinism", () => {
  it("returns deep-equal results for identical input", () => {
    const a = assessPrimary(asset());
    const b = assessPrimary(asset());
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
