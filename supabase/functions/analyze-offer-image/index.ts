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

    // gemini-2.5-pro liest dichte Tabellen (Verbrauch, Anzahlung, CO₂) deutlich
    // zuverlässiger als flash. Flash bleibt nur als Fallback.
    const models = ["gemini-2.5-pro", "gemini-2.5-flash"];
    const promptText = `Analysiere dieses Bild eines Fahrzeugangebots (z.B. von mobile.de, autoscout24, leasingmarkt.de, carwow, meinauto.de etc.) und extrahiere alle relevanten Informationen.

⚠️ ABSOLUTE GRUNDREGEL — KEINE ERFINDUNGEN:
- Lies ALLE Werte WÖRTLICH aus dem Bild ab (Tabellenzellen, Listen, Labels).
- Wenn ein Wert nicht klar lesbar ist → setze das Feld auf null. NIEMALS schätzen, runden, interpolieren oder aus Erfahrung „ergänzen".
- Achte besonders auf deutsche Zahlenformate: „1.000" = 1000 (Tausenderpunkt), „17,2" = 17.2 (Komma-Dezimal). Übernimm den String exakt wie er da steht.

⚠️ ANZAHLUNG / SONDERZAHLUNG (kritisch):
Suche im Leasing-/Finanzierungs-Block nach „Anzahlung", „Sonderzahlung" oder „Leasingsonderzahlung".
- Wenn dort z.B. „1.000 €" steht → downPayment: "1.000 €". 
- NUR wenn explizit „0 €" oder „keine Anzahlung" steht → "0 €".
- Wenn das Feld nicht sichtbar ist → null. NIEMALS 0 raten.

⚠️ PHEV / PLUG-IN-HYBRID — PFLICHT (Pkw-EnVKV):
Bei fuelType = „Plug-in-Hybrid" oder „Hybrid (Benzin/Elektro)" MÜSSEN folgende Felder befüllt sein, sonst ist die Analyse unvollständig:
- consumptionCombined: gewichteter komb. Verbrauch, Format „X,X l/100km + YY,Y kWh/100km" (z.B. "0,9 l/100km + 20,1 kWh/100km")
- consumptionCombinedDischarged: Verbrauch entladene Batterie, Format „X,X l/100km" (z.B. "8,0 l/100km")
- co2Emissions: gewichtete g/km (z.B. "21 g/km")
- co2Class: A–G aus den GEWICHTETEN g/km
- co2ClassDischarged: A–G aus den ENTLADENEN g/km (meist F oder G bei PHEV!)
- electricRange: elektrische Reichweite (z.B. "69 km")
Suche diese Werte in der „Verbrauch & Emissionen"-Tabelle. Bei meinauto.de stehen sie typischerweise zweispaltig (geladen | entladen).

⚠️ CO₂-KLASSE — STRENGE REGEL (Pkw-EnVKV / WLTP):
Seit der neuen Pkw-EnVKV (WLTP) gibt es NUR NOCH die Klassen A, B, C, D, E, F, G.
Klassen wie "A+", "A++", "A+++" sind UNGÜLTIG und dürfen NIEMALS ausgegeben werden, auch wenn sie im Bild stehen.
Wenn im Bild "A+++" o.ä. steht, IGNORIERE diesen Wert komplett und LEITE die Klasse aus den g/km-Werten ab:
- 0 g/km → A | 1–95 → B | 96–115 → C | 116–135 → D | 136–155 → E | 156–175 → F | >175 → G
Bei PHEVs: co2Class aus gewichteten g/km, co2ClassDischarged aus entladenen g/km.

⚠️ FAHRZEUGZUSTAND-ERKENNUNG (Pkw-EnVKV, Fassung seit 23.02.2024) — STRENG NACH DATEN, NICHT RATEN:
SCHRITT 1: Suche im Bild eine TABELLE oder LISTE mit "Fahrzeugzustand", "Erstzulassung"
und "Kilometerstand" (oder "km-Stand", "Laufleistung"). Lese die Werte WÖRTLICH ab.
SCHRITT 2: Bestimme condition NACH ZAHLEN (Daten haben Vorrang vor Begriffen):
- "Neuwagen" → noch nicht zum Weiterverkauf zugelassen UND (Erstzulassung ≤ 8 Monate ODER Kilometerstand ≤ 1.000 km). § 2 Nr. 1 Pkw-EnVKV.
- "Tageszulassung" → Erstzulassung < 1 Monat alt UND mileageKm < 100 km
- "Jahreswagen" → Erstzulassung 6–18 Monate alt UND mileageKm < 25.000 km
- "Gebrauchtwagen" → Erstzulassung > 8 Monate alt UND mileageKm > 1.000 km (also Neuwagen-Definition NICHT erfüllt) ODER explizit „Gebrauchtwagen"
- "Vorführwagen" → nur wenn explizit „Vorführwagen"/„Demo" in der Tabelle steht
SCHRITT 3: Bei Widerspruch zwischen Begriff und Zahlen → ZAHLEN gewinnen.
WICHTIG: NIEMALS condition raten. Wenn unsicher, leer lassen — der Server leitet sie ab.
WICHTIG: mileageKm IMMER aus der "Kilometerstand"-Zeile übernehmen, NICHT mit Jahresfahrleistung verwechseln.

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
      generationConfig: { temperature: 0 },
    });

    let response: Response | null = null;
    let lastErr = "";
    // Per-attempt timeout to avoid hitting the 150s function idle limit.
    // Budget: max 2 models × 2 attempts × 35s = 140s worst case.
    const ATTEMPT_TIMEOUT_MS = 35_000;
    const MAX_ATTEMPTS = 2;
    outer: for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
            body,
            signal: ctrl.signal,
          });
          clearTimeout(t);
          if (r.ok) { response = r; break outer; }
          lastErr = await r.text();
          console.error(`Gemini ${model} attempt ${attempt + 1}: ${r.status}`, lastErr);
          if (r.status === 503 || r.status === 429 || r.status >= 500) {
            await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
            continue;
          }
          break; // hard error – try next model
        } catch (err) {
          clearTimeout(t);
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Gemini ${model} attempt ${attempt + 1} aborted/failed:`, msg);
          lastErr = msg;
          // On timeout/abort, move to next attempt or model immediately
          continue;
        }
      }
    }

    if (!response) {
      return errorResponse(`Analyse-Service vorübergehend überlastet (${lastErr.slice(0, 120)}). Bitte in einigen Sekunden erneut versuchen.`, 503);
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

    // ── Vehicle condition: berechne IMMER aus Daten und überschreibe AI-Wert bei Widerspruch ──
    const fr = String(parsed.firstRegistration || '').trim();
    const kmMatch = String(parsed.mileageKm || '').match(/([\d.,]+)/);
    const km = kmMatch ? parseInt(kmMatch[1].replace(/[.,]/g, ''), 10) : NaN;
    let monthsOld = NaN;
    // Akzeptiere MM/YYYY, MM.YYYY, TT.MM.YYYY, TT/MM/YYYY
    const dm = fr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/) || fr.match(/^(\d{1,2})[./](\d{4})$/);
    if (dm) {
      const month = parseInt(dm[1], 10);
      const year = parseInt(dm[3] || dm[2], 10);
      if (year > 1990) {
        const now = new Date();
        monthsOld = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
      }
    }

    // Pkw-EnVKV (Fassung seit 23.02.2024) — § 2 Nr. 1: Neuwagen = noch nicht zum
    // Weiterverkauf zugelassen UND (Erstzulassung ≤ 8 Monate ODER ≤ 1.000 km).
    let derivedCondition = '';
    let derivedReason = '';
    const isNew = (isNaN(monthsOld) || monthsOld <= 8) && (isNaN(km) || km <= 1000);

    if (isNew) {
      derivedCondition = 'Neuwagen';
      const partsN: string[] = [];
      if (!isNaN(monthsOld)) partsN.push(`EZ ${monthsOld} Mon. ≤ 8 Mon.`);
      else partsN.push('keine Erstzulassung');
      if (!isNaN(km)) partsN.push(`${km.toLocaleString('de-DE')} km ≤ 1.000 km`);
      else partsN.push('km ≤ 1.000');
      derivedReason = `${partsN.join(' & ')} → Neuwagen (§ 2 Nr. 1 Pkw-EnVKV).`;
    } else if (!isNaN(monthsOld) && monthsOld <= 1 && !isNaN(km) && km < 100) {
      derivedCondition = 'Tageszulassung';
      derivedReason = `EZ < 1 Mon. & km < 100 → Tageszulassung.`;
    } else if (!isNaN(monthsOld) && monthsOld <= 18 && !isNaN(km) && km < 25000) {
      derivedCondition = 'Jahreswagen';
      derivedReason = `EZ ${monthsOld} Mon. & ${km.toLocaleString('de-DE')} km → Jahreswagen.`;
    } else {
      derivedCondition = 'Gebrauchtwagen';
      const reasonsG: string[] = [];
      if (!isNaN(monthsOld) && monthsOld > 8) reasonsG.push(`EZ ${monthsOld} Mon. > 8 Mon.`);
      if (!isNaN(km) && km > 1000) reasonsG.push(`${km.toLocaleString('de-DE')} km > 1.000 km`);
      derivedReason = `${reasonsG.join(' & ') || 'Daten widersprechen Neuwagen-Definition'} → Gebrauchtwagen.`;
    }

    const validConditions = ['Neuwagen', 'Gebrauchtwagen', 'Tageszulassung', 'Vorführwagen', 'Jahreswagen'];
    const aiCondition = validConditions.includes(parsed.condition) ? parsed.condition : '';

    // Plausibilitäts-Override gemäß neuer Pkw-EnVKV-Schwellen (8 Mon. / 1.000 km)
    const aiSaysNew = aiCondition === 'Neuwagen';
    const dataSaysUsed = (!isNaN(km) && km > 1000) || (!isNaN(monthsOld) && monthsOld > 8);
    const aiSaysUsed = aiCondition === 'Gebrauchtwagen';
    const dataSaysNew = (isNaN(km) || km <= 1000) && (isNaN(monthsOld) || monthsOld <= 8);

    if (aiSaysNew && dataSaysUsed && derivedCondition) {
      console.log(`[condition-override] AI sagte "Neuwagen", Daten widersprechen (km=${km}, monthsOld=${monthsOld}) → "${derivedCondition}" (${derivedReason})`);
      parsed.condition = derivedCondition;
      parsed.conditionOverridden = true;
      parsed.conditionOverrideReason = `AI sagte „Neuwagen", aber Kilometerstand/Erstzulassung sprechen für ${derivedCondition} (${derivedReason}).`;
    } else if (aiSaysUsed && dataSaysNew && derivedCondition) {
      console.log(`[condition-override] AI sagte "Gebrauchtwagen", Daten widersprechen → "${derivedCondition}"`);
      parsed.condition = derivedCondition;
      parsed.conditionOverridden = true;
      parsed.conditionOverrideReason = `AI sagte „Gebrauchtwagen", aber keine EZ und km<50 → ${derivedCondition}.`;
    } else if (!aiCondition && derivedCondition) {
      parsed.condition = derivedCondition;
    }

    // ── PHEV-Plausibilität: bei Plug-in-Hybrid müssen entladene Werte vorhanden sein ──
    const fuelLower = String(parsed.fuelType || '').toLowerCase();
    const isPHEV = /plug.?in|hybrid.*benzin|hybrid.*elektro|benzin.*elektro/.test(fuelLower)
      && /\+|kwh.*l|l.*kwh/i.test(String(parsed.consumptionCombined || ''));
    if (isPHEV) {
      const missing: string[] = [];
      if (!parsed.consumptionCombinedDischarged) missing.push('Verbrauch entladen');
      if (!parsed.co2ClassDischarged) missing.push('CO₂-Klasse entladen');
      if (!parsed.electricRange) missing.push('elektr. Reichweite');
      if (missing.length) {
        parsed.phevDataIncomplete = true;
        parsed.phevMissingFields = missing;
        console.warn(`[phev-incomplete] Fehlende PHEV-Pflichtfelder: ${missing.join(', ')}`);
      }
    }

    return jsonResponse({ extracted: parsed });
  } catch (e) {
    console.error("analyze-offer-image error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
