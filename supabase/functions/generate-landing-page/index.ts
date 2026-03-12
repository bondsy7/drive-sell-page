// generate-landing-page v2 – AI landing page generator with brand logos + storage upload
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
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
  volkswagen: ['vw'],
  vw: ['volkswagen'],
  mercedesbenz: ['mercedes', 'mb'],
  mercedes: ['mercedesbenz', 'mb'],
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
  supabase: any,
  base64: string,
  userId: string,
  key: string
): Promise<string | null> {
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const path = `${userId}/landing/${Date.now()}-${key}.png`;
    const { error } = await supabase.storage
      .from("vehicle-images")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("Upload failed:", e);
    return null;
  }
}

// ─── Page type configurations ───
interface PageTypeConfig {
  label: string;
  sectionCount: number;
  imageCount: number;
  systemInstruction: string;
}

const PAGE_TYPES: Record<string, PageTypeConfig> = {
  leasing: {
    label: "Leasing-Angebot",
    sectionCount: 6,
    imageCount: 4,
    systemInstruction:
      "Du erstellst eine überzeugende Leasing-Landingpage. Fokus auf: niedrige monatliche Rate, Flexibilität, Steuervorteile für Gewerbetreibende, Kilometerpakete, Rückgabe-Optionen. Strukturiere mit: Hero → Vorteile Leasing → Fahrzeug-Highlights → Leasing-Konditionen → FAQ → CTA.",
  },
  finanzierung: {
    label: "Finanzierung",
    sectionCount: 6,
    imageCount: 4,
    systemInstruction:
      "Du erstellst eine überzeugende Finanzierungs-Landingpage. Fokus auf: Eigentumsübergang, flexible Raten, niedrige Zinsen, Anzahlung/Schlussrate-Optionen. Strukturiere mit: Hero → Warum Finanzieren → Fahrzeug-Details → Finanzierungsrechnung → Kundenstimmen → CTA.",
  },
  barkauf: {
    label: "Barkauf / Neuwagen",
    sectionCount: 5,
    imageCount: 4,
    systemInstruction:
      "Du erstellst eine Premium-Verkaufsseite für Barkauf/Neuwagen. Fokus auf: Sofort-Preisvorteil, Ausstattungshighlights, Verfügbarkeit, Garantie. Strukturiere mit: Hero → Ausstattung & Technik → Preisvorteil → Warum bei uns → CTA.",
  },
  massenangebot: {
    label: "Massenangebot / Aktionsseite",
    sectionCount: 7,
    imageCount: 5,
    systemInstruction:
      "Du erstellst eine dringliche Aktionsseite/Massenangebot. Fokus auf: zeitlich begrenzt, Stückzahl limitiert, Sonderkonditionen, FOMO-Elemente, Vergleich mit Normalpreis. Strukturiere mit: Hero mit Countdown → Angebots-Übersicht → Einzelne Modell-Highlights → Warum jetzt → Vergleichstabelle → Testimonials → CTA.",
  },
  autoabo: {
    label: "Auto-Abo",
    sectionCount: 6,
    imageCount: 4,
    systemInstruction:
      "Du erstellst eine moderne Auto-Abo-Landingpage. Fokus auf: All-inclusive (Versicherung, Wartung, Reifen), Flexibilität, kurze Laufzeiten, keine versteckten Kosten, digitaler Prozess. Strukturiere mit: Hero → So funktioniert's (3 Schritte) → Was ist inklusive → Fahrzeug-Details → Preisvergleich Abo vs. Leasing → CTA.",
  },
  event: {
    label: "Event im Autohaus",
    sectionCount: 6,
    imageCount: 4,
    systemInstruction:
      "Du erstellst eine einladende Event-Landingpage für ein Autohaus. Fokus auf: Event-Datum/Uhrzeit, exklusive Vorteile für Teilnehmer, Programm, Registrierung. Strukturiere mit: Hero mit Datum → Event-Programm → Highlights & Sonderangebote → Über das Autohaus → Anfahrt → Anmeldung/CTA.",
  },
  release: {
    label: "Fahrzeug-Release / Premiere",
    sectionCount: 7,
    imageCount: 5,
    systemInstruction:
      "Du erstellst eine spektakuläre Release/Premiere-Seite für ein neues Fahrzeugmodell. Fokus auf: Innovation, Design, Technik-Highlights, Emotionen, Vorbestellmöglichkeit. Strukturiere mit: Hero (cinematic) → Design-Philosophie → Technische Innovation → Interieur-Erlebnis → Performance-Daten → Konfiguration/Vorbestellung → CTA.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand, model, pageType, additionalInfo, dealer } = await req.json();

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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createServiceClient();

    // ─── Find brand logo ───
    const brandLogoUrl = await findBrandLogo(supabase, brand);
    console.log("Brand logo:", brandLogoUrl ? "found" : "not found");

    // ─── Step 1: Generate page content via AI ───
    const dealerInfo = dealer
      ? `\nHändler-Informationen:\n- Name: ${dealer.name || ""}\n- Adresse: ${dealer.address || ""}, ${dealer.postalCode || ""} ${dealer.city || ""}\n- Telefon: ${dealer.phone || ""}\n- E-Mail: ${dealer.email || ""}\n- Website: ${dealer.website || ""}\n- WhatsApp: ${dealer.whatsappNumber || ""}\n`
      : "";

    const systemPrompt = `Du bist ein professioneller Automotive-Marketing-Texter und Webdesigner.
${config.systemInstruction}

WICHTIG:
- Schreibe auf Deutsch
- Texte müssen SEO-optimiert sein (natürliche Keywords, H1/H2/H3 Hierarchie)
- Schreibe echten Mehrwert-Content, keine Platzhalter
- Passe Ton und Stil an den Seitentyp an
- Verwende konkrete Zahlen und Fakten wo möglich
- Jeder Absatz soll für den Kunden einen echten Informationswert bieten

${dealerInfo}

Antworte AUSSCHLIESSLICH als JSON mit folgender Struktur:
{
  "meta": {
    "title": "SEO Title (<60 Zeichen)",
    "description": "Meta Description (<160 Zeichen)",
    "h1": "Hauptüberschrift der Seite"
  },
  "hero": {
    "headline": "Emotionale Headline",
    "subheadline": "Ergänzender Untertitel",
    "ctaText": "CTA Button Text",
    "imagePrompt": "Detaillierter englischer Prompt für ein Hero-Bild des ${brand} ${model}"
  },
  "sections": [
    {
      "id": "unique-id",
      "type": "content|features|pricing|faq|cta|comparison|steps|testimonials",
      "headline": "Abschnitts-Überschrift",
      "content": "HTML-formattierter Inhalt (Absätze, Listen etc.)",
      "imagePrompt": "Englischer Prompt für ein passendes Bild oder null",
      "bgStyle": "white|light|dark|accent"
    }
  ],
  "seo": {
    "keywords": ["keyword1", "keyword2"],
    "structuredData": { JSON-LD Objekt }
  }
}

Erstelle genau ${config.sectionCount} sections. Davon sollen ${config.imageCount} ein imagePrompt haben, der Rest null.`;

    const userPrompt = `Erstelle eine ${config.label}-Landingpage für:\nMarke: ${brand}\nModell: ${model}\n${additionalInfo ? `Zusätzliche Informationen: ${additionalInfo}` : ""}`;

    console.log("Generating content for:", brand, model, pageType);

    const geminiTextUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const contentResponse = await fetch(geminiTextUrl, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
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
    rawContent = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let pageContent;
    try {
      pageContent = JSON.parse(rawContent);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawContent.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "KI-Antwort konnte nicht verarbeitet werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Step 2: Generate images and upload to storage ───
    const imagePrompts: { key: string; prompt: string }[] = [];
    if (pageContent.hero?.imagePrompt) {
      imagePrompts.push({ key: "hero", prompt: pageContent.hero.imagePrompt });
    }
    for (const section of pageContent.sections || []) {
      if (section.imagePrompt) {
        imagePrompts.push({ key: section.id, prompt: section.imagePrompt });
      }
    }

    console.log(`Generating ${imagePrompts.length} images...`);

    const geminiImageUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    const imageResults: Record<string, string> = {};
    for (let i = 0; i < imagePrompts.length; i += 2) {
      const batch = imagePrompts.slice(i, i + 2);
      const results = await Promise.allSettled(
        batch.map(async ({ key, prompt }) => {
          try {
            const imgResp = await fetch(geminiImageUrl, {
              method: "POST",
              headers: {
                "x-goog-api-key": GEMINI_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `Generate a professional, high-quality automotive marketing photo: ${prompt}. Style: Modern, clean, professional car dealership photography. Aspect ratio: 16:9. No text overlays.`,
                  }],
                }],
                generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
              }),
            });
            if (!imgResp.ok) {
              console.error(`Image gen failed for ${key}:`, imgResp.status);
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
              const url = await uploadGeneratedImage(
                supabase,
                base64,
                authResult.userId,
                key
              );
              return { key, url: url || base64 };
            }
            return { key, url: null };
          } catch (e) {
            console.error(`Image gen error for ${key}:`, e);
            return { key, url: null };
          }
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.url) {
          imageResults[r.value.key] = r.value.url;
        }
      }
    }

    console.log(
      `Generated ${Object.keys(imageResults).length}/${imagePrompts.length} images`
    );

    // ─── Step 3: Assemble HTML ───
    const html = buildHTML(
      pageContent,
      imageResults,
      dealer,
      brand,
      model,
      brandLogoUrl
    );

    return new Response(
      JSON.stringify({
        html,
        pageContent,
        imageMap: imageResults,
        brandLogoUrl,
        imageCount: Object.keys(imageResults).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-landing-page error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unbekannter Fehler",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─── HTML Builder ───
function buildHTML(
  content: any,
  images: Record<string, string>,
  dealer: any,
  brand: string,
  model: string,
  brandLogoUrl: string
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
  const address = [dealer?.address, dealer?.postalCode, dealer?.city]
    .filter(Boolean)
    .join(", ");

  const socials = [
    dealer?.facebookUrl &&
      `<a href="${dealer.facebookUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">Facebook</a>`,
    dealer?.instagramUrl &&
      `<a href="${dealer.instagramUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">Instagram</a>`,
    dealer?.youtubeUrl &&
      `<a href="${dealer.youtubeUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">YouTube</a>`,
    dealer?.tiktokUrl &&
      `<a href="${dealer.tiktokUrl}" target="_blank" style="color:#94a3b8;text-decoration:none">TikTok</a>`,
  ]
    .filter(Boolean)
    .join(" · ");

  const jsonLd = seo.structuredData
    ? `<script type="application/ld+json">${JSON.stringify(seo.structuredData)}</script>`
    : "";

  const logoHeader = [
    brandLogoUrl
      ? `<img src="${brandLogoUrl}" alt="${brand}" style="max-height:32px" />`
      : "",
    dealerLogo
      ? `<img src="${dealerLogo}" alt="${dealerName}" style="max-height:40px" />`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const sectionBlocks = sections
    .map((s: any, idx: number) => {
      const img = images[s.id] || "";
      const bgMap: Record<string, string> = {
        white: "background:#ffffff",
        light: "background:#f8fafc",
        dark: "background:#0f172a;color:#f1f5f9",
        accent: "background:#1e3a5f;color:#ffffff",
      };
      const bg = bgMap[s.bgStyle] || bgMap.white;
      const isDark = s.bgStyle === "dark" || s.bgStyle === "accent";
      const headlineColor = isDark ? "#ffffff" : "#0f172a";
      const subColor = isDark ? "#cbd5e1" : "#475569";

      if (s.type === "steps") {
        return `<section style="${bg};padding:64px 24px">
          <div style="max-width:960px;margin:0 auto;text-align:center">
            <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:40px">${s.headline}</h2>
            <div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div>
          </div>
        </section>`;
      }

      if (s.type === "faq") {
        return `<section style="${bg};padding:64px 24px">
          <div style="max-width:760px;margin:0 auto">
            <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:32px;text-align:center">${s.headline}</h2>
            <div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div>
          </div>
        </section>`;
      }

      if (s.type === "cta") {
        return `<section style="background:linear-gradient(135deg,#1e3a5f,#0f172a);color:#ffffff;padding:80px 24px;text-align:center">
          <div style="max-width:640px;margin:0 auto">
            <h2 style="font-family:'Space Grotesk',sans-serif;font-size:32px;font-weight:700;margin-bottom:16px">${s.headline}</h2>
            <div style="font-size:16px;line-height:1.7;opacity:0.9;margin-bottom:32px">${s.content}</div>
            ${phone ? `<a href="tel:${phone}" style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">📞 Jetzt anrufen</a>` : ""}
            ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}" target="_blank" style="display:inline-block;background:#25d366;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-left:12px">💬 WhatsApp</a>` : ""}
          </div>
        </section>`;
      }

      const hasImage = !!img;
      const imageOnLeft = idx % 2 === 0;

      if (hasImage) {
        const imgBlock = `<div style="flex:1;min-width:280px"><img src="${img}" alt="${s.headline}" style="width:100%;border-radius:12px;object-fit:cover;max-height:400px" loading="lazy" /></div>`;
        const textBlock = `<div style="flex:1;min-width:280px"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:${headlineColor};margin-bottom:16px">${s.headline}</h2><div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div></div>`;

        return `<section style="${bg};padding:64px 24px">
          <div style="max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:40px;align-items:center">
            ${imageOnLeft ? imgBlock + textBlock : textBlock + imgBlock}
          </div>
        </section>`;
      }

      return `<section style="${bg};padding:64px 24px">
        <div style="max-width:760px;margin:0 auto">
          <h2 style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;color:${headlineColor};margin-bottom:20px;text-align:center">${s.headline}</h2>
          <div style="font-size:15px;line-height:1.8;color:${subColor}">${s.content}</div>
        </div>
      </section>`;
    })
    .join("\n");

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
  ${jsonLd}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;color:#1e293b;background:#ffffff}
    img{max-width:100%}
    a{color:#3b82f6}
    h1,h2,h3{font-family:'Space Grotesk',sans-serif}
    ul,ol{padding-left:20px}
    li{margin-bottom:8px}
    @media(max-width:768px){
      .hero-content{padding:40px 20px !important}
      .hero-content h1{font-size:28px !important}
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
</body>
</html>`;
}
