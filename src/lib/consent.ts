/**
 * Consent-Verwaltung für AUTO3 mit Basic Google Consent Mode V2.
 *
 * Grundregeln:
 * - Ohne Einwilligung wird KEIN Google-Script geladen und es werden keine
 *   (auch keine cookielosen) Pings gesendet -> "Basic Consent Mode".
 * - Notwendige/sicherheitsrelevante Speicherung (Auth-Session) ist kein
 *   einwilligungspflichtiger Zweck und wird hier nicht als solcher geführt.
 *
 * ANSCHLUSS-CHECKLISTE für GA4 / Google Ads (später):
 * 1. `VITE_GA_MEASUREMENT_ID` (G-XXXXXXX) und/oder `VITE_GOOGLE_ADS_ID` (AW-XXXXXXX)
 *    als Umgebungsvariablen setzen. Sind sie leer, passiert bewusst nichts.
 * 2. GA4-Datenaufbewahrung im Konto auf <= 14 Monate stellen.
 * 3. Google-Signale / Werbepersonalisierung nur aktivieren, wenn gewollt.
 * 4. Mit dem Google Tag Assistant prüfen: vor Einwilligung keine Requests an
 *    googletagmanager.com / google-analytics.com / googleads.g.doubleclick.net.
 * 5. Conversion-Labels erst nach juristischer Freigabe ergänzen.
 */

import { LEGAL_VERSIONS } from './legal-config';
import { supabase } from '@/integrations/supabase/client';

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface ConsentState {
  version: string;
  consentId: string;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'auto3_consent_v1';

type GtagConsentValue = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function pushGtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function ensureGtagStub() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => pushGtag(...args);
  }
}

/** Setzt den Default (alles verweigert) BEVOR irgendein Tag geladen werden darf. */
export function initConsentDefaults() {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  window.gtag?.('consent', 'default', {
    ad_storage: 'denied' as GtagConsentValue,
    ad_user_data: 'denied' as GtagConsentValue,
    ad_personalization: 'denied' as GtagConsentValue,
    analytics_storage: 'denied' as GtagConsentValue,
    wait_for_update: 500,
  });

  const stored = readConsent();
  if (stored) applyConsent(stored);
}

export function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== LEGAL_VERSIONS.consent) return null; // neue Version -> erneut fragen
    return parsed;
  } catch {
    return null;
  }
}

export function createConsent(analytics: boolean, marketing: boolean): ConsentState {
  return {
    version: LEGAL_VERSIONS.consent,
    consentId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    analytics,
    marketing,
    timestamp: new Date().toISOString(),
  };
}

export function saveConsent(state: ConsentState) {
  const previous = readConsent();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Speicher nicht verfügbar – Consent gilt dann nur für diese Sitzung */
  }

  // Widerruf: bereits geladene Google-Scripts lassen sich nicht sauber entfernen.
  // Deshalb Zustand speichern und die Seite neu laden – danach lädt kein Script mehr.
  const revoked =
    (previous?.analytics === true && state.analytics === false) ||
    (previous?.marketing === true && state.marketing === false);

  if (revoked && tagsLoaded) {
    window.gtag?.('consent', 'update', {
      analytics_storage: state.analytics ? 'granted' : 'denied',
      ad_storage: state.marketing ? 'granted' : 'denied',
      ad_user_data: state.marketing ? 'granted' : 'denied',
      ad_personalization: state.marketing ? 'granted' : 'denied',
    });
    window.location.reload();
    return;
  }

  applyConsent(state);

  if (!state.marketing) clearMarketingStorage();
}

/** Entfernt lokal gespeicherte Kampagnendaten, wenn die Marketing-Einwilligung fehlt. */
function clearMarketingStorage() {
  try {
    window.localStorage.removeItem('auto3_b2b_attribution_v1');
    window.sessionStorage.removeItem('auto3_b2b_attribution_v1');
  } catch {
    /* ignore */
  }
}

/** Überträgt den Zustand an Google Consent Mode und lädt Tags erst bei Einwilligung. */
export function applyConsent(state: ConsentState) {
  if (typeof window === 'undefined') return;
  ensureGtagStub();
  window.gtag?.('consent', 'update', {
    analytics_storage: state.analytics ? 'granted' : 'denied',
    ad_storage: state.marketing ? 'granted' : 'denied',
    ad_user_data: state.marketing ? 'granted' : 'denied',
    ad_personalization: state.marketing ? 'granted' : 'denied',
  });

  if (state.analytics || state.marketing) loadGoogleTagsIfConfigured(state);
}

let tagsLoaded = false;

function loadGoogleTagsIfConfigured(state: ConsentState) {
  const gaId = (
    (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined) ??
    (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)
  )?.trim();
  const adsId = (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim();

  // Aktuell sind im Projekt bewusst KEINE IDs hinterlegt -> es wird nichts geladen.
  const primaryId = (state.analytics && gaId) || (state.marketing && adsId) || '';
  if (!primaryId || tagsLoaded) return;
  tagsLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
  document.head.appendChild(script);

  window.gtag?.('js', new Date());
  if (state.analytics && gaId) window.gtag?.('config', gaId);
  if (state.marketing && adsId) window.gtag?.('config', adsId);
}

/**
 * Dokumentiert die Entscheidung zusätzlich serverseitig (append-only).
 * Bewusst ohne IP-Adresse; Nutzerkennung nur, wenn bereits angemeldet.
 */
export async function recordConsentServerSide(state: ConsentState) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from('consent_records').insert({
      consent_id: state.consentId,
      version: state.version,
      analytics: state.analytics,
      marketing: state.marketing,
      user_id: data.user?.id ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    });
  } catch {
    /* Protokollierung darf die Auswahl nie blockieren */
  }
}

/** Event-Bus, damit Footer/Banner denselben Dialog öffnen können. */
export const CONSENT_OPEN_EVENT = 'auto3:open-consent-settings';

export function openConsentSettings() {
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}
