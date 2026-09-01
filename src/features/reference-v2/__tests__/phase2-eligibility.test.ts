import { describe, expect, it } from "vitest";
import {
  AssetEligibilityError,
  AssetEligibilityInputSchema,
  AssetEligibilityResultSchema,
  evaluateAssetEligibility,
  parseAssetEligibilityResult,
} from "../phase2/eligibility";
import { MIN_SAME_VEHICLE_CONFIDENCE } from "../phase1-5/analyzer-contract";
import { REFERENCE_V2_PROVIDER_ID } from "../phase1-5/provider-adapter";
import { resolvePerspectiveIdsForClass } from "../domain/capability-profiles";
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
const PAST_ISO = "2026-08-31T11:00:00.000Z";
const CLUSTER = "cluster_a";

const P_34_FRONT_LEFT: PerspectiveId = "EXT_34_FRONT_LEFT";
const P_SIDE_RIGHT: PerspectiveId = "EXT_SIDE_RIGHT";
const P_FRONT: PerspectiveId = "EXT_FRONT";
const HERO: PerspectiveId = "HERO_FRONT_LEFT";

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
    pose: { canonicalPerspectiveId: P_34_FRONT_LEFT, azimuthDeg: 45 },
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
      visibleWheelPositions: ["front_left", "front_right"],
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
    scores: {
      perspective: 90,
      identity: 90,
      surfaceCoverage: 90,
      quality: 90,
      framing: 90,
    },
    weightedScore: 90,
    hardFailures: [...(o.hardFailures ?? [])],
    blockers: [...(o.blockers ?? [])],
    warnings: [],
    role: o.role ?? "primary",
    protection: "unprotected",
    outputReadyFormats: ["4:5"],
    version: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
  } as ReferenceAssetRecord;
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
  } as VehicleMasterRecord;
}

function evalPrimary(
  a: ReferenceAssetRecord,
  target: PerspectiveId = P_34_FRONT_LEFT,
  m: VehicleMasterRecord = master([a]),
) {
  return evaluateAssetEligibility({
    vehicleMaster: m,
    assetId: a.id,
    targetPerspectiveId: target,
    intendedRole: "primary",
    nowIso: NOW_ISO,
  });
}

function evalSecondary(
  a: ReferenceAssetRecord,
  target: PerspectiveId = P_34_FRONT_LEFT,
  m: VehicleMasterRecord = master([a]),
) {
  return evaluateAssetEligibility({
    vehicleMaster: m,
    assetId: a.id,
    targetPerspectiveId: target,
    intendedRole: "secondary",
    nowIso: NOW_ISO,
  });
}

function codes(result: { reasons: readonly { code: string }[] }): string[] {
  return result.reasons.map((r) => r.code);
}

function blockingCodes(result: {
  reasons: readonly { code: string; severity: string }[];
}): string[] {
  return result.reasons.filter((r) => r.severity === "BLOCKING").map((r) => r.code);
}

// --------------------------------------------------------------------------

