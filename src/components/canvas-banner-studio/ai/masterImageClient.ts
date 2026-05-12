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
  return (data as { fields: ExtractedBannerFields }).fields;
}

export async function extractBannerDataFromPdf(pdfBase64: string): Promise<ExtractedBannerFields> {
  // Reuse the rich existing analyze-pdf function and map its output to banner fields.
  const { data, error } = await supabase.functions.invoke("analyze-pdf", {
    body: { pdfBase64 },
  });
  if (error) throw error;
  const v = (data as any)?.vehicle ?? {};
  const f = (data as any)?.financing ?? {};
  const c = (data as any)?.consumption ?? {};
  const brandModel = [v.brand, v.model].filter(Boolean).join(" ").trim();

  let price = "";
  if (f?.monthlyRate) price = `ab ${formatEUR(f.monthlyRate)} mtl.`;
  else if (v?.price) price = `${formatEUR(v.price)}`;

  let legalText = "";
  if (c?.consumptionCombined || c?.co2Emissions) {
    const parts: string[] = [];
    if (c.consumptionCombined) parts.push(`Verbrauch komb. ${c.consumptionCombined} l/100km`);
    if (c.co2Emissions) parts.push(`CO₂ ${c.co2Emissions} g/km`);
    if (c.co2Class) parts.push(`Klasse ${c.co2Class}`);
    legalText = parts.join(" · ");
  }

  return {
    headline: brandModel.slice(0, 60),
    subline: (v?.equipment?.[0] || (data as any)?.category || "").toString().slice(0, 80),
    price: price.slice(0, 40),
    cta: "Jetzt Probefahrt sichern",
    smallInfo: f?.duration ? `${f.duration} Monate` : "",
    legalText: legalText.slice(0, 240),
  };
}

function formatEUR(n: any): string {
  const x = Number(String(n).replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!isFinite(x)) return String(n);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x);
}
