import { describe, it, expect } from "vitest";
import {
  ALL_PERSPECTIVE_SPECS,
  PERSPECTIVE_REGISTRY_VERSION,
  PERSPECTIVE_SPECS_BY_ID,
  getPerspectiveSpec,
  listPerspectivesByCategory,
  listPerspectivesForVehicleClass,
  validatePerspectiveRegistry,
} from "@/features/reference-v2/domain/perspectives/registry";
import {
  PERSPECTIVE_IDS,
  PerspectiveSpecSchema,
} from "@/features/reference-v2/domain/perspectives/types";
import {
  AZIMUTH_CONVENTION,
  circularAzimuthDeltaDeg,
  isLeftHemisphere,
  isRightHemisphere,
  normalizeAzimuthDeg,
} from "@/features/reference-v2/domain/angles";
import {
  DEFAULT_CAPABILITY_PROFILES,
  resolvePerspectiveIdsForClass,
} from "@/features/reference-v2/domain/capability-profiles";

describe("angle conventions", () => {
  it("normalizes azimuths into (-180, 180]", () => {
    expect(normalizeAzimuthDeg(0)).toBe(0);
    expect(normalizeAzimuthDeg(270)).toBe(-90);
    expect(normalizeAzimuthDeg(-270)).toBe(90);
    expect(normalizeAzimuthDeg(180)).toBe(180);
    expect(normalizeAzimuthDeg(-180)).toBe(180);
    expect(normalizeAzimuthDeg(-190)).toBe(170);
    expect(normalizeAzimuthDeg(360)).toBe(0);
  });

  it("computes circular deltas", () => {
    expect(circularAzimuthDeltaDeg(0, 45)).toBe(45);
    expect(circularAzimuthDeltaDeg(170, -170)).toBe(20);
    expect(circularAzimuthDeltaDeg(-45, 45)).toBe(90);
    expect(circularAzimuthDeltaDeg(180, -180)).toBe(0);
  });

  it("maps hemispheres vehicle-relative (positive = right side)", () => {
    expect(isRightHemisphere(AZIMUTH_CONVENTION.rightSideDeg)).toBe(true);
    expect(isLeftHemisphere(AZIMUTH_CONVENTION.leftSideDeg)).toBe(true);
    expect(isRightHemisphere(AZIMUTH_CONVENTION.frontDeg)).toBe(false);
    expect(isLeftHemisphere(AZIMUTH_CONVENTION.rearDeg)).toBe(false);
  });
});

