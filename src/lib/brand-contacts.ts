/**
 * Markenbezogene Ansprechpartner aus dem Profil (profiles.ci_settings.brandContacts).
 * Vorerst nur für generierte Landingpages: die gewählte Marke setzt ihre
 * Ansprechpartner automatisch in den Kontakt-Abschnitt.
 */
import { isContactSection } from '@/lib/landing-contact-plain';

export interface BrandContact { id: string; brand: string; name: string; email: string; phone: string }

export function normalizeBrand(b: string | null | undefined): string {
  return (b || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function readBrandContacts(ciSettings: unknown): BrandContact[] {
  const list = (ciSettings as any)?.brandContacts;
  if (!Array.isArray(list)) return [];
  return list.filter(c => c && typeof c === 'object').map((c: any) => ({
    id: String(c.id || crypto.randomUUID()), brand: String(c.brand || ''), name: String(c.name || ''),
    email: String(c.email || ''), phone: String(c.phone || ''),
  }));
}

export function contactsForBrand(contacts: BrandContact[], brand: string): BrandContact[] {
  const key = normalizeBrand(brand);
  if (!key) return [];
  return contacts.filter(c => normalizeBrand(c.brand) === key && (c.name.trim() || c.email.trim() || c.phone.trim()));
}

export function contactBrands(contacts: BrandContact[]): string[] {
  const seen = new Map<string, string>();
  for (const c of contacts) { const k = normalizeBrand(c.brand); if (k && !seen.has(k)) seen.set(k, c.brand.trim()); }
  return [...seen.values()];
}

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

export function brandContactsHtml(contacts: BrandContact[]): string {
  if (!contacts.length) return '';
  const blocks = contacts.map(c => {
    const lines = [c.name.trim() ? `<strong>${esc(c.name.trim())}</strong>` : ''];
    if (c.phone.trim()) lines.push(`Telefon: <a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone.trim())}</a>`);
    if (c.email.trim()) lines.push(`E-Mail: <a href="mailto:${esc(c.email.trim())}">${esc(c.email.trim())}</a>`);
    return `<p>${lines.filter(Boolean).join('<br>')}</p>`;
  });
  return `<div data-brand-contacts="1"><p><strong>${contacts.length > 1 ? 'Ihre Ansprechpartner' : 'Ihr Ansprechpartner'}</strong></p>${blocks.join('')}</div>`;
}

/** Hängt die Ansprechpartner an den (letzten) Kontakt-Abschnitt an. */
export function injectBrandContacts<T extends { sections?: { id: string; type: string; headline: string; content: string }[] }>(page: T, contacts: BrandContact[]): T {
  const html = brandContactsHtml(contacts);
  if (!html || !page?.sections?.length) return page;
  const idx = [...page.sections].map((s, i) => [s, i] as const).reverse().find(([s]) => isContactSection(s.headline, s.type, s.id))?.[1];
  if (idx === undefined) return page;
  const sections = page.sections.map((s, i) => i === idx ? { ...s, content: `${(s.content || '').replace(/<div data-brand-contacts="1">[\s\S]*?<\/div>/, '')}${html}` } : s);
  return { ...page, sections };
}
