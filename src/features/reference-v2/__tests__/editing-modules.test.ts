import { describe, it, expect } from "vitest";
import {
  EDITING_MODULES,
  EDITING_MODULE_IDS,
  getModuleIdsByRiskClass,
  validateModuleSelection,
  assertModuleSelectionAllowed,
} from "@/features/reference-v2/domain/editing-modules";

describe("editing module catalog", () => {
  it("covers every module id with a definition", () => {
    for (const id of EDITING_MODULE_IDS) {
      expect(EDITING_MODULES[id].id).toBe(id);
      expect(EDITING_MODULES[id].promptDirective.length).toBeGreaterThan(0);
    }
  });

  it("assigns the specified risk classes", () => {
    const safe = getModuleIdsByRiskClass("SAFE_CLEANUP");
    expect(safe).toEqual([
      "dirtRemoval",
      "dustRemoval",
      "fingerprintRemoval",
      "waterSpotRemoval",
      "glassCleanup",
      "whiteBalance",
      "exposureNormalization",
      "removableClutter",
    ]);
    const cosmetic = getModuleIdsByRiskClass("COSMETIC_REPAIR");
    expect(cosmetic).toEqual([
      "lightScratchRemoval",
      "minorRimScratchRemoval",
      "smallPaintDefectRemoval",
      "minorDentRepair",
    ]);
    const transformation = getModuleIdsByRiskClass("TRANSFORMATION");
    expect(transformation).toEqual([
      "paintColorChange",
      "wheelReplacement",
      "wrapChange",
      "addPart",
      "removePart",
    ]);
  });

  it("COSMETIC_REPAIR and TRANSFORMATION default to disabled", () => {
    for (const id of getModuleIdsByRiskClass("COSMETIC_REPAIR")) {
      expect(EDITING_MODULES[id].defaultEnabled).toBe(false);
    }
    for (const id of getModuleIdsByRiskClass("TRANSFORMATION")) {
      expect(EDITING_MODULES[id].defaultEnabled).toBe(false);
    }
    for (const id of getModuleIdsByRiskClass("SAFE_CLEANUP")) {
      expect(EDITING_MODULES[id].defaultEnabled).toBe(true);
    }
  });
});

describe("strict_reference module validation", () => {
  it("rejects every TRANSFORMATION module", () => {
    for (const id of getModuleIdsByRiskClass("TRANSFORMATION")) {
      const result = validateModuleSelection("strict_reference", [id]);
      expect(result.ok).toBe(false);
      expect(result.rejected.map((r) => r.id)).toContain(id);
      expect(result.allowed).not.toContain(id);
    }
  });

  it("allows SAFE_CLEANUP + COSMETIC_REPAIR combinations", () => {
    const result = validateModuleSelection("strict_reference", [
      "dirtRemoval",
      "glassCleanup",
      "minorDentRepair",
    ]);
    expect(result.ok).toBe(true);
    expect(result.rejected).toEqual([]);
    expect(result.allowed).toEqual([
      "dirtRemoval",
      "glassCleanup",
      "minorDentRepair",
    ]);
  });

  it("rejects mixed selections containing a transformation", () => {
    const result = validateModuleSelection("strict_reference", [
      "dirtRemoval",
      "paintColorChange",
    ]);
    expect(result.ok).toBe(false);
    expect(result.allowed).toEqual(["dirtRemoval"]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].riskClass).toBe("TRANSFORMATION");
  });

  it("assertModuleSelectionAllowed throws on transformation modules", () => {
    expect(() =>
      assertModuleSelectionAllowed("strict_reference", ["wheelReplacement"]),
    ).toThrow(/TRANSFORMATION/);
    expect(() =>
      assertModuleSelectionAllowed("strict_reference", ["dirtRemoval"]),
    ).not.toThrow();
  });
});
