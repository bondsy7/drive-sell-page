// Pure helpers for api-landingpages (no I/O) – unit-tested from src/test.
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface LiveConfig {
  enabled: boolean;
  mode: "filter" | "manual";
  brand?: string;
  model?: string;
  condition?: "all" | "new" | "used";
  selectedIds?: string[];
  maxItems?: number;
  layout?: "slider" | "grid";
  title?: string;
  financeBank?: string;
  cardDesign?: { preset?: string; detailUrlTemplate?: string };
}

export function buildSeo(pc: Row, imageMap: Record<string, string>, fallbackTitle: string) {
  const meta = (pc.meta || {}) as Row;
  const title = meta.title || fallbackTitle;
  const description = meta.description || "";
  const ogImage = [imageMap?.hero, ...Object.values(imageMap || {})].find((u) => typeof u === "string" && /^https:\/\//.test(u)) || null;
  return {
    metaTitle: title,
    metaDescription: description,
    canonical: typeof meta.canonical === "string" && /^https?:\/\//.test(meta.canonical) ? meta.canonical : null,
    robots: "index,follow",
    ogTitle: meta.ogTitle || title,
    ogDescription: meta.ogDescription || description,
    ogImage,
    keywords: Array.isArray(pc.seo?.keywords) ? pc.seo.keywords : [],
    structuredData: pc.seo?.structuredData ?? null,
  };
}

const SCOPE = "autohaus-ai-landingpage";

/** Scope the template's global reset rules so they cannot restyle the WordPress theme. */
export function scopeCss(css: string): string {
  return css
    .replace(/(^|\n)(\s*)\*\{/g, `$1$2.${SCOPE},.${SCOPE} *{`)
    .replace(/(^|\n)(\s*)body\{/g, `$1$2.${SCOPE}{`)
    .replace(/(^|\n)(\s*)img\{/g, `$1$2.${SCOPE} img{`)
    .replace(/(^|\n)(\s*)a\{/g, `$1$2.${SCOPE} a{`)
    .replace(/(^|\n)(\s*)h1,h2,h3\{/g, `$1$2.${SCOPE} h1,.${SCOPE} h2,.${SCOPE} h3{`);
}

/**
 * Turns the stored full HTML document into an embeddable fragment:
 * keeps <style>, font <link>s, JSON-LD and the complete body (forms, actions, scripts untouched),
 * strips <!DOCTYPE>/<html>/<head>/<body>, and replaces the frozen live-vehicle list with a container.
 */
export function buildFragment(doc: string, id: string, inventoryEndpoint: string | null): string {
  const head = (doc.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || "";
  const bodyMatch = doc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : doc.replace(/<!DOCTYPE[^>]*>/i, "").replace(/<\/?(html|head|body)[^>]*>/gi, "");

  const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0].replace(/<style([^>]*)>([\s\S]*?)<\/style>/i, (_s, a, c) => `<style${a}>${scopeCss(c)}</style>`));
  const fonts = [...head.matchAll(/<link[^>]+(fonts\.googleapis|fonts\.gstatic)[^>]*>/gi)].map((m) => m[0]);
  const jsonLd = [...head.matchAll(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi)].map((m) => m[0]);

  body = body.replace(/<section id="live-fahrzeuge"([^>]*)>[\s\S]*?<\/section>/i, (_m, attrs: string) => {
    const title = (_m.match(/<h2 class="lp-live-title">([\s\S]*?)<\/h2>/) || [])[1] || "";
    const cleanAttrs = attrs.replace(/\sdata-live-inventory="[^"]*"/, "").replace(/\shidden(?=\s|$)/, "");
    return `<section id="live-fahrzeuge"${cleanAttrs} data-autohaus-live-inventory="${id}"${inventoryEndpoint ? ` data-inventory-endpoint="${inventoryEndpoint}"` : ""}>
  <div class="lp-live-inner">
    <div class="lp-live-head"><h2 class="lp-live-title">${title}</h2></div>
    <div class="lp-live-container" data-autohaus-live-container></div>
  </div>
</section>`;
  });
  // Footnotes belonged to the frozen vehicle list; the plugin renders them for the live vehicles.
  body = body.replace(/<section id="lp-finanzierung"[\s\S]*?<\/section>/i, `<div data-autohaus-finance-footnotes="${id}"></div>`);

  // Like the PDF offer pages, the fragment uses the dealer website's own font instead of Inter/Space Grotesk.
  const inheritFont = `<style>.${SCOPE},.${SCOPE} :is(h1,h2,h3,h4,h5,h6,p,li,span,a,div,label,input,textarea,select,button,td,th){font-family:inherit !important}.${SCOPE} #live-fahrzeuge:has([data-autohaus-live-container]:empty){display:none}</style>`;
  void fonts;
  return `<div class="${SCOPE} lp-layout" data-landingpage-id="${id}">
${styles.join("\n")}
${inheritFont}
${jsonLd.join("\n")}
${body.trim()}
</div>`;
}

const num = (v: unknown) => { const x = Number(v); return v !== null && v !== "" && Number.isFinite(x) ? x : null; };
const pos = (v: unknown) => { const x = num(v); return x !== null && x > 0 ? x : null; };

function media(r: Row): string[] {
  const out: string[] = [];
  const push = (u: unknown) => { if (typeof u === "string" && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u); };
  push(r.thumbnailImage);
  for (const m of (r.media || []) as Row[]) push(m?.path || m?.url || m?.thumbnail);
  return out;
}

export function normalizeVehicle(r: Row, detailUrlTemplate?: string) {
  const internal = r.interneNummer ? String(r.interneNummer).trim() : null;
  const f = r.financing as Row | null;
  return {
    id: String(r.id),
    internalNumber: internal,
    brand: r.vehicleModel?.brand?.name ?? null,
    model: r.vehicleModel?.model ?? r.model ?? null,
    variant: r.modelDescription ?? null,
    condition: r.used === true ? "used" : r.used === false ? "new" : null,
    priceEur: pos(r.price) ? Math.round(Number(r.price) / 100) : null,
    mileageKm: num(r.mileage),
    firstRegistration: r.firstRegistration ?? null,
    year: num(r.yearOfManufacture),
    fuelType: r.vehicleModel?.fuelType ?? null,
    transmission: typeof r.vehicleModel?.automatic === "boolean" ? (r.vehicleModel.automatic ? "automatic" : "manual") : null,
    powerKw: pos(r.vehicleModel?.kwpower),
    powerPs: pos(r.vehicleModel?.horsePower),
    color: r.colorDetail || r.color || null,
    images: media(r),
    emissionText: typeof r.emissionText === "string" && r.emissionText.trim() ? r.emissionText.trim() : null,
    financing: f ? {
      monthlyRate: pos(f.monthlyRate), termMonths: pos(f.termInMonths), downPayment: num(f.downPayment),
      finalInstallment: num(f.finalInstallment), netLoanAmount: pos(f.netLoanAmount), totalAmount: pos(f.totalAmount),
      effectiveRate: pos(f.effectiveInterestRate), nominalRate: pos(f.nominalInterestRate), annualMileage: pos(f.annualMileage),
      bank: typeof f.bank === "string" && f.bank.trim() ? f.bank.trim() : null,
    } : null,
    detailUrl: detailUrlTemplate && internal ? detailUrlTemplate.replace("{internalNumber}", encodeURIComponent(internal)) : null,
  };
}

export type ApiVehicle = ReturnType<typeof normalizeVehicle>;

const REQUIRED_FIN = ["monthlyRate", "termMonths", "downPayment", "effectiveRate", "nominalRate", "totalAmount", "bank"] as const;

/** § 17 PAngV: a rate may only be shown when every mandatory value is present. */
export function financingStatus(v: ApiVehicle, fallbackBank?: string) {
  if (!v.financing || v.financing.monthlyRate === null) return { showRate: false, missing: ["monthlyRate"] };
  const f = { ...v.financing, bank: v.financing.bank || (fallbackBank?.trim() || null) };
  const missing = REQUIRED_FIN.filter((k) => f[k] === null || f[k] === undefined);
  return { showRate: missing.length === 0, missing, bank: f.bank };
}

// Mirrors src/lib/brand-aliases.ts so saved canonical filters also match Auto3's brand spellings.
const STOCK_BRAND_ALIASES: Record<string, string[]> = {
  volkswagen: ["vw", "volkswagon"],
  "mercedes-benz": ["mercedes", "mercedesbenz", "mb", "mercedesamg", "daimler", "daimlerchrysler"],
  bmw: ["bayerischemotorenwerke"],
  "alfa romeo": ["alfaromeo", "alfa"],
  "aston martin": ["astonmartin"],
  "land rover": ["landrover"],
  "rolls-royce": ["rollsroyce", "rolls royce"],
  citroën: ["citroen", "citröen"],
  škoda: ["skoda"],
  mini: ["bmwmini"],
  smart: ["smartcar"],
  opel: ["vauxhall"],
  peugeot: ["peugot"],
  renault: ["renaultsport"],
  toyota: ["lexus"],
  porsche: ["porscheag"],
  fiat: ["fiatchrysler", "stellantis"],
  seat: ["cupra"],
  "ds automobiles": ["ds"],
  alpine: ["alpinecars"],
  nissan: ["datsun"],
  hyundai: ["genesis"],
  ssangyong: ["kgmobility"],
  tesla: ["teslamotors"],
  ford: ["fordmotor"],
  honda: ["acura"],
  chevrolet: ["chevy"],
  chrysler: ["mopar"],
  jeep: ["jeepeagle"],
  mazda: ["toyokogyo"],
  mitsubishi: ["netherlandscar"],
  volvo: ["volvocars", "polestar"],
  subaru: ["fuji"],
  suzuki: ["maruti"],
  dacia: ["daciarenault"],
  kia: ["kiamotors"],
  lamborghini: ["lambo"],
  maserati: ["maseratiitalia"],
  ferrari: ["ferrariitalia", "scuderiaferrari"],
  audi: ["audiag"],
  lancia: ["lanciaitalia"],
  jaguar: ["jaguarlandrover", "jlr"],
  bentley: ["bentleymotors"],
  bugatti: ["bugattiautomobiles"],
  lotus: ["lotuscars"],
  mclaren: ["mclarencars"],
  pagani: ["paganiautomobili"],
  koenigsegg: ["koenigseggautomotive"],
  rimac: ["rimacautomobili"],
  byd: ["buildyourdreams"],
  polestar: ["polestarcars"],
  cupra: ["cupraofficial"],
  genesis: ["genesismotors"],
};

const stockBrandNorm = (value: string | null | undefined) => (value || "").toLowerCase().replace(/[-_\s.]+/g, "").trim();
function stockBrandMatches(a: string | null, b?: string): boolean {
  if (!b) return true;
  const left = stockBrandNorm(a);
  const right = stockBrandNorm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return Object.entries(STOCK_BRAND_ALIASES).some(([canonical, aliases]) => {
    const names = [canonical, ...aliases].map(stockBrandNorm);
    return names.includes(left) && names.includes(right);
  });
}

function stockModelMatches(a: string | null, b?: string): boolean {
  if (!b) return true;
  const normalize = (value: string | null | undefined) => (value || "")
    .trim().toLowerCase().normalize("NFKC")
    .replace(/º/g, "°").replace(/^no(?=\d)/, "n°")
    .replace(/[-_\s.]+/g, "");
  const left = normalize(a);
  return !!left && left === normalize(b);
}

export function matchVehicles(raws: Row[], c: LiveConfig): ApiVehicle[] {
  const tpl = c.cardDesign?.detailUrlTemplate;
  const all = raws.map((r) => normalizeVehicle(r, tpl));
  if (c.mode === "manual") {
    const order = c.selectedIds || [];
    return order.map((id) => all.find((v) => v.id === id)).filter((v): v is ApiVehicle => !!v);
  }
  return all.filter((v) => stockBrandMatches(v.brand, c.brand) && stockModelMatches(v.model, c.model)
    && (c.condition !== "new" || v.condition === "new") && (c.condition !== "used" || v.condition === "used"))
    .slice(0, c.maxItems === 0 ? 500 : Math.max(1, Math.min(50, c.maxItems || 8)));
}
