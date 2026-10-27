// Single registration point for the offline service worker.
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
const LOVABLE_SUFFIXES = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];

export function isSwRefusedHost(hostname: string, search = ""): boolean {
  const h = hostname.toLowerCase();
  if (new URLSearchParams(search).get("sw") === "off") return true;
  const label = h.split(".")[0];
  if (LOVABLE_SUFFIXES.some((s) => h.endsWith(s))) {
    if (PREVIEW_LABEL.test(label)) return true;
    if (/^project--[a-z0-9-]+-dev$/.test(label)) return true;
  }
  for (const d of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) {
    if (h === d || h.endsWith("." + d)) return true;
  }
  return false;
}

async function unregisterAppSw() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs.filter((r) => (r.active || r.installing || r.waiting)?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
  );
}

export function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let inIframe = true;
  try { inIframe = window.self !== window.top; } catch { /* cross-origin */ }
  const refused = !import.meta.env.PROD || inIframe || isSwRefusedHost(window.location.hostname, window.location.search);
  if (refused) { void unregisterAppSw().catch(() => {}); return; }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
