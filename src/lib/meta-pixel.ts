/**
 * Meta-Pixel (Facebook/Instagram) – nur mit Marketing-Einwilligung.
 * Ohne `VITE_META_PIXEL_ID` passiert bewusst nichts.
 * Keine personenbezogenen Daten (kein Advanced Matching).
 */
import { readConsent } from './consent';

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...a: unknown[]) => void; push?: unknown };

declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

let loaded = false;

function pixelId() {
  return (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim();
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
  f('init', id);
  f('track', 'PageView');
}

/** Bei Widerruf: keine weiteren Sendungen. */
export function revokeMetaPixel() {
  if (typeof window !== 'undefined' && loaded) window.fbq?.('consent', 'revoke');
}

export function trackMetaEvent(name: 'PageView' | 'Lead' | 'Schedule' | 'ViewContent', eventId?: string, params: Record<string, string | number> = {}) {
  if (typeof window === 'undefined' || !loaded) return;
  if (readConsent()?.marketing !== true) return;
  window.fbq?.('track', name, params, eventId ? { eventID: eventId } : undefined);
}