describe("Phase 2.1 input contract", () => {
  it("rejects an assetId that is not in the master", () => {
    expect(() =>
      evaluateAssetEligibility({
        vehicleMaster: master([asset()]),
        assetId: "asset_missing",
        targetPerspectiveId: P_34_FRONT_LEFT,
        intendedRole: "primary",
        nowIso: NOW_ISO,
      }),
    ).toThrow(AssetEligibilityError);
  });

  it("rejects a duplicated assetId in the master", () => {
    const dup = master([asset(), asset()]);
    expect(
      AssetEligibilityInputSchema.safeParse({
        vehicleMaster: dup,
        assetId: "asset_1",
        targetPerspectiveId: P_34_FRONT_LEFT,
        intendedRole: "primary",
        nowIso: NOW_ISO,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-ISO nowIso", () => {
    expect(() =>
      evaluateAssetEligibility({
        vehicleMaster: master([asset()]),
        assetId: "asset_1",
        targetPerspectiveId: P_34_FRONT_LEFT,
        intendedRole: "primary",
        nowIso: "01.09.2026",
      }),
    ).toThrow(AssetEligibilityError);
  });

  it("rejects unknown input keys and unknown roles", () => {
    expect(
      AssetEligibilityInputSchema.safeParse({
        vehicleMaster: master([asset()]),
        assetId: "asset_1",
        targetPerspectiveId: P_34_FRONT_LEFT,
        intendedRole: "tertiary",
        nowIso: NOW_ISO,
      }).success,
    ).toBe(false);
  });
});

describe("Phase 2.1 lifecycle (A)", () => {
  it("blocks a missing analysis record", () => {
    const r = evalPrimary(asset({ analysis: undefined }));
    expect(r.selectable).toBe(false);
    expect(blockingCodes(r)).toContain("NO_ANALYSIS_RECORD");
  });

  it("blocks pending analysis", () => {
    const r = evalPrimary(asset({ analysis: analysis({ status: "pending" }) }));
    expect(r.selectable).toBe(false);
    expect(blockingCodes(r)).toContain("FILE_NOT_ANALYZED");
  });

  it("blocks failed analysis", () => {
    const r = evalPrimary(asset({ analysis: analysis({ status: "failed" }) }));
    expect(blockingCodes(r)).toContain("FILE_NOT_ANALYZED");
  });

  it("blocks a foreign provider", () => {
    const r = evalPrimary(
      asset({ analysis: analysis({ providerId: "openai-files" }) }),
    );
    expect(blockingCodes(r)).toContain("FILE_PROVIDER_INVALID");
  });

  it("blocks a missing MIME type", () => {
    const r = evalPrimary(
      asset({ analysis: analysis({ mimeType: undefined }) }),
    );
    expect(blockingCodes(r)).toContain("FILE_MIME_INVALID");
  });

  it("blocks a disallowed MIME type", () => {
    const r = evalPrimary(
      asset({ analysis: analysis({ mimeType: "image/gif" }) }),
    );
    expect(blockingCodes(r)).toContain("FILE_MIME_INVALID");
  });

  it("blocks an expired file reference", () => {
    const r = evalPrimary(
      asset({ analysis: analysis({ fileExpiresAtIso: PAST_ISO }) }),
    );
    expect(r.selectable).toBe(false);
    expect(blockingCodes(r)).toContain("FILE_EXPIRED");
  });

  it("keeps a missing expiry selectable but review-flagged", () => {
    const r = evalPrimary(
      asset({ analysis: analysis({ fileExpiresAtIso: undefined }) }),
    );
    expect(r.selectable).toBe(true);
    expect(r.reviewRequired).toBe(true);
    expect(codes(r)).toContain("FILE_EXPIRY_UNKNOWN");
  });

  it("fails closed on a malformed expiry without throwing", () => {
    const a = asset({ analysis: analysis({ fileExpiresAtIso: "irgendwann" }) });
    const r = evalPrimary(a);
    expect(r.selectable).toBe(false);
    const reason = r.reasons.find((x) => x.code === "FILE_EXPIRY_UNKNOWN");
    expect(reason?.severity).toBe("BLOCKING");
    expect(reason?.messageDe).toContain("Lifecycle-Zeitstempel ungültig");
  });
});

describe("Phase 2.1 intrinsic safety (B)", () => {
  it("blocks when no vehicle was detected", () => {
    const r = evalPrimary(
      asset({ intake: intake({ vehicleDetected: false }) }),
    );
    expect(r.selectable).toBe(false);
    expect(r.hardFailures).toContain("NO_VEHICLE_DETECTED");
  });

  it("blocks a missing visual vehicle class", () => {
    const r = evalPrimary(asset({ intake: intake({ vehicleClass: undefined }) }));
    expect(r.hardFailures).toContain("VEHICLE_CLASS_MISMATCH");
    expect(blockingCodes(r)).toContain("VEHICLE_CLASS_NOT_APPLICABLE");
  });

  it("blocks a mismatched visual vehicle class", () => {
    const r = evalPrimary(asset({ intake: intake({ vehicleClass: "truck" }) }));
    expect(r.hardFailures).toContain("VEHICLE_CLASS_MISMATCH");
  });

  it("blocks a missing identity cluster", () => {
    const r = evalPrimary(
      asset({ intake: intake({ identityClusterId: undefined }) }),
    );
    expect(r.hardFailures).toContain("IDENTITY_CLUSTER_CONFLICT");
    expect(blockingCodes(r)).toContain("IDENTITY_CLUSTER_MIXED");
  });

  it("blocks a mixed identity cluster", () => {
    const r = evalPrimary(
      asset({ intake: intake({ identityClusterId: "cluster_b" }) }),
    );
    expect(r.hardFailures).toContain("IDENTITY_CLUSTER_CONFLICT");
  });

  it("blocks MIRRORED_SUSPECTED even when stored arrays are empty", () => {
    const r = evalPrimary(
      asset({
        intake: intake({
          issues: [
            {
              code: "MIRRORED_SUSPECTED",
              severity: "critical",
              message: "gespiegelt",
            },
          ],
        }),
      }),
    );
    expect(r.selectable).toBe(false);
    expect(r.hardFailures).toContain("MIRRORED_REFERENCE");
    expect(blockingCodes(r)).toContain("MIRROR_RISK");
  });

  it("blocks IDENTITY_MISMATCH issues", () => {
    const r = evalPrimary(
      asset({
        intake: intake({
          issues: [
            {
              code: "IDENTITY_MISMATCH",
              severity: "critical",
              message: "anderes Fahrzeug",
            },
          ],
        }),
      }),
    );
    expect(r.hardFailures).toContain("IDENTITY_CLUSTER_CONFLICT");
    expect(blockingCodes(r)).toContain("IDENTITY_CLUSTER_MIXED");
  });

  it("flags low same-vehicle confidence as review but keeps it selectable", () => {
    const r = evalPrimary(
      asset({
        intake: intake({
          sameVehicleConfidence: MIN_SAME_VEHICLE_CONFIDENCE - 0.1,
        }),
      }),
    );
    expect(r.selectable).toBe(true);
    expect(r.reviewRequired).toBe(true);
    expect(codes(r)).toContain("IDENTITY_CONFIDENCE_LOW");
  });

  it("treats a missing sameVehicleConfidence as acceptable", () => {
    const r = evalPrimary(
      asset({ intake: intake({ sameVehicleConfidence: undefined }) }),
    );
    expect(r.selectable).toBe(true);
    expect(codes(r)).not.toContain("IDENTITY_CONFIDENCE_LOW");
  });
});

describe("Phase 2.1 visual truth vs stale Phase-1 target (C)", () => {
  const staleAsset = () =>
    asset({
      requestedPerspectiveId: P_SIDE_RIGHT,
      intake: intake({
        pose: { canonicalPerspectiveId: P_34_FRONT_LEFT, azimuthDeg: 45 },
      }),
      blockers: ["PERSPECTIVE_MISMATCH", "WRONG_VEHICLE_SIDE"],
      hardFailures: ["WRONG_VEHICLE_SIDE"],
      role: "rejected",
    });

  it("allows the analyzer-detected perspective despite stale target-relative codes", () => {
    const r = evalPrimary(staleAsset(), P_34_FRONT_LEFT);
    expect(r.selectable).toBe(true);
    expect(r.exactPerspective).toBe(true);
    expect(r.reviewRequired).toBe(true);
    expect(codes(r)).toContain("PRIMARY_NOT_PROMOTED");
    expect(r.hardFailures).toEqual([]);
    expect(r.intrinsicBlockers).toEqual([]);
    expect([...r.ignoredLegacyTargetRelativeCodes].sort()).toEqual([
      "PERSPECTIVE_MISMATCH",
      "WRONG_VEHICLE_SIDE",
    ]);
  });

  it("blocks the same asset for the historical admin target", () => {
    const r = evalPrimary(staleAsset(), P_SIDE_RIGHT);
    expect(r.selectable).toBe(false);
    expect(r.exactPerspective).toBe(false);
    expect(blockingCodes(r)).toContain("EXACT_REFERENCE_MISSING");
  });

  it("keeps a stored GLARE_VIOLATION intrinsic even when the target matches", () => {
    const r = evalPrimary(
      asset({
        blockers: ["GLARE_VIOLATION", "PERSPECTIVE_MISMATCH"],
        role: "rejected",
      }),
    );
    expect(r.selectable).toBe(false);
    expect(r.intrinsicBlockers).toEqual(["GLARE_VIOLATION"]);
    expect(r.ignoredLegacyTargetRelativeCodes).toEqual(["PERSPECTIVE_MISMATCH"]);
  });

  it("never uses requestedPerspectiveId as detected perspective", () => {
    const r = evalPrimary(staleAsset(), P_34_FRONT_LEFT);
    expect(r.detectedPerspectiveId).toBe(P_34_FRONT_LEFT);
  });
});

describe("Phase 2.1 side safety (D)", () => {
  const sideIntake = (rightSide: number, leftSide: number) =>
    intake({
      pose: { canonicalPerspectiveId: P_SIDE_RIGHT, azimuthDeg: 90 },
      visibility: {
        front: 0.2,
        rear: 0.2,
        leftSide,
        rightSide,
        roof: 0.2,
      },
    });

  it("blocks when the opposite side dominates", () => {
    const r = evalPrimary(
      asset({ intake: sideIntake(0.2, 0.9) }),
      P_SIDE_RIGHT,
    );
    expect(r.selectable).toBe(false);
    expect(blockingCodes(r)).toContain("SIDE_EVIDENCE_MISSING");
  });

  it("blocks when the required side evidence is zero", () => {
    const r = evalPrimary(asset({ intake: sideIntake(0, 0) }), P_SIDE_RIGHT);
    expect(blockingCodes(r)).toContain("SIDE_EVIDENCE_MISSING");
  });

  it("allows a dominant required side", () => {
    const r = evalPrimary(
      asset({ intake: sideIntake(0.95, 0.05) }),
      P_SIDE_RIGHT,
    );
    expect(r.selectable).toBe(true);
    expect(codes(r)).not.toContain("SIDE_EVIDENCE_MISSING");
  });

  it("does not side-fail a non-side-sensitive perspective", () => {
    const r = evalPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_FRONT, azimuthDeg: 0 },
          visibility: {
            front: 0.95,
            rear: 0.05,
            leftSide: 0.5,
            rightSide: 0.5,
            roof: 0.2,
          },
        }),
      }),
      P_FRONT,
    );
    expect(r.selectable).toBe(true);
    expect(codes(r)).not.toContain("SIDE_EVIDENCE_MISSING");
  });
});

