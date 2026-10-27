import { toast } from 'sonner';

/** Buttons, die ohne Verbindung nicht funktionieren (Generieren, Remastern, Speichern …). */
const NETWORK_ACTION = /(generier|remaster|starten|speichern|erstellen|hochladen|senden|veröffentlich|freigeben|analysier|regenerier)/i;
/** Ausnahme: Foto-Upload für Originale läuft offline über die Warteschlange. */
const OFFLINE_OK_ATTR = 'data-offline-ok';

export function isNetworkActionLabel(label: string): boolean {
  return NETWORK_ACTION.test(label.trim());
}

function shouldBlock(btn: HTMLElement) {
  if (btn.closest(`[${OFFLINE_OK_ATTR}]`)) return false;
  return isNetworkActionLabel(btn.getAttribute('aria-label') || btn.textContent || '');
}

function mark() {
  const offline = !navigator.onLine;
  document.querySelectorAll<HTMLElement>('button, [role="button"]').forEach(btn => {
    if (offline && shouldBlock(btn)) btn.setAttribute('data-offline-blocked', '');
    else btn.removeAttribute('data-offline-blocked');
  });
}

export function installOfflineActionGuard() {
  if (typeof window === 'undefined') return;
  const observer = new MutationObserver(() => { if (!navigator.onLine) mark(); });
  const update = () => {
    mark();
    if (navigator.onLine) observer.disconnect();
    else observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  document.addEventListener('click', e => {
    if (navigator.onLine) return;
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('button, [role="button"]');
    if (btn && shouldBlock(btn)) {
      e.preventDefault();
      e.stopPropagation();
      toast.info('Ohne Internetverbindung nicht möglich – bitte später erneut versuchen.');
    }
  }, true);
  update();
}
