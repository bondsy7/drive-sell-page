// analyze-offer-image – extracts vehicle info from offer screenshots via Gemini
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { user } = await authenticateRequest(req);
    const { imageBase64 } = await req.json();
    if (!imageBase64) return errorResponse("Kein Bild übermittelt", 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY not configured", 500);

    // Strip data URL prefix
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeType = imageBase64.startsWith("data:image/png") ? "image/png"
      : imageBase64.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analysiere dieses Bild eines Fahrzeugangebots (z.B. von mobile.de, autoscout24, leasingmarkt.de, carwow etc.) und extrahiere alle relevanten Informationen.

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
  "fuelType": "Kraftstoffart z.B. 'Benzin', 'Diesel', 'Elektro', 'Hybrid'",
  "transmission": "Getriebe z.B. 'Automatik', 'Manuell'",
  "mileageKm": "Kilometerstand z.B. '0 km' oder '45.000 km'",
  "dealer": "Händlername falls sichtbar",
  "location": "Standort/Stadt falls sichtbar",
  "headline": "Vorschlag für eine kurze, knackige Headline für ein Werbebanner",
  "subline": "Vorschlag für eine Subline",
  "legalText": "Alle rechtlichen Pflichtangaben die sichtbar sind (Verbrauch, CO2, Effizienzklasse, PAngV-Daten etc.)",
  "confidence": "high" oder "medium" oder "low"
}

Wenn ein Feld nicht erkennbar ist, setze es auf null. Extrahiere so viel wie möglich.`
            },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini analyze error:", response.status, errText);
      return errorResponse(`Analyse fehlgeschlagen: ${response.status}`, 500);
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

    return jsonResponse({ extracted: parsed });
  } catch (e) {
    console.error("analyze-offer-image error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
