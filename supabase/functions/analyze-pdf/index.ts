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
  "imagePrompt": "Ein detaillierter englischsprachiger Prompt für fotorealistische Bildgenerierung des Fahrzeugs in einem luxuriösen Autohaus-Showroom"
}

Für den imagePrompt: Erstelle einen detaillierten englischen Prompt, der das exakte Fahrzeugmodell (Marke, Modell, Farbe) fotorealistisch in einem modernen, hellen, luxuriösen Autohaus-Showroom zeigt. Beschreibe Licht, Reflexionen, Boden, und Atmosphäre.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdfText } = await req.json();
    if (!pdfText) throw new Error("No PDF text provided");

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
          { role: "user", content: `Analysiere folgenden PDF-Text und extrahiere die Fahrzeugdaten:\n\n${pdfText}` },
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
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(content);

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
