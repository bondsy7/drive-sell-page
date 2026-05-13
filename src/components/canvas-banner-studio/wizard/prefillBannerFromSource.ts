/**
 * Single orchestrator that converts any of the three sources (vehicle / VIN / PDF)
 * into a normalized prefill payload for the banner store. Centralises what used to
 * be scattered across Step 0, Step 2 and the CI panel.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Vehicle } from "@/hooks/useVehicles";
import type { BannerTextFieldKey, BannerTextFields } from "../state/types";
import { buildPrefillFromVehicle } from "../persistence/prefillFromVehicle";
import {
  extractBannerDataFromImage,
  extractBannerDataFromPdf,
  type ExtractedBannerFields,
} from "../ai/masterImageClient";
import { extractPDFAsBase64 } from "@/lib/pdf-utils";

export type PrefillSource = "vehicle" | "vin" | "pdf" | "image";

export interface PrefillPayload {
  source: PrefillSource;
  textFields: Partial<BannerTextFields>;
  manufacturerLogoUrl?: string;
  backgroundDataUrl?: string;
  brandKey?: string;
  vehicleId?: string;
  vinNote?: string;
}

/* ------------------------------------------------------------------ */
/*  Vehicle                                                            */
/* ------------------------------------------------------------------ */

export function prefillFromVehicle(
  vehicle: Vehicle,
  getLogoForMake: (key: string) => string | null,
): PrefillPayload {
  const { textFields, manufacturerLogoUrl } = buildPrefillFromVehicle(vehicle, { getLogoForMake });
  return {
    source: "vehicle",
    textFields,
    manufacturerLogoUrl,
    backgroundDataUrl: vehicle.cover_image_url ?? undefined,
    vehicleId: vehicle.id,
  };
}

/* ------------------------------------------------------------------ */
/*  VIN                                                                */
/* ------------------------------------------------------------------ */

export async function prefillFromVin(
  vin: string,
  getLogoForMake: (key: string) => string | null,
): Promise<PrefillPayload> {
  if (!vin || vin.trim().length !== 17) {
    throw new Error("VIN muss exakt 17 Zeichen haben.");
  }
  const { data, error } = await supabase.functions.invoke("lookup-vin", { body: { vin: vin.trim() } });
  if (error) throw new Error(error.message ?? "VIN-Abfrage fehlgeschlagen");
  if ((data as any)?.error) throw new Error((data as any).error);

  const v = (data as any)?.vehicle ?? {};
  const headline = [v.brand, v.model].filter(Boolean).join(" ").trim().toUpperCase();
  const subline = v.variant || (v.year ? `Baujahr ${v.year}` : undefined);

  const textFields: Partial<BannerTextFields> = {};
  if (headline) textFields.headline = headline;
  if (subline) textFields.subline = subline;

  let manufacturerLogoUrl: string | undefined;
  if (v.brand) {
    const key = String(v.brand).toLowerCase().replace(/\s+/g, "-");
    const url = getLogoForMake(key) || getLogoForMake(String(v.brand).toLowerCase());
    if (url) manufacturerLogoUrl = url;
  }

  return {
    source: "vin",
    textFields,
    manufacturerLogoUrl,
    vinNote: `VIN ${vin.toUpperCase()}`,
  };
}

/* ------------------------------------------------------------------ */
/*  PDF / Image upload                                                 */
/* ------------------------------------------------------------------ */

function fieldsToPartial(f: ExtractedBannerFields): Partial<BannerTextFields> {
  const out: Partial<BannerTextFields> = {};
  (Object.keys(f) as (keyof ExtractedBannerFields)[]).forEach((k) => {
    const v = f[k];
    if (v && String(v).trim()) out[k as BannerTextFieldKey] = String(v).trim();
  });
  return out;
}

export async function prefillFromPdfFile(file: File): Promise<PrefillPayload> {
  const base64 = await extractPDFAsBase64(file);
  const fields = await extractBannerDataFromPdf(base64);
  return { source: "pdf", textFields: fieldsToPartial(fields) };
}

export async function prefillFromImageFile(file: File): Promise<PrefillPayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("FileReader Fehler"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });

  // Run text extraction (best-effort) and use the image itself as background.
  let textFields: Partial<BannerTextFields> = {};
  try {
    const fields = await extractBannerDataFromImage(dataUrl);
    textFields = fieldsToPartial(fields);
  } catch (e) {
    console.warn("extractBannerDataFromImage failed, continuing without text", e);
  }
  return { source: "image", textFields, backgroundDataUrl: dataUrl };
}
