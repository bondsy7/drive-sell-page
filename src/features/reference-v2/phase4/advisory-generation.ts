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
 * liegt mindestens ein nutzbares Referenzbild vor, darf generiert werden —
 * fehlende Direktreferenzen werden als "geschaetzt" gekennzeichnet, nicht
 * blockiert.
 *
 * Unveraendert streng bleibt: der Kern-Prompt entsteht ausschliesslich im
 * eingefrorenen PromptAssembler, es gelangen KEINE Fahrzeugdaten (Marke,
 * Modell, Baujahr, Fahrgestellnummer) in die Generierung, und es wird niemals
 * still die Gegenseite gespiegelt.
 *
 * Zusaetzlich haengt dieser Pfad — und NUR dieser Pfad, isoliert vom
 * Legacy-Remastering — zwei deterministische Textbloecke an: ein fest
 * definiertes Showroom-Setup und die Remastering-Regeln. Beide sind
 * Konstanten, damit jede Ansicht dieselbe Umgebung erhaelt; sie koennen
 * spaeter durch deterministisches Compositing ersetzt werden.
 */

/** Genau EIN Standard-Showroom fuer alle Ansichten (MVP). */
export const DEFAULT_SHOWROOM_ID = "studio_neutral_v1";

const SHOWROOM_SECTION = [
  "[SHOWROOM]",
  `Fixed studio environment (id: ${DEFAULT_SHOWROOM_ID}) — identical for every generated view of this vehicle:`,
  "- Enclosed neutral indoor studio, seamless light grey floor, softly graded light grey background, no visible walls, doors, windows, plants, people or other vehicles.",
  "- Large soft overhead key light slightly in front of the vehicle, gentle fill from both sides, no coloured light, no lens flare.",
  "- Soft elliptical contact shadow directly under the vehicle; the vehicle stands firmly on the floor, never floating.",
  "- Identical light direction, floor tone, background gradient and exposure in every view; no outdoor scenery, no original background from the reference images is kept.",
  "- Clean floor without text, markings, logos, watermarks or signage anywhere in the image.",
].join("\n");

const REMASTER_SECTION = [
  "[REMASTER]",
  "Photographic finish of the same physical vehicle:",
  "- Preserve exactly: body shape and proportions, lamp geometry, front panel and air intakes, glass line, wheel and rim design, mirrors, door handles, trim strips and every piece of visible equipment as shown in the reference images.",
  "- Clean up presentation only: even paint, plausible reflections, no dirt, no dust, no water spots, no stickers or lettering added, no dents introduced.",
  "- Do not redesign the vehicle. Do not substitute generic wheels, lamps, emblems or bumpers. Do not change colour.",
  "- Number plates stay blank/neutral; never add text.",
  "- Where the target view exposes an area not visible in the primary reference, reconstruct it only from the other supplied reference images plus physically consistent continuation of the visible geometry. Never rely on catalogue knowledge of any make or type, and never mirror one side onto the other.",
].join("\n");

export interface AdvisoryReferenceInput {
  readonly assetId: string;
  readonly previewUrl: string;
}

export interface AdvisoryGenerationInput {
  readonly perspectiveId: PerspectiveId;
  /** Primaerreferenz — Bildquelle (Object-URL oder Signed URL). */
  readonly primaryPreviewUrl: string;
  readonly primaryAssetId: string;
  /** true, wenn die Analyse die Perspektive bestaetigt hat. */
  readonly exactPerspective: boolean;
  /** Zusaetzliche Fahrzeugreferenzen als Strukturnachweis (max. 3). */
  readonly secondaryReferences?: readonly AdvisoryReferenceInput[];
  readonly tier?: GenerationTier;
}

export interface AdvisoryGeneratedImage {
  readonly perspectiveId: PerspectiveId;
  readonly dataUrl: string;
  readonly model: string;
  readonly correlationId: string;
  readonly promptText: string;
}

const MAX_SECONDARY = 3;

export function buildAdvisoryPrompt(input: AdvisoryGenerationInput): string {
  const entry = getPerspectiveMasterEntry(input.perspectiveId);
  const secondary = (input.secondaryReferences ?? []).slice(0, MAX_SECONDARY);
  const core = assembleStrictReferencePrompt({
    perspectiveSpecId: entry.id,
    perspectiveSpecVersion: entry.version,
    enabledModuleIds: [],
    references: [
      {
        assetId: input.primaryAssetId,
        role: "primary",
        isExactPerspectiveMatch: input.exactPerspective,
      },
      ...secondary.map((s) => ({ assetId: s.assetId, role: "secondary" as const })),
    ],
  }).text;

  return [core, SHOWROOM_SECTION, REMASTER_SECTION].join("\n\n");
}

export async function generateFromAdvisoryReference(
  input: AdvisoryGenerationInput,
): Promise<AdvisoryGeneratedImage> {
  const entry = getPerspectiveMasterEntry(input.perspectiveId);
  const promptText = buildAdvisoryPrompt(input);
  const bytes = await loadReferenceBytes(input.primaryPreviewUrl);

  const references: {
    role: "primary" | "secondary";
    assetId: string;
    mimeType: string;
    dataBase64: string;
  }[] = [
    {
      role: "primary",
      assetId: input.primaryAssetId,
      mimeType: bytes.mimeType,
      dataBase64: bytes.dataBase64,
    },
  ];

  for (const ref of (input.secondaryReferences ?? []).slice(0, MAX_SECONDARY)) {
    try {
      const secondaryBytes = await loadReferenceBytes(ref.previewUrl);
      references.push({
        role: "secondary",
        assetId: ref.assetId,
        ...secondaryBytes,
      });
    } catch {
      // Ein nicht ladbarer Zusatznachweis darf die Generierung nicht stoppen.
    }
  }

  const { data, error } = await supabase.functions.invoke(
    "reference-v2-generate-image",
    {
      body: {
        perspectiveSpecId: entry.id,
        perspectiveSpecVersion: entry.version,
        prompt: promptText,
        tier: input.tier ?? "standard",
        references,
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
