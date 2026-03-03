import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein Experte für die Analyse von Fahrzeug-Angebots-PDFs deutscher Autohäuser. Deine Aufgabe: Extrahiere ALLE verfügbaren Daten so vollständig und präzise wie möglich. Lasse NICHTS aus.

WICHTIG: Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

EXTRAKTIONS-STRATEGIE:
1. Lies das GESAMTE Dokument Seite für Seite durch
2. Suche nach ALLEN Tabellen, Fußnoten, Kleingedrucktem, Seitenleisten
3. Fahrzeugdaten stehen oft in strukturierten Tabellen oder als Key-Value-Paare
4. Verbrauchswerte und CO₂-Daten stehen häufig im Kleingedruckten oder in Pflichtangaben am Ende
5. Händlerdaten stehen oft im Kopf/Fuß oder auf der letzten Seite
6. Finanzierungsdaten können in Tabellen, Hervorhebungen oder separaten Abschnitten stehen
7. Ausstattungsmerkmale stehen oft als Aufzählungen, Listen oder in Paketen

CO₂-KLASSE ABLEITUNG (AUTOFILL):
Wenn die CO₂-Klasse NICHT explizit im PDF steht, aber CO₂-Emissionen vorhanden sind, leite die Klasse automatisch ab:
- 0 g/km → A
- 1–95 g/km → B  
- 96–115 g/km → C
- 116–135 g/km → D
- 136–155 g/km → E
- 156–175 g/km → F
- >175 g/km → G

PLUGIN-HYBRID (PHEV) ERKENNUNG:
Erkenne PHEVs anhand folgender Hinweise:
- Begriffe: "Plug-in-Hybrid", "PHEV", "extern aufladbar", "Hybridelektrofahrzeug"
- Kraftstoffart enthält "Strom" oder "Elektro" zusammen mit Benzin/Diesel
- Es gibt ZWEI verschiedene Verbrauchs-/Emissionswerte (gewichtet + entladen)
- Begriffe wie "gewichtet, kombiniert", "bei entladener Batterie", "EAER", "elektrische Reichweite"
PHEVs haben:
- Gewichtete kombinierte Werte (co2Emissions, consumptionCombined, co2Class)
- Werte bei entladener Batterie (co2EmissionsDischarged, consumptionCombinedDischarged, co2ClassDischarged)
- Stromverbrauch und elektrische Reichweite

LEISTUNG:
- Kombiniere PS und kW wenn beide vorhanden, z.B. "110 kW (150 PS)"
- Suche nach "PS", "kW", "Nennleistung", "Systemleistung"

FEATURES/AUSSTATTUNG:
- Extrahiere ALLE genannten Ausstattungsmerkmale, Pakete, Extras
- Auch Standardausstattung wenn aufgelistet
- Typische Kategorien: Sicherheit, Komfort, Infotainment, Exterieur, Interieur, Assistenzsysteme
- Paket-Namen aufnehmen (z.B. "Business Paket", "AMG Line")

FINANZIERUNG:
- Achte auf: Brutto vs. Netto, MwSt-Hinweise
- "Sonderzahlung" = "Anzahlung" bei manchen Händlern
- "Schlussrate" = "Restwert" bei manchen Angeboten
- Leasingfaktor, eff. Jahreszins wenn vorhanden

VERBRAUCH - Suche nach ALLEN dieser Werte:
- Kombiniert, Innerorts/Innenstadt, Außerorts/Stadtrand, Landstraße, Autobahn
- WLTP vs NEFZ (bevorzuge WLTP)
- Energiekosten pro Jahr, Kraftstoffpreis (Berechnungsgrundlage)
- CO₂-Kosten: niedrig, mittel, hoch (jeweils über 10 Jahre)
- Kfz-Steuer pro Jahr
- Bei Elektro/PHEV: Stromverbrauch in kWh/100km

