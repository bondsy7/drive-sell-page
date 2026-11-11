/**
 * Markenbezogene Ansprechpartner aus dem Profil (profiles.ci_settings.brandContacts).
 * Vorerst nur für generierte Landingpages: die gewählte Marke setzt ihre
 * Ansprechpartner automatisch in den Kontakt-Abschnitt.
 */
import { isContactSection } from '@/lib/landing-contact-plain';

export interface BrandContact { id: string; brand: string; brands: string[]; name: string; email: string; phone: string; imageUrl?: string }

export function normalizeBrand(b: string | null | undefined): string {
  return (b || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Markenliste eines Kontakts: neue Mehrfachauswahl, sonst einzelner Markenwert. */
export function normalizeBrandList(brands: unknown, legacyBrand?: unknown): string[] {
  const raw = Array.isArray(brands)
    ? brands.map(b => String(b || ''))
    : String(legacyBrand || '').split(',');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const value = item.trim().slice(0, 60);
    const key = normalizeBrand(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Nur http(s)-Bildlinks zulassen. */
export function safeImageUrl(u: unknown): string {
  const v = String(u || '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v.slice(0, 1000) : '';
}

export function readBrandContacts(ciSettings: unknown): BrandContact[] {
  const list = (ciSettings as any)?.brandContacts;
  if (!Array.isArray(list)) return [];
  return list.filter(c => c && typeof c === 'object').map((c: any) => {
    const brands = normalizeBrandList(c.brands, c.brand);
    return {
      id: String(c.id || crypto.randomUUID()), brand: brands.join(', ') || String(c.brand || ''), brands,
      name: String(c.name || ''), email: String(c.email || ''), phone: String(c.phone || ''), imageUrl: safeImageUrl(c.imageUrl),
    };
  });
}

export function contactsForBrand(contacts: BrandContact[], brand: string): BrandContact[] {
  const key = normalizeBrand(brand);
  if (!key) return [];
  return contacts.filter(c =>
    (c.brands?.length ? c.brands.some(b => normalizeBrand(b) === key) : normalizeBrand(c.brand) === key)
    && (c.name.trim() || c.email.trim() || c.phone.trim()));
}

export function contactBrands(contacts: BrandContact[]): string[] {
  const seen = new Map<string, string>();
  for (const c of contacts) {
    for (const b of (c.brands?.length ? c.brands : [c.brand])) {
      const k = normalizeBrand(b); if (k && !seen.has(k)) seen.set(k, b.trim());
    }
  }
  return [...seen.values()];
}

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

export function brandContactsHtml(contacts: BrandContact[]): string {
  if (!contacts.length) return '';
  const blocks = contacts.map(c => {
    const lines = [c.name.trim() ? `<strong>${esc(c.name.trim())}</strong>` : ''];
    if (c.phone.trim()) lines.push(`Telefon: <a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone.trim())}</a>`);
    if (c.email.trim()) lines.push(`E-Mail: <a href="mailto:${esc(c.email.trim())}">${esc(c.email.trim())}</a>`);
    const img = safeImageUrl(c.imageUrl);
    const text = lines.filter(Boolean).join('<br>');
    if (!img) return `<p>${text}</p>`;
    return `<div class="lp-contact-person"><img src="${esc(img)}" alt="${esc(c.name.trim() ? `Ansprechpartner ${c.name.trim()}` : 'Ansprechpartner')}" loading="lazy" decoding="async" width="140" height="140"><p>${text}</p></div>`;
  });
  return `<div data-brand-contacts="1"><p><strong>${contacts.length > 1 ? 'Ihre Ansprechpartner' : 'Ihr Ansprechpartner'}</strong></p>${blocks.join('')}</div><!--/brand-contacts-->`;
}

/** Hängt die Ansprechpartner an den (letzten) Kontakt-Abschnitt an. */
export function injectBrandContacts<T extends { sections?: { id: string; type: string; headline: string; content: string }[] }>(page: T, contacts: BrandContact[]): T {
  const html = brandContactsHtml(contacts);
  if (!html || !page?.sections?.length) return page;
  const idx = [...page.sections].map((s, i) => [s, i] as const).reverse().find(([s]) => isContactSection(s.headline, s.type, s.id))?.[1];
  if (idx === undefined) return page;
  const sections = page.sections.map((s, i) => i === idx ? { ...s, content: `${(s.content || '').replace(/<div data-brand-contacts="1">[\s\S]*?<\/div><!--\/brand-contacts-->|<div data-brand-contacts="1">(?:(?!<div)[\s\S])*?<\/div>/, '')}${html}` } : s);
  return { ...page, sections };
}
