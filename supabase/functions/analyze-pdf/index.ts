import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein Experte für die Analyse von Fahrzeug-Angebots-PDFs. Extrahiere die Daten und gib sie als JSON zurück.

WICHTIG: Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

JSON-Schema:
{
  "category": "Leasing|Finanzierung|Kauf",
  "vehicle": {
    "brand": "string",
    "model": "string (volles Modell inkl. Variante)",
    "variant": "string",
    "year": number,
    "color": "string",
    "fuelType": "Benzin|Diesel|Elektro|Hybrid|Plug-in-Hybrid",
    "transmission": "Automatik|Manuell",
    "power": "string (z.B. '150 PS / 110 kW')",
    "features": ["string array der wichtigsten Ausstattungsmerkmale"]
  },
  "finance": {
    "monthlyRate": "string (z.B. '299,00 €')",
    "downPayment": "string",
    "duration": "string (z.B. '48 Monate')",
    "totalPrice": "string",
    "annualMileage": "string (z.B. '10.000 km')",
    "specialPayment": "string",
    "residualValue": "string"
  },
  "dealer": {
    "name": "string",
    "address": "string",
    "phone": "string",
    "email": "string",
    "website": "string"
  },
  "consumption": {
    "origin": "string (z.B. 'Deutsche Ausführung')",
    "mileage": "string (z.B. '10 km')",
    "displacement": "string (z.B. '1.598 cm³')",
    "power": "string (z.B. '110 kW (150 PS)')",
    "driveType": "string (z.B. 'Verbrennungsmotor' oder 'Plug-in-Hybrid')",
    "fuelType": "string (z.B. 'Benzin' oder 'Benzin/Strom')",
    "consumptionCombined": "string (z.B. '7,0 l/100km' oder bei PHEV der gewichtete kombinierte Wert)",
    "co2Emissions": "string (z.B. '162 g/km' oder bei PHEV die gewichteten kombinierten CO₂-Emissionen)",
    "co2Class": "string (A-G, bei PHEV die CO₂-Klasse für gewichtet kombiniert)",
    "consumptionCity": "string",
    "consumptionSuburban": "string",
    "consumptionRural": "string",
    "consumptionHighway": "string",
    "energyCostPerYear": "string (z.B. '1.886 €/Jahr')",
    "fuelPrice": "string (z.B. '1,80 €/l')",
    "co2CostMedium": "string (z.B. '3.086 €')",
    "co2CostLow": "string (z.B. '1.458 €')",
    "co2CostHigh": "string (z.B. '4.860 €')",
    "vehicleTax": "string (z.B. '186 €/Jahr')",
    "isPluginHybrid": "boolean (true wenn Plug-in-Hybrid / extern aufladbares Hybridelektrofahrzeug)",
    "co2EmissionsDischarged": "string (nur PHEV: CO₂-Emissionen bei entladener Batterie, z.B. '180 g/km')",
    "co2ClassDischarged": "string (nur PHEV: CO₂-Klasse bei entladener Batterie, A-G)",
    "consumptionCombinedDischarged": "string (nur PHEV: Kraftstoffverbrauch kombiniert bei entladener Batterie)",
    "electricRange": "string (nur PHEV: elektrische Reichweite EAER, z.B. '60 km')",
    "consumptionElectric": "string (nur PHEV: Stromverbrauch kombiniert, z.B. '18,5 kWh/100km')"
  },
  "imagePrompt": "Ein detaillierter englischsprachiger Prompt für fotorealistische Bildgenerierung des Fahrzeugs in einem luxuriösen Autohaus-Showroom"
}

PLUGIN-HYBRID ERKENNUNG:
- Wenn das Fahrzeug ein Plug-in-Hybrid (PHEV) / extern aufladbares Hybridelektrofahrzeug ist, setze "isPluginHybrid": true
- PHEVs haben ZWEI CO₂-Klassen: eine für "gewichtet kombiniert" und eine für "bei entladener Batterie"
- PHEVs haben auch separate Verbrauchs- und Emissionswerte bei entladener Batterie
- Die CO₂-Klassen folgen denselben Grenzwerten: A=0, B=1-95, C=96-115, D=116-135, E=136-155, F=156-175, G=>175 g/km
- Achte besonders auf Begriffe wie "gewichtet, kombiniert", "bei entladener Batterie", "EAER", "Stromverbrauch"

Für den imagePrompt: Erstelle einen detaillierten englischen Prompt, der das exakte Fahrzeugmodell (Marke, Modell, Farbe) fotorealistisch in einem modernen, hellen, luxuriösen Autohaus-Showroom zeigt. Beschreibe Licht, Reflexionen, Boden, und Atmosphäre.

WICHTIG: Extrahiere ALLE Verbrauchswerte, CO2-Emissionen, CO2-Klasse, Energiekosten und Kfz-Steuer aus dem PDF falls vorhanden. Wenn Werte nicht gefunden werden, setze leere Strings "". Bei boolean-Feldern setze false als Default.`;

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
                text: "Analysiere dieses PDF-Dokument und extrahiere alle Fahrzeugdaten inkl. Verbrauchswerte, CO2-Emissionen und Kosten gemäß dem Schema. Prüfe besonders ob es sich um ein Plug-in-Hybrid handelt und extrahiere ggf. beide CO₂-Klassen.",
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

    // Ensure consumption object exists with all fields
    if (!parsed.consumption) {
      parsed.consumption = {
        origin: '', mileage: '', displacement: '', power: '', driveType: '',
        fuelType: '', consumptionCombined: '', co2Emissions: '', co2Class: '',
        consumptionCity: '', consumptionSuburban: '', consumptionRural: '',
        consumptionHighway: '', energyCostPerYear: '', fuelPrice: '',
        co2CostMedium: '', co2CostLow: '', co2CostHigh: '', vehicleTax: '',
        isPluginHybrid: false, co2EmissionsDischarged: '', co2ClassDischarged: '',
        consumptionCombinedDischarged: '', electricRange: '', consumptionElectric: '',
      };
    } else {
      // Ensure PHEV fields have defaults
      parsed.consumption.isPluginHybrid = parsed.consumption.isPluginHybrid || false;
      parsed.consumption.co2EmissionsDischarged = parsed.consumption.co2EmissionsDischarged || '';
      parsed.consumption.co2ClassDischarged = parsed.consumption.co2ClassDischarged || '';
      parsed.consumption.consumptionCombinedDischarged = parsed.consumption.consumptionCombinedDischarged || '';
      parsed.consumption.electricRange = parsed.consumption.electricRange || '';
      parsed.consumption.consumptionElectric = parsed.consumption.consumptionElectric || '';
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
