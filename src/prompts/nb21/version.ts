/**
 * Nano Banana 2.1 – getrennter Prompt-Pfad.
 *
 * REGEL: Dieser Pfad wird AUSSCHLIESSLICH für den Tier `nb21` verwendet.
 * Alle anderen Tiers (inkl. `qualitaet` = Nano Banana 2) bauen ihre Prompts
 * unverändert über `buildMasterPrompt` + `PIPELINE_JOBS`.
 *
 * Admin-Prompt-Overrides (admin_settings.ai_prompts) gelten bewusst NUR für 2.0.
 * Sie lassen sich nicht sauber auf die 9-Abschnitt-Struktur abbilden und werden
 * im 2.1-Pfad daher absichtlich ignoriert.
 *
 * Server-Spiegel: supabase/functions/remaster-vehicle-image/index.ts
 * (NB21_* Konstanten) – Werte müssen identisch bleiben.
 */
export const NB21_TIER = 'nb21' as const;
export const NB21_PROMPT_VERSION = 'nb21-v1' as const;
export const NB21_MODEL_ID = 'gemini-nano-banana-2.1' as const;

/** Marker-Zeile, an der der Server die 2.1-Version erkennt. */
export const NB21_VERSION_MARKER = `PROMPT_VERSION: ${NB21_PROMPT_VERSION}`;

/** Platzhalter, die der Server durch seine verbindlichen Invarianten ersetzt. */
export const NB21_SERVER_SLOTS = {
  identity: '{{NB21_SERVER_IDENTITY}}',
  perspective: '{{NB21_SERVER_PERSPECTIVE}}',
  lighting: '{{NB21_SERVER_LIGHTING}}',
} as const;

export function isNb21Tier(tier?: string | null): boolean {
  return tier === NB21_TIER;
}

/**
 * Prompt-Version für eine Neu-Generierung. Gespeicherte Version gewinnt;
 * Läufe mit Tier nb21 ohne gespeicherte Version stammen aus der Testphase und
 * werden ebenfalls über 2.1 gebaut. Alles andere bleibt 2.0 (undefined).
 */
export function resolveRegenerationPromptVersion(ctx?: { promptVersion?: string; modelTier?: string } | null): typeof NB21_PROMPT_VERSION | undefined {
  if (ctx?.promptVersion === NB21_PROMPT_VERSION) return NB21_PROMPT_VERSION;
  if (!ctx?.promptVersion && isNb21Tier(ctx?.modelTier)) return NB21_PROMPT_VERSION;
  return undefined;
}
