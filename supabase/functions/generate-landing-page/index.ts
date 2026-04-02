// generate-landing-page v6 – Hero 3:1 + rich sections + reliable image gen
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Robust JSON extraction ───
function extractJsonFromResponse(response: string): unknown {
  let cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonStart = cleaned.search(/[\{\[]/);
  if (jsonStart === -1) throw new Error("No JSON found");
  const openChar = cleaned[jsonStart];
  const closeChar = openChar === '{' ? '}' : ']';
  const jsonEnd = cleaned.lastIndexOf(closeChar);
  if (jsonEnd === -1 || jsonEnd <= jsonStart) throw new Error("Truncated JSON");
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  const ob = (cleaned.match(/{/g) || []).length;
  const cb = (cleaned.match(/}/g) || []).length;
  const obr = (cleaned.match(/\[/g) || []).length;
  const cbr = (cleaned.match(/\]/g) || []).length;
  if (ob !== cb || obr !== cbr) {
    for (let i = 0; i < obr - cbr; i++) cleaned += ']';
    for (let i = 0; i < ob - cb; i++) cleaned += '}';
  }
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, (ch) => ch === '\n' || ch === '\t' ? ch : '');
    return JSON.parse(cleaned);
  }
}

function extractTextFromGeminiResponse(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function repairJsonResponse(apiKey: string, brokenResponse: string): Promise<unknown> {
  const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const repairResponse = await fetch(geminiUrl, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Repariere den folgenden JSON-Text. Gib ausschließlich gültiges JSON zurück. Behalte Struktur und Inhalte soweit möglich bei, escape alle Strings korrekt und ergänze nur minimal, wenn der Text abgeschnitten wurde.\n\n${brokenResponse}`,
        }],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 16384,
        temperature: 0,
      },
    }),
  });

  if (!repairResponse.ok) {
    const errText = await repairResponse.text();
    throw new Error(`JSON repair failed: ${repairResponse.status} ${errText.substring(0, 400)}`);
  }

  const repairData = await repairResponse.json();
  const repairedText = extractTextFromGeminiResponse(repairData);
  if (!repairedText) throw new Error("Repair response was empty");
  return extractJsonFromResponse(repairedText);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (_e) {}
  return defaultPrompt;
}

async function authenticateAndDeductCredits(req: Request, cost: number): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const supabase = createServiceClient();
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const { data, error } = await supabase.rpc("deduct_credits", { _user_id: user.id, _amount: cost, _action_type: "landing_page_export", _model: "gemini", _description: "Landing Page Generator" });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!data?.success) return new Response(JSON.stringify({ error: "insufficient_credits", balance: data?.balance, cost }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return { userId: user.id };
}

// ─── Brand logo lookup ───
const BRAND_LOGO_ALIASES: Record<string, string[]> = {
  volkswagen: ['vw'], vw: ['volkswagen'], mercedesbenz: ['mercedes', 'mb'], mercedes: ['mercedesbenz', 'mb'], bmw: ['bayerischemotorenwerke'],
};

async function findBrandLogo(supabase: any, brand: string): Promise<string> {
  try {
    const brandNorm = brand.toLowerCase().replace(/[-_\s]+/g, '').replace(/é/g, 'e');
    const aliases = BRAND_LOGO_ALIASES[brandNorm] || [];
    const allKeys = [brandNorm, ...aliases];
    const matchFile = (files: any[], folder: string): string | null => {
      for (const f of (files || [])) {
        const fn = f.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[-_\s]+/g, '');
        if (allKeys.some(k => fn === k)) {
          const path = folder ? `${folder}/${f.name}` : f.name;
          const { data } = supabase.storage.from('manufacturer-logos').getPublicUrl(path);
          return data.publicUrl;
        }
      }
      return null;
    };
    const [{ data: rootFiles }, { data: svgFiles }] = await Promise.all([
      supabase.storage.from('manufacturer-logos').list('', { limit: 500 }),
      supabase.storage.from('manufacturer-logos').list('svg', { limit: 500 }),
    ]);
    return matchFile(rootFiles, '') || matchFile(svgFiles, 'svg') || '';
  } catch (_e) {}
  return '';
}

// ─── Upload image to storage ───
async function uploadImage(supabase: any, base64: string, userId: string, key: string): Promise<string | null> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const path = `${userId}/landing/${Date.now()}-${key}.png`;
    const { error } = await supabase.storage.from("vehicle-images").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("Upload failed:", e); return null; }
}

async function uploadUserImage(supabase: any, base64: string, userId: string, index: number): Promise<string | null> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const mimeMatch = base64.match(/^data:([^;]+);/);
    const mime = mimeMatch?.[1] || "image/jpeg";
    const ext = mime.includes("png") ? "png" : "jpg";
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const path = `${userId}/landing/${Date.now()}-user-${index}.${ext}`;
    const { error } = await supabase.storage.from("vehicle-images").upload(path, bytes, { contentType: mime, upsert: true });
    if (error) { console.error("User image upload error:", error); return null; }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("User image upload failed:", e); return null; }
}

// ─── Generate a single image via Gemini ───
async function generateImage(apiKey: string, prompt: string, aspectHint: string): Promise<string | null> {
  const models = ["gemini-2.5-flash-preview-05-20"];
  
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate a single high-quality professional automotive marketing photograph. ${aspectHint}. ${prompt}. Photorealistic, no text overlays, no watermarks, no logos, professional lighting.` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"], temperature: 1.0 },
        }),
      });
      
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Image gen ${model} failed:`, resp.status, errText.substring(0, 200));
        continue;
      }
      
      const data = await resp.json();
      const parts = data.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            return `data:${mime};base64,${part.inlineData.data}`;
          }
        }
      }
      console.error(`No image data in response for ${model}`);
    } catch (e) {
      console.error(`Image gen error ${model}:`, e);
    }
  }
  return null;
}

// ─── Tone & audience maps ───
const TONE_MAP: Record<string, string> = {
  professionell: "Schreibe in einem seriösen, vertrauenswürdigen Ton. Sachlich, kompetent, überzeugend.",
  emotional: "Schreibe emotional und bildreich. Wecke Begeisterung und Sehnsucht. Storytelling-Ansatz.",
  sportlich: "Schreibe dynamisch und energiegeladen. Kurze, prägnante Sätze. Performance im Fokus.",
  premium: "Schreibe in einem exklusiven, luxuriösen Ton. Understatement, Eleganz, Perfektion.",
  jugendlich: "Schreibe modern, locker und direkt. Duze den Leser. Frisch und unkompliziert.",
};

const AUDIENCE_MAP: Record<string, string> = {
  privat: "Zielgruppe: Privatkunden. Fokus auf Alltagstauglichkeit, Preis-Leistung, Komfort.",
  gewerbe: "Zielgruppe: Gewerbekunden/Firmenwagen. Fokus auf steuerliche Vorteile, TCO, Dienstwagen-Regelung.",
  jung: "Zielgruppe: Junge Fahrer (18-30). Fokus auf Lifestyle, Technologie, günstige Einstiegsangebote.",
  familien: "Zielgruppe: Familien. Fokus auf Sicherheit, Platzangebot, Kindersitze, Praktikabilität.",
  premium: "Zielgruppe: Premium-Käufer. Fokus auf Exklusivität, Sonderausstattung, Status.",
};

const IMAGE_STYLE_MAP: Record<string, string> = {
  studio: "in a pristine white modern car showroom with professional studio lighting and reflective polished floor",
  outdoor: "on a scenic winding mountain road with dramatic landscape, golden hour warm sunlight, cinematic composition",
  urban: "in an upscale urban setting with modern glass architecture, evening city lights reflecting off the car",
  dynamic: "photographed from a low dynamic angle on a highway, subtle motion blur in background, speed feeling",
};

// ─── Page type configs with MORE sections ───
interface PageTypeConfig { label: string; sectionCount: number; imageCount: number; systemInstruction: string; }

const PAGE_TYPES: Record<string, PageTypeConfig> = {
  leasing: {
    label: "Leasing-Angebot", sectionCount: 9, imageCount: 7,
    systemInstruction: "Erstelle eine überzeugende Leasing-Landingpage. Strukturiere: Hero → Design & Exterieur (content, Bild!) → Warum Leasing? (benefits) → Fahrzeug-Highlights & Technische Daten (specs, Bild!) → Interieur & Komfort (content, Bild!) → Motor & Performance (content, Bild!) → Leasing-Konditionen (content, Bild!) → FAQ mit echten Fragen (faq) → CTA.",
  },
  finanzierung: {
    label: "Finanzierung", sectionCount: 9, imageCount: 7,
    systemInstruction: "Erstelle eine überzeugende Finanzierungs-Landingpage. Strukturiere: Hero → Design & Exterieur (content, Bild!) → Finanzierung vs. Leasing vs. Barkauf (comparison) → Fahrzeug-Highlights (content, Bild!) → Interieur & Technologie (content, Bild!) → Motor & Fahrwerk (content, Bild!) → Finanzierungsrechner / Konditionen (content, Bild!) → FAQ (faq) → CTA.",
  },
  barkauf: {
    label: "Barkauf / Neuwagen", sectionCount: 8, imageCount: 6,
    systemInstruction: "Erstelle eine Premium-Verkaufsseite. Strukturiere: Hero → Design-Philosophie (content, Bild!) → Ausstattung & Technik (specs, Bild!) → Interieur-Erlebnis (content, Bild!) → Motor & Performance (content, Bild!) → Konnektivität & Assistenz (content, Bild!) → Preisvorteil & Garantie (benefits) → CTA.",
  },
  massenangebot: {
    label: "Massenangebot / Aktionsseite", sectionCount: 10, imageCount: 8,
    systemInstruction: "Erstelle eine dringliche Aktionsseite. Strukturiere: Hero → Angebots-Übersicht (content, Bild!) → Design & Exterieur (content, Bild!) → Motor & Leistung (content, Bild!) → Interieur (content, Bild!) → Technische Daten (specs, Bild!) → Ausstattungspakete (benefits) → Vergleichstabelle (comparison) → FAQ (faq) → CTA.",
  },
  autoabo: {
    label: "Auto-Abo", sectionCount: 9, imageCount: 7,
    systemInstruction: "Erstelle eine Auto-Abo-Landingpage. Strukturiere: Hero → So funktioniert's (steps) → Design & Exterieur (content, Bild!) → Was ist inklusive (benefits) → Fahrzeug-Highlights (content, Bild!) → Interieur & Technologie (content, Bild!) → Motor & Fahrverhalten (content, Bild!) → Preisvergleich (comparison) → CTA.",
  },
  event: {
    label: "Event im Autohaus", sectionCount: 9, imageCount: 6,
    systemInstruction: "Erstelle eine Event-Landingpage. Strukturiere: Hero → Event-Programm (steps) → Design & Exterieur (content, Bild!) → Fahrzeug-Highlights (content, Bild!) → Interieur-Erlebnis (content, Bild!) → Motor & Performance (content, Bild!) → Vorteile für Teilnehmer (benefits) → FAQ (faq) → CTA.",
  },
  release: {
    label: "Fahrzeug-Release / Premiere", sectionCount: 10, imageCount: 8,
    systemInstruction: "Erstelle eine spektakuläre Release-Seite. Strukturiere: Hero → Design-Philosophie (content, Bild!) → Exterieur-Details (content, Bild!) → Motor & Performance (content, Bild!) → Interieur & Technologie (content, Bild!) → Konnektivität & Assistenzsysteme (content, Bild!) → Technische Daten (specs, Bild!) → Vergleich zum Vorgänger (comparison) → Vorbestellung (benefits) → CTA.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { brand, model, pageType, additionalInfo, dealer, variant, color, price, targetAudience, tone, imageStyle, uploadedImages } = body;

    if (!brand || !model || !pageType) {
      return new Response(JSON.stringify({ error: "brand, model und pageType sind erforderlich" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const config = PAGE_TYPES[pageType];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unbekannter pageType: ${pageType}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalCost = 3;
    const authResult = await authenticateAndDeductCredits(req, totalCost);
    if (authResult instanceof Response) return authResult;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY nicht konfiguriert" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createServiceClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Upload user images
    const userImageUrls: string[] = [];
    if (uploadedImages && Array.isArray(uploadedImages)) {
      for (let i = 0; i < uploadedImages.length; i++) {
        const url = await uploadUserImage(supabase, uploadedImages[i], authResult.userId, i);
        if (url) userImageUrls.push(url);
      }
    }

    const brandLogoUrl = await findBrandLogo(supabase, brand);
    const vehicleDesc = [color, brand, model, variant].filter(Boolean).join(" ");
    const imgStyleSuffix = IMAGE_STYLE_MAP[imageStyle || "studio"] || IMAGE_STYLE_MAP.studio;

    const dealerInfo = dealer ? `\nHändler-Informationen:\n- Name: ${dealer.name || ""}\n- Adresse: ${dealer.address || ""}, ${dealer.postalCode || ""} ${dealer.city || ""}\n- Telefon: ${dealer.phone || ""}\n- E-Mail: ${dealer.email || ""}\n- Website: ${dealer.website || ""}\n- WhatsApp: ${dealer.whatsappNumber || ""}\n` : "";

    const toneInstruction = TONE_MAP[tone || "professionell"] || TONE_MAP.professionell;
    const audienceInstruction = targetAudience ? (AUDIENCE_MAP[targetAudience] || "") : "";
    const priceInstruction = price ? `\nPreis/Rate die auf der Seite erscheinen soll: ${price}` : "";
    const variantInfo = variant ? `, Variante: ${variant}` : "";
    const colorInfo = color ? `, Farbe: ${color}` : "";

    const DEFAULT_LP_INTRO = `Du bist ein professioneller Automotive-Marketing-Texter und Webdesigner, spezialisiert auf Google-Helpful-Content.`;
    const lpIntro = await getCustomPrompt("landing_page", DEFAULT_LP_INTRO);

    const systemPrompt = `${lpIntro}
