// Pure SEO helpers for newly generated landing pages. Existing pages are never rewritten.

export const META_DESCRIPTION_MAX = 152;

const PLACEHOLDER_RE = /\b(Musterstadt|Musterstra(?:ß|ss)e(?:\s*\d+)?|Max Mustermann|Mustermann|Autohaus Muster\w*|12345)\b/gi;

export function hasPlaceholder(text: string): boolean {
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(text || "");
}

/** Removes placeholder tokens and the dangling glue words around them. */
export function stripPlaceholders(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*(?:in|aus|bei|im Raum|nahe)\s+(?:Musterstadt)\b/gi, "")
    .replace(PLACEHOLDER_RE, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,–-])\s*([,–-])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[,–|-]\s*$/g, "")
    .trim();
}

export function clampMetaDescription(text: string, max = META_DESCRIPTION_MAX): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 60 ? cut.slice(0, sp) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

/** Same transliteration as public.landing_slugify so the canonical matches the stored slug. */
export function landingSlugify(t: string): string {
  const from = "ÄÖÜäöüßÀÁÂÉÈÊÍÓÔÚàáâéèêíóôúçÇ";
  const to = "AOUaousAAAEEEIOOUaaaeeeiooucC";
  const tr = [...(t || "")].map((c) => { const i = from.indexOf(c); return i >= 0 ? to[i] : c; }).join("");
  const s = tr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (s || "landingpage").slice(0, 80);
}

export function buildCanonicalUrl(website: string | undefined, slug: string): string | null {
  const w = (website || "").trim();
  if (!/^https?:\/\//i.test(w)) return null;
  return `${w.replace(/\/+$/, "")}/${slug}/`;
}

export interface SeoDealer {
  name?: string; address?: string; postalCode?: string; city?: string;
  phone?: string; email?: string; website?: string;
}

const clean = (v?: string) => {
  const s = (v || "").trim();
  return s && !hasPlaceholder(s) ? s : "";
};

/** Splits FAQ HTML (<h3>Frage</h3><p>Antwort</p>) into question/answer pairs. */
export function extractFaqPairs(html: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
  const txt = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || ""))) {
    const q = txt(m[1]); const a = txt(m[2]);
    if (q && a) out.push({ q, a });
  }
  return out;
}

export function buildStructuredData(opts: {
  dealer?: SeoDealer; brand: string; model: string; canonicalUrl: string | null;
  faqHtml?: string[];
}): Record<string, unknown> {
  const d = opts.dealer || {};
  const dealerNode: Record<string, unknown> = { "@type": "AutoDealer" };
  if (clean(d.name)) dealerNode.name = clean(d.name);
  if (clean(d.website)) dealerNode.url = clean(d.website);
  if (clean(d.phone)) dealerNode.telephone = clean(d.phone);
  if (clean(d.email)) dealerNode.email = clean(d.email);
  const addr: Record<string, string> = {};
  if (clean(d.address)) addr.streetAddress = clean(d.address);
  if (clean(d.postalCode)) addr.postalCode = clean(d.postalCode);
  if (clean(d.city)) addr.addressLocality = clean(d.city);
  if (Object.keys(addr).length) dealerNode.address = { "@type": "PostalAddress", ...addr, addressCountry: "DE" };
  dealerNode.makesOffer = { "@type": "Offer", itemOffered: { "@type": "Car", brand: { "@type": "Brand", name: opts.brand }, model: opts.model } };

  const graph: Record<string, unknown>[] = [dealerNode];
  const home = clean(d.website);
  if (home && opts.canonicalUrl) {
    graph.push({ "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: clean(d.name) || "Startseite", item: home },
      { "@type": "ListItem", position: 2, name: `${opts.brand} ${opts.model}`, item: opts.canonicalUrl },
    ] });
  }
  const faqs = (opts.faqHtml || []).flatMap(extractFaqPairs);
  if (faqs.length) {
    graph.push({ "@type": "FAQPage", mainEntity: faqs.map((f) => ({
      "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
    })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
