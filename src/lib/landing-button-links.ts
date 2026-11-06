/**
 * Per-button link overrides (pageContent.buttonLinks), shared by React renderer and HTML export.
 * Only safe schemes are accepted so a saved link can never inject script into public HTML.
 */
export function normalizeButtonLink(raw: string | null | undefined): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  if (/^#[\w-]+$/.test(value)) return value;
  if (/^(mailto|tel):[^\s<>"']+$/i.test(value)) return value;
  if (/^\/[^\s<>"']*$/.test(value) && !value.startsWith('//')) return value;
  const withScheme = /^https?:\/\//i.test(value) ? value : /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(value) ? `https://${value}` : '';
  if (!withScheme) return null;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveButtonLink(override: string | null | undefined, fallback: string): { href: string; external: boolean } {
  const href = normalizeButtonLink(override) || fallback;
  return { href, external: /^https?:\/\//i.test(href) };
}
