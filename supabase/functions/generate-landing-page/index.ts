// generate-landing-page v5 – Robust JSON parsing + contextual images
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Robust JSON extraction from AI responses ───
function extractJsonFromResponse(response: string): unknown {
  let cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  if (jsonStart === -1) throw new Error("No JSON found in response");

  const openChar = cleaned[jsonStart];
  const closeChar = openChar === '{' ? '}' : ']';
  const jsonEnd = cleaned.lastIndexOf(closeChar);

  if (jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("Truncated JSON response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  // Check for truncation (unbalanced braces)
  const openBraces = (cleaned.match(/{/g) || []).length;
  const closeBraces = (cleaned.match(/}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;

  if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
    // Try to repair by closing missing braces/brackets
    let repaired = cleaned;
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
    cleaned = repaired;
  }

  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    // Fix common issues: trailing commas, control characters
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, (ch) => ch === '\n' || ch === '\t' ? ch : '');
    return JSON.parse(cleaned);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
}

async function authenticateAndDeductCredits(
  req: Request,
  cost: number
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createServiceClient();
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data, error } = await supabase.rpc("deduct_credits", {
    _user_id: user.id,
    _amount: cost,
    _action_type: "landing_page_export",
    _model: "gemini",
    _description: "Landing Page Generator",
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!data?.success) {
    return new Response(
      JSON.stringify({ error: "insufficient_credits", balance: data?.balance, cost }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return { userId: user.id };
}

// ─── Brand logo lookup ───
const BRAND_LOGO_ALIASES: Record<string, string[]> = {
  volkswagen: ['vw'], vw: ['volkswagen'],
  mercedesbenz: ['mercedes', 'mb'], mercedes: ['mercedesbenz', 'mb'],
  bmw: ['bayerischemotorenwerke'],
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
  } catch (e) {
    console.error('Brand logo lookup error:', e);
  }
  return '';
}

// ─── Upload generated image to storage ───
async function uploadGeneratedImage(
  supabase: any, base64: string, userId: string, key: string
): Promise<string | null> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const path = `${userId}/landing/${Date.now()}-${key}.png`;
    const { error } = await supabase.storage
      .from("vehicle-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("Upload failed:", e); return null; }
}

// ─── Upload user-provided image ───
async function uploadUserImage(
  supabase: any, base64: string, userId: string, index: number
): Promise<string | null> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const mimeMatch = base64.match(/^data:([^;]+);/);
    const mime = mimeMatch?.[1] || "image/jpeg";
    const ext = mime.includes("png") ? "png" : "jpg";
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const path = `${userId}/landing/${Date.now()}-user-${index}.${ext}`;
    const { error } = await supabase.storage
      .from("vehicle-images")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) { console.error("User image upload error:", error); return null; }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("User image upload failed:", e); return null; }
}

// ─── Tone & audience prompt enrichment ───
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
  studio: "in a clean white modern showroom with professional studio lighting, reflective floor",
  outdoor: "on a scenic mountain road with dramatic landscape, golden hour sunlight",
  urban: "in a modern city setting with glass architecture, evening city lights",
  dynamic: "in motion on a highway with motion blur, dynamic driving perspective",
};

// ─── Page type configurations (v4 – more images, helpful content) ───
interface PageTypeConfig {
  label: string;
  sectionCount: number;
  imageCount: number;
  systemInstruction: string;
}