describe("Phase 2.1 roles (E)", () => {
  it("accepts a promoted primary without PRIMARY_NOT_PROMOTED", () => {
    const r = evalPrimary(asset({ role: "primary" }));
    expect(r.selectable).toBe(true);
    expect(r.reviewRequired).toBe(false);
    expect(codes(r)).toEqual([]);
  });

  it("flags primary_candidate with PRIMARY_NOT_PROMOTED", () => {
    const r = evalPrimary(asset({ role: "primary_candidate" }));
    expect(r.selectable).toBe(true);
    expect(r.reviewRequired).toBe(true);
    expect(codes(r)).toContain("PRIMARY_NOT_PROMOTED");
  });

  it("lets secondary_support pass primary eligibility with review", () => {
    const r = evalPrimary(asset({ role: "secondary_support" }));
    expect(r.selectable).toBe(true);
    expect(codes(r)).toContain("PRIMARY_NOT_PROMOTED");
  });

  it("blocks a rejected asset that carries an intrinsic blocker", () => {
    const r = evalPrimary(
      asset({ blockers: ["CROP_VIOLATION"], role: "rejected" }),
    );
    expect(r.selectable).toBe(false);
    expect(r.intrinsicBlockers).toEqual(["CROP_VIOLATION"]);
  });

  it("blocks a rejected asset that carries an intrinsic hard failure", () => {
    const r = evalPrimary(
      asset({ hardFailures: ["FILE_UNAVAILABLE"], role: "rejected" }),
    );
    expect(r.selectable).toBe(false);
    expect(r.hardFailures).toEqual(["FILE_UNAVAILABLE"]);
  });

  it("allows a safe secondary_support without exact target match", () => {
    const r = evalSecondary(
      asset({ role: "secondary_support" }),
      P_SIDE_RIGHT,
    );
    expect(r.selectable).toBe(true);
    expect(r.exactPerspective).toBe(false);
    expect(codes(r)).not.toContain("EXACT_REFERENCE_MISSING");
    expect(codes(r)).not.toContain("PRIMARY_NOT_PROMOTED");
  });

  it("does not apply target side dominance to secondaries", () => {
    const r = evalSecondary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: P_SIDE_RIGHT, azimuthDeg: 90 },
          visibility: {
            front: 0.2,
            rear: 0.2,
            leftSide: 0.9,
            rightSide: 0.1,
            roof: 0.2,
          },
        }),
        role: "secondary_support",
      }),
      P_SIDE_RIGHT,
    );
    expect(r.selectable).toBe(true);
    expect(codes(r)).not.toContain("SIDE_EVIDENCE_MISSING");
  });

  it("still applies intrinsic safety to secondaries", () => {
    const r = evalSecondary(
      asset({ intake: intake({ identityClusterId: "cluster_b" }) }),
      P_SIDE_RIGHT,
    );
    expect(r.selectable).toBe(false);
  });
});