JSON-Schema:
{
  "category": "Leasing|Finanzierung|Kauf|Barkauf",
  "vehicle": {
    "brand": "string (Marke, z.B. 'BMW', 'Mercedes-Benz', 'Volkswagen')",
    "model": "string (volles Modell, z.B. 'X3 xDrive30e')",
    "variant": "string (Ausstattungslinie/Variante, z.B. 'M Sport, xLine')",
    "year": "number (Modelljahr oder EZ-Jahr)",
    "color": "string (Außenfarbe, z.B. 'Alpinweiß uni')",
    "fuelType": "Benzin|Diesel|Elektro|Hybrid|Plug-in-Hybrid",
    "transmission": "Automatik|Manuell|Doppelkupplungsgetriebe|CVT",
    "power": "string (z.B. '150 PS / 110 kW' oder Systemleistung bei Hybrid)",
    "features": ["ALLE Ausstattungsmerkmale als Array - so viele wie möglich"]
  },
  "finance": {
    "monthlyRate": "string mit € (z.B. '299,00 €')",
    "downPayment": "string mit € (Anzahlung)",
    "duration": "string (z.B. '48 Monate')",
    "totalPrice": "string mit € (Gesamtpreis / Fahrzeugpreis brutto)",
    "annualMileage": "string (z.B. '10.000 km/Jahr')",
    "specialPayment": "string mit € (Sonderzahlung / Leasing-Sonderzahlung)",
    "residualValue": "string mit € (Restwert / Schlussrate)",
    "interestRate": "string (eff. Jahreszins, z.B. '3,99 %')"
  },
  "dealer": {
    "name": "string (Autohaus-Name)",
    "address": "string (vollständige Adresse mit PLZ und Ort)",
    "phone": "string (Telefonnummer)",
    "email": "string (E-Mail-Adresse)",
    "website": "string (Webseite)"
  },
  "consumption": {
    "origin": "string (z.B. 'Deutsche Ausführung', 'EU-Import')",
    "mileage": "string (Kilometerstand, z.B. '10 km')",
    "displacement": "string (Hubraum, z.B. '1.998 cm³')",
    "power": "string (z.B. '110 kW (150 PS)')",
    "driveType": "string (z.B. 'Verbrennungsmotor', 'Plug-in-Hybrid', 'Elektro', 'Allrad')",
    "fuelType": "string (z.B. 'Super (E10)', 'Diesel', 'Super Plus', 'Benzin/Strom')",
    "consumptionCombined": "string (z.B. '7,0 l/100km', bei PHEV gewichtet kombiniert z.B. '1,8 l/100km')",
    "co2Emissions": "string (z.B. '162 g/km', bei PHEV gewichtet kombiniert)",
    "co2Class": "string (A-G, ableiten wenn nicht explizit angegeben!)",
    "consumptionCity": "string (Innerorts/Innenstadt)",
    "consumptionSuburban": "string (Stadtrand/Außerorts niedrig)",
    "consumptionRural": "string (Landstraße/Außerorts hoch)",
    "consumptionHighway": "string (Autobahn)",
    "energyCostPerYear": "string mit € (z.B. '1.886 €/Jahr')",
    "fuelPrice": "string (Berechnungsgrundlage, z.B. '1,82 €/l Super')",
    "co2CostMedium": "string mit € (CO₂-Kosten mittel über 10 Jahre)",
    "co2CostLow": "string mit € (CO₂-Kosten niedrig über 10 Jahre)",
    "co2CostHigh": "string mit € (CO₂-Kosten hoch über 10 Jahre)",
    "vehicleTax": "string mit € (Kfz-Steuer/Jahr)",
    "isPluginHybrid": "boolean (true wenn PHEV erkannt)",
    "co2EmissionsDischarged": "string (nur PHEV: CO₂ bei entladener Batterie)",
    "co2ClassDischarged": "string (nur PHEV: CO₂-Klasse bei entladener Batterie, ableiten!)",
    "consumptionCombinedDischarged": "string (nur PHEV: Verbrauch kombiniert bei entladener Batterie)",
    "electricRange": "string (nur PHEV/BEV: elektrische Reichweite EAER)",
    "consumptionElectric": "string (nur PHEV/BEV: Stromverbrauch komb. in kWh/100km)"
  },
  "imagePrompt": "Detaillierter englischer Prompt für fotorealistische Fahrzeug-Bildgenerierung"
}

Für den imagePrompt: Erstelle einen detaillierten englischen Prompt mit exaktem Fahrzeugmodell (Marke, Modell, Farbe, Karosserieform) in einem modernen, hellen Autohaus-Showroom. Beschreibe Licht, Reflexionen, Boden und Atmosphäre.

