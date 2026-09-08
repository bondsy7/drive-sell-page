import { supabase } from "@/integrations/supabase/client";
import { assembleStrictReferencePrompt } from "../domain/prompt-assembler";
import type { PerspectiveId } from "../domain/perspectives/types";
import { getPerspectiveMasterEntry } from "../phase1/perspective-master";
import { loadReferenceBytes, type GenerationTier } from "../phase3/generation-client";

/**
 * Reference V2 — Phase 4: Generierung aus einer BERATEND ausgewaehlten Referenz.
 *
 * Der strikte Planner bleibt unveraendert erhalten und liefert weiterhin die
 * Diagnose. Hier wird zusaetzlich der ausdrueckliche Nutzerwille umgesetzt:
 * liegt mindestens ein nutzbares, vom Nutzer bestaetigtes Referenzbild vor,
 * darf generiert werden ("Trotzdem generieren").
 *
 * Unveraendert streng bleibt: der Prompt entsteht ausschliesslich im
 * eingefrorenen PromptAssembler, es gelangen KEINE Fahrzeugdaten (Marke,
 * Modell, Baujahr, VIN) in die Generierung, und es wird niemals still die
 * Gegenseite gespiegelt.
 */

export interface AdvisoryGenerationInput {
  readonly perspectiveId: PerspectiveId;
  /** Primaerreferenz — Bildquelle (Object-URL oder Signed URL). */
  readonly primaryPreviewUrl: string;
  readonly primaryAssetId: string;
  /** true, wenn die Analyse die Perspektive bestaetigt hat. */
  readonly exactPerspective: boolean;
  readonly tier?: GenerationTier;
}

export interface AdvisoryGeneratedImage {
  readonly perspectiveId: PerspectiveId;
  readonly dataUrl: string;
  readonly model: string;
  readonly correlationId: string;
  readonly promptText: string;
}

export function buildAdvisoryPrompt(input: AdvisoryGenerationInput): string {
  const entry = getPerspectiveMasterEntry(input.perspectiveId);
  return assembleStrictReferencePrompt({
    perspectiveSpecId: entry.id,
    perspectiveSpecVersion: entry.version,
    enabledModuleIds: [],
    references: [
      {
        assetId: input.primaryAssetId,
        role: "primary",
        isExactPerspectiveMatch: input.exactPerspective,
      },
    ],
  }).text;
}

export async function generateFromAdvisoryReference(
  input: AdvisoryGenerationInput,
): Promise<AdvisoryGeneratedImage> {
  const entry = getPerspectiveMasterEntry(input.perspectiveId);
  const promptText = buildAdvisoryPrompt(input);
  const bytes = await loadReferenceBytes(input.primaryPreviewUrl);

  const { data, error } = await supabase.functions.invoke(
    "reference-v2-generate-image",
    {
      body: {
        perspectiveSpecId: entry.id,
        perspectiveSpecVersion: entry.version,
        prompt: promptText,
        tier: input.tier ?? "standard",
        references: [
          {
            role: "primary",
            assetId: input.primaryAssetId,
            mimeType: bytes.mimeType,
            dataBase64: bytes.dataBase64,
          },
        ],
      },
    },
  );

  if (error) throw new Error(error.message || "Generierung fehlgeschlagen.");
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
    perspectiveId: input.perspectiveId,
    dataUrl: `data:${payload.mimeType ?? "image/png"};base64,${payload.imageBase64}`,
    model: payload.model ?? "unbekannt",
    correlationId: payload.correlationId ?? "",
    promptText,
  };
}
