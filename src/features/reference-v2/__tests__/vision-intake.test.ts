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
    occlusion: 0.95,
    glare: 0.85,
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