describe("Phase 2.1 hero reference geometry (F)", () => {
  it("accepts a hero target whose analyzer geometry is the base perspective", () => {
    const r = evalPrimary(asset(), HERO);
    expect(r.referenceGeometryPerspectiveId).toBe(P_34_FRONT_LEFT);
    expect(r.exactPerspective).toBe(true);
    expect(r.selectable).toBe(true);
  });

  it("blocks a hero target whose analyzer geometry is the hero id itself", () => {
    const r = evalPrimary(
      asset({
        intake: intake({
          pose: { canonicalPerspectiveId: HERO, azimuthDeg: 45 },
        }),
      }),
      HERO,
    );
    expect(r.exactPerspective).toBe(false);
    expect(r.selectable).toBe(false);
    expect(blockingCodes(r)).toContain("EXACT_REFERENCE_MISSING");
  });
});

describe("Phase 2.1 class applicability (G)", () => {
  it("blocks a target that is not applicable to the vehicle class", () => {
    const carOnly = resolvePerspectiveIdsForClass("car");
    const truckOnly = resolvePerspectiveIdsForClass("truck");
    const notForTruck = carOnly.find((id) => !truckOnly.includes(id));
    expect(notForTruck).toBeDefined();

    const a = asset({
      intake: intake({
        vehicleClass: "truck",
        pose: { canonicalPerspectiveId: notForTruck!, azimuthDeg: 45 },
      }),
    });
    const r = evalPrimary(
      a,
      notForTruck!,
      master([a], { vehicleClass: "truck" }),
    );
    expect(r.selectable).toBe(false);
    expect(blockingCodes(r)).toContain("VEHICLE_CLASS_NOT_APPLICABLE");
  });
});