${config.systemInstruction}

TONALITÄT: ${toneInstruction}
${audienceInstruction ? `\n${audienceInstruction}` : ""}

HELPFUL CONTENT RICHTLINIEN:
- Jede Section MUSS echten Informationswert bieten – KEINE leeren Marketing-Phrasen
- Verwende konkrete technische Daten, Zahlen und Fakten
- Erkläre technische Features aus Kundensicht
- Nutze Vergleiche und Praxisbeispiele
- FAQ: Echte Fragen die Kunden stellen
- Verwende <ul><li> für Aufzählungen und <h3> für Zwischenüberschriften
- Content MUSS LANG und DETAILLIERT sein – mindestens 150 Wörter pro Section

BILD-PROMPT REGELN (KRITISCH):
Für den Hero: Erstelle einen cinematic wide-angle shot (3:1 Panorama). Das Bild muss breit und flach sein!
Für JEDE Content-Section die ein Bild braucht, MUSS der imagePrompt EXAKT zum Sektionsinhalt passen:
- Motor/Leistung → "Close-up engine bay / exhaust / brake calipers of a ${vehicleDesc}"
- Innenraum/Komfort → "Interior cockpit showing dashboard, steering wheel, infotainment of a ${vehicleDesc}"
- Design/Exterieur → "Elegant side profile / rear three-quarter view of a ${vehicleDesc}"  
- Technologie/Assistenz → "Detail of digital dashboard / head-up display of a ${vehicleDesc}"
- Gallery → "Dramatic front view with reflections of a ${vehicleDesc}"
Jeder imagePrompt MUSS enden mit: "${imgStyleSuffix}"
FAQ/Steps/CTA/Comparison/Benefits Sektionen → imagePrompt: null
${priceInstruction}

