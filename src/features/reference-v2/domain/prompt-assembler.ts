import { z } from "zod";
import { VisualSurfaceSchema } from "./surfaces";
import { PerspectiveIdSchema, type PerspectiveSpec } from "./perspectives/types";
import { getPerspectiveSpec } from "./perspectives/registry";
import {
  EDITING_MODULES,
  EDITING_MODULE_IDS,
  EditingModuleIdSchema,
  assertModuleSelectionAllowed,
  type EditingModuleId,
} from "./editing-modules";

/**
 * Reference V2 — Deterministic Prompt Assembly Contract (Phase 0).
 * KEIN Provider-Call. Baut den Prompt aus GENAU vier Bereichen:
 *   CORE, PERSPECTIVE, ACTIVE_MODULES, REFERENCE_MANIFEST
 *
 * Der CORE ist kurz, enthaelt KEINE Wiederholungs-Locks und GENAU EINE
 * Prioritaetshierarchie. Es gelangen niemals Fahrzeug-Metadaten (Marke,
 * Modell, Baujahr, VIN, Beschreibungstexte) in den Prompt — der Assembler
 * akzeptiert solche Felder strukturell gar nicht (.strict()-Input).
 */

export const PROMPT_SECTION_KEYS = [
  "CORE",
  "PERSPECTIVE",
  "ACTIVE_MODULES",
  "REFERENCE_MANIFEST",
] as const;
export type PromptSectionKey = (typeof PROMPT_SECTION_KEYS)[number];

export const ReferenceManifestEntrySchema = z
  .object({
    assetId: z.string().min(1),
    role: z.enum(["primary", "secondary"]),
    coverageSurfaces: z.array(VisualSurfaceSchema).optional(),
    isExactPerspectiveMatch: z.boolean().optional(),
  })
  .strict();
export type ReferenceManifestEntry = z.infer<
  typeof ReferenceManifestEntrySchema
>;

