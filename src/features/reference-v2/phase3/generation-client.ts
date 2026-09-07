import { supabase } from "@/integrations/supabase/client";
import { assembleStrictReferencePrompt } from "../domain/prompt-assembler";
import type { EditingModuleId } from "../domain/editing-modules";
import type { VehicleMasterRecord } from "../phase1/vehicle-master";
import type { PlannerItem } from "../phase2/planner-contract";

/**
 * Reference V2 — Phase 3: Strict-Reference Generation Client.
 *
 * Der Prompt entsteht ausschliesslich im eingefrorenen deterministischen
 * PromptAssembler. Fahrzeug-Metadaten (Marke, Modell, Baujahr, VIN) erreichen
 * die Generierung strukturell nicht. Referenzbilder sind die alleinige
 * visuelle Wahrheit.
 */

export const GENERATION_TIERS = ["economy", "standard", "premium"] as const;
export type GenerationTier = (typeof GENERATION_TIERS)[number];

export interface GeneratedReferenceImage {
  readonly perspectiveSpecId: string;
  readonly perspectiveSpecVersion: number;
  readonly model: string;
  readonly dataUrl: string;
  readonly promptText: string;
  readonly correlationId: string;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadReferenceBytes(
  previewUrl: string,
): Promise<{ mimeType: string; dataBase64: string }> {
  const response = await fetch(previewUrl);
  if (!response.ok) {
    throw new Error(`Referenzbild nicht ladbar (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const mimeType = ALLOWED_MIME.has(blob.type) ? blob.type : "image/png";
  const buffer = await blob.arrayBuffer();
  return { mimeType, dataBase64: base64FromArrayBuffer(buffer) };
}

export function buildPromptForPlannerItem(
  item: PlannerItem,
  enabledModuleIds: readonly EditingModuleId[] = [],
): string {
  const primary = item.selection.primary;
  if (!primary) {
    throw new Error("Keine Primärreferenz — Generierung nicht zulässig.");
  }
  return assembleStrictReferencePrompt({
    perspectiveSpecId: item.perspectiveSpecId,
    perspectiveSpecVersion: item.perspectiveSpecVersion,
    enabledModuleIds: [...enabledModuleIds],
    references: [
      {
        assetId: primary.assetId,
        role: "primary",
        isExactPerspectiveMatch: primary.exactPerspective,
      },
      ...item.selection.secondaryReferences.map((s) => ({
        assetId: s.assetId,
        role: "secondary" as const,
        coverageSurfaces: [...s.scopes],
      })),
    ],
  }).text;
}

export interface GenerateFromPlannerItemInput {
  readonly master: VehicleMasterRecord;
  readonly item: PlannerItem;
  readonly tier?: GenerationTier;
  readonly enabledModuleIds?: readonly EditingModuleId[];
}

export async function generateFromPlannerItem({
  master,
  item,
  tier = "standard",
  enabledModuleIds = [],
}: GenerateFromPlannerItemInput): Promise<GeneratedReferenceImage> {
  if (!item.generationAllowed) {
    throw new Error(
      "Preflight blockiert diese Perspektive — Generierung nicht zulässig.",
    );
  }
  const primary = item.selection.primary;
  if (!primary) {
    throw new Error("Keine Primärreferenz vorhanden.");
  }

  const promptText = buildPromptForPlannerItem(item, enabledModuleIds);

  const selected = [
    { assetId: primary.assetId, role: "primary" as const },
    ...item.selection.secondaryReferences.map((s) => ({
      assetId: s.assetId,
      role: "secondary" as const,
    })),
  ];

  const references = [] as {
    role: "primary" | "secondary";
    assetId: string;
    mimeType: string;
    dataBase64: string;
  }[];
  for (const ref of selected) {
    const asset = master.assets.find((a) => a.id === ref.assetId);
    if (!asset) {
      throw new Error(`Referenz ${ref.assetId} nicht im Vehicle Master.`);
    }
    const bytes = await loadReferenceBytes(asset.previewUrl);
    references.push({ ...ref, ...bytes });
  }

  const { data, error } = await supabase.functions.invoke(
    "reference-v2-generate-image",
    {
      body: {
        perspectiveSpecId: item.perspectiveSpecId,
        perspectiveSpecVersion: item.perspectiveSpecVersion,
        prompt: promptText,
        tier,
        references,
      },
    },
  );

  if (error) {
    throw new Error(error.message || "Generierung fehlgeschlagen.");
  }
  const payload = data as
    | {
        imageBase64?: string;
        mimeType?: string;
        model?: string;
        correlationId?: string;
        error?: string;
      }
    | null;
  if (!payload?.imageBase64) {
    throw new Error(payload?.error || "Generierung lieferte kein Bild.");
  }

  return {
    perspectiveSpecId: item.perspectiveSpecId,
    perspectiveSpecVersion: item.perspectiveSpecVersion,
    model: payload.model ?? "unbekannt",
    dataUrl: `data:${payload.mimeType ?? "image/png"};base64,${payload.imageBase64}`,
    promptText,
    correlationId: payload.correlationId ?? "",
  };
}