${dealerInfo}

Antworte AUSSCHLIESSLICH als JSON:
{
  "meta": { "title": "SEO Title (<60 Zeichen)", "description": "Meta Description (<160 Zeichen)", "h1": "Hauptüberschrift" },
  "hero": {
    "headline": "Emotionale Headline",
    "subheadline": "Untertitel mit Kernvorteil",
    "ctaText": "CTA Button Text",
    "imagePrompt": "Cinematic wide panoramic 3:1 aspect ratio hero shot of a ${vehicleDesc} from dramatic low front 3/4 angle, ${imgStyleSuffix}, wide landscape composition, ultra-wide cinematic framing"
  },
  "sections": [
    {
      "id": "unique-kebab-id",
      "type": "content|features|pricing|faq|cta|comparison|steps|benefits|specs|gallery",
      "headline": "Abschnitts-Überschrift",
      "content": "HTML-formatierter Inhalt – MINDESTENS 150 Wörter, detailliert mit <h3>, <ul><li>, <p>",
      "imagePrompt": "Detaillierter englischer Prompt passend zum Sektionsinhalt ODER null",
      "bgStyle": "white|light|dark|accent"
    }
  ],
  "seo": {
    "keywords": ["keyword-1", "keyword-2", "keyword-3"],
    "structuredData": { "@context": "https://schema.org", "@type": "AutoDealer", "name": "${dealer?.name || ''}", "offers": { "@type": "Offer", "itemOffered": { "@type": "Car", "brand": "${brand}", "model": "${model}" } } }
  }
}

