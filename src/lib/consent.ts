/**
 * Consent-Verwaltung für autohaus.ai mit Basic Google Consent Mode V2.
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

function ensureGtagStub() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    // gtag.js verarbeitet nur echte `arguments`-Objekte, keine Arrays.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    } as (...args: unknown[]) => void;
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
    // Nur technisch notwendige Grundfunktionen sind ohne Einwilligung erlaubt.
    functionality_storage: 'granted' as GtagConsentValue,
    security_storage: 'granted' as GtagConsentValue,
    personalization_storage: 'denied' as GtagConsentValue,
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

  if (revoked) {
    window.gtag?.('consent', 'update', {
      analytics_storage: state.analytics ? 'granted' : 'denied',
      ad_storage: state.marketing ? 'granted' : 'denied',
      ad_user_data: state.marketing ? 'granted' : 'denied',
      ad_personalization: state.marketing ? 'granted' : 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      personalization_storage: 'denied',
    });
    clearGoogleCookies();
    if (!state.marketing) clearMarketingStorage();
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

/** Bekannte Google-Cookie-Namen bzw. -Präfixe. Fremde Cookies bleiben unangetastet. */
const GOOGLE_COOKIE_PREFIXES = ['_ga', '_gid', '_gat', '_gcl_', '__gads', '__gpi', 'FPAU', 'FPGCLAW', 'FPGCLDC'];

function deleteCookie(name: string) {
  const paths = ['/', window.location.pathname];
  const host = window.location.hostname;
  const domains = [undefined, host, `.${host}`];
  const parts = host.split('.');
  if (parts.length > 2) domains.push(`.${parts.slice(-2).join('.')}`);

  for (const path of paths) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${
        domain ? `; domain=${domain}` : ''
      }`;
    }
  }
}

/** Löscht bestmöglich die typischen Google-Analyse-/Werbe-Cookies dieser Domain. */
export function clearGoogleCookies() {
  if (typeof document === 'undefined') return;
  try {
    const names = document.cookie
      .split(';')
      .map((c) => c.split('=')[0]?.trim())
      .filter((n): n is string => !!n && GOOGLE_COOKIE_PREFIXES.some((p) => n.startsWith(p)));
    for (const name of new Set(names)) deleteCookie(name);
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
    functionality_storage: 'granted',
    security_storage: 'granted',
    personalization_storage: 'denied',
  });

  if (state.analytics || state.marketing) loadGoogleTagsIfConfigured(state);
}

let tagsLoaded = false;
let gaConfigured = false;
let adsConfigured = false;
let remoteGaId: string | null | undefined; // undefined = noch nicht geladen
let remoteGaPromise: Promise<string | null> | null = null;
/** Analyse-Events, die vor fertiger GA4-Konfiguration ausgelöst wurden (nur mit Einwilligung). */
let gaPageViewSent = false;
const pendingAnalytics: Array<[string, Record<string, unknown>]> = [];

/** GA4-Mess-ID: Build-Variable oder serverseitig hinterlegte ID. */
function getGaId() {
  const env = (
    (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined) ??
    (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)
  )?.trim();
  return env || remoteGaId || undefined;
}

/** Lädt die GA4-Mess-ID vom eigenen Backend (kein Google-Request). */
function fetchRemoteGaId(): Promise<string | null> {
  if (remoteGaId !== undefined) return Promise.resolve(remoteGaId);
  if (!remoteGaPromise) {
    remoteGaPromise = supabase.functions
      .invoke('public-analytics-config', { method: 'GET' })
      .then(({ data }) => {
        const id = (data as { ga4MeasurementId?: string | null } | null)?.ga4MeasurementId ?? null;
        remoteGaId = id;
        return id;
      })
      .catch(() => {
        remoteGaId = null;
        return null;
      });
  }
  return remoteGaPromise;
}

/** Google-Ads bewusst deaktiviert, bis AW-ID und Conversion-Label vorliegen (nur per Build-Variable). */
function getAdsId() {
  return (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim();
}

function withDebug(p: Record<string, unknown>) {
  return isDebugMode() ? { ...p, debug_mode: true } : p;
}

function isDebugMode() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('ga_debug') === '1') sessionStorage.setItem('auto3_ga_debug', '1');
    return sessionStorage.getItem('auto3_ga_debug') === '1';
  } catch {
    return false;
  }
}

function loadGoogleTagsIfConfigured(state: ConsentState) {
  if (state.analytics && !getGaId() && remoteGaId === undefined) {
    void fetchRemoteGaId().then(() => {
      const current = readConsent();
      if (current?.analytics) loadGoogleTagsIfConfigured(current);
    });
    return;
  }

  const gaId = getGaId();
  const adsId = getAdsId();

  // Sind bewusst keine IDs hinterlegt, passiert hier nichts.
  const primaryId = (state.analytics && gaId) || (state.marketing && adsId) || '';
  if (!primaryId) return;

  // Genau eine gtag.js-Installation, kein GTM-Container.
  if (!tagsLoaded) {
    tagsLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
    document.head.appendChild(script);
    window.gtag?.('js', new Date());
  }

  if (state.analytics && gaId && !gaConfigured) {
    gaConfigured = true;
    // page_view sendet der Funnel selbst (einmal pro Route) -> automatischen Seitenaufruf abschalten.
    window.gtag?.('config', gaId, {
      send_page_view: false,
      ...(isDebugMode() ? { debug_mode: true } : {}),
    });
    // Seitenaufruf, der vor der Einwilligung stattfand, einmalig nachreichen (ohne Doppelung).
    if (!pendingAnalytics.some(([n]) => n === 'page_view') && !gaPageViewSent) {
      pendingAnalytics.unshift(['page_view', { page_path: window.location.pathname }]);
    }
    while (pendingAnalytics.length) {
      const [n, p] = pendingAnalytics.shift()!;
      if (n === 'page_view') gaPageViewSent = true;
      window.gtag?.('event', n, withDebug(p));
    }
  }
  if (state.marketing && adsId && !adsConfigured) {
    adsConfigured = true;
    window.gtag?.('config', adsId);
  }
}

/**
 * Analyse-Event – wird nur gesendet, wenn aktuell eine Analyse-Einwilligung
 * vorliegt. Solange GA4 noch konfiguriert wird, werden Events kurz gepuffert.
 */
export function trackAnalyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const consent = readConsent();
  if (!consent?.analytics) return;
  const p = params ?? {};
  if (name === 'page_view') gaPageViewSent = true;
  if (gaConfigured) {
    window.gtag?.('event', name, withDebug(p));
  } else if (remoteGaId !== null || getGaId()) {
    if (pendingAnalytics.length < 20) pendingAnalytics.push([name, p]);
  }
}

/**
 * Google-Ads-Conversion – nur mit aktueller Marketing-Einwilligung und
 * konfigurierter Konto-ID. `sendTo` kann weggelassen werden, dann wird
 * `VITE_GOOGLE_ADS_ID` mit `VITE_GOOGLE_ADS_CONVERSION_LABEL` kombiniert.
 * Ohne Konfiguration passiert bewusst nichts.
 */
export function trackGoogleAdsConversion(sendTo?: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const consent = readConsent();
  const adsId = getAdsId();
  if (!consent?.marketing || !adsId || !tagsLoaded) return;

  const label = (import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL as string | undefined)?.trim();
  const target = sendTo?.trim() || (label ? `${adsId}/${label}` : '');
  if (!target) return;

  window.gtag?.('event', 'conversion', { ...(params ?? {}), send_to: target });
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
