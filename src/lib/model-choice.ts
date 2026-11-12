// Public choices keep their existing wire IDs for provider routing and saved runs.
export const MODEL_CHOICES = ['premium', 'flare'] as const;
export const DEFAULT_MODEL_TIER = 'premium' as const;

// Zentrale, leicht entfernbare Ausnahme: nur dieser Account sieht alle technisch
// unterstützten Bild-Tiers (Testzugang). Keine Plan-, Preis- oder Billing-Änderung.
export const FULL_MODEL_ACCESS_EMAILS = ['d.bonds@autoactiva.de'] as const;

export interface ModelTierInfo {
  id: string; label: string; sublabel: string; group: string;
  /** in remaster-vehicle-image ENGINE_MAP vorhanden */
  remaster: boolean;
  /** in generate-vehicle-image / generate-banner MODEL_MAP vorhanden */
  generate: boolean;
}

// Alle aktuell im Backend unterstützten Tiers.
export const ALL_MODEL_TIERS: ModelTierInfo[] = [
  { id: 'schnell',   label: 'Schnell',  sublabel: 'Schnelle Verarbeitung',  group: 'A', remaster: true, generate: true },
  { id: 'qualitaet', label: 'Qualität', sublabel: 'Ausgewogene Qualität',   group: 'A', remaster: true, generate: true },
  { id: 'premium',   label: 'Premium',  sublabel: 'Standard',               group: 'A', remaster: true, generate: true },
  { id: 'flare',     label: 'Advanced', sublabel: 'Upgrade',                group: 'B', remaster: true, generate: false },
  { id: 'turbo',     label: 'Turbo',    sublabel: 'Erweiterte Qualität',    group: 'B', remaster: true, generate: true },
  { id: 'ultra',     label: 'Ultra',    sublabel: 'Hohe Qualität',          group: 'B', remaster: true, generate: true },
  { id: 'neu',       label: 'Neu',      sublabel: 'Aktuelle Qualität',      group: 'B', remaster: true, generate: true },
  { id: 'sunburst',  label: 'Sunburst', sublabel: 'Maximale Qualität',      group: 'B', remaster: true, generate: false },
  // Nano Banana 2.1 Testpfad (nur Testaccount); Versionswahl V1/V2 im Foto-Bereich.
  { id: 'nb21',      label: 'NB 2.1',   sublabel: 'Test',                   group: 'A', remaster: true, generate: false },
];

export function hasFullModelAccess(email?: string | null): boolean {
  return !!email && (FULL_MODEL_ACCESS_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

/** Sichtbare Tiers: öffentlich Premium/Advanced; Testaccount alle unterstützten. */
export function getSelectableModelTiers(actionType: string, email?: string | null): ModelTierInfo[] {
  if (!hasFullModelAccess(email)) {
    return ALL_MODEL_TIERS.filter((t) => (MODEL_CHOICES as readonly string[]).includes(t.id));
  }
  const key = actionType === 'image_generate' ? 'generate' : 'remaster';
  return ALL_MODEL_TIERS.filter((t) => t[key]);
}

export function resolveSelectableModelTier(tier: string, email?: string | null, actionType: string = 'image_remaster'): string {
  if (hasFullModelAccess(email)) {
    const allowed = getSelectableModelTiers(actionType, email);
    return allowed.some((t) => t.id === tier) ? tier : DEFAULT_MODEL_TIER;
  }
  return tier === 'flare' ? 'flare' : DEFAULT_MODEL_TIER;
}
