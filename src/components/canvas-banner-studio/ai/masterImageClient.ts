import { supabase } from "@/integrations/supabase/client";

export async function generateMasterBannerImage(args: {
  sourceImageUrl: string;
  promptText: string;
  extraInstruction?: string;
}): Promise<{ imageDataUrl: string }> {
  const { data, error } = await supabase.functions.invoke("generate-master-banner-image", {
    body: args,
  });
  if (error) throw error;
  return data as { imageDataUrl: string };
}

export type ExtractedBannerFields = {
  brand: string;
  headline: string;
  subline: string;
  price: string;
  cta: string;
  smallInfo: string;
  legalText: string;
};

export async function extractBannerDataFromImage(fileDataUrl: string): Promise<ExtractedBannerFields> {
  const { data, error } = await supabase.functions.invoke("extract-banner-data", {
    body: { fileDataUrl },
  });
  if (error) throw error;
  const fields = (data as { fields: Partial<ExtractedBannerFields> }).fields ?? {};
  return {
    brand: String(fields.brand ?? "").trim(),
    headline: String(fields.headline ?? ""),
    subline: String(fields.subline ?? ""),
    price: String(fields.price ?? ""),
    cta: String(fields.cta ?? ""),
    smallInfo: String(fields.smallInfo ?? ""),
    legalText: String(fields.legalText ?? ""),
  };
}

type OfferType = "leasing" | "finanzierung" | "barkauf";

function detectOfferType(category: string, finance: any): OfferType {
  const cat = String(category || "").toLowerCase();
  if (cat.includes("leasing")) return "leasing";
  if (cat.includes("finanz") || cat.includes("kredit")) return "finanzierung";
  if (cat.includes("bar") || cat.includes("kauf")) return "barkauf";
  // Fallback aus Finance-Feldern
  if (finance?.residualValue || finance?.specialPayment || finance?.annualMileage) return "leasing";
  if (finance?.interestRate || finance?.nominalInterestRate || finance?.totalAmount) return "finanzierung";
  if (finance?.monthlyRate) return "finanzierung";
  return "barkauf";
}

function vatSuffix(customerType: string): string {
  return String(customerType || "").toLowerCase() === "business" ? " zzgl. MwSt." : "";
}

function shortMonths(s: string): string {
  // "48 Monate" → "48 Mon."
  return String(s || "").replace(/\bMonate?\b/i, "Mon.").trim();
}

function compactKm(s: string): string {
  return String(s || "").replace(/\s*km\s*\/\s*jahr/i, " km").trim();
}

export async function extractBannerDataFromPdf(pdfBase64: string): Promise<ExtractedBannerFields> {
  // Reuse the rich existing analyze-pdf function and map its output to sales-oriented banner copy.
  const { data, error } = await supabase.functions.invoke("analyze-pdf", {
    body: { pdfBase64 },
  });
  if (error) throw error;
  const v = (data as any)?.vehicle ?? {};
  const f = (data as any)?.finance ?? (data as any)?.financing ?? {};
  const c = (data as any)?.consumption ?? {};
  const category = String((data as any)?.category ?? "");
  const customerType = String((data as any)?.customerType ?? "private");

  const brand = String(v.brand ?? "").trim();
  const model = String(v.model ?? "").trim();
  const headline = [brand, model].filter(Boolean).join(" ").trim().toUpperCase().slice(0, 28);

  const offer = detectOfferType(category, f);
  const vat = vatSuffix(customerType);

  // --- Subline: Angebots-Hook mit Firmen-Shortcode ---
  let subline = "";
  if (offer === "leasing") subline = "Leasingangebot von {{firma}}";
  else if (offer === "finanzierung") subline = "Top-Finanzierung von {{firma}}";
  else subline = "Hauspreis bei {{firma}}";

  // --- Price: kompakte Aussage ---
  let price = "";
  if ((offer === "leasing" || offer === "finanzierung") && f?.monthlyRate) {
    price = `ab ${formatEUR(f.monthlyRate)} mtl.${vat}`;
  } else if (v?.price || f?.totalPrice) {
    price = `${formatEUR(v?.price || f?.totalPrice)}${vat}`;
  }
  price = price.slice(0, 40);

  // --- smallInfo: Faktencluster ---
  let smallInfoParts: string[] = [];
  if (offer === "leasing" || offer === "finanzierung") {
    if (f?.duration) smallInfoParts.push(shortMonths(f.duration));
    if (f?.annualMileage) smallInfoParts.push(compactKm(f.annualMileage));
    if (f?.downPayment || f?.specialPayment) {
      smallInfoParts.push(`${formatEUR(f.downPayment || f.specialPayment)} Anzahlung`);
    } else if (offer === "leasing") {
      smallInfoParts.push("0 € Anzahlung");
    }
  } else {
    if (v?.year || v?.firstRegistration) smallInfoParts.push(`EZ ${String(v.year || v.firstRegistration).slice(-4)}`);
    if (v?.mileage || c?.mileage) smallInfoParts.push(`${String(v.mileage || c.mileage).replace(/\s*km.*$/i, "")} km`);
    if (v?.power || c?.power) {
      const p = String(v.power || c.power);
      const ps = p.match(/(\d+)\s*PS/i)?.[1];
      smallInfoParts.push(ps ? `${ps} PS` : p);
    }
  }
  const smallInfo = smallInfoParts.filter(Boolean).join(" · ").slice(0, 70);

  // --- CTA: kurz & aktiv ---
  const cta = offer === "barkauf" ? "Jetzt Probefahrt!" : "Jetzt sichern!";

  // --- Pflichtangabe (legalText) ---
  const legalParts: string[] = [];
  if (c?.consumptionCombined) legalParts.push(`Verbrauch komb. ${c.consumptionCombined}`);
  if (c?.consumptionElectric) legalParts.push(`Strom ${c.consumptionElectric}`);
  if (c?.co2Emissions) legalParts.push(`CO₂ ${c.co2Emissions}`);
  if (c?.co2Class) legalParts.push(`Klasse ${c.co2Class}`);
  const legalText = legalParts.join(" · ").slice(0, 240);

  return {
    brand,
    headline,
    subline: subline.slice(0, 60),
    price,
    cta,
    smallInfo,
    legalText,
  };
}

function formatEUR(n: any): string {
  if (n === undefined || n === null || n === "") return "";
  const x = Number(String(n).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (!isFinite(x) || x <= 0) return String(n);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x);
}
