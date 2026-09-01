import { describe, expect, it } from "vitest";
import {
  PERSPECTIVE_MASTER,
  REQUIRED_MASTER_PERSPECTIVE_IDS,
  getPerspectiveMasterEntry,
  requiredPerspectivesForClass,
  verifyAgainstRegistry,
} from "../phase1/perspective-master";
import { ALL_PERSPECTIVE_SPECS } from "../domain/perspectives/registry";
import {
  evaluateOutputFormatReadiness,
  isFullyOutputReady,
} from "../phase1/output-format-policy";
import {
  canBecomePrimary,
  computeCompletenessWarnings,
  computeCoverage,
  evaluateIngestion,
} from "../phase1/ingestion";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VehicleMasterRecord } from "../phase1/vehicle-master";
import { VehicleMasterRecordSchema } from "../phase1/vehicle-master";

const CLUSTER = "cluster_a";

function intake(
  perspectiveId: PerspectiveId,
  overrides: Partial<VisionIntakeResult> = {},
): VisionIntakeResult {
  const entry = getPerspectiveMasterEntry(perspectiveId);
  return {
    schemaVersion: 1,
    assetId: "asset_1",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: CLUSTER,
    sameVehicleConfidence: 0.95,
    pose: {
      canonicalPerspectiveId: perspectiveId,
      ...(entry.azimuthDeg !== null ? { azimuthDeg: entry.azimuthDeg } : {}),
      elevationProfile: entry.elevationProfile,
    },
    visibility: {
      front: perspectiveId.includes("FRONT") ? 0.95 : 0.2,
      rear: perspectiveId.includes("REAR") ? 0.95 : 0.2,
      leftSide: perspectiveId.includes("LEFT") ? 0.95 : 0.2,
      rightSide: perspectiveId.includes("RIGHT") ? 0.95 : 0.2,
      roof: 0.6,
    },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: ["front_left", "front_right", "rear_left", "rear_right"],
    },
    quality: {
      sharpness: 0.9,
      occlusion: 0.02,
      glare: 0.05,
      resolutionAdequacy: 0.95,
      usableScore: 0.92,
    },
    classificationConfidence: 0.95,
    issues: [],
    ...overrides,
  };
}

function ingest(
  perspectiveId: PerspectiveId,
  overrides: Partial<VisionIntakeResult> = {},
  framing = { sourceAspectRatio: 3 / 2, fullVehicleVisible: true, paddingPct: 20 },
  fileAvailable = true,
  isAutomatic = true,
) {
  return evaluateIngestion({
    vehicleClass: "car",
    identityClusterId: CLUSTER,
    requestedPerspectiveId: perspectiveId,
    intake: intake(perspectiveId, overrides),
    framing,
    fileAvailable,
    isAutomatic,
  });
}

describe("PerspectiveMaster v1", () => {
  it("stays byte-consistent with the Phase 0 registry", () => {
    expect(verifyAgainstRegistry(PERSPECTIVE_MASTER)).toEqual([]);
    expect(PERSPECTIVE_MASTER.perspectives).toHaveLength(
      ALL_PERSPECTIVE_SPECS.length,
    );
  });

  it("exposes required perspectives per vehicle class", () => {
    const car = requiredPerspectivesForClass("car");
    expect(car.length).toBeGreaterThan(0);
    for (const id of car) {
      expect(REQUIRED_MASTER_PERSPECTIVE_IDS).toContain(id);
      expect(getPerspectiveMasterEntry(id).vehicleClasses).toContain("car");
    }
  });
});

