import { z } from "zod";
import {
  ElevationProfileSchema,
  PerspectiveCategorySchema,
  PerspectiveIdSchema,
} from "./perspectives/types";

/**
 * Reference V2 — Scene & Logo Domain Types (Phase 0, KEIN Rendering).
 *
 * DOMAIN-REGEL (verbindlich):
 * Ein Wall-/Showroom-Logo-Asset (environment_branding) ist strikt getrennt
 * vom Emblem/Badge AM Fahrzeug. Fahrzeugembleme kommen AUSSCHLIESSLICH aus
 * den visuellen Referenzen — es existiert bewusst KEIN Typ, der ein Logo auf
 * dem Fahrzeug platziert.
 *
 * Scenes und Logos sind versioniert und immutable: inhaltliche Aenderung =
 * neue Version + neuer Hash, niemals Ueberschreiben.
 */

const Sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "sha256 must be 64 lowercase hex characters");

const Fraction01Schema = z.number().min(0).max(1);

export const ScenePlateVehicleAnchorSchema = z
  .object({
    /** Normalisierte Bodenlinie (0 = oben, 1 = unten). */
    groundLineY: Fraction01Schema,
    /** Normalisierte horizontale Fahrzeugmitte. */
    centerX: Fraction01Schema,
    /** Maximale Fahrzeugbreite als Anteil der Bildbreite. */
    maxVehicleWidthFraction: z.number().gt(0).max(1),
    horizonY: Fraction01Schema.optional(),
  })
  .strict();
export type ScenePlateVehicleAnchor = z.infer<
  typeof ScenePlateVehicleAnchorSchema
>;

export const ScenePlateSchema = z
  .object({
    id: z.string().min(1),
    scenePackId: z.string().min(1),
    version: z.number().int().min(1),
    sha256: Sha256HexSchema,
    storagePath: z.string().min(1),
    /** Kompatible Kamera-Elevationsprofile dieser Plate. */
    compatibleElevationProfiles: z.array(ElevationProfileSchema).nonempty(),
    compatibleCategories: z.array(PerspectiveCategorySchema).nonempty(),
    /**
     * Echte Kamerakompatibilitaet: eine Plate ist nur fuer explizit gelistete
     * Perspektiven zulaessig. Ein Standard-Plate ist NICHT automatisch fuer
     * Low-/Elevated-Perspektiven verwendbar.
     */
    compatiblePerspectiveIds: z.array(PerspectiveIdSchema).nonempty(),
    /** Kamerahoehe/-pitch, fuer die die Plate fotografiert wurde. */
    cameraProfile: z
      .object({
        cameraHeightM: z.number().gt(0).max(10),
        pitchDeg: z.number().min(-60).max(60),
        focalLengthMm: z.number().positive(),
      })
      .strict(),
    vehicleAnchor: ScenePlateVehicleAnchorSchema,
    immutable: z.literal(true),
  })
  .strict();
export type ScenePlate = z.infer<typeof ScenePlateSchema>;

export const ScenePackSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().min(1),
    labelDe: z.string().min(1),
    labelEn: z.string().min(1),
    plateIds: z.array(z.string().min(1)).nonempty(),
    /** Inhaltlicher Hash des Packs — Aenderung = neue Version + neuer Hash. */
    sha256: Sha256HexSchema,
    active: z.boolean(),
    immutable: z.literal(true),
  })
  .strict();
export type ScenePack = z.infer<typeof ScenePackSchema>;

export const LOGO_FORMATS = ["svg", "png"] as const;
export type LogoFormat = (typeof LOGO_FORMATS)[number];
export const LogoFormatSchema = z.enum(LOGO_FORMATS);

export const LogoAssetSchema = z
  .object({
    id: z.string().min(1),
    brandKey: z.string().min(1),
    version: z.number().int().min(1),
    format: LogoFormatSchema,
    sha256: Sha256HexSchema,
    storagePath: z.string().min(1),
    active: z.boolean(),
    /** Logos sind wie Scene-Assets immutable und versioniert. */
    immutable: z.literal(true),
    /**
     * Einziger zulaessiger Einsatzzweck: Umgebungs-Branding (Wand/Boden der
     * Szene). Fahrzeugembleme kommen NIEMALS aus einem LogoAsset.
     */
    usage: z.literal("environment_branding"),
  })
  .strict();
export type LogoAsset = z.infer<typeof LogoAssetSchema>;