describe("perspective registry integrity", () => {
  it("is versioned", () => {
    expect(PERSPECTIVE_REGISTRY_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("contains no duplicate perspective ids", () => {
    const ids = ALL_PERSPECTIVE_SPECS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches the declared id list exactly (57 specs)", () => {
    expect(ALL_PERSPECTIVE_SPECS).toHaveLength(57);
    expect(PERSPECTIVE_IDS).toHaveLength(57);
    const registryIds = new Set(ALL_PERSPECTIVE_SPECS.map((s) => s.id));
    for (const id of PERSPECTIVE_IDS) {
      expect(registryIds.has(id)).toBe(true);
    }
  });

  it("has expected category counts", () => {
    expect(listPerspectivesByCategory("standard_exterior")).toHaveLength(8);
    expect(listPerspectivesByCategory("hero")).toHaveLength(5);
    expect(listPerspectivesByCategory("low_angle")).toHaveLength(6);
    expect(listPerspectivesByCategory("elevated")).toHaveLength(6);
    expect(listPerspectivesByCategory("interior")).toHaveLength(12);
    expect(listPerspectivesByCategory("detail")).toHaveLength(20);
  });

  it("all specs are schema-valid and versioned", () => {
    for (const spec of ALL_PERSPECTIVE_SPECS) {
      const result = PerspectiveSpecSchema.safeParse(spec);
      expect(
        result.success,
        result.success
          ? undefined
          : `${spec.id}: ${JSON.stringify(result.error.issues)}`,
      ).toBe(true);
      expect(Number.isInteger(spec.version)).toBe(true);
      expect(spec.version).toBeGreaterThanOrEqual(1);
      expect(spec.applicableVehicleClasses.length).toBeGreaterThan(0);
      expect(spec.validationRules.mirrorForbidden).toBe(true);
    }
  });

  it("validatePerspectiveRegistry reports valid", () => {
    const result = validatePerspectiveRegistry();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("getPerspectiveSpec resolves every declared id", () => {
    for (const id of PERSPECTIVE_IDS) {
      expect(getPerspectiveSpec(id).id).toBe(id);
    }
    expect(PERSPECTIVE_SPECS_BY_ID.size).toBe(57);
  });
});

describe("standard exterior angle/side conventions", () => {
  const expectedAzimuths: ReadonlyArray<readonly [string, number]> = [
    ["EXT_FRONT", 0],
    ["EXT_34_FRONT_RIGHT", 45],
    ["EXT_SIDE_RIGHT", 90],
    ["EXT_34_REAR_RIGHT", 135],
    ["EXT_REAR", 180],
    ["EXT_34_REAR_LEFT", -135],
    ["EXT_SIDE_LEFT", -90],
    ["EXT_34_FRONT_LEFT", -45],
  ];

  it.each(expectedAzimuths)("%s has azimuth %d", (id, azimuth) => {
    const spec = getPerspectiveSpec(id as (typeof PERSPECTIVE_IDS)[number]);
    expect(spec.pose.azimuthDeg).toBe(azimuth);
  });

  it("SIDE_RIGHT: +90, right vehicle side, front points image-left", () => {
    const spec = getPerspectiveSpec("EXT_SIDE_RIGHT");
    expect(spec.pose.azimuthDeg).toBe(90);
    expect(spec.requiredVisibleSurfaces).toContain("right_side");
    expect(spec.forbiddenDominantSurfaces).toContain("left_side");
    expect(spec.orientationRules.sideConvention).toBe("vehicle_relative");
    expect(spec.orientationRules.vehicleFrontImageDirection).toBe("left");
  });

  it("SIDE_LEFT: -90, left vehicle side, front points image-right", () => {
    const spec = getPerspectiveSpec("EXT_SIDE_LEFT");
    expect(spec.pose.azimuthDeg).toBe(-90);
    expect(spec.requiredVisibleSurfaces).toContain("left_side");
    expect(spec.forbiddenDominantSurfaces).toContain("right_side");
    expect(spec.orientationRules.vehicleFrontImageDirection).toBe("right");
  });

  it("side views forbid mirroring and require side match", () => {
    for (const id of ["EXT_SIDE_RIGHT", "EXT_SIDE_LEFT"] as const) {
      const spec = getPerspectiveSpec(id);
      expect(spec.validationRules.mirrorForbidden).toBe(true);
      expect(spec.validationRules.sideMustMatch).toBe(true);
    }
  });
});

describe("hero output keys", () => {
  const heroBases: ReadonlyArray<readonly [string, string]> = [
    ["HERO_FRONT_LEFT", "EXT_34_FRONT_LEFT"],
    ["HERO_FRONT_RIGHT", "EXT_34_FRONT_RIGHT"],
    ["HERO_FRONT_CENTER", "EXT_FRONT"],
    ["HERO_REAR_LEFT", "EXT_34_REAR_LEFT"],
    ["HERO_REAR_RIGHT", "EXT_34_REAR_RIGHT"],
  ];

  it.each(heroBases)("%s references base %s", (heroId, baseId) => {
    const hero = getPerspectiveSpec(
      heroId as (typeof PERSPECTIVE_IDS)[number],
    );
    expect(hero.category).toBe("hero");
    expect(hero.basePerspectiveId).toBe(baseId);
    const base = getPerspectiveSpec(
      baseId as (typeof PERSPECTIVE_IDS)[number],
    );
    expect(base.category).toBe("standard_exterior");
    // Hero = Output-Key, keine neue Geometrie: identischer Azimut.
    expect(hero.pose.azimuthDeg).toBe(base.pose.azimuthDeg);
    expect(hero.requiredVisibleSurfaces).toEqual(base.requiredVisibleSurfaces);
  });

  it("only hero specs carry basePerspectiveId", () => {
    for (const spec of ALL_PERSPECTIVE_SPECS) {
      if (spec.category === "hero") {
        expect(spec.basePerspectiveId).toBeDefined();
      } else {
        expect(spec.basePerspectiveId).toBeUndefined();
      }
    }
  });
});

describe("interior/detail semantic constraints", () => {
  it("interior and detail specs use semantic constraints instead of azimuths", () => {
    for (const spec of ALL_PERSPECTIVE_SPECS) {
      if (spec.category === "interior" || spec.category === "detail") {
        expect(spec.pose.azimuthDeg).toBeUndefined();
        expect(
          spec.cameraGuidance.semanticConstraints.length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("elevated specs are high risk and require roof coverage", () => {
    for (const spec of listPerspectivesByCategory("elevated")) {
      expect(spec.riskLevel).toBe("high");
      expect(spec.referenceRequirements.requiredCoverageSurfaces).toContain(
        "roof",
      );
    }
  });
});

describe("vehicle class capability model", () => {
  it("every class resolves a non-empty perspective set", () => {
    for (const profile of Object.values(DEFAULT_CAPABILITY_PROFILES)) {
      const ids = resolvePerspectiveIdsForClass(profile.vehicleClass);
      expect(ids.length).toBeGreaterThan(0);
    }
  });

  it("motorcycle excludes cabin interior specs but keeps exterior", () => {
    const ids = resolvePerspectiveIdsForClass("motorcycle");
    expect(ids).toContain("EXT_FRONT");
    expect(ids).toContain("EXT_SIDE_LEFT");
    expect(ids).not.toContain("INT_DRIVER_POV");
    expect(ids).not.toContain("DET_STEERING_WHEEL");
  });

  it("trailer keeps taillight/rear wheel details but excludes cockpit", () => {
    const ids = resolvePerspectiveIdsForClass("trailer");
    expect(ids).toContain("DET_TAILLIGHT_LEFT");
    expect(ids).toContain("DET_WHEEL_REAR_LEFT");
    expect(ids).toContain("INT_CARGO");
    expect(ids).not.toContain("INT_DRIVER_POV");
    expect(ids).not.toContain("DET_HEADLIGHT_LEFT");
  });

  it("profiles can add/remove specs without rewriting the registry", () => {
    const ids = resolvePerspectiveIdsForClass("motorcycle", {
      vehicleClass: "motorcycle",
      version: 1,
      addedPerspectiveIds: ["INT_CARGO"],
      removedPerspectiveIds: ["EXT_REAR"],
    });
    expect(ids).toContain("INT_CARGO");
    expect(ids).not.toContain("EXT_REAR");
  });

  it("listPerspectivesForVehicleClass matches applicableVehicleClasses", () => {
    for (const spec of listPerspectivesForVehicleClass("car")) {
      expect(spec.applicableVehicleClasses).toContain("car");
    }
  });
});