const PAGE_TYPES: Record<string, PageTypeConfig> = {
  leasing: {
    label: "Leasing-Angebot", sectionCount: 7, imageCount: 6,
    systemInstruction: "Erstelle eine überzeugende Leasing-Landingpage. Strukturiere: Hero → Leasing-Vorteile (Kaufberatung-Charakter) → Fahrzeug-Highlights mit technischen Daten → Interieur & Komfort → Leasing-Konditionen → FAQ mit echten Fragen → CTA.",
  },
  finanzierung: {
    label: "Finanzierung", sectionCount: 7, imageCount: 6,
    systemInstruction: "Erstelle eine überzeugende Finanzierungs-Landingpage. Strukturiere: Hero → Warum Finanzieren (Vergleich Leasing vs. Finanzierung) → Fahrzeug-Design & Exterieur → Interieur & Technologie → Finanzierungskonditionen → FAQ → CTA.",
  },
  barkauf: {
    label: "Barkauf / Neuwagen", sectionCount: 6, imageCount: 5,
    systemInstruction: "Erstelle eine Premium-Verkaufsseite. Strukturiere: Hero → Ausstattung & Technik → Design & Exterieur → Interieur-Erlebnis → Preisvorteil & Garantie → CTA.",
  },
  massenangebot: {
    label: "Massenangebot / Aktionsseite", sectionCount: 8, imageCount: 7,
    systemInstruction: "Erstelle eine dringliche Aktionsseite. Strukturiere: Hero → Angebots-Übersicht → Fahrzeug-Highlights → Motor & Leistung → Interieur → Vergleichstabelle (comparison) → FAQ → CTA.",
  },
  autoabo: {
    label: "Auto-Abo", sectionCount: 7, imageCount: 6,
    systemInstruction: "Erstelle eine Auto-Abo-Landingpage. Strukturiere: Hero → So funktioniert's (steps) → Was ist inklusive (benefits) → Fahrzeug-Details → Interieur & Technologie → Preisvergleich (comparison) → CTA.",
  },
  event: {
    label: "Event im Autohaus", sectionCount: 7, imageCount: 5,
    systemInstruction: "Erstelle eine Event-Landingpage. Strukturiere: Hero → Event-Programm (steps) → Fahrzeug-Highlights → Interieur-Erlebnis → Vorteile für Teilnehmer (benefits) → FAQ → CTA.",
  },
  release: {
    label: "Fahrzeug-Release / Premiere", sectionCount: 8, imageCount: 7,
    systemInstruction: "Erstelle eine spektakuläre Release-Seite. Strukturiere: Hero → Design-Philosophie → Motor & Performance → Interieur & Technologie → Technische Daten (specs) → Vergleich zum Vorgänger (comparison) → Vorbestellung → CTA.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      brand, model, pageType, additionalInfo, dealer,
      variant, color, price, targetAudience, tone, imageStyle,
      uploadedImages,
    } = body;

    if (!brand || !model || !pageType) {
      return new Response(
        JSON.stringify({ error: "brand, model und pageType sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = PAGE_TYPES[pageType];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Unbekannter pageType: ${pageType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalCost = 3;
    const authResult = await authenticateAndDeductCredits(req, totalCost);
    if (authResult instanceof Response) return authResult;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY nicht konfiguriert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Upload user images first
    const userImageUrls: string[] = [];
    if (uploadedImages && Array.isArray(uploadedImages)) {
      for (let i = 0; i < uploadedImages.length; i++) {
        const url = await uploadUserImage(supabase, uploadedImages[i], authResult.userId, i);
        if (url) userImageUrls.push(url);
      }
    }

    // Find brand logo
    const brandLogoUrl = await findBrandLogo(supabase, brand);

    // Build vehicle description for image prompts
    const vehicleDesc = [color, brand, model, variant].filter(Boolean).join(" ");
    const imgStyleSuffix = IMAGE_STYLE_MAP[imageStyle || "studio"] || IMAGE_STYLE_MAP.studio;

    // Build enriched prompts
    const dealerInfo = dealer
      ? `\nHändler-Informationen:\n- Name: ${dealer.name || ""}\n- Adresse: ${dealer.address || ""}, ${dealer.postalCode || ""} ${dealer.city || ""}\n- Telefon: ${dealer.phone || ""}\n- E-Mail: ${dealer.email || ""}\n- Website: ${dealer.website || ""}\n- WhatsApp: ${dealer.whatsappNumber || ""}\n`
      : "";

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
- Jede Section MUSS echten Informationswert für den Kunden bieten – KEINE leeren Marketing-Phrasen
- Verwende konkrete technische Daten, Zahlen und Fakten (PS, Nm, Verbrauch, Kofferraum-Liter, 0-100 km/h etc.)
- Erkläre technische Features aus Kundensicht: "Was bedeutet das für Ihren Alltag?"
- Nutze Vergleiche: "Im Vergleich zum Vorgänger...", "Gegenüber dem Wettbewerb..."
- Baue Praxisbeispiele ein: "Auf der Langstrecke...", "Im Stadtverkehr..."
- FAQ: Echte Fragen die Kunden stellen ("Wie hoch ist der Restwert?", "Was passiert bei Mehrkilometern?")
- Verwende Bullet-Points (<ul><li>) für Aufzählungen und Checklisten
- Strukturiere mit Zwischenüberschriften (<h3>) innerhalb der Sections

KONTEXTUELLE BILD-PROMPTS (KRITISCH):
Für JEDE Section die ein Bild braucht, MUSS der imagePrompt EXAKT zum Sektionsinhalt passen:
- Sektion über Motor/Leistung/Performance → "Close-up of the engine bay / exhaust system / brake calipers of a ${vehicleDesc}"
- Sektion über Innenraum/Komfort/Interieur → "Interior cockpit view showing dashboard, steering wheel, and infotainment of a ${vehicleDesc}"
- Sektion über Design/Exterieur → "Elegant side profile / rear three-quarter view of a ${vehicleDesc}"
- Sektion über Technologie/Assistenzsysteme → "Detail of the digital dashboard display / head-up display / charging port of a ${vehicleDesc}"
- Sektion über Sicherheit → "Artistic visualization of safety sensors and driver assistance of a ${vehicleDesc}"
- FAQ/Steps/CTA/Comparison/Benefits Sektionen → imagePrompt: null (kein Bild)
Jeder imagePrompt MUSS enden mit: "${imgStyleSuffix}"
${priceInstruction}

${dealerInfo}

Antworte AUSSCHLIESSLICH als JSON mit folgender Struktur:
{
  "meta": {
    "title": "SEO Title (<60 Zeichen, mit Keyword)",
    "description": "Meta Description (<160 Zeichen, Call-to-Action)",
    "h1": "Hauptüberschrift der Seite"
  },
  "hero": {
    "headline": "Emotionale Headline mit Marke/Modell",
    "subheadline": "Ergänzender Untertitel mit Kernvorteil",
    "ctaText": "CTA Button Text",
    "imagePrompt": "Professional hero shot of a ${vehicleDesc} from a dramatic front 3/4 angle ${imgStyleSuffix}"
  },
  "sections": [
    {
      "id": "unique-kebab-id",
      "type": "content|features|pricing|faq|cta|comparison|steps|benefits|specs|gallery",
      "headline": "Abschnitts-Überschrift",
      "content": "HTML-formatierter Inhalt mit <h3>, <ul><li>, <p> etc. – echter Mehrwert-Content",
      "imagePrompt": "Kontextueller englischer Prompt passend zum Sektionsinhalt ODER null",
      "bgStyle": "white|light|dark|accent"
    }
  ],
  "seo": {
    "keywords": ["long-tail-keyword-1", "keyword-2", "keyword-3"],
    "structuredData": {
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      "name": "${dealer?.name || ''}",
      "offers": { "@type": "Offer", "itemOffered": { "@type": "Car", "brand": "${brand}", "model": "${model}" } }
    }
  }
}

Erstelle genau ${config.sectionCount} sections. Davon sollen ${config.imageCount} ein imagePrompt haben, der Rest null.
Section-Types "specs", "comparison", "benefits" werden speziell gerendert – nutze sie wo sinnvoll.
${!uploadedImages?.length ? `\nWICHTIG: Es wurden KEINE eigenen Bilder hochgeladen. Du MUSST für JEDE visuelle Section einen detaillierten imagePrompt generieren, damit automatisch passende KI-Bilder erstellt werden. Generiere mindestens ${config.imageCount} imagePrompts. Jedes Bild soll thematisch exakt zur Section passen.` : ''}`;

    const userPrompt = `Erstelle eine ${config.label}-Landingpage für:\nMarke: ${brand}\nModell: ${model}${variantInfo}${colorInfo}\n${additionalInfo ? `Zusätzliche Informationen / Highlights: ${additionalInfo}` : ""}`;

    console.log("Generating content for:", brand, model, pageType, "tone:", tone, "audience:", targetAudience);

    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const contentResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!contentResponse.ok) {
      const errText = await contentResponse.text();
      console.error("Gemini content error:", contentResponse.status, errText);
      if (contentResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es in einer Minute erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "KI-Fehler bei Content-Generierung" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentData = await contentResponse.json();
    let rawContent = contentData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    let pageContent;
    try {
      pageContent = extractJsonFromResponse(rawContent);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawContent.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "KI-Antwort konnte nicht verarbeitet werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Generate images ───
    const imagePrompts: { key: string; prompt: string }[] = [];
    if (pageContent.hero?.imagePrompt) {
      imagePrompts.push({ key: "hero", prompt: pageContent.hero.imagePrompt });
    }
    for (const section of pageContent.sections || []) {
      if (section.imagePrompt) {
        imagePrompts.push({ key: section.id, prompt: section.imagePrompt });
      }
    }

    // Assign user images to first slots, generate rest
    const imageResults: Record<string, string> = {};
    let userImgIdx = 0;
    const hasUserImages = userImageUrls.length > 0;

    if (hasUserImages) {
      // Only assign user images when provided
      for (let i = 0; i < imagePrompts.length && userImgIdx < userImageUrls.length; i++) {
        imageResults[imagePrompts[i].key] = userImageUrls[userImgIdx];
        userImgIdx++;
      }
    }

    // Generate ALL remaining images (when no user images: generate everything)
    const remainingPrompts = imagePrompts.filter(p => !imageResults[p.key]);
    console.log(`User images: ${userImageUrls.length}, Generating ${remainingPrompts.length} AI images...`);

    const imageGenModel = "gemini-2.5-flash-preview-05-20";
    const imageGenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageGenModel}:generateContent`;

    for (let i = 0; i < remainingPrompts.length; i += 3) {
      const batch = remainingPrompts.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(async ({ key, prompt }) => {
          try {
            const imgResp = await fetch(imageGenUrl, {
              method: "POST",
              headers: { "x-goog-api-key": GEMINI_API_KEY!, "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate a professional, high-quality automotive marketing photo: ${prompt}. Style: Modern, clean, professional. Aspect ratio: 16:9. No text overlays, no watermarks.` }] }],
                generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
              }),
            });
            if (!imgResp.ok) {
              const errText = await imgResp.text();
              console.error(`Image gen failed for ${key}:`, imgResp.status, errText.substring(0, 300));
              return { key, url: null };
            }
            const imgData = await imgResp.json();
            let base64: string | null = null;
            const respParts = imgData.candidates?.[0]?.content?.parts;
            if (respParts) {
              for (const part of respParts) {
                if (part.inlineData?.data) {
                  const mime = part.inlineData.mimeType || "image/png";
                  base64 = `data:${mime};base64,${part.inlineData.data}`;
                  break;
                }
              }
            }
            if (base64) {
              const url = await uploadGeneratedImage(supabase, base64, authResult.userId, key);
              return { key, url: url || null };
            }
            console.error(`No image in response for ${key}`);
            return { key, url: null };
          } catch (e) { console.error(`Image gen error for ${key}:`, e); return { key, url: null }; }
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.url) {
          imageResults[r.value.key] = r.value.url;
        }
      }
    }

    console.log(`Total images: ${Object.keys(imageResults).length}/${imagePrompts.length}`);

    // ─── Build HTML with contact form ───
    const html = buildHTML(pageContent, imageResults, dealer, brand, model, brandLogoUrl, {
      dealerUserId: authResult.userId,
      supabaseUrl,
      vehicleTitle: `${brand} ${model}${variant ? ` ${variant}` : ""}`,
      pageType,
    });

    return new Response(
      JSON.stringify({
        html, pageContent, imageMap: imageResults, brandLogoUrl,
        imageCount: Object.keys(imageResults).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Contact Form Builder (inline for edge function) ───
function buildContactFormInline(opts: {
  dealerUserId: string;
  supabaseUrl: string;
  vehicleTitle: string;
  pageType: string;
}): string {
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
    <button onclick="document.getElementById('leadModal').style.display='flex'" style="
      background:linear-gradient(135deg,#3366cc,#2952a3);color:#fff;border:none;cursor:pointer;
      padding:14px 28px;border-radius:50px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;
      box-shadow:0 4px 24px rgba(51,102,204,0.4);transition:all .2s;display:flex;align-items:center;gap:8px;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
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

// ─── HTML Builder (v4 – new section types: specs, comparison, benefits, gallery) ───
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
    dealer?.facebookUrl && `<a href="${dealer.facebookUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">Facebook</a>`,
    dealer?.instagramUrl && `<a href="${dealer.instagramUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">Instagram</a>`,
    dealer?.youtubeUrl && `<a href="${dealer.youtubeUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">YouTube</a>`,
    dealer?.tiktokUrl && `<a href="${dealer.tiktokUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">TikTok</a>`,
  ].filter(Boolean).join(" · ");

  const jsonLd = seo.structuredData
    ? `<script type="application/ld+json">${JSON.stringify(seo.structuredData)}</script>`
    : "";

  const ogImage = heroImage ? `<meta property="og:image" content="${heroImage}">` : "";

  const logoHeader = [
    brandLogoUrl ? `<img src="${brandLogoUrl}" alt="${brand}" style="max-height:32px" />` : "",
    dealerLogo ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:40px" />` : "",
  ].filter(Boolean).join("");

  const sectionBlocks = sections
    .map((s: any, idx: number) => {
      const img = images[s.id] || "";
      const bgMap: Record<string, string> = {
        white: "background:#ffffff", light: "background:#f8fafc",
        dark: "background:#0f172a;color:#f1f5f9", accent: "background:#1e3a5f;color:#ffffff",
      };
      const bg = bgMap[s.bgStyle] || bgMap.white;
      const isDark = s.bgStyle === "dark" || s.bgStyle === "accent";
      const headlineColor = isDark ? "#ffffff" : "#0f172a";
      const subColor = isDark ? "#cbd5e1" : "#475569";

      // Steps section
      if (s.type === "steps") {
        return `<section style="${bg};padding:64px 24px"><div style="max-width:960px;margin:0 auto;text-align:center"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:40px">${s.headline}</h2><div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div></div></section>`;
      }

      // FAQ section
      if (s.type === "faq") {
        return `<section style="${bg};padding:64px 24px"><div style="max-width:760px;margin:0 auto"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2><div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div></div></section>`;
      }

      // CTA section
      if (s.type === "cta") {
        return `<section style="background:linear-gradient(135deg,#1e3a5f,#0f172a);color:#ffffff;padding:80px 24px;text-align:center"><div style="max-width:640px;margin:0 auto"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:32px;font-weight:700;margin-bottom:16px">${s.headline}</h2><div style="font-size:16px;line-height:1.7;opacity:0.9;margin-bottom:32px">${s.content}</div>${phone ? `<a href="tel:${phone}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">📞 Jetzt anrufen</a>` : ""}${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}" target="_blank" style="display:inline-block;background:#25d366;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-left:12px">💬 WhatsApp</a>` : ""}</div></section>`;
      }

      // Specs section – image left, data right
      if (s.type === "specs") {
        const imgBlock = img ? `<div style="flex:1;min-width:280px"><img src="${img}" alt="${s.headline}" style="width:100%;border-radius:12px;object-fit:cover;max-height:420px" loading="lazy" /></div>` : "";
        return `<section style="${bg};padding:64px 24px"><div style="max-width:960px;margin:0 auto"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2><div style="display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start">${imgBlock}<div style="flex:1;min-width:280px;font-size:14px;line-height:1.8;color:${subColor}">${s.content}</div></div></div></section>`;
      }

      // Comparison section – full-width table
      if (s.type === "comparison") {
        return `<section style="${bg};padding:64px 24px"><div style="max-width:860px;margin:0 auto"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2><div style="font-size:14px;line-height:1.8;color:${subColor};overflow-x:auto">${s.content}</div></div></section>`;
      }

      // Benefits section – icon grid
      if (s.type === "benefits") {
        return `<section style="${bg};padding:64px 24px"><div style="max-width:960px;margin:0 auto;text-align:center"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:40px">${s.headline}</h2><div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div></div></section>`;
      }

      // Gallery section
      if (s.type === "gallery") {
        return `<section style="${bg};padding:64px 24px"><div style="max-width:960px;margin:0 auto"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2>${img ? `<img src="${img}" alt="${s.headline}" style="width:100%;border-radius:12px;object-fit:cover;max-height:500px" loading="lazy" />` : ""}<div style="font-size:15px;line-height:1.8;color:${subColor};margin-top:20px">${s.content}</div></div></section>`;
      }

      // Default content with image – stunning split-screen with background overlay
      const hasImage = !!img;
      const imageOnLeft = idx % 2 === 0;
      if (hasImage) {
        // Full-width split-screen: image as background on one side, content on the other
        const overlayGradient = imageOnLeft
          ? "linear-gradient(to right, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 40%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,1) 55%)"
          : "linear-gradient(to left, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 40%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,1) 55%)";
        const darkOverlayGradient = imageOnLeft
          ? "linear-gradient(to right, rgba(15,23,42,0.0) 0%, rgba(15,23,42,0.0) 40%, rgba(15,23,42,0.95) 50%, rgba(15,23,42,1) 55%)"
          : "linear-gradient(to left, rgba(15,23,42,0.0) 0%, rgba(15,23,42,0.0) 40%, rgba(15,23,42,0.95) 50%, rgba(15,23,42,1) 55%)";
        const useOverlay = isDark ? darkOverlayGradient : overlayGradient;
        const textAlign = imageOnLeft ? "right" : "left";
        const textPadding = imageOnLeft ? "padding:64px 48px 64px 55%" : "padding:64px 55% 64px 48px";
        const bgPos = imageOnLeft ? "left center" : "right center";

        return `<section style="position:relative;min-height:420px;overflow:hidden;${bg}">
  <div style="position:absolute;inset:0;background:url('${img}') ${bgPos}/50% 100% no-repeat"></div>
  <div style="position:absolute;inset:0;background:${useOverlay}"></div>
  <div style="position:relative;z-index:1;max-width:1200px;margin:0 auto;${textPadding}">
    <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:16px">${s.headline}</h2>
    <div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div>
  </div>
</section>`;
      }

      return `<section style="${bg};padding:64px 24px"><div style="max-width:760px;margin:0 auto"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:20px;text-align:center">${s.headline}</h2><div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div></div></section>`;
    })
    .join("\n");

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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;color:#1e293b;background:#ffffff}
    img{max-width:100%}
    a{color:#3b82f6}
    h1,h2,h3{font-family:'Space Grotesk',sans-serif}
    h3{font-size:18px;font-weight:600;margin:20px 0 8px}
    ul,ol{padding-left:20px}
    li{margin-bottom:8px}
    table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{padding:10px 14px;border:1px solid #e2e8f0;text-align:left;font-size:13px}
    th{background:#f1f5f9;font-weight:600;font-family:'Space Grotesk',sans-serif}
    @media(max-width:768px){
      .hero-content{padding:40px 20px !important}
      .hero-content h1{font-size:28px !important}
      table{font-size:12px}
      th,td{padding:6px 8px}
      section[style*="min-height:420px"] > div:last-child{padding:40px 24px !important}
      section[style*="min-height:420px"] > div:first-child{background-size:cover !important}
      section[style*="min-height:420px"] > div:nth-child(2){background:linear-gradient(to bottom,rgba(0,0,0,0) 0%,rgba(255,255,255,0.9) 30%,rgba(255,255,255,1) 40%) !important}
    }
  </style>
</head>
<body>
  <header style="background:#ffffff;border-bottom:1px solid #e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100">
    <div style="display:flex;align-items:center;gap:12px">
      ${logoHeader}
      <span style="font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;color:#0f172a">${dealerName}</span>
    </div>
    ${phone ? `<a href="tel:${phone}" style="background:#3b82f6;color:#fff;padding:8px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Jetzt anfragen</a>` : ""}
  </header>

  <section style="position:relative;min-height:480px;display:flex;align-items:center;overflow:hidden;${heroImage ? `background:url('${heroImage}') center/cover no-repeat` : "background:linear-gradient(135deg,#0f172a,#1e3a5f)"}">
    <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(15,23,42,0.85) 0%,rgba(15,23,42,0.4) 100%)"></div>
    <div class="hero-content" style="position:relative;z-index:1;max-width:640px;padding:80px 48px;color:#ffffff">
      <h1 style="font-family:'Space Grotesk',sans-serif;font-size:42px;font-weight:800;line-height:1.15;margin-bottom:16px">${hero.headline || `${brand} ${model}`}</h1>
      <p style="font-size:18px;line-height:1.6;opacity:0.9;margin-bottom:32px">${hero.subheadline || ""}</p>
      ${hero.ctaText ? `<a href="#kontakt" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">${hero.ctaText}</a>` : ""}
    </div>
  </section>

  ${sectionBlocks}

  <section id="kontakt" style="background:#f8fafc;padding:64px 24px;border-top:1px solid #e2e8f0">
    <div style="max-width:760px;margin:0 auto;text-align:center">
      ${dealerLogo ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:56px;margin-bottom:16px" />` : ""}
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;margin-bottom:8px">${dealerName}</h2>
      ${address ? `<p style="color:#64748b;font-size:14px;margin-bottom:4px">${address}</p>` : ""}
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-top:16px;font-size:14px">
        ${phone ? `<a href="tel:${phone}" style="color:#3b82f6;text-decoration:none">📞 ${phone}</a>` : ""}
        ${email ? `<a href="mailto:${email}" style="color:#3b82f6;text-decoration:none">✉️ ${email}</a>` : ""}
        ${website ? `<a href="${website.startsWith("http") ? website : "https://" + website}" target="_blank" style="color:#3b82f6;text-decoration:none">🌐 Website</a>` : ""}
        ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}" target="_blank" style="color:#25d366;text-decoration:none">💬 WhatsApp</a>` : ""}
      </div>
      ${socials ? `<div style="margin-top:16px;font-size:13px">${socials}</div>` : ""}
    </div>
  </section>

  <footer style="background:#0f172a;color:#94a3b8;padding:32px 24px;text-align:center;font-size:12px">
    <p>&copy; ${new Date().getFullYear()} ${dealerName}. Alle Angaben ohne Gewähr.</p>
    ${dealer?.defaultLegalText ? `<p style="margin-top:8px;max-width:640px;margin-left:auto;margin-right:auto;line-height:1.6">${dealer.defaultLegalText}</p>` : ""}
  </footer>

  ${contactFormHTML}
</body>
</html>`;
}
