/**
 * First-touch Attribution für den B2B-Paid-Funnel.
 * Erfasst Kampagnenparameter auf der Landingpage und hält sie bis zum Formular.
 * Kein Tracking-Pixel, keine Drittanbieter – rein lokale Speicherung.
 */

const STORAGE_KEY = 'auto3_b2b_attribution_v1';

export const ATTRIBUTION_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'msclkid',
  'fbclid',
  'li_fat_id',
] as const;

export type AttributionParam = (typeof ATTRIBUTION_PARAMS)[number];

export interface FunnelAttribution extends Partial<Record<AttributionParam, string>> {
  landing_page?: string;
  first_referrer?: string;
  source_label?: string;
  captured_at?: string;
}

function readStored(): FunnelAttribution {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as FunnelAttribution) : {};
  } catch {
    return {};
  }
}

function persist(data: FunnelAttribution) {
  const raw = JSON.stringify(data);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* ignore */
  }
}

/**
 * Speichert den First Touch. Bereits vorhandene Werte werden NICHT überschrieben,
 * solange die neue Sitzung keine eigenen Kampagnenparameter mitbringt.
 */
export function captureAttribution(sourceLabel?: string): FunnelAttribution {
  if (typeof window === 'undefined') return {};

  const existing = readStored();
  const params = new URLSearchParams(window.location.search);

  const incoming: FunnelAttribution = {};
  for (const key of ATTRIBUTION_PARAMS) {
    const value = params.get(key);
    if (value) incoming[key] = value.slice(0, 300);
  }
  const hasIncomingCampaign = Object.keys(incoming).length > 0;

  // First touch bleibt erhalten, sofern bereits erfasst und keine neuen Kampagnendaten anliegen.
  if (existing.captured_at && !hasIncomingCampaign) {
    if (sourceLabel && !existing.source_label) {
      const merged = { ...existing, source_label: sourceLabel };
      persist(merged);
      return merged;
    }
    return existing;
  }

  const next: FunnelAttribution = {
    ...(hasIncomingCampaign ? incoming : existing),
    landing_page: existing.landing_page || window.location.pathname + window.location.search,
    first_referrer: existing.first_referrer || document.referrer || 'direct',
    source_label: sourceLabel || existing.source_label || 'paid_funnel',
    captured_at: existing.captured_at || new Date().toISOString(),
  };

  persist(next);
  return next;
}

export function getAttribution(): FunnelAttribution {
  if (typeof window === 'undefined') return {};
  return readStored();
}
