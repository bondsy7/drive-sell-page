// Shortcode-Resolver: ersetzt {{firma}}, {{telefon}}, ... beim Render.
// Originale Strings im State bleiben erhalten und editierbar.

import type { CiContext } from "./profileSources";

export const SHORTCODES: { code: string; label: string }[] = [
  { code: "{{firma}}", label: "Firmenname" },
  { code: "{{telefon}}", label: "Telefon" },
  { code: "{{whatsapp}}", label: "WhatsApp" },
  { code: "{{website}}", label: "Website" },
  { code: "{{email}}", label: "E-Mail" },
  { code: "{{adresse}}", label: "Straße / Adresse" },
  { code: "{{stadt}}", label: "Stadt" },
  { code: "{{plz}}", label: "PLZ" },
  { code: "{{marke}}", label: "Fahrzeugmarke" },
  { code: "{{modell}}", label: "Fahrzeugmodell" },
  { code: "{{preis}}", label: "Preis" },
  { code: "{{rate}}", label: "Monatsrate" },
  { code: "{{laufzeit}}", label: "Laufzeit" },
  { code: "{{anzahlung}}", label: "Anzahlung" },
  { code: "{{ez}}", label: "Erstzulassung" },
  { code: "{{km}}", label: "Kilometerstand" },
  { code: "{{leistung}}", label: "Leistung (PS/kW)" },
  { code: "{{kraftstoff}}", label: "Kraftstoff" },
  { code: "{{getriebe}}", label: "Getriebe" },
  { code: "{{rechtstext}}", label: "Rechtstext (Standard)" },
  { code: "{{leasingbank}}", label: "Leasingbank" },
  { code: "{{leasing_rechtstext}}", label: "Leasing Rechtstext" },
  { code: "{{finanzierungsbank}}", label: "Finanzierungsbank" },
  { code: "{{finanzierung_rechtstext}}", label: "Finanzierung Rechtstext" },
  { code: "{{facebook}}", label: "Facebook" },
  { code: "{{instagram}}", label: "Instagram" },
  { code: "{{x}}", label: "X (Twitter)" },
  { code: "{{tiktok}}", label: "TikTok" },
  { code: "{{youtube}}", label: "YouTube" },
];

export function resolveShortcodes(text: string, ctx?: CiContext | null): string {
  if (!text || !ctx) return text ?? "";
  // Erlaubt Buchstaben + Unterstrich (z. B. {{leasing_rechtstext}}, {{finanzierung_rechtstext}}).
  return text.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (full, key) => {
    const v = (ctx as any)[String(key).toLowerCase()];
    return v != null && String(v) !== "" ? String(v) : full;
  });
}
