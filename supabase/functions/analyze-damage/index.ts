import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function authAndDeduct(req: Request, cost: number): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = data.claims.sub as string;
  const admin = createServiceClient();
  const { data: result } = await admin.rpc("deduct_credits", {
    _user_id: userId, _amount: cost, _action_type: "image_remaster",
    _description: "Schadensanalyse",
  });
  const r = result as any;
  if (!r?.success) {
    return new Response(JSON.stringify({ error: "insufficient_credits", balance: r?.balance || 0, cost: r?.cost || cost }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId };
}

const ANALYSIS_SYSTEM_PROMPT = `Du bist ein erfahrener KFZ-Sachverständiger, Karosseriebaumeister und Schadenkalkulator.
Analysiere die hochgeladenen Fahrzeugbilder professionell, vorsichtig und strukturiert.

GRUNDREGELN:
1. Bewerte nur Schäden, die auf den Bildern sichtbar oder plausibel ableitbar sind.
2. Trenne klar: a) sicher sichtbare Schäden, b) wahrscheinliche Folgeschäden, c) mögliche verdeckte Schäden.
3. Erfinde KEINE Schäden, die nicht erkennbar sind.
4. Bei eingeschränkter Bildqualität (Spiegelung, Schmutz, Schatten, Unschärfe) explizit hinweisen.
5. Kostenschätzung ist nur grobe Orientierung – ersetzt kein DAT/Audatex/Sachverständigengutachten.
6. Doppelte Schadenserfassung über mehrere Bilder vermeiden.

Antworte AUSSCHLIESSLICH als gültiges JSON nach diesem Schema:

{
  "fazit": {
    "gesamteindruck": "string",
    "schweregrad": "gering|mittel|hoch",
    "betroffeneBereiche": ["string"],
    "kategorie": "kosmetisch|funktional|sicherheitsrelevant|strukturell"
  },
  "schaeden": [
    {
      "nr": 1,
      "bildIndex": 0,
      "position": "string (z.B. Stoßfänger vorne rechts)",
      "bauteil": "string",
      "art": "string",
      "merkmale": "string",
      "ursache": "string",
      "schweregrad": "gering|mittel|hoch",
      "sicherheitsrelevant": "ja|nein|unklar",
      "massnahme": "string",
      "reparaturart": "instandsetzen|lackieren|ersetzen|pruefen|kalibrieren",
      "stunden": 0,
      "kostenNetto": { "min": 0, "max": 0 },
      "kostenBrutto": { "min": 0, "max": 0 },
      "unsicherheit": "string",
      "markierung": {
        "typ": "box|pfeil|kreis|gestrichelt",
        "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0,
        "label": "string (kurz: Nr. Bauteil Maßnahme)",
        "prioritaet": "niedrig|mittel|hoch"
      }
    }
  ],
  "reparaturEmpfehlung": [
    {
      "schadenNr": 1,
      "demontage": "ja|nein",
      "instandsetzungMoeglich": "ja|nein",
      "lackierung": "ja|nein",
      "austausch": "ja|nein",
      "achsvermessung": "ja|nein",
      "sensorikKalibrierung": "ja|nein",
      "spaltmasseDichtheit": "ja|nein"
    }
  ],
  "verdeckteSchaeden": [
    { "bauteil": "string", "wahrscheinlichkeit": "unwahrscheinlich|moeglich|wahrscheinlich", "hinweis": "string" }
  ],
  "kostenGesamt": {
    "konservativNetto": 0,
    "realistischNetto": 0,
    "maxNetto": 0,
    "konservativBrutto": 0,
    "realistischBrutto": 0,
    "maxBrutto": 0,
    "annahmen": "string"
  },
  "berichtMarkdown": "string – vollständiger professioneller Bericht im Markdown-Format mit Abschnitten A–I, inkl. rechtlichem Hinweis am Ende",
  "bildQualitaetHinweise": ["string"]
}

Bei Markierungs-Koordinaten: x,y,w,h sind RELATIV zum Bild (0.0–1.0). bildIndex = 0-basierter Index des Bildes.
Nummeriere Schäden fortlaufend über alle Bilder hinweg (1, 2, 3 ...).
Im berichtMarkdown immer den rechtlichen Hinweis aufnehmen:
"Diese Analyse basiert ausschließlich auf den bereitgestellten Bildern und dient als erste technische Orientierung. Sie ersetzt kein Gutachten, keine Hebebühnenprüfung, keine Demontageprüfung und keine verbindliche Schadenkalkulation durch einen qualifizierten KFZ-Sachverständigen oder Fachbetrieb."`;

async function callGeminiAnalysis(apiKey: string, vehicleInfo: string, anlass: string, images: string[], imagesFileUris?: { uri: string; mimeType: string }[]) {
  const total = (imagesFileUris && imagesFileUris.length > 0) ? imagesFileUris.length : images.length;
  const userText = `Fahrzeugdaten:\n${vehicleInfo}\n\nAnlass der Analyse: ${anlass || 'Allgemeine Zustandsbewertung'}\n\nAnzahl Bilder: ${total}\n\nFühre die vollständige Schadensanalyse durch und antworte als JSON.`;
  const parts: any[] = [{ text: userText }];

  if (imagesFileUris && imagesFileUris.length > 0) {
    for (let i = 0; i < imagesFileUris.length; i++) {
      parts.push({ text: `--- Bild ${i + 1} (Index ${i}) ---` });
      parts.push({ file_data: { mime_type: imagesFileUris[i].mimeType || "image/jpeg", file_uri: imagesFileUris[i].uri } });
    }
  } else {
    for (let i = 0; i < images.length; i++) {
      parts.push({ text: `--- Bild ${i + 1} (Index ${i}) ---` });
      const raw = images[i].includes(",") ? images[i].split(",")[1] : images[i];
      let mime = "image/jpeg";
      if (images[i].startsWith("data:image/png")) mime = "image/png";
      else if (images[i].startsWith("data:image/webp")) mime = "image/webp";
      parts.push({ inlineData: { mimeType: mime, data: raw } });
    }
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: ANALYSIS_SYSTEM_PROMPT }] },
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const models = ["gemini-2.5-pro", "gemini-2.5-flash"];
  let lastErr = "";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
      });
      if (r.ok) {
        const data = await r.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(content);
      }
      lastErr = `${model} ${r.status}: ${(await r.text()).slice(0, 200)}`;
      console.error("[analyze-damage]", lastErr);
      if (r.status === 429 || r.status >= 500) await sleep(1500 * (attempt + 1));
      else break;
    }
  }
  throw new Error("KI-Analyse fehlgeschlagen: " + lastErr);
}