Erstelle genau ${config.sectionCount} sections. Davon sollen ${config.imageCount} ein imagePrompt haben, der Rest null.
Alterniere bgStyle für visuellen Rhythmus: white → light → dark → accent → white...
${!uploadedImages?.length ? `\nWICHTIG: KEINE eigenen Bilder hochgeladen. Du MUSST für JEDE visuelle Section einen imagePrompt generieren!` : ''}`;

    const userPrompt = `Erstelle eine ${config.label}-Landingpage für:\nMarke: ${brand}\nModell: ${model}${variantInfo}${colorInfo}\n${additionalInfo ? `Zusätzliche Informationen / Highlights: ${additionalInfo}` : ""}`;

    console.log("Generating content for:", brand, model, pageType);

    // ─── Step 1: Generate content JSON ───
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const contentResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          temperature: 0.6,
        },
      }),
    });

    if (!contentResponse.ok) {
      const errText = await contentResponse.text();
      console.error("Gemini content error:", contentResponse.status, errText);
      if (contentResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte in einer Minute erneut versuchen." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "KI-Fehler bei Content-Generierung" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contentData = await contentResponse.json();
    const rawContent = extractTextFromGeminiResponse(contentData);

    let pageContent: any;
    try {
      pageContent = extractJsonFromResponse(rawContent);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawContent.substring(0, 1500));
      try {
        pageContent = await repairJsonResponse(GEMINI_API_KEY!, rawContent);
      } catch (repairError) {
        console.error("JSON repair failed:", repairError);
        return new Response(JSON.stringify({ error: "KI-Antwort konnte nicht verarbeitet werden" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── Step 2: Collect all image prompts ───
    const imagePrompts: { key: string; prompt: string; isHero?: boolean }[] = [];
    if (pageContent.hero?.imagePrompt) {
      imagePrompts.push({ key: "hero", prompt: pageContent.hero.imagePrompt, isHero: true });
    }
    for (const section of pageContent.sections || []) {
      if (section.imagePrompt) {
        imagePrompts.push({ key: section.id, prompt: section.imagePrompt });
      }
    }

    // ─── Step 3: Assign user images first, generate rest ───
    const imageResults: Record<string, string> = {};
    let userImgIdx = 0;

    if (userImageUrls.length > 0) {
      // Skip hero for user images (hero should always be AI-generated for 3:1 ratio)
      const nonHeroPrompts = imagePrompts.filter(p => !p.isHero);
      for (let i = 0; i < nonHeroPrompts.length && userImgIdx < userImageUrls.length; i++) {
        imageResults[nonHeroPrompts[i].key] = userImageUrls[userImgIdx];
        userImgIdx++;
      }
    }

    // Generate remaining images
    const remainingPrompts = imagePrompts.filter(p => !imageResults[p.key]);
    console.log(`User images: ${userImageUrls.length}, Generating ${remainingPrompts.length} AI images...`);

    // Generate images in batches of 2 (to avoid rate limits)
    for (let i = 0; i < remainingPrompts.length; i += 2) {
      const batch = remainingPrompts.slice(i, i + 2);
      const results = await Promise.allSettled(
        batch.map(async ({ key, prompt, isHero }) => {
          const aspectHint = isHero
            ? "The image MUST be in ultra-wide panoramic 3:1 aspect ratio (very wide, not tall). Landscape cinematic composition."
            : "The image should be in 16:9 widescreen aspect ratio.";
          
          const base64 = await generateImage(GEMINI_API_KEY!, prompt, aspectHint);
          if (base64) {
            const url = await uploadImage(supabase, base64, authResult.userId, key);
            return { key, url };
          }
          console.error(`Failed to generate image for: ${key}`);
          return { key, url: null };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.url) {
          imageResults[r.value.key] = r.value.url;
        }
      }
      // Small delay between batches to avoid rate limits
      if (i + 2 < remainingPrompts.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`Total images generated: ${Object.keys(imageResults).length}/${imagePrompts.length}`);

    // ─── Step 4: Build HTML ───
    const html = buildHTML(pageContent, imageResults, dealer, brand, model, brandLogoUrl, {
      dealerUserId: authResult.userId, supabaseUrl, vehicleTitle: `${brand} ${model}${variant ? ` ${variant}` : ""}`, pageType,
    });

    return new Response(
      JSON.stringify({ html, pageContent, imageMap: imageResults, brandLogoUrl, imageCount: Object.keys(imageResults).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── Contact Form Builder ───
function buildContactFormInline(opts: { dealerUserId: string; supabaseUrl: string; vehicleTitle: string; pageType: string; }): string {
  const { dealerUserId, supabaseUrl, vehicleTitle, pageType } = opts;
  const cat = (pageType || '').toLowerCase();
  const showLeasing = cat !== 'leasing';
  const showFinancing = cat !== 'finanzierung';
  const isPurchase = ['barkauf', 'neuwagen', 'gebrauchtwagen'].includes(cat);
  const showPurchase = !isPurchase;
  const checkboxStyle = `accent-color:#3366cc;width:16px;height:16px;cursor:pointer`;
  const labelStyle = `display:flex;align-items:center;gap:8px;font-size:13px;font-family:'Inter',sans-serif;color:#1a2332;cursor:pointer`;

  return `
  <div id="leadCta" style="position:fixed;bottom:24px;right:24px;z-index:9999">
    <button onclick="document.getElementById('leadModal').style.display='flex'" style="background:linear-gradient(135deg,#3366cc,#2952a3);color:#fff;border:none;cursor:pointer;padding:14px 28px;border-radius:50px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;box-shadow:0 4px 24px rgba(51,102,204,0.4);transition:all .2s;display:flex;align-items:center;gap:8px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      Jetzt anfragen
    </button>
  </div>
  <div id="leadModal" style="display:none;position:fixed;inset:0;z-index:10000;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px)" onclick="if(event.target===this)this.style.display='none'">
    <div style="background:#fff;border-radius:20px;padding:32px;max-width:460px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);position:relative;animation:leadSlideIn .3s ease">
      <button onclick="document.getElementById('leadModal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:20px">✕</button>
      <div style="margin-bottom:20px">
        <h3 style="font-family:'Space Grotesk','Inter',sans-serif;font-size:20px;font-weight:700;color:#1a2332;margin-bottom:4px">Interesse an diesem Fahrzeug?</h3>
        <p style="font-size:13px;color:#6b7a8d">${vehicleTitle.replace(/'/g, "\\'")}</p>
      </div>
      <form id="leadForm" onsubmit="return submitLead(event)">
        <div style="display:flex;flex-direction:column;gap:12px">
          <input name="name" placeholder="Ihr Name *" required style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none" />
          <input name="email" type="email" placeholder="Ihre E-Mail *" required style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none" />
          <input name="phone" type="tel" placeholder="Telefonnummer (optional)" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none" />
          <textarea name="message" placeholder="Ihre Nachricht (optional)" rows="3" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;outline:none;resize:vertical"></textarea>
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
            <span style="font-size:12px;font-weight:600;color:#6b7a8d;text-transform:uppercase;letter-spacing:0.5px">Ich interessiere mich für:</span>
            <label style="${labelStyle}"><input type="checkbox" name="interested_test_drive" style="${checkboxStyle}" /> Probefahrt</label>
            <label style="${labelStyle}"><input type="checkbox" name="interested_trade_in" style="${checkboxStyle}" /> Inzahlungnahme</label>
            ${showLeasing ? `<label style="${labelStyle}"><input type="checkbox" name="interested_leasing" style="${checkboxStyle}" /> Leasing</label>` : ''}
            ${showFinancing ? `<label style="${labelStyle}"><input type="checkbox" name="interested_financing" style="${checkboxStyle}" /> Finanzierung</label>` : ''}
            ${showPurchase ? `<label style="${labelStyle}"><input type="checkbox" name="interested_purchase" style="${checkboxStyle}" /> Barkauf</label>` : ''}
          </div>
          <button type="submit" id="leadSubmitBtn" style="background:linear-gradient(135deg,#3366cc,#2952a3);color:#fff;border:none;cursor:pointer;padding:14px;border-radius:10px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif">Anfrage senden</button>
        </div>
      </form>
      <div id="leadSuccess" style="display:none;text-align:center;padding:20px 0">
        <div style="font-size:48px;margin-bottom:12px">✓</div>
        <h4 style="font-size:18px;font-weight:700;color:#1a2332;margin-bottom:8px">Anfrage gesendet!</h4>
        <p style="font-size:13px;color:#6b7a8d">Vielen Dank! Wir melden uns in Kürze.</p>
      </div>
      <p style="font-size:10px;color:#9ca3af;margin-top:12px;text-align:center">Ihre Daten werden vertraulich behandelt.</p>
    </div>
  </div>
  <style>@keyframes leadSlideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}</style>
  <script>
  async function submitLead(e){
    e.preventDefault();
    var btn=document.getElementById('leadSubmitBtn');
    btn.disabled=true;btn.textContent='Wird gesendet...';
    var form=document.getElementById('leadForm');
    var fd=new FormData(form);
    try{
      var res=await fetch('${supabaseUrl}/functions/v1/submit-lead',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          dealerUserId:'${dealerUserId}',projectId:null,
          name:fd.get('name'),email:fd.get('email'),
          phone:fd.get('phone')||null,message:fd.get('message')||null,
          vehicleTitle:'${vehicleTitle.replace(/'/g, "\\'")}',
          interestedTestDrive:!!form.querySelector('[name=interested_test_drive]')?.checked,
          interestedTradeIn:!!form.querySelector('[name=interested_trade_in]')?.checked,
          interestedLeasing:!!form.querySelector('[name=interested_leasing]')?.checked,
          interestedFinancing:!!form.querySelector('[name=interested_financing]')?.checked,
          interestedPurchase:!!form.querySelector('[name=interested_purchase]')?.checked
        })
      });
      if(res.ok){form.style.display='none';document.getElementById('leadSuccess').style.display='block';}
      else{btn.textContent='Fehler – erneut versuchen';btn.disabled=false;}
    }catch(err){btn.textContent='Fehler – erneut versuchen';btn.disabled=false;}
    return false;
  }
  </script>`;
}

