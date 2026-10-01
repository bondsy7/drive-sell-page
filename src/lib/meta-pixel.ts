/**
 * Meta-Pixel (Facebook/Instagram) – nur mit Marketing-Einwilligung.
 * Pixel-ID ist öffentlich; `VITE_META_PIXEL_ID` kann sie überschreiben.
 * Keine personenbezogenen Daten (kein Advanced Matching, autoConfig aus).
 * Seitenaufrufe kommen aus dem Funnel (`page_view`), nicht automatisch vom Router.
 */
import { readConsent } from './consent';

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...a: unknown[]) => void; push?: unknown };

declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

const DEFAULT_PIXEL_ID = '1491394502834323';
/** Query-Parameter, die nie an Meta gehen dürfen (Lead-Zugang, Kontaktdaten). */
const SENSITIVE_PARAMS = ['lead', 't', 'token', 'email', 'name', 'phone'];

let loaded = false;
let lastPagePath: string | null = null;

function pixelId() {
  return ((import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim()) || DEFAULT_PIXEL_ID;
}

/** Entfernt sensible Parameter aus der sichtbaren Adresse, bevor Meta sie lesen kann. */
export function stripSensitiveParams() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const p of SENSITIVE_PARAMS) {
    if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }
  }
  if (changed) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

function hasSensitiveParams() {
  const sp = new URLSearchParams(window.location.search);
  return SENSITIVE_PARAMS.some((p) => sp.has(p));
}

export function loadMetaPixelIfAllowed() {
  if (typeof window === 'undefined' || loaded) return;
  const id = pixelId();
  if (!id || readConsent()?.marketing !== true) return;
  loaded = true;
  const f = function (...args: unknown[]) {
    if (f.callMethod) f.callMethod(...args);
    else f.queue!.push(args);
  } as Fbq;
  f.queue = [];
  f.loaded = true;
  f.version = '2.0';
  f.push = f;
  window.fbq = f;
  window._fbq = f;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  f('consent', 'grant');
  f('set', 'autoConfig', false, id);
  f('init', id);
  trackMetaPageView();
}

/** Bei Widerruf: keine weiteren Sendungen. */
export function revokeMetaPixel() {
  if (typeof window !== 'undefined' && loaded) window.fbq?.('consent', 'revoke');
}

/** Genau ein PageView pro Route; nie mit sensiblen Parametern in der Adresse. */
export function trackMetaPageView() {
  if (typeof window === 'undefined' || !loaded) return;
  if (readConsent()?.marketing !== true) return;
  if (hasSensitiveParams()) return; // Seite bereinigt die Adresse und meldet sich erneut
  const path = window.location.pathname;
  if (lastPagePath === path) return;
  lastPagePath = path;
  window.fbq?.('track', 'PageView');
}

export function trackMetaEvent(name: 'PageView' | 'Lead' | 'Schedule' | 'ViewContent', eventId?: string, params: Record<string, string | number> = {}) {
  if (typeof window === 'undefined' || !loaded) return;
  if (readConsent()?.marketing !== true) return;
  window.fbq?.('track', name, params, eventId ? { eventID: eventId } : undefined);
}

/** Gemerkter ViewContent-Wunsch, falls die Einwilligung erst nach dem Seitenaufruf kommt. */
let pendingViewContent: { path: string; name: string; category: string } | null = null;
const sentViewContentPaths = new Set<string>();

/**
 * ViewContent für Kampagnen-Landingpages: genau einmal pro Seitenaufruf,
 * nur technische, stabile Parameter (Grundlage für Custom Audiences).
 * Wird nachgereicht, sobald der Pixel nach Einwilligung geladen ist.
 */
export function trackMetaViewContent(contentName: string, contentCategory: string) {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (sentViewContentPaths.has(path)) return;
  pendingViewContent = { path, name: contentName, category: contentCategory };
  flushViewContent();
}

function flushViewContent() {
  if (!pendingViewContent || !loaded) return;
  if (readConsent()?.marketing !== true) return;
  if (hasSensitiveParams()) return;
  if (window.location.pathname !== pendingViewContent.path) return;
  if (sentViewContentPaths.has(pendingViewContent.path)) return;
  sentViewContentPaths.add(pendingViewContent.path);
  trackMetaEvent('ViewContent', `view_content:${pendingViewContent.path}`, {
    content_name: pendingViewContent.name,
    content_category: pendingViewContent.category,
  });
  pendingViewContent = null;
}