describe("Phase 1 ingestion governance", () => {
  it("accepts an exact reference as primary candidate", () => {
    const result = ingest("EXT_34_FRONT_RIGHT");
    expect(result.blockers).toEqual([]);
    expect(result.role).toBe("primary_candidate");
    expect(result.weightedScore).toBeGreaterThan(70);
  });

  it("never lets the manual diagnostic path become a primary candidate", () => {
    const manual = ingest(
      "EXT_34_FRONT_RIGHT",
      {},
      { sourceAspectRatio: 3 / 2, fullVehicleVisible: true, paddingPct: 20 },
      true,
      false,
    );
    expect(manual.blockers).toEqual([]);
    expect(manual.role).toBe("secondary_support");
  });

  it("hard-fails the wrong vehicle side and never allows primary", () => {
    const result = ingest("EXT_SIDE_RIGHT", {
      visibility: {
        front: 0.3,
        rear: 0.3,
        leftSide: 0.95,
        rightSide: 0.1,
        roof: 0.5,
      },
    });
    expect(result.hardFailures).toContain("WRONG_VEHICLE_SIDE");
    expect(result.role).toBe("rejected");
  });

  it("hard-fails mirrored, foreign-vehicle and unavailable references", () => {
    expect(
      ingest("EXT_FRONT", {
        issues: [
          { code: "MIRRORED_SUSPECTED", severity: "critical", message: "flip" },
        ],
      }).hardFailures,
    ).toContain("MIRRORED_REFERENCE");

    expect(
      ingest("EXT_FRONT", { identityClusterId: "other" }).hardFailures,
    ).toContain("IDENTITY_CLUSTER_CONFLICT");

    expect(
      ingest("EXT_FRONT", {}, undefined as never, false).hardFailures,
    ).toContain("FILE_UNAVAILABLE");
  });

  it("downgrades a slightly off-angle reference to secondary support", () => {
    const entry = getPerspectiveMasterEntry("EXT_34_FRONT_RIGHT");
    const off = (entry.azimuthDeg ?? 45) + (entry.maxAzimuthErrorDeg ?? 10) + 2;
    const result = ingest("EXT_34_FRONT_RIGHT", {
      pose: {
        canonicalPerspectiveId: "EXT_34_FRONT_RIGHT",
        azimuthDeg: off,
        elevationProfile: entry.elevationProfile,
      },
    });
    expect(result.blockers).toEqual([]);
    expect(result.role).toBe("secondary_support");
  });

  it("rejects a grossly wrong perspective", () => {
    const result = ingest("EXT_FRONT", {
      pose: {
        canonicalPerspectiveId: "EXT_FRONT",
        azimuthDeg: 120,
        elevationProfile: "standard",
      },
    });
    expect(result.blockers).toContain("PERSPECTIVE_MISMATCH");
    expect(result.role).toBe("rejected");
  });

  it("rejects cropped, occluded, glaring and low-resolution imagery", () => {
    expect(
      ingest("EXT_FRONT", {
        framing: {
          fullVehicleVisible: false,
          cropped: true,
          visibleWheelPositions: [],
        },
      }).blockers,
    ).toContain("CROP_VIOLATION");

    const bad = ingest("EXT_FRONT", {
      quality: {
        sharpness: 0.3,
        occlusion: 0.8,
        glare: 0.9,
        resolutionAdequacy: 0.2,
        usableScore: 0.2,
      },
    });
    expect(bad.blockers).toEqual(
      expect.arrayContaining([
        "OCCLUSION_VIOLATION",
        "GLARE_VIOLATION",
        "RESOLUTION_VIOLATION",
      ]),
    );
    expect(bad.role).toBe("rejected");
  });
});

describe("4:5 + 1.91:1 output policy", () => {
  it("marks generous framing ready for both formats", () => {
    const readiness = evaluateOutputFormatReadiness("EXT_34_FRONT_RIGHT", {
      sourceAspectRatio: 3 / 2,
      fullVehicleVisible: true,
      paddingPct: 30,
    });
    expect(isFullyOutputReady(readiness)).toBe(true);
  });

  it("blocks tight framing and cropped vehicles", () => {
    const tight = evaluateOutputFormatReadiness("EXT_34_FRONT_RIGHT", {
      sourceAspectRatio: 3 / 2,
      fullVehicleVisible: true,
      paddingPct: 1,
    });
    expect(isFullyOutputReady(tight)).toBe(false);

    const cropped = evaluateOutputFormatReadiness("EXT_34_FRONT_RIGHT", {
      sourceAspectRatio: 3 / 2,
      fullVehicleVisible: false,
      paddingPct: 30,
    });
    expect(cropped.every((r) => !r.ready)).toBe(true);
  });
});

describe("Vehicle Master completeness", () => {
  function master(assets: VehicleMasterRecord["assets"]): VehicleMasterRecord {
    return VehicleMasterRecordSchema.parse({
      id: "vm_1",
      label: "Referenzfahrzeug A",
      vehicleClass: "car",
      colorFamily: null,
      identityClusterId: CLUSTER,
      createdAtIso: new Date().toISOString(),
      version: 1,
      history: [{ version: 1, atIso: new Date().toISOString(), action: "created" }],
      assets,
    });
  }

  it("warns about the missing color family and every required perspective", () => {
    const record = master([]);
    const warnings = computeCompletenessWarnings(record);
    expect(warnings.some((w) => w.code === "MISSING_COLOR_FAMILY")).toBe(true);
    expect(
      warnings.filter((w) => w.code === "MISSING_REQUIRED_PERSPECTIVE").length,
    ).toBe(requiredPerspectivesForClass("car").length);
    expect(computeCoverage(record).length).toBeGreaterThan(0);
  });

  it("keeps rejected assets out of primary eligibility", () => {
    const evaluation = ingest("EXT_FRONT", { vehicleDetected: false });
    expect(evaluation.role).toBe("rejected");
    expect(
      canBecomePrimary({
        id: "a",
        vehicleMasterId: "vm_1",
        requestedPerspectiveId: "EXT_FRONT",
        fileName: "a.jpg",
        previewUrl: "blob:a",
        createdAtIso: new Date().toISOString(),
        intake: intake("EXT_FRONT"),
        scores: evaluation.scores,
        weightedScore: evaluation.weightedScore,
        hardFailures: [...evaluation.hardFailures],
        blockers: [...evaluation.blockers],
        warnings: [...evaluation.warnings],
        role: "rejected",
        protection: "unprotected",
        outputReadyFormats: [],
        version: 1,
        history: [
          { version: 1, atIso: new Date().toISOString(), action: "ingested" },
        ],
      }),
    ).toBe(false);
  });
});