export const PromptAssemblyInputSchema = z
  .object({
    perspectiveSpecId: PerspectiveIdSchema,
    enabledModuleIds: z.array(EditingModuleIdSchema).default([]),
    references: z.array(ReferenceManifestEntrySchema).min(1),
    scene: z
      .object({
        scenePackId: z.string().min(1),
        scenePlateId: z.string().min(1),
      })
      .strict()
      .optional(),
    logo: z
      .object({
        logoAssetId: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PromptAssemblyInput = z.input<typeof PromptAssemblyInputSchema>;

export interface AssembledPrompt {
  readonly text: string;
  readonly sections: Readonly<Record<PromptSectionKey, string>>;
}

const CORE_SECTION = [
  "[CORE]",
  "Render one photorealistic image of the exact same physical vehicle shown in the assigned reference images.",
  "The reference images are the sole authority for the vehicle's visual identity. Never invent, replace or \"correct\" any vehicle feature from memory or catalogue assumptions.",
  "PRIORITY HIERARCHY (exactly one, highest first):",
  "1. Visual vehicle identity from the assigned reference images.",
  "2. The target perspective specification.",
  "3. Explicitly enabled non-transformative editing modules.",
  "4. Photographic enhancement (lighting, clarity, color balance).",
  "On conflict, the lower priority yields — it must never alter a higher priority.",
].join("\n");

function formatAzimuth(deg: number): string {
  return `${deg > 0 ? "+" : ""}${deg}\u00B0`;
}

function frontDirectionPhrase(spec: PerspectiveSpec): string | undefined {
  switch (spec.orientationRules.vehicleFrontImageDirection) {
    case "left":
      return "The vehicle front points to the image left.";
    case "right":
      return "The vehicle front points to the image right.";
    case "toward_camera":
      return "The vehicle front faces toward the camera.";
    case "away_from_camera":
      return "The vehicle front faces away from the camera.";
    default:
      return undefined;
  }
}

function renderPerspectiveSection(spec: PerspectiveSpec): string {
  const lines: string[] = ["[PERSPECTIVE]"];
  lines.push(`Target: ${spec.id} (v${spec.version}) \u2014 ${spec.labelEn}`);
  lines.push(`Category: ${spec.category}`);
  if (spec.basePerspectiveId !== undefined) {
    lines.push(
      `Presentation output for base perspective ${spec.basePerspectiveId} \u2014 identical geometry, presentation only.`,
    );
  }
  if (spec.pose.azimuthDeg !== undefined) {
    const tolerance =
      spec.pose.azimuthToleranceDeg !== undefined
        ? ` (\u00B1${spec.pose.azimuthToleranceDeg}\u00B0)`
        : "";
    lines.push(
      `Camera azimuth: ${formatAzimuth(spec.pose.azimuthDeg)}${tolerance}, from top view relative to the vehicle; 0\u00B0 = front, +90\u00B0 = right side of the vehicle, 180\u00B0 = rear, -90\u00B0 = left side of the vehicle.`,
    );
  }
  lines.push(`Elevation profile: ${spec.pose.elevationProfile}.`);
  if (spec.pose.pitchDeg !== undefined) {
    const tolerance =
      spec.pose.pitchToleranceDeg !== undefined
        ? ` (\u00B1${spec.pose.pitchToleranceDeg}\u00B0)`
        : "";
    lines.push(`Camera pitch: ${formatAzimuth(spec.pose.pitchDeg)}${tolerance}.`);
  }
  const orientationParts: string[] = [
    "Left/right always refer to the vehicle itself, never to the viewer.",
  ];
  const frontPhrase = frontDirectionPhrase(spec);
  if (frontPhrase !== undefined) orientationParts.push(frontPhrase);
  orientationParts.push("Mirroring or flipping is strictly forbidden.");
  lines.push(`Orientation: ${orientationParts.join(" ")}`);
  if (spec.orientationRules.notes !== undefined) {
    lines.push(`Note: ${spec.orientationRules.notes}`);
  }
  lines.push(
    `Must be clearly visible: ${spec.requiredVisibleSurfaces.join(", ")}.`,
  );
  if (spec.forbiddenDominantSurfaces.length > 0) {
    lines.push(
      `Must not dominate the composition: ${spec.forbiddenDominantSurfaces.join(", ")}.`,
    );
  }
  const framingSubject = spec.framing.fullVehicle
    ? "entire vehicle fully in frame"
    : "close composition on the target area";
  lines.push(
    `Framing: ${framingSubject}; padding ${spec.framing.paddingMinPct}-${spec.framing.paddingMaxPct}% of the frame.`,
  );
  if (spec.framing.requiredVisibleWheels.length > 0) {
    lines.push(
      `Wheels fully visible: ${spec.framing.requiredVisibleWheels.join(", ")}.`,
    );
  }
  const focal =
    spec.cameraGuidance.focalLengthMinMm !== undefined &&
    spec.cameraGuidance.focalLengthMaxMm !== undefined
      ? `, ${spec.cameraGuidance.focalLengthMinMm}-${spec.cameraGuidance.focalLengthMaxMm}mm equivalent focal range`
      : "";
  lines.push(`Camera: ${spec.cameraGuidance.projection} projection${focal}.`);
  if (spec.cameraGuidance.semanticConstraints.length > 0) {
    lines.push(
      `Guidance: ${spec.cameraGuidance.semanticConstraints.join("; ")}.`,
    );
  }
  return lines.join("\n");
}

function renderActiveModulesSection(
  moduleIds: readonly EditingModuleId[],
): string {
  const lines: string[] = ["[ACTIVE_MODULES]"];
  if (moduleIds.length === 0) {
    lines.push(
      "No editing modules enabled. Reproduce the vehicle's condition exactly as shown in the reference images.",
    );
    return lines.join("\n");
  }
  // Deterministische Reihenfolge: Katalogreihenfolge, Duplikate entfernt.
  const ordered = EDITING_MODULE_IDS.filter((id) => moduleIds.includes(id));
  lines.push("Apply exactly these edits and nothing else:");
  for (const id of ordered) {
    lines.push(`- ${id}: ${EDITING_MODULES[id].promptDirective}`);
  }
  lines.push("Any change beyond the listed edits is forbidden.");
  return lines.join("\n");
}

function renderReferenceManifestSection(
  references: readonly ReferenceManifestEntry[],
  scene: { scenePackId?: string; scenePlateId?: string } | undefined,
  logo: { logoAssetId?: string } | undefined,
): string {
  const lines: string[] = ["[REFERENCE_MANIFEST]"];
  const primary = references.filter((r) => r.role === "primary");
  const secondary = [...references.filter((r) => r.role === "secondary")].sort(
    (a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0),
  );
  const ordered = [...primary, ...secondary];
  ordered.forEach((ref, index) => {
    const qualifiers: string[] = [ref.role];
    if (ref.isExactPerspectiveMatch === true) {
      qualifiers.push("exact perspective match");
    }
    const coverage =
      ref.coverageSurfaces !== undefined && ref.coverageSurfaces.length > 0
        ? ` \u2014 authoritative for: ${[...ref.coverageSurfaces].sort().join(", ")}`
        : "";
    lines.push(
      `R${index + 1} (${qualifiers.join(", ")}): asset ${ref.assetId}${coverage}`,
    );
  });
  if (
    scene !== undefined &&
    scene.scenePlateId !== undefined &&
    scene.scenePackId !== undefined
  ) {
    lines.push(
      `Scene plate ${scene.scenePlateId} from pack ${scene.scenePackId}: environment only; it must never change the vehicle.`,
    );
  } else {
    lines.push(
      "No scene plate assigned: keep the environment neutral and photographically consistent with the references.",
    );
  }
  if (logo !== undefined && logo.logoAssetId !== undefined) {
    lines.push(
      `Environment logo asset ${logo.logoAssetId}: wall/floor branding in the scene only; never on the vehicle. Vehicle emblems come exclusively from the reference images.`,
    );
  }
  return lines.join("\n");
}

/**
 * Deterministischer Assembler: identischer Input (als Menge) ergibt
 * byte-identischen Output. Wirft bei TRANSFORMATION-Modulen, fehlender oder
 * mehrfacher Primaerreferenz und unbekannten Feldern (.strict()).
 */
export function assembleStrictReferencePrompt(
  input: PromptAssemblyInput,
): AssembledPrompt {
  const parsed = PromptAssemblyInputSchema.parse(input);

  const primaryCount = parsed.references.filter(
    (r) => r.role === "primary",
  ).length;
  if (primaryCount !== 1) {
    throw new Error(
      `assembleStrictReferencePrompt: exactly one primary reference required, got ${primaryCount}`,
    );
  }
  const assetIds = parsed.references.map((r) => r.assetId);
  if (new Set(assetIds).size !== assetIds.length) {
    throw new Error(
      "assembleStrictReferencePrompt: duplicate reference assetIds are not permitted",
    );
  }

  assertModuleSelectionAllowed("strict_reference", parsed.enabledModuleIds);

  const spec = getPerspectiveSpec(parsed.perspectiveSpecId);

  const sections: Record<PromptSectionKey, string> = {
    CORE: CORE_SECTION,
    PERSPECTIVE: renderPerspectiveSection(spec),
    ACTIVE_MODULES: renderActiveModulesSection(parsed.enabledModuleIds),
    REFERENCE_MANIFEST: renderReferenceManifestSection(
      parsed.references,
      parsed.scene,
      parsed.logo,
    ),
  };

  const text = PROMPT_SECTION_KEYS.map((key) => sections[key]).join("\n\n");
  return { text, sections };
}
