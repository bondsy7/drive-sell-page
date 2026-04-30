// classify-vehicle-images
// Classifies a batch of vehicle images in a SINGLE Gemini call.
// Returns category per image so OneShotStudio can route them to the
// correct pipeline jobs / banner / video without manual sorting.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

interface InImage {
  /** Caller-provided id so client can match results back to its files */
  id: string;
  /** data URL or raw base64 (compressed/resized recommended) */
  imageBase64: string;
}

type Category =
  | "exterior_front"
  | "exterior_rear"
  | "exterior_side_left"
  | "exterior_side_right"
  | "exterior_34_front"
  | "exterior_34_rear"
  | "interior_front"
  | "interior_rear"
  | "interior_dashboard"
  | "detail_wheel"
  | "detail_headlight"
  | "detail_taillight"
  | "detail_emblem"
  | "detail_other"
  | "vin_plate"
  | "datasheet"
  | "unknown";

interface OutItem {
  id: string;
  category: Category;
  confidence: "high" | "medium" | "low";
  /** Whether the picture is clearly the car's exterior, interior, etc. */
  isExterior: boolean;
  isInterior: boolean;
  isDetail: boolean;
  /** Short german label for UI badges */
  labelDe: string;
}

const PROMPT = `Du bist ein Klassifikator für Fahrzeugfotos.
Du bekommst mehrere Bilder und musst JEDES Bild EXAKT EINEM der folgenden Kategorien zuordnen.

Kategorien:
- "exterior_front" – Direkte Frontansicht (frontal, mittig, beide Scheinwerfer)
- "exterior_rear" – Direkte Heckansicht (frontal von hinten)
- "exterior_side_left" – Linke Seite (Fahrerseite, Front zeigt nach rechts)
- "exterior_side_right" – Rechte Seite (Beifahrerseite, Front zeigt nach links)
- "exterior_34_front" – 3/4 Vorderansicht (Front + eine Seite sichtbar, schräg)
- "exterior_34_rear" – 3/4 Heckansicht
- "interior_front" – Innenraum, Fahrer-/Beifahrersitze, Lenkrad sichtbar
- "interior_rear" – Innenraum, Rücksitzbank
- "interior_dashboard" – Detail Cockpit / Armaturenbrett / Mittelkonsole
- "detail_wheel" – Felge / Reifen Detail
- "detail_headlight" – Scheinwerfer Detail
- "detail_taillight" – Rücklicht Detail
- "detail_emblem" – Emblem / Badge / Schriftzug
- "detail_other" – Sonstige Detailaufnahme (Innenraum-Detail, Logo, Naht etc.)
- "vin_plate" – VIN-Schild / Fahrgestellnummer-Plakette / Typenschild
- "datasheet" – Datenblatt, Preisliste, WLTP-Label, Screenshot eines Inserats (KEIN Auto)
- "unknown" – Nicht erkennbar oder nicht relevant

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt – KEIN Markdown, KEIN Codeblock:
{
  "items": [
    { "index": 0, "category": "exterior_34_front", "confidence": "high" },
    { "index": 1, "category": "interior_front", "confidence": "medium" }
  ]
}

Die Reihenfolge "index" entspricht der Bildreihenfolge die du bekommst (0-basiert).
Bei Unsicherheit nimm die wahrscheinlichste Kategorie und setze confidence auf "low".`;

const LABEL_DE: Record<Category, string> = {
  exterior_front: "Front",
  exterior_rear: "Heck",
  exterior_side_left: "Seite links",
  exterior_side_right: "Seite rechts",
  exterior_34_front: "3/4 Front",
  exterior_34_rear: "3/4 Heck",
  interior_front: "Innenraum vorn",
  interior_rear: "Innenraum hinten",
  interior_dashboard: "Cockpit",
  detail_wheel: "Felge",
  detail_headlight: "Scheinwerfer",
  detail_taillight: "Rücklicht",
  detail_emblem: "Emblem",
  detail_other: "Detail",
  vin_plate: "VIN",
  datasheet: "Datenblatt",
  unknown: "Unbekannt",
};

function categoryFlags(c: Category) {
  const isExterior = c.startsWith("exterior_");
  const isInterior = c.startsWith("interior_");
  const isDetail = c.startsWith("detail_");
  return { isExterior, isInterior, isDetail };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await authenticateRequest(req);

    const { images }: { images: InImage[] } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return errorResponse("Keine Bilder übermittelt", 400);
    }
    if (images.length > 20) {
      return errorResponse("Maximal 20 Bilder pro Anfrage", 400);
    }

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY not configured", 500);

    const parts: Array<Record<string, unknown>> = [{ text: PROMPT }];
    for (const img of images) {
      const data = img.imageBase64.includes(",")
        ? img.imageBase64.split(",")[1]
        : img.imageBase64;
      const mimeType = img.imageBase64.startsWith("data:image/png")
        ? "image/png"
        : img.imageBase64.startsWith("data:image/webp")
          ? "image/webp"
          : "image/jpeg";
      parts.push({ inlineData: { mimeType, data } });
    }

    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    });

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
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
        console.error(`classify ${model} attempt ${attempt + 1}: ${r.status}`, lastErr);
        if (r.status === 503 || r.status === 429 || r.status >= 500) {
          await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    if (!response) {
      return errorResponse("Klassifikator vorübergehend überlastet. Bitte erneut versuchen.", 503);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return errorResponse("Keine Klassifikation erhalten", 500);

    let parsed: { items?: Array<{ index: number; category: Category; confidence?: string }> };
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(text);
    } catch {
      console.error("classify parse error:", text);
      return errorResponse("Klassifikator-Antwort ungültig", 500);
    }

    const items: OutItem[] = images.map((img, idx) => {
      const found = parsed.items?.find((it) => it.index === idx);
      const category = (found?.category || "unknown") as Category;
      const confidence = (found?.confidence as "high" | "medium" | "low") || "low";
      return {
        id: img.id,
        category,
        confidence,
        labelDe: LABEL_DE[category] ?? "Unbekannt",
        ...categoryFlags(category),
      };
    });

    return jsonResponse({ items });
  } catch (e) {
    console.error("classify-vehicle-images error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
