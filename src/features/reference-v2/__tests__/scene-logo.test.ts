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
    compatiblePerspectiveIds: ["EXT_SIDE_RIGHT", "EXT_34_FRONT_LEFT"],
    cameraProfile: { cameraHeightM: 1.4, pitchDeg: 0, focalLengthMm: 70 },
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
      sha256: sha,
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
    immutable: true,
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

describe("scene/logo immutability hardening", () => {
  const plate = {
    id: "plate-1",
    scenePackId: "pack-1",
    version: 1,
    sha256: sha,
    storagePath: "p.png",
    compatibleElevationProfiles: ["standard"],
    compatibleCategories: ["standard_exterior"],
    compatiblePerspectiveIds: ["EXT_SIDE_RIGHT"],
    cameraProfile: { cameraHeightM: 1.4, pitchDeg: 0, focalLengthMm: 70 },
    vehicleAnchor: { groundLineY: 0.8, centerX: 0.5, maxVehicleWidthFraction: 0.6 },
    immutable: true,
  } as const;

  it("requires explicit perspective compatibility (no implicit low/elevated reuse)", () => {
    expect(ScenePlateSchema.safeParse(plate).success).toBe(true);
    const { compatiblePerspectiveIds: _omitted, ...withoutIds } = plate;
    expect(ScenePlateSchema.safeParse(withoutIds).success).toBe(false);
    expect(
      ScenePlateSchema.safeParse({ ...plate, compatiblePerspectiveIds: [] })
        .success,
    ).toBe(false);
    const parsed = ScenePlateSchema.parse(plate);
    expect(parsed.compatiblePerspectiveIds).not.toContain("LOW_FRONT_LEFT");
    expect(parsed.compatiblePerspectiveIds).not.toContain("HIGH_FRONT_LEFT");
  });

  it("requires a camera profile on every plate", () => {
    const { cameraProfile: _c, ...noCamera } = plate;
    expect(ScenePlateSchema.safeParse(noCamera).success).toBe(false);
  });

  it("requires a sha256 on scene packs", () => {
    const pack = {
      id: "pack-1",
      version: 1,
      labelDe: "A",
      labelEn: "A",
      plateIds: ["plate-1"],
      sha256: sha,
      active: true,
      immutable: true,
    };
    expect(ScenePackSchema.safeParse(pack).success).toBe(true);
    const { sha256: _s, ...noHash } = pack;
    expect(ScenePackSchema.safeParse(noHash).success).toBe(false);
  });

  it("requires logo assets to be immutable and versioned", () => {
    const logo = {
      id: "logo-1",
      brandKey: "dealer",
      version: 2,
      format: "png",
      sha256: sha,
      storagePath: "l.png",
      active: true,
      immutable: true,
      usage: "environment_branding",
    };
    expect(LogoAssetSchema.safeParse(logo).success).toBe(true);
    expect(LogoAssetSchema.safeParse({ ...logo, immutable: false }).success).toBe(
      false,
    );
    const { immutable: _i, ...mutable } = logo;
    expect(LogoAssetSchema.safeParse(mutable).success).toBe(false);
  });
});