async function annotateImage(apiKey: string, imageBase64: string, schaeden: any[]): Promise<string | null> {
  if (!schaeden || schaeden.length === 0) return null;
  const list = schaeden.map((s: any) =>
    `${s.nr}. ${s.position} (${s.bauteil}) – ${s.art}, Maßnahme: ${s.massnahme}, Markierung: ${s.markierung?.typ || 'box'}, Priorität: ${s.markierung?.prioritaet || 'mittel'}`
  ).join("\n");

  const prompt = `Markiere die folgenden Schäden direkt in diesem Fahrzeugbild wie ein professioneller KFZ-Sachverständiger.

Schäden zum Markieren:
${list}

REGELN:
- Nummerierte Markierungen passend zur Schadensliste (1, 2, 3 ...).
- Sichtbare Schäden: durchgezogene rote Box.
- Mögliche verdeckte Schäden: gestrichelte gelbe Box mit "prüfen".
- Kleine Schäden: Pfeil mit Kreis.
- Große Schäden: halbtransparente rote Fläche.
- Beschriftung kurz: "Nr. Bauteil – Maßnahme" in lesbarer Schrift mit weißer Hintergrundbox.
- Keine unbeschädigten Bereiche markieren.
- Keine Markierung wenn Schaden nicht eindeutig sichtbar.
- Markierungen dürfen wichtige Fahrzeugdetails NICHT verdecken.
- Das Fahrzeug, Farbe, Perspektive, Hintergrund EXAKT beibehalten – nur Annotationen hinzufügen.
- Ergebnis soll wie eine professionelle Sachverständigen-Annotation aussehen.`;

  const raw = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  let mime = "image/jpeg";
  if (imageBase64.startsWith("data:image/png")) mime = "image/png";
  else if (imageBase64.startsWith("data:image/webp")) mime = "image/webp";

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: raw } }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });

  const models = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
      });
      if (!r.ok) {
        console.warn(`[annotate] ${model} ${r.status}`);
        continue;
      }
      const data = await r.json();
      const respParts = data.candidates?.[0]?.content?.parts;
      if (respParts) {
        for (const p of respParts) {
          if (p.inlineData?.data) {
            return `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`;
          }
        }
      }
    } catch (e) {
      console.warn("[annotate] error", e);
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { images, imagesFileUris, vehicleInfo, anlass } = await req.json();
    const usingFileUris = Array.isArray(imagesFileUris) && imagesFileUris.length > 0;
    const total = usingFileUris ? imagesFileUris.length : (Array.isArray(images) ? images.length : 0);
    if (total === 0) {
      return new Response(JSON.stringify({ error: "Keine Bilder übergeben" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (total > 10) {
      return new Response(JSON.stringify({ error: "Maximal 10 Bilder" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cost: 1 credit per image (analysis only — annotation runs in separate function)
    const cost = total * 1;
    const auth = await authAndDeduct(req, cost);
    if (auth instanceof Response) return auth;

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const infoLines = [
      vehicleInfo?.marke && `Marke: ${vehicleInfo.marke}`,
      vehicleInfo?.modell && `Modell: ${vehicleInfo.modell}`,
      vehicleInfo?.baujahr && `Baujahr: ${vehicleInfo.baujahr}`,
      vehicleInfo?.kmStand && `Kilometerstand: ${vehicleInfo.kmStand}`,
      vehicleInfo?.farbe && `Farbe: ${vehicleInfo.farbe}`,
      vehicleInfo?.antrieb && `Antrieb: ${vehicleInfo.antrieb}`,
    ].filter(Boolean).join("\n") || "Keine Fahrzeugdaten angegeben";

    console.log(`[analyze-damage] ${total} Bilder (fileUris=${usingFileUris}), anlass=${anlass}`);
    const analysis = await callGeminiAnalysis(GEMINI_API_KEY, infoLines, anlass || "", images || [], imagesFileUris);
    console.log(`[analyze-damage] ${analysis.schaeden?.length || 0} Schäden erkannt`);

    return new Response(JSON.stringify({ analysis, cost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-damage] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
