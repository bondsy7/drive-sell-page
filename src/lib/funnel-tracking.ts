/**
 * Zentrales Funnel-Tracking für den B2B-Paid-Funnel.
 *
 * - An Google (GA4/Ads) wird nur mit der jeweiligen Einwilligung gesendet
 *   (siehe trackAnalyticsEvent / trackGoogleAdsConversion in consent.ts).
 * - Intern wird ein anonymes Ereignis ohne personenbezogene Daten gezählt
 *   (keine E-Mail, Telefonnummer, Firma, VIN oder Freitexte).
 * - Jede Aktion erhält eine event_id; doppelte Ereignisse werden verworfen.
 */
import { supabase } from '@/integrations/supabase/client';
import { readConsent, trackAnalyticsEvent, trackGoogleAdsConversion } from './consent';
import { getAttribution, getLastTouch } from './funnel-attribution';

export type FunnelEventName =
  | 'page_view'
  | 'cta_click'
  | 'form_start'
  | 'vehicle_test_started'
  | 'process_check_started'
  | 'generate_lead'
  | 'demo_requested';

const SERVER_EVENTS = new Set<FunnelEventName>([
  'page_view', 'cta_click', 'form_start', 'vehicle_test_started', 'demo_requested', 'process_check_started',
]);

const SESSION_KEY = 'auto3_funnel_session';
const sentIds = new Set<string>();

let memorySession: string | null = null;

/** Ohne Analyse-Einwilligung nur im Arbeitsspeicher (nichts im Browser gespeichert, § 25 TDDDG). */
function sessionId(): string {
  if (!memorySession) memorySession = crypto.randomUUID();
  if (readConsent()?.analytics !== true) return memorySession;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = memorySession;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return memorySession;
  }
}

const PII_KEYS = /mail|phone|tel|name|company|firma|vin|note|notiz|message|website/i;

function safeParams(params: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (PII_KEYS.test(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && !v.includes('@')) out[k] = v.slice(0, 100);
  }
  return out;
}

interface TrackOptions {
  leadId?: string;
  /** Stabile ID für Dedup (z. B. `generate_lead:<leadId>`). Standard: einmal pro Seite/Sitzung. */
  eventId?: string;
}

export function trackFunnelEvent(name: FunnelEventName, params: Record<string, unknown> = {}, opts: TrackOptions = {}) {
  if (typeof window === 'undefined') return;
  const page = window.location.pathname;
  // Dedup-Schlüssel ohne Sitzungs-ID, damit ein Wechsel der Sitzungs-ID (z. B. nach Einwilligung) keine Dubletten erzeugt.
  const dedupKey = `${name}:${page}:${String(params.cta_id ?? params.step ?? '')}`;
  const useKey = !opts.eventId && name !== 'page_view';
  if (useKey && sentIds.has(dedupKey)) return;
  if (useKey) sentIds.add(dedupKey);
  const eventId = opts.eventId ?? `${name}:${sessionId()}:${page}:${String(params.cta_id ?? params.step ?? '')}`;
  if (sentIds.has(eventId)) return;
  sentIds.add(eventId);

  const clean = safeParams(params);
  const consent = readConsent();

  // 1) Google – nur mit Einwilligung (Prüfung in consent.ts)
  trackAnalyticsEvent(name, { ...clean, event_id: eventId });
  if (name === 'generate_lead') {
    const label = (import.meta.env.VITE_GOOGLE_ADS_GENERATE_LEAD_LABEL as string | undefined)?.trim();
    const adsId = (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim();
    trackGoogleAdsConversion(label && adsId ? `${adsId}/${label}` : undefined, { transaction_id: eventId });
  }

  // 2) Interne, anonyme Zählung (generate_lead wird serverseitig beim Speichern erfasst)
  if (!SERVER_EVENTS.has(name)) return;
  const first = getAttribution();
  const last = getLastTouch();
  const utm = Object.keys(last).length > 0 ? last : first;
  void supabase.functions.invoke('track-marketing-event', {
    body: {
      event_name: name,
      event_id: eventId,
      lead_id: opts.leadId,
      session_id: sessionId(),
      page,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      has_click_id: !!(utm.gclid || utm.gbraid || utm.wbraid || utm.msclkid || utm.fbclid || utm.li_fat_id),
      consent_analytics: consent?.analytics === true,
      consent_marketing: consent?.marketing === true,
      metadata: clean,
    },
  }).catch(() => { /* Tracking darf den Ablauf nie blockieren */ });
}