// ─── HTML Builder v6 – Stunning design with hero 3:1 + rich sections ───
function buildHTML(
  content: any, images: Record<string, string>, dealer: any,
  brand: string, model: string, brandLogoUrl: string,
  contactFormOpts?: { dealerUserId: string; supabaseUrl: string; vehicleTitle: string; pageType: string }
): string {
  const meta = content.meta || {};
  const hero = content.hero || {};
  const sections = content.sections || [];
  const seo = content.seo || {};

  const heroImage = images.hero || "";
  const dealerName = dealer?.name || "";
  const dealerLogo = dealer?.logoUrl || "";
  const phone = dealer?.phone || "";
  const email = dealer?.email || "";
  const website = dealer?.website || "";
  const whatsapp = dealer?.whatsappNumber || "";
  const address = [dealer?.address, dealer?.postalCode, dealer?.city].filter(Boolean).join(", ");

  const socials = [
    dealer?.facebookUrl && `<a href="${dealer.facebookUrl}" target="_blank" style="color:#94a3b8;text-decoration:none;transition:color .2s" onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#94a3b8'">Facebook</a>`,
    dealer?.instagramUrl && `<a href="${dealer.instagramUrl}" target="_blank" style="color:#94a3b8;text-decoration:none;transition:color .2s" onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#94a3b8'">Instagram</a>`,
    dealer?.youtubeUrl && `<a href="${dealer.youtubeUrl}" target="_blank" style="color:#94a3b8;text-decoration:none;transition:color .2s" onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#94a3b8'">YouTube</a>`,
    dealer?.tiktokUrl && `<a href="${dealer.tiktokUrl}" target="_blank" style="color:#94a3b8;text-decoration:none;transition:color .2s" onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#94a3b8'">TikTok</a>`,
  ].filter(Boolean).join(" · ");

  const jsonLd = seo.structuredData ? `<script type="application/ld+json">${JSON.stringify(seo.structuredData)}</script>` : "";
  const ogImage = heroImage ? `<meta property="og:image" content="${heroImage}">` : "";

  const logoHeader = [
    brandLogoUrl ? `<img src="${brandLogoUrl}" alt="${brand}" style="max-height:32px" />` : "",
    dealerLogo ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:40px" />` : "",
  ].filter(Boolean).join("");

  // Build sections
  const sectionBlocks = sections.map((s: any, idx: number) => {
    const img = images[s.id] || "";
    const bgMap: Record<string, string> = {
      white: "background:#ffffff", light: "background:#f8fafc",
      dark: "background:#0f172a;color:#f1f5f9", accent: "background:#1e3a5f;color:#ffffff",
    };
    const bg = bgMap[s.bgStyle] || bgMap.white;
    const isDark = s.bgStyle === "dark" || s.bgStyle === "accent";
    const hc = isDark ? "#ffffff" : "#0f172a";
    const sc = isDark ? "#cbd5e1" : "#475569";
    const accentLine = isDark ? "#3b82f6" : "#1e3a5f";

    // Accent line decoration for headlines
    const headlineHTML = `<div style="text-align:center;margin-bottom:40px"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:32px;font-weight:700;color:${hc};margin-bottom:12px">${s.headline}</h2><div style="width:60px;height:3px;background:${accentLine};margin:0 auto;border-radius:2px"></div></div>`;

    if (s.type === "steps") {
      return `<section style="${bg};padding:80px 24px">${wrapMax(960, headlineHTML + `<div style="font-size:15px;line-height:1.9;color:${sc}">${s.content}</div>`)}</section>`;
    }
    if (s.type === "faq") {
      return `<section style="${bg};padding:80px 24px">${wrapMax(760, headlineHTML + `<div style="font-size:15px;line-height:1.9;color:${sc}">${s.content}</div>`)}</section>`;
    }
    if (s.type === "cta") {
      return `<section style="background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 50%,#1e293b 100%);color:#ffffff;padding:100px 24px;text-align:center;position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(59,130,246,0.15) 0%,transparent 60%)"></div>
  <div style="position:relative;z-index:1;max-width:640px;margin:0 auto">
    <h2 style="font-family:'Space Grotesk',sans-serif;font-size:36px;font-weight:700;margin-bottom:16px">${s.headline}</h2>
    <div style="font-size:17px;line-height:1.7;opacity:0.9;margin-bottom:40px">${s.content}</div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center">
      ${phone ? `<a href="tel:${phone}" style="display:inline-flex;align-items:center;gap:8px;background:#3b82f6;color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(59,130,246,0.4);transition:transform .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">📞 Jetzt anrufen</a>` : ""}
      ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(37,211,102,0.3);transition:transform .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">💬 WhatsApp</a>` : ""}
    </div>
  </div>
</section>`;
    }
    if (s.type === "specs") {
      const imgBlock = img ? `<div style="flex:1;min-width:300px"><img src="${img}" alt="${s.headline}" style="width:100%;border-radius:16px;object-fit:cover;max-height:450px;box-shadow:0 8px 30px rgba(0,0,0,0.12)" loading="lazy" /></div>` : "";
      return `<section style="${bg};padding:80px 24px">${wrapMax(1060, headlineHTML + `<div style="display:flex;flex-wrap:wrap;gap:40px;align-items:flex-start">${imgBlock}<div style="flex:1;min-width:300px;font-size:14px;line-height:1.9;color:${sc}">${s.content}</div></div>`)}</section>`;
    }
    if (s.type === "comparison") {
      return `<section style="${bg};padding:80px 24px">${wrapMax(900, headlineHTML + `<div style="font-size:14px;line-height:1.8;color:${sc};overflow-x:auto">${s.content}</div>`)}</section>`;
    }
    if (s.type === "benefits") {
      return `<section style="${bg};padding:80px 24px">${wrapMax(1060, headlineHTML + `<div style="font-size:15px;line-height:1.9;color:${sc}">${s.content}</div>`)}</section>`;
    }
    if (s.type === "gallery") {
      return `<section style="${bg};padding:80px 24px">${wrapMax(1060, headlineHTML + (img ? `<img src="${img}" alt="${s.headline}" style="width:100%;border-radius:16px;object-fit:cover;max-height:500px;box-shadow:0 8px 30px rgba(0,0,0,0.12);margin-bottom:24px" loading="lazy" />` : '') + `<div style="font-size:15px;line-height:1.9;color:${sc}">${s.content}</div>`)}</section>`;
    }

    // Default content sections – stunning split design with image
    if (img) {
      const imageOnLeft = idx % 2 === 0;
      const overlayGradient = imageOnLeft
        ? isDark
          ? "linear-gradient(to right, rgba(15,23,42,0) 0%, rgba(15,23,42,0) 35%, rgba(15,23,42,0.8) 45%, rgba(15,23,42,1) 52%)"
          : "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0.85) 45%, rgba(255,255,255,1) 52%)"
        : isDark
          ? "linear-gradient(to left, rgba(15,23,42,0) 0%, rgba(15,23,42,0) 35%, rgba(15,23,42,0.8) 45%, rgba(15,23,42,1) 52%)"
          : "linear-gradient(to left, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0.85) 45%, rgba(255,255,255,1) 52%)";

      const textPadding = imageOnLeft ? "padding:80px 48px 80px 55%" : "padding:80px 55% 80px 48px";
      const bgPos = imageOnLeft ? "left center" : "right center";

      return `<section style="position:relative;min-height:500px;overflow:hidden;${bg}">
  <div style="position:absolute;inset:0;background:url('${img}') ${bgPos}/50% 100% no-repeat"></div>
  <div style="position:absolute;inset:0;background:${overlayGradient}"></div>
  <div style="position:relative;z-index:1;max-width:1200px;margin:0 auto;${textPadding}">
    <div style="width:60px;height:3px;background:${accentLine};margin-bottom:20px;border-radius:2px"></div>
    <h2 style="font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;color:${hc};margin-bottom:20px">${s.headline}</h2>
    <div style="font-size:15px;line-height:1.9;color:${sc}">${s.content}</div>
  </div>
</section>`;
    }

    // No image – centered content
    return `<section style="${bg};padding:80px 24px">${wrapMax(800, headlineHTML + `<div style="font-size:15px;line-height:1.9;color:${sc}">${s.content}</div>`)}</section>`;
  }).join("\n");

  const contactFormHTML = contactFormOpts ? buildContactFormInline(contactFormOpts) : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title || `${brand} ${model}`}</title>
  <meta name="description" content="${meta.description || ""}">
  <meta name="keywords" content="${(seo.keywords || []).join(", ")}">
  <link rel="canonical" href="${website || "#"}">
  <meta property="og:title" content="${meta.title || `${brand} ${model}`}">
  <meta property="og:description" content="${meta.description || ""}">
  <meta property="og:type" content="website">
  ${ogImage}
  ${jsonLd}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;color:#1e293b;background:#ffffff;-webkit-font-smoothing:antialiased}
    img{max-width:100%;height:auto}
    a{color:#3b82f6;transition:color .2s}
    a:hover{color:#2563eb}
    h1,h2,h3{font-family:'Space Grotesk',sans-serif}
    h3{font-size:19px;font-weight:600;margin:24px 0 10px;color:inherit}
    ul,ol{padding-left:20px}
    li{margin-bottom:10px}
    table{width:100%;border-collapse:collapse;margin:20px 0;border-radius:12px;overflow:hidden}
    th,td{padding:12px 16px;border:1px solid #e2e8f0;text-align:left;font-size:13px}
    th{background:#f1f5f9;font-weight:600;font-family:'Space Grotesk',sans-serif;color:#0f172a}
    @media(max-width:768px){
      .hero-wrap{min-height:320px !important}
      .hero-content{padding:40px 24px !important}
      .hero-content h1{font-size:28px !important}
      table{font-size:12px}
      th,td{padding:8px 10px}
      section[style*="min-height:500px"] > div:last-child{padding:40px 24px !important}
      section[style*="min-height:500px"] > div:first-child{background-size:cover !important}
      section[style*="min-height:500px"] > div:nth-child(2){background:linear-gradient(to bottom,rgba(0,0,0,0) 0%,rgba(255,255,255,0.9) 30%,rgba(255,255,255,1) 40%) !important}
    }
  </style>
</head>
<body>
  <!-- Sticky Header -->
  <header style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHeader}
      <span style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;color:#0f172a">${dealerName}</span>
    </div>
    ${phone ? `<a href="tel:${phone}" style="background:#1e3a5f;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;transition:background .2s" onmouseover="this.style.background='#3b82f6'" onmouseout="this.style.background='#1e3a5f'">Jetzt anfragen</a>` : ""}
  </header>

  <!-- Hero – 3:1 Panoramic -->
  <section class="hero-wrap" style="position:relative;min-height:560px;display:flex;align-items:center;overflow:hidden;${heroImage ? `background:url('${heroImage}') center/cover no-repeat` : "background:linear-gradient(135deg,#0f172a,#1e3a5f)"}">
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(15,23,42,0.9) 0%,rgba(15,23,42,0.5) 40%,rgba(15,23,42,0.2) 100%)"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:120px;background:linear-gradient(to top,rgba(15,23,42,0.6),transparent)"></div>
    <div class="hero-content" style="position:relative;z-index:1;max-width:700px;padding:100px 48px 80px;color:#ffffff">
      <div style="width:60px;height:4px;background:#3b82f6;margin-bottom:24px;border-radius:2px"></div>
      <h1 style="font-family:'Space Grotesk',sans-serif;font-size:48px;font-weight:800;line-height:1.1;margin-bottom:20px;text-shadow:0 2px 40px rgba(0,0,0,0.3)">${hero.headline || `${brand} ${model}`}</h1>
      <p style="font-size:19px;line-height:1.6;opacity:0.9;margin-bottom:36px;max-width:540px">${hero.subheadline || ""}</p>
      ${hero.ctaText ? `<a href="#kontakt" style="display:inline-flex;align-items:center;gap:8px;background:#3b82f6;color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(59,130,246,0.4);transition:transform .2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">${hero.ctaText}</a>` : ""}
    </div>
  </section>

  ${sectionBlocks}

  <!-- Contact / Dealer Info -->
  <section id="kontakt" style="background:#f8fafc;padding:80px 24px;border-top:1px solid #e2e8f0">
    <div style="max-width:760px;margin:0 auto;text-align:center">
      ${dealerLogo ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:56px;margin-bottom:20px" />` : ""}
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;margin-bottom:8px">${dealerName}</h2>
      ${address ? `<p style="color:#64748b;font-size:14px;margin-bottom:8px">${address}</p>` : ""}
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:20px;margin-top:20px;font-size:14px">
        ${phone ? `<a href="tel:${phone}" style="color:#3b82f6;text-decoration:none;display:flex;align-items:center;gap:6px">📞 ${phone}</a>` : ""}
        ${email ? `<a href="mailto:${email}" style="color:#3b82f6;text-decoration:none;display:flex;align-items:center;gap:6px">✉️ ${email}</a>` : ""}
        ${website ? `<a href="${website.startsWith("http") ? website : "https://" + website}" target="_blank" style="color:#3b82f6;text-decoration:none;display:flex;align-items:center;gap:6px">🌐 Website</a>` : ""}
        ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}" target="_blank" style="color:#25d366;text-decoration:none;display:flex;align-items:center;gap:6px">💬 WhatsApp</a>` : ""}
      </div>
      ${socials ? `<div style="margin-top:20px;font-size:13px">${socials}</div>` : ""}
    </div>
  </section>

  <footer style="background:#0f172a;color:#94a3b8;padding:40px 24px;text-align:center;font-size:12px">
    <p>&copy; ${new Date().getFullYear()} ${dealerName}. Alle Angaben ohne Gewähr.</p>
    ${dealer?.defaultLegalText ? `<p style="margin-top:12px;max-width:640px;margin-left:auto;margin-right:auto;line-height:1.7">${dealer.defaultLegalText}</p>` : ""}
  </footer>

  ${contactFormHTML}
</body>
</html>`;
}

function wrapMax(width: number, inner: string): string {
  return `<div style="max-width:${width}px;margin:0 auto">${inner}</div>`;
}
