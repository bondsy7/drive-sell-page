// analyze-offer-image – extracts vehicle info from offer screenshots via Gemini
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user } = await authenticateRequest(req);
    const { imageBase64 } = await req.json();
    if (!imageBase64) return errorResponse("Kein Bild übermittelt", 400);

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY not configured", 500);

    // Strip data URL prefix
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeType = imageBase64.startsWith("data:image/png") ? "image/png"
      : imageBase64.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    const promptText = `Analysiere dieses Bild eines Fahrzeugangebots (z.B. von mobile.de, autoscout24, leasingmarkt.de, carwow etc.) und extrahiere alle relevanten Informationen.

⚠️ CO₂-KLASSE — STRENGE REGEL (Pkw-EnVKV / WLTP):
Seit der neuen Pkw-EnVKV (WLTP) gibt es NUR NOCH die Klassen A, B, C, D, E, F, G.
Klassen wie "A+", "A++", "A+++" sind UNGÜLTIG und dürfen NIEMALS ausgegeben werden, auch wenn sie im Bild stehen.
Wenn im Bild "A+++" o.ä. steht, IGNORIERE diesen Wert komplett und LEITE die Klasse aus den g/km-Werten ab:
- 0 g/km → A | 1–95 → B | 96–115 → C | 116–135 → D | 136–155 → E | 156–175 → F | >175 → G
Bei PHEVs: co2Class aus gewichteten g/km, co2ClassDischarged aus entladenen g/km.

⚠️ FAHRZEUGZUSTAND-ERKENNUNG (Pkw-EnVKV):
Bestimme condition aus Erstzulassung + Kilometerstand:
- "Neuwagen" → keine Erstzulassung ODER Kilometerstand 0–50 km
- "Tageszulassung" → Erstzulassung < 1 Monat alt UND mileageKm < 100 km, oder explizit "Tageszulassung"
- "Vorführwagen" → Begriff "Vorführwagen", "Demo"
- "Jahreswagen" → Erstzulassung 6–18 Monate alt, mileageKm < 25.000 km
- "Gebrauchtwagen" → Erstzulassung > 18 Monate ODER mileageKm > 25.000 km

Antworte NUR mit einem JSON-Objekt im folgenden Format (keine Markdown-Formatierung, kein Codeblock):
{
  "vehicleTitle": "Marke Modell Variante",
  "brand": "Marke",
  "price": "Kaufpreis oder Leasingrate als Text z.B. '28.470 €' oder 'ab 99 €/mtl.'",
  "priceType": "buy" oder "lease" oder "finance" oder "abo",
  "monthlyRate": "Monatliche Rate falls vorhanden z.B. '298 €'",
  "duration": "Laufzeit in Monaten falls vorhanden z.B. '24'",
  "mileage": "Fahrleistung pro Jahr falls vorhanden z.B. '10.000 km'",
  "downPayment": "Anzahlung falls vorhanden",
  "power": "Leistung z.B. '131 PS (96 kW)'",
  "fuelType": "Kraftstoffart z.B. 'Benzin', 'Diesel', 'Elektro', 'Hybrid', 'Plug-in-Hybrid'",
  "transmission": "Getriebe z.B. 'Automatik', 'Manuell'",
  "mileageKm": "Kilometerstand z.B. '0 km' oder '45.000 km'",
  "firstRegistration": "Erstzulassungsdatum z.B. '03/2023' oder '15.03.2023', leer bei Neuwagen ohne Zulassung",
  "condition": "Neuwagen | Gebrauchtwagen | Tageszulassung | Vorführwagen | Jahreswagen",
  "dealer": "Händlername falls sichtbar",
  "location": "Standort/Stadt falls sichtbar",
  "headline": "Vorschlag für eine kurze, knackige Headline für ein Werbebanner",
  "subline": "Vorschlag für eine Subline",
  "consumptionCombined": "Verbrauch kombiniert (bei PHEV: gewichtet kombiniert) z.B. '5,8 l/100km' oder '1,3 l/100km + 17,2 kWh/100km'",
  "consumptionCity": "Verbrauch innerorts falls vorhanden",
  "consumptionHighway": "Verbrauch außerorts/Autobahn falls vorhanden",
  "co2Emissions": "CO2-Emissionen kombiniert (bei PHEV: gewichtet) z.B. '132 g/km'",
  "co2Class": "CO2-Effizienzklasse — NUR 'A','B','C','D','E','F' oder 'G' (KEIN '+' erlaubt!)",
  "co2ClassDischarged": "CO2-Klasse bei entladener Batterie (nur PHEV) — NUR A-G",
  "consumptionCombinedDischarged": "Verbrauch entladene Batterie (nur PHEV) z.B. '10,4 l/100km'",
  "electricRange": "Elektrische Reichweite (nur PHEV/BEV) z.B. '52 km'",
  "wltpRange": "WLTP-Reichweite gesamt falls angegeben",
  "energyCostPerYear": "Energiekosten pro Jahr falls vorhanden z.B. '1.450 €'",
  "vehicleTax": "Kfz-Steuer pro Jahr falls vorhanden z.B. '120 €'",
  "year": "Erstzulassungsjahr z.B. '2023'",
  "color": "Farbe z.B. 'Mineralweiß Metallic'",
  "vin": "Fahrgestellnummer / VIN falls sichtbar",
  "features": ["Liste der Ausstattungsmerkmale falls sichtbar"],
  "legalText": "Alle rechtlichen Pflichtangaben die sichtbar sind (PAngV-Daten, Hinweise zu Verbrauch/CO2 etc., aber NICHT die Werte selbst doppelt)",
  "confidence": "high" oder "medium" oder "low"
}

Wenn ein Feld nicht erkennbar ist, setze es auf null. Extrahiere so viel wie möglich, auch von Datenblättern, Preislisten, WLTP-Tabellen, CO2-Labels.`;

    const body = JSON.stringify({
      contents: [{
        parts: [
          { text: promptText },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }],
      generationConfig: { temperature: 0.1 },
    });

    let response: Response | null = null;
    let lastErr = "";
    outer: for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body,
        });
        if (r.ok) { response = r; break outer; }
        lastErr = await r.text();
        console.error(`Gemini ${model} attempt ${attempt + 1}: ${r.status}`, lastErr);
        // Retry only on overload / rate-limit
        if (r.status === 503 || r.status === 429 || r.status >= 500) {
          await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
          continue;
        }
        break; // hard error – try next model
      }
    }

    if (!response) {
      return errorResponse(`Analyse-Service vorübergehend überlastet. Bitte in einigen Sekunden erneut versuchen.`, 503);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return errorResponse("Keine Analyse möglich", 500);

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      console.error("Failed to parse Gemini response:", text);
      return errorResponse("Analyse-Format ungültig", 500);
    }

    // ── Sanitize: enforce A-G only (Pkw-EnVKV / WLTP) ──
    const deriveClass = (emissionsStr: string): string => {
      const m = String(emissionsStr || '').match(/(\d+)/);
      if (!m) return '';
      const g = parseInt(m[1], 10);
      if (g === 0) return 'A';
      if (g <= 95) return 'B';
      if (g <= 115) return 'C';
      if (g <= 135) return 'D';
      if (g <= 155) return 'E';
      if (g <= 175) return 'F';
      return 'G';
    };
    const cleanClass = (raw: any, emissions: any): string => {
      const v = String(raw || '').trim().toUpperCase().replace(/\+/g, '').slice(0, 1);
      if (/^[A-G]$/.test(v)) return v;
      return deriveClass(emissions);
    };
    parsed.co2Class = cleanClass(parsed.co2Class, parsed.co2Emissions);
    parsed.co2ClassDischarged = cleanClass(parsed.co2ClassDischarged, parsed.consumptionCombinedDischarged || parsed.co2EmissionsDischarged);

    // ── Auto-derive vehicle condition from firstRegistration + mileageKm ──
    if (!parsed.condition || !['Neuwagen', 'Gebrauchtwagen', 'Tageszulassung', 'Vorführwagen', 'Jahreswagen'].includes(parsed.condition)) {
      const fr = String(parsed.firstRegistration || '').trim();
      const kmMatch = String(parsed.mileageKm || '').match(/([\d.,]+)/);
      const km = kmMatch ? parseInt(kmMatch[1].replace(/[.,]/g, ''), 10) : NaN;
      let monthsOld = NaN;
      const dateMatch = fr.match(/(\d{1,2})[./](\d{4})|(\d{1,2})[./](\d{1,2})[./](\d{4})/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1] || dateMatch[3] || '1', 10);
        const year = parseInt(dateMatch[2] || dateMatch[5] || '0', 10);
        if (year > 1990) {
          const now = new Date();
          monthsOld = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
        }
      }
      if (!fr && (isNaN(km) || km < 50)) parsed.condition = 'Neuwagen';
      else if (!isNaN(monthsOld) && monthsOld <= 1 && !isNaN(km) && km < 100) parsed.condition = 'Tageszulassung';
      else if (!isNaN(monthsOld) && monthsOld <= 18 && !isNaN(km) && km < 25000) parsed.condition = 'Jahreswagen';
      else if (!isNaN(monthsOld) || !isNaN(km)) parsed.condition = 'Gebrauchtwagen';
    }

    return jsonResponse({ extracted: parsed });
  } catch (e) {
    console.error("analyze-offer-image error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
