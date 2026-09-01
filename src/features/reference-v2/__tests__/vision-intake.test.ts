import { describe, it, expect } from "vitest";
import {
  VisionIntakeResultSchema,
  parseVisionIntakeResult,
} from "@/features/reference-v2/domain/vision-intake";

const validIntake = {
  schemaVersion: 1,
  assetId: "asset-1",
  vehicleDetected: true,
  vehicleClass: "car",
  identityClusterId: "cluster-1",
  sameVehicleConfidence: 0.97,
  pose: {
    canonicalPerspectiveId: "EXT_34_FRONT_LEFT",
    azimuthDeg: -47.5,
    pitchDeg: 1.2,
    rollDeg: 0.3,
    elevationProfile: "standard",
  },
  visibility: {
    front: 0.9,
    rear: 0,
    leftSide: 0.8,
    rightSide: 0,
    roof: 0.2,
    surfaces: {
      headlight_left: 0.85,
      wheel_front_left: 0.9,
    },
  },
  framing: {
    fullVehicleVisible: true,
    cropped: false,
    visibleWheelPositions: ["front_left", "rear_left"],
  },
  quality: {
    sharpness: 0.9,
    // severity semantics: 0 = none, 1 = strong
    occlusion: 0.05,
    glare: 0.15,
    resolutionAdequacy: 1,
    usableScore: 0.9,
  },
  classificationConfidence: 0.93,
  issues: [
    {
      code: "STRONG_GLARE",
      severity: "minor",
      message: "slight glare on the windshield",
    },
  ],
} as const;

describe("VisionIntakeResultSchema", () => {
  it("parses a valid intake result", () => {
    const parsed = parseVisionIntakeResult(validIntake);
    expect(parsed.assetId).toBe("asset-1");
    expect(parsed.pose.canonicalPerspectiveId).toBe("EXT_34_FRONT_LEFT");
  });

  it("accepts manual overrides", () => {
    const result = VisionIntakeResultSchema.safeParse({
      ...validIntake,
      manualOverride: {
        canonicalPerspectiveId: "EXT_FRONT",
        vehicleClass: "van",
        sameVehicleConfirmed: true,
        reason: "operator corrected the perspective",
        overriddenBy: "user-1",
        overriddenAtIso: "2026-09-01T08:00:00Z",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects scores outside 0..1", () => {
    const result = VisionIntakeResultSchema.safeParse({
      ...validIntake,
      classificationConfidence: 1.2,
    });
    expect(result.success).toBe(false);

    const visibility = VisionIntakeResultSchema.safeParse({
      ...validIntake,
      visibility: { ...validIntake.visibility, front: -0.1 },
    });
    expect(visibility.success).toBe(false);
  });

  it("rejects unknown fields (no business metadata smuggling)", () => {
    for (const field of ["brand", "model", "vin", "vehicleDescription"]) {
      const result = VisionIntakeResultSchema.safeParse({
        ...validIntake,
        [field]: "leak",
      });
      expect(result.success, `field ${field} must be rejected`).toBe(false);
    }
  });

  it("rejects invalid issue severities and empty codes", () => {
    const badSeverity = VisionIntakeResultSchema.safeParse({
      ...validIntake,
      issues: [{ code: "X", severity: "fatal", message: "boom" }],
    });
    expect(badSeverity.success).toBe(false);

    const emptyCode = VisionIntakeResultSchema.safeParse({
      ...validIntake,
      issues: [{ code: "", severity: "minor", message: "boom" }],
    });
    expect(emptyCode.success).toBe(false);
  });

  it("rejects wrong schema versions", () => {
    const result = VisionIntakeResultSchema.safeParse({
      ...validIntake,
      schemaVersion: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe("vision quality semantics", () => {
  it("treats occlusion and glare as severity (0 = none, 1 = strong)", () => {
    const clean = parseVisionIntakeResult({
      ...validIntake,
      quality: {
        sharpness: 1,
        occlusion: 0,
        glare: 0,
        resolutionAdequacy: 1,
        usableScore: 1,
      },
    });
    expect(clean.quality.occlusion).toBe(0);
    expect(clean.quality.glare).toBe(0);

    const bad = parseVisionIntakeResult({
      ...validIntake,
      quality: {
        sharpness: 0.2,
        occlusion: 1,
        glare: 1,
        resolutionAdequacy: 0.2,
        usableScore: 0.1,
      },
    });
    expect(bad.quality.occlusion).toBeGreaterThan(clean.quality.occlusion);
    expect(bad.quality.usableScore).toBeLessThan(clean.quality.usableScore);
  });

  it("keeps all quality scores inside 0..1", () => {
    for (const field of ["occlusion", "glare", "sharpness", "resolutionAdequacy", "usableScore"]) {
      expect(
        VisionIntakeResultSchema.safeParse({
          ...validIntake,
          quality: { ...validIntake.quality, [field]: 1.5 },
        }).success,
      ).toBe(false);
    }
  });
});