describe("Phase 2.1 determinism and result contract (H, I)", () => {
  it("returns deep-equal results for the same input", () => {
    const a = asset({
      role: "primary_candidate",
      analysis: analysis({ fileExpiresAtIso: undefined }),
      intake: intake({ sameVehicleConfidence: 0.5 }),
    });
    const m = master([a]);
    const input = {
      vehicleMaster: m,
      assetId: a.id,
      targetPerspectiveId: P_34_FRONT_LEFT,
      intendedRole: "primary" as const,
      nowIso: NOW_ISO,
    };
    const first = evaluateAssetEligibility(input);
    const second = evaluateAssetEligibility(input);
    expect(second).toEqual(first);
    expect(codes(first)).toEqual([
      "FILE_EXPIRY_UNKNOWN",
      "IDENTITY_CONFIDENCE_LOW",
      "PRIMARY_NOT_PROMOTED",
    ]);
  });

  it("produces results that satisfy the result contract", () => {
    const r = evalPrimary(asset());
    expect(() => parseAssetEligibilityResult(r)).not.toThrow();
    expect(AssetEligibilityResultSchema.safeParse(r).success).toBe(true);
  });

  it("rejects a selectable result that carries a blocking reason", () => {
    const r = evalPrimary(asset());
    expect(
      AssetEligibilityResultSchema.safeParse({
        ...r,
        reasons: [
          {
            code: "MIRROR_RISK",
            severity: "BLOCKING",
            messageDe: "gespiegelt",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-selectable result without any disqualifier", () => {
    const r = evalPrimary(asset());
    expect(
      AssetEligibilityResultSchema.safeParse({ ...r, selectable: false }).success,
    ).toBe(false);
  });

  it("rejects reviewRequired without a REVIEW reason", () => {
    const r = evalPrimary(asset());
    expect(
      AssetEligibilityResultSchema.safeParse({ ...r, reviewRequired: true })
        .success,
    ).toBe(false);
  });

  it("rejects reviewRequired on a non-selectable result", () => {
    const r = evalPrimary(asset({ analysis: undefined }));
    expect(
      AssetEligibilityResultSchema.safeParse({ ...r, reviewRequired: true })
        .success,
    ).toBe(false);
  });

  it("rejects duplicated codes in the result arrays", () => {
    const r = evalPrimary(asset({ analysis: undefined }));
    expect(
      AssetEligibilityResultSchema.safeParse({
        ...r,
        intrinsicBlockers: ["CROP_VIOLATION", "CROP_VIOLATION"],
      }).success,
    ).toBe(false);
  });
});