ABSOLUTE REGELN:
1. Extrahiere JEDEN Wert der im PDF steht - lieber zu viel als zu wenig
2. Leite co2Class und co2ClassDischarged IMMER aus den g/km-Werten ab wenn nicht explizit angegeben
3. Setze isPluginHybrid=true sobald irgendein PHEV-Hinweis erkannt wird
4. Features: Extrahiere ALLE - auch 50+ Einträge sind OK
5. Einheiten IMMER mit angeben (€, km, l/100km, g/km, kW, PS, cm³, kWh/100km)
6. Fehlende Werte = leerer String "", fehlende booleans = false
7. Antworte NUR mit JSON`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfBase64 } = await req.json();
    if (!pdfBase64) throw new Error("No PDF data provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analysiere dieses Fahrzeug-PDF vollständig. Extrahiere ALLE verfügbaren Daten:
- Fahrzeugdaten (Marke, Modell, Variante, Farbe, Leistung, Getriebe, Baujahr)
- Finanzierung/Leasing (Rate, Laufzeit, Anzahlung, Sonderzahlung, Restwert, Preis)
- Händler (Name, Adresse, Telefon, E-Mail, Website)
- ALLE Verbrauchswerte (kombiniert, Stadt, Landstraße, Autobahn)
- CO₂-Emissionen und CO₂-Klasse (bei PHEV: BEIDE Klassen!)
- Energiekosten, Kraftstoffpreis, CO₂-Kosten, Kfz-Steuer
- ALLE Ausstattungsmerkmale und Extras (so viele wie möglich!)
- Bei Plug-in-Hybrid: gewichtete UND entladene Werte, Stromverbrauch, E-Reichweite

Wenn CO₂-Klasse nicht angegeben aber g/km-Wert vorhanden: Klasse ableiten!
Gib das Ergebnis als JSON zurück.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es später erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI Credits aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(content);

    // === AUTO-FILL / POST-PROCESSING ===
    
    // Ensure consumption object exists
    if (!parsed.consumption) {
      parsed.consumption = {};
    }
    const c = parsed.consumption;

    // Default all missing string fields to ""
    const stringFields = [
      'origin', 'mileage', 'displacement', 'power', 'driveType', 'fuelType',
      'consumptionCombined', 'co2Emissions', 'co2Class',
      'consumptionCity', 'consumptionSuburban', 'consumptionRural', 'consumptionHighway',
      'energyCostPerYear', 'fuelPrice', 'co2CostMedium', 'co2CostLow', 'co2CostHigh',
      'vehicleTax', 'co2EmissionsDischarged', 'co2ClassDischarged',
      'consumptionCombinedDischarged', 'electricRange', 'consumptionElectric',
    ];
    for (const f of stringFields) {
      c[f] = c[f] || '';
    }
    c.isPluginHybrid = c.isPluginHybrid || false;

    // Auto-detect PHEV from driveType/fuelType if not set
    const dtLower = (c.driveType || '').toLowerCase();
    const ftLower = (c.fuelType || '').toLowerCase();
    const vftLower = (parsed.vehicle?.fuelType || '').toLowerCase();
    if (!c.isPluginHybrid) {
      if (dtLower.includes('plug') || dtLower.includes('phev') ||
          ftLower.includes('plug') || ftLower.includes('phev') ||
          vftLower.includes('plug-in') || vftLower === 'plug-in-hybrid' ||
          (ftLower.includes('strom') && (ftLower.includes('benzin') || ftLower.includes('diesel'))) ||
          c.co2EmissionsDischarged || c.consumptionCombinedDischarged) {
        c.isPluginHybrid = true;
      }
    }

    // Auto-derive CO₂ classes from g/km values
    function deriveCO2Class(emissionsStr: string): string {
      const match = emissionsStr?.match(/(\d+)/);
      if (!match) return '';
      const gkm = parseInt(match[1], 10);
      if (gkm === 0) return 'A';
      if (gkm <= 95) return 'B';
      if (gkm <= 115) return 'C';
      if (gkm <= 135) return 'D';
      if (gkm <= 155) return 'E';
      if (gkm <= 175) return 'F';
      return 'G';
    }

    // Auto-fill co2Class from co2Emissions
    if (!c.co2Class && c.co2Emissions) {
      c.co2Class = deriveCO2Class(c.co2Emissions);
    }
    // Auto-fill co2ClassDischarged from co2EmissionsDischarged
    if (!c.co2ClassDischarged && c.co2EmissionsDischarged) {
      c.co2ClassDischarged = deriveCO2Class(c.co2EmissionsDischarged);
    }

    // Copy power from vehicle to consumption if missing
    if (!c.power && parsed.vehicle?.power) {
      c.power = parsed.vehicle.power;
    }

    // Copy fuelType from vehicle to consumption if missing
    if (!c.fuelType && parsed.vehicle?.fuelType) {
      c.fuelType = parsed.vehicle.fuelType;
    }

    // Ensure vehicle features is an array
    if (parsed.vehicle && !Array.isArray(parsed.vehicle.features)) {
      parsed.vehicle.features = [];
    }

    // Ensure finance fields exist
    if (!parsed.finance) parsed.finance = {};
    const finFields = ['monthlyRate', 'downPayment', 'duration', 'totalPrice', 'annualMileage', 'specialPayment', 'residualValue', 'interestRate'];
    for (const f of finFields) {
      parsed.finance[f] = parsed.finance[f] || '';
    }

    // Ensure dealer fields exist
    if (!parsed.dealer) parsed.dealer = {};
    const dealerFields = ['name', 'address', 'phone', 'email', 'website'];
    for (const f of dealerFields) {
      parsed.dealer[f] = parsed.dealer[f] || '';
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
