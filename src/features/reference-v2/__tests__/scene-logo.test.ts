import { describe, it, expect } from "vitest";
import {
  LogoAssetSchema,
  ScenePackSchema,
  ScenePlateSchema,
} from "@/features/reference-v2/domain/scene-logo";

const sha = "a".repeat(64);

describe("ScenePlate / ScenePack", () => {
  const validPlate = {
    id: "plate-1",
    scenePackId: "pack-1",
    version: 1,
    sha256: sha,
    storagePath: "reference-v2/scenes/pack-1/plate-1.png",
    compatibleElevationProfiles: ["standard", "low"],
    compatibleCategories: ["standard_exterior", "hero"],
    vehicleAnchor: {
      groundLineY: 0.82,
      centerX: 0.5,
      maxVehicleWidthFraction: 0.6,
      horizonY: 0.55,
    },
    immutable: true,
  } as const;

  it("parses a valid immutable plate", () => {
    expect(ScenePlateSchema.safeParse(validPlate).success).toBe(true);
  });

  it("rejects mutable plates and bad hashes", () => {
    expect(
      ScenePlateSchema.safeParse({ ...validPlate, immutable: false }).success,
    ).toBe(false);
    expect(
      ScenePlateSchema.safeParse({ ...validPlate, sha256: "XYZ" }).success,
    ).toBe(false);
    expect(
      ScenePlateSchema.safeParse({ ...validPlate, version: 0 }).success,
    ).toBe(false);
  });

  it("parses a valid pack", () => {
    const result = ScenePackSchema.safeParse({
      id: "pack-1",
      version: 1,
      labelDe: "Showroom hell",
      labelEn: "Bright Showroom",
      plateIds: ["plate-1", "plate-2"],
      active: true,
      immutable: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("LogoAsset — environment branding only", () => {
  const validLogo = {
    id: "logo-1",
    brandKey: "dealer-brand",
    version: 3,
    format: "svg",
    sha256: sha,
    storagePath: "reference-v2/logos/dealer-brand/v3.svg",
    active: true,
    usage: "environment_branding",
  } as const;

  it("parses a valid logo asset", () => {
    expect(LogoAssetSchema.safeParse(validLogo).success).toBe(true);
  });

  it("only permits usage=environment_branding (vehicle emblems come from references)", () => {
    expect(
      LogoAssetSchema.safeParse({ ...validLogo, usage: "vehicle_badge" })
        .success,
    ).toBe(false);
  });

  it("only permits svg|png formats", () => {
    expect(
      LogoAssetSchema.safeParse({ ...validLogo, format: "jpg" }).success,
    ).toBe(false);
  });
});
