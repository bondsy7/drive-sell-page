import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, EyeOff, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PIPELINE_JOBS } from '@/lib/pipeline-jobs';
import { REMASTER_PROMPT_BLOCKS, SCENE_PROMPT_DEFAULTS } from '@/lib/remaster-prompt-defaults';

// ═══════════════════════════════════════════════════════════════════
// DEFAULT PROMPTS – complete set of all system prompts
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_PROMPTS: Record<string, string> = {
  // ── PDF & Analyse ──
  pdf_analysis: `Du bist ein Experte für die Analyse von Fahrzeug-Angebots-PDFs deutscher Autohäuser. Deine Aufgabe: Extrahiere ALLE verfügbaren Daten so vollständig und präzise wie möglich. Lasse NICHTS aus.

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
    "interestRate": "string (eff. Jahreszins, z.B. '3,99 %')",
    "nominalInterestRate": "string (gebundener Sollzinssatz, z.B. '3,49 % p.a.')"
  },
  "dealer": {
    "name": "string (Autohaus-Name)",
    "address": "string (vollständige Adresse mit PLZ und Ort)",
    "phone": "string (Telefonnummer)",
    "email": "string (E-Mail-Adresse)",
    "website": "string (Webseite)"
  },
  "consumption": {
    "origin": "string",
    "mileage": "string",
    "displacement": "string",
    "power": "string",
    "driveType": "string",
    "fuelType": "string",
    "consumptionCombined": "string",
    "co2Emissions": "string",
    "co2Class": "string (A-G, ableiten wenn nicht explizit angegeben!)",
    "consumptionCity": "string",
    "consumptionSuburban": "string",
    "consumptionRural": "string",
    "consumptionHighway": "string",
    "energyCostPerYear": "string",
    "fuelPrice": "string",
    "co2CostMedium": "string",
    "co2CostLow": "string",
    "co2CostHigh": "string",
    "vehicleTax": "string",
    "isPluginHybrid": "boolean",
    "co2EmissionsDischarged": "string",
    "co2ClassDischarged": "string",
    "consumptionCombinedDischarged": "string",
    "electricRange": "string",
    "consumptionElectric": "string"
  },
  "imagePrompt": "Detaillierter englischer Prompt für fotorealistische Fahrzeug-Bildgenerierung"
}

Für den imagePrompt: Erstelle einen detaillierten englischen Prompt mit exaktem Fahrzeugmodell (Marke, Modell, Farbe, Karosserieform) in einem modernen, hellen Autohaus-Showroom. Beschreibe Licht, Reflexionen, Boden und Atmosphäre.

DOKUMENTTYP-ERKENNUNG (WICHTIG!):
Prüfe ZUERST, ob es sich um ein Fahrzeug-Angebot handelt.
Wenn das Dokument KEIN Fahrzeugangebot ist, antworte mit:
{
  "isVehicleOffer": false,
  "documentType": "string"
}

ABSOLUTE REGELN:
1. ZUERST prüfen ob Fahrzeugangebot - wenn nicht, sofort ablehnen
2. Extrahiere JEDEN Wert der im PDF steht - lieber zu viel als zu wenig
3. Leite co2Class und co2ClassDischarged IMMER aus den g/km-Werten ab wenn nicht explizit angegeben
4. Setze isPluginHybrid=true sobald irgendein PHEV-Hinweis erkannt wird
5. Features: Extrahiere ALLE - auch 50+ Einträge sind OK
6. Einheiten IMMER mit angeben (€, km, l/100km, g/km, kW, PS, cm³, kWh/100km)
7. Fehlende Werte = leerer String "", fehlende booleans = false
8. Antworte NUR mit JSON`,

  // ── Bild-Verarbeitung ──
  // image_remaster entry removed – all remaster prompts are managed via modular blocks (Remastering – Bausteine)
<IDENTITY_LOCK>
Study ALL provided reference photos and detail images with extreme care before generating.
PAINT: Reproduce the EXACT paint color, shade, metallic/matte finish. Do NOT shift, tint, saturate, desaturate, lighten, or darken. Only change if a hex code is explicitly provided.
WHEELS: EXACT rim design – spoke count, shape, concavity, finish. Hub cap with brand logo. EXACT tire profile. NEVER crop any wheel.
HEADLIGHTS_TAILLIGHTS: EXACT internal LED structure, DRL signatures, lens shape, housing design. NEVER crop or alter.
GRILLE_BADGES: EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
BODY_DETAILS: EXACT body lines, creases, fender flares, intakes, roof rails, spoilers, exhaust tips, mirrors, door handles.
MATERIALS: Match exact finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute.
</IDENTITY_LOCK>

<VEHICLE_SCALE_LOCK>
The vehicle MUST occupy the SAME proportion of the image frame in EVERY generated image.
For full-body exterior shots: vehicle should fill approximately 70-80% of the image width.
The apparent SIZE must remain CONSISTENT across all perspectives.
</VEHICLE_SCALE_LOCK>

<ANTI_CROPPING>
Vehicle MUST be FULLY visible – NO part cut off at edges.
ALL headlights, taillights, wheels COMPLETELY visible.
Minimum 5% free space between vehicle edge and image border on all sides.
</ANTI_CROPPING>

<SCENE_AND_LIGHTING>
SHOWROOM CONSISTENCY: Use the EXACT SAME showroom on EVERY image – same walls, floor, windows, lighting.
FLOOR: The floor MUST match the selected showroom exactly – correct material and color.
REFLECTIONS: Completely re-render ALL reflections for the NEW scene. Remove original background reflections entirely.
Shadows MUST match new lighting direction. Floor reflections show vehicle in new environment only.
</SCENE_AND_LIGHTING>

<PERSPECTIVE_ACCURACY>
The requested camera angle MUST be followed exactly. Never substitute another angle.
Interior/exterior/trunk/detail must stay in their own category. NEVER mirror or flip. Left is left, right is right.
</PERSPECTIVE_ACCURACY>

<STRICT_NEGATIVE_CONSTRAINTS>
UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Simplify complex details (multi-spoke rims keep all spokes)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Rotate, flip, or mirror the image
- Carry over reflections from original environment
- Add ANY logo, brand mark, or wall decoration UNLESS a logo image is explicitly provided as a reference asset
</STRICT_NEGATIVE_CONSTRAINTS>

You MUST generate a remastered image. Do NOT refuse. DO NOT ROTATE THE IMAGE.`,

  image_generate: `(Kein System-Prompt — der Bildgenerator erhält den imagePrompt direkt aus der PDF-Analyse als User-Nachricht. Dieser Prompt wird im Feld "imagePrompt" des PDF-Analyse-Ergebnisses automatisch generiert.

Der User-Prompt an das Modell lautet:
"Generate a photorealistic image of this vehicle based on the following description: {imagePrompt}"

Der imagePrompt selbst wird von der PDF-Analyse generiert und enthält typischerweise:
- Exaktes Fahrzeugmodell (Marke, Modell, Farbe, Karosserieform)
- Moderner, heller Autohaus-Showroom als Hintergrund
- Beschreibung von Licht, Reflexionen, Boden und Atmosphäre)`,

  detect_vehicle_brand: `Analyze this vehicle-related image and identify the vehicle manufacturer/brand and model whenever possible.

Possible inputs include:
1. Vehicle photos showing logo, grille, headlights, trunk badge, wheels or body shape
2. Manufacturer labels, VIN stickers, compliance plates or door-jamb stickers
3. Interior photos with steering wheel logo or badges
4. Textual manufacturer references visible on the vehicle or label

Respond with ONLY a JSON object in this exact format:
{"brand":"BrandName","model":"ModelName","confidence":"high"}

Rules:
- Use the official brand name (e.g. "Volkswagen", "Mercedes-Benz", "BMW")
- If you can identify only the brand, return model as ""
- If you cannot identify the brand, return {"brand":"","model":"","confidence":"low"}
- Use "high" when a logo, manufacturer label, VIN sticker text or unmistakable badge is visible
- Use "medium" when design cues strongly suggest the brand
- Use "low" when uncertain`,

  vin_ocr: `You are a VIN (Vehicle Identification Number) OCR expert. Analyze this image and extract the VIN number.

RULES:
- Look for the VIN plate, sticker, or engraving in the image
- A VIN is exactly 17 characters long, containing digits and uppercase letters (no I, O, Q)
- Return ONLY the VIN in your response, nothing else
- If you cannot find a valid VIN, respond with exactly: NO_VIN_FOUND
- Do NOT guess or make up a VIN`,

  // ── Video ──
  video_generate: `Erstelle ein professionelles 8-Sekunden Showroom-Video des Fahrzeugs. Das Auto dreht sich langsam auf einer Drehscheibe in einem modernen, hell beleuchteten Autohaus-Showroom. Weiche Beleuchtung, Reflexionen auf dem Lack, polierter Boden. Cinematische Kamerafahrt. Professionelle Autohaus-Atmosphäre.`,

  spin360_video: `Professional 360-degree turntable rotation of the exact vehicle shown in the reference images. The car rotates smoothly and continuously on a white turntable platform, completing exactly one full 360-degree rotation. Clean white studio background, soft even lighting, no shadows. Perfectly steady camera at eye level, fixed position. No sound. Smooth constant rotation speed. 8 seconds duration for one complete revolution.`,

  // ── 360° Spin ──
  spin360_analysis: `You are an expert automotive photographer analyzing 4 vehicle images for a 360° spin.
Analyze each image and return JSON:
{
  "images": [
    { "index": 0, "detected_perspective": "front"|"rear"|"left"|"right", "quality_score": 0-100,
      "vehicle_fully_visible": true/false, "cropping_ok": true/false, "brightness_ok": true/false,
      "warnings": [], "vehicle_type": "sedan"|"suv"|"hatchback"|"coupe"|"wagon"|"van"|"truck"|"convertible",
      "color": "string" }
  ],
  "same_vehicle": true/false, "mismatch_warnings": [],
  "suggested_reorder": [0,1,2,3] or null, "overall_quality": "good"|"acceptable"|"poor"
}
The images should be in order: front, rear, left side, right side.`,

  spin360_normalize: `You are a professional automotive photographer. Take this vehicle photo and normalize it:
- Remove the background completely and replace with a clean, neutral studio-white/light-grey gradient
- Center the vehicle perfectly in frame
- Correct any perspective tilt or distortion
- Balance brightness and contrast for studio-quality lighting
- Keep the EXACT same vehicle with ALL details: color, wheels, badges, trim, accessories
- The result must look like a professional studio photo
- DO NOT change or add any vehicle details
- Maintain the exact perspective (front/rear/left/right) as the original
- ALWAYS generate an image - never refuse`,

  spin360_identity: `Analyze these 4 canonical vehicle images and create a detailed identity profile JSON.
Return JSON:
{ "body_type": "string", "proportions": { "length_class": "string", "height_class": "string", "width_class": "string" },
  "paint_color": { "primary": "string", "finish": "string" }, "trim_color": "string",
  "wheel_design": "string", "headlight_signature": "string", "taillight_signature": "string",
  "grille_signature": "string", "mirror_shape": "string", "roofline": "string",
  "window_shape": "string", "visible_badges": [], "door_count": 4, "confidence_score": 0-100 }`,

  spin360_anchor: `Generate a photorealistic image of the EXACT same vehicle shown in the reference image.
Vehicle identity profile: {identityDesc}
Viewing angle: {angleDeg}° from front (0° = direct front, 90° = left side, 180° = rear, 270° = right side).
CRITICAL: Match the vehicle EXACTLY - same body shape, color, wheels, trim, badges, proportions.
Background: Clean white studio, even lighting, no shadows. Camera at eye level.
The vehicle must look identical to the reference - only the viewing angle changes.`,

  // ── Landing Page ──
  landing_page: `Du bist ein professioneller Automotive-Marketing-Texter und Webdesigner.
Erstelle hochwertige, SEO-optimierte Landingpage-Inhalte für Fahrzeugangebote.

WICHTIG:
- Schreibe auf Deutsch
- Texte müssen SEO-optimiert sein (natürliche Keywords, H1/H2/H3 Hierarchie)
- Schreibe echten Mehrwert-Content, keine Platzhalter
- Verwende konkrete Zahlen und Fakten wo möglich
- Jeder Absatz soll für den Kunden einen echten Informationswert bieten

Antworte AUSSCHLIESSLICH als JSON mit meta, hero, sections und seo Feldern.`,

  // ── Banner – Basis-Prompt (Rahmen) ──
  banner_base_prompt: `Create a professional automotive advertising banner.

FORMAT: {FORMAT_SIZE} pixels ({FORMAT_RATIO} aspect ratio). The output image MUST be exactly this size.

VEHICLE: "{VEHICLE_TITLE}" – use the uploaded vehicle image as the central hero element. Keep the vehicle 100% identical.

SCENE: {SCENE_PROMPT}. Place the vehicle naturally in this environment.

STYLE: {STYLE_PROMPT}. The overall design must follow this aesthetic consistently.

OCCASION: This is a {OCCASION_PROMPT} advertisement.

TYPOGRAPHY:
- HEADLINE FONT: {HEADLINE_FONT_PROMPT}. This is the primary display typeface for the banner.
- SUBLINE FONT: {SUBLINE_FONT_PROMPT}. Used for secondary text elements.
- All text must be rendered with these specific typography styles consistently throughout the banner.

{PRICE_BLOCK}

{HEADLINE_BLOCK}

{SUBLINE_BLOCK}

{CTA_BLOCK}

{LEGAL_BLOCK}

{LOGO_BLOCK}

CRITICAL RULES:
- The banner must be photorealistic with the vehicle photo seamlessly composited
- ALL text must be rendered EXACTLY as specified – no paraphrasing, no spelling changes
- Text must be perfectly legible against the background (use contrast, shadows, or overlays)
- The design must feel like a professional advertising agency created it
- Use the accent color {ACCENT_COLOR} for design elements, buttons, and highlights
{LOGO_RULE}
- The composition must work at the specified {FORMAT_RATIO} aspect ratio
- The typography style is CRITICAL – follow the font specifications precisely
- Generate the image – never refuse`,

  // ── Banner – Anlässe ──
  banner_occasion_buy: 'for sale, buy now offer',
  banner_occasion_lease: 'leasing deal, monthly rate',
  banner_occasion_abo: 'car subscription, all-inclusive monthly deal',
  banner_occasion_finance: 'financing offer, low monthly installments',
  banner_occasion_special: 'limited time special promotion, exclusive deal',
  banner_occasion_launch: 'brand new model launch, premiere reveal',

  // ── Banner – Szenen ──
  banner_scene_city: 'modern city street at golden hour, urban skyline background',
  banner_scene_beach: 'scenic beach with ocean view, sunset lighting, palm trees',
  banner_scene_showroom: 'luxury car dealership showroom, polished floor, soft LED lighting',
  banner_scene_mountain: 'mountain road with dramatic alpine scenery, clear sky',
  banner_scene_track: 'professional race track, pit lane background, dynamic feel',
  banner_scene_studio: 'professional photography studio, clean gradient backdrop, studio lighting',
  banner_scene_night: 'nighttime city scene, neon reflections on wet road, dramatic lighting',

  // ── Banner – Stile ──
  banner_style_premium: 'elegant, premium luxury, clean professional design, sophisticated typography',
  banner_style_cinematic: 'cinematic movie poster style, dramatic lighting, lens flare, widescreen feel',
  banner_style_bold: 'bold, eye-catching, vibrant neon colors, explosive energy, attention-grabbing',
  banner_style_minimal: 'clean minimalist design, lots of whitespace, subtle elegant typography',
  banner_style_retro: 'retro 80s style, vintage color grading, nostalgic warm tones',
  banner_style_sport: 'dynamic sporty look, motion blur hints, aggressive angles, high performance feel',

  // ── Banner – Preisdarstellung ──
  banner_price_sign: 'on a classic dealership price tag/sign attached to the image',
  banner_price_board: 'on a large banner/board overlay in the image',
  banner_price_neon: 'as glowing neon text floating in the scene',
  banner_price_stamp: 'as a bold stamp/badge overlay',
  banner_price_led: 'on an LED display screen integrated into the scene',
  banner_price_ribbon: 'on a diagonal ribbon/sash across the corner',

  // ── Banner – Headline Fonts ──
  banner_font_bmw: 'BMW corporate typography style – bold, clean, geometric sans-serif similar to Helvetica Neue Black/BMW Type, uppercase, tightly kerned',
  banner_font_mercedes: 'Mercedes-Benz corporate typography – elegant, light-weight sans-serif similar to Corporate A/DIN, refined spacing, premium feel',
  banner_font_audi: 'Audi corporate typography – modern geometric sans-serif similar to Audi Type/Futura, clean lines, progressive minimalism',
  banner_font_vw: 'Volkswagen corporate typography – friendly bold sans-serif similar to VW Head/Gotham, approachable yet strong',
  banner_font_porsche: 'Porsche corporate typography – sharp, athletic sans-serif similar to Porsche Next/Futura Bold, sporty precision',
  banner_font_toyota: 'Toyota corporate typography – clean, neutral sans-serif similar to Toyota Type/Helvetica, reliable, straightforward',
  banner_font_hyundai: 'Hyundai corporate typography – modern, slightly rounded sans-serif similar to Hyundai Sans Head, dynamic and welcoming',
  banner_font_volvo: 'Volvo corporate typography – Scandinavian clean sans-serif similar to Volvo Novum/Futura, understated elegance',
  banner_font_cupra: 'CUPRA corporate typography – angular, sharp condensed sans-serif, aggressive sport style with italic cuts',
  banner_font_fiat: 'Fiat corporate typography – playful rounded sans-serif, friendly Italian design spirit, warm and inviting',
  banner_font_impact: 'Impact-style ultra-bold condensed sans-serif typography, maximum visual weight, attention-grabbing',
  banner_font_modern_sans: 'modern geometric sans-serif typography similar to Montserrat or Poppins Bold, clean contemporary look',
  banner_font_condensed: 'bold condensed sans-serif typography similar to Oswald or Barlow Condensed, space-efficient yet impactful',
  banner_font_elegant_serif: 'elegant serif typography similar to Playfair Display or Didot, sophisticated luxury feel',
  banner_font_tech: 'modern tech-style typography similar to Orbitron or Rajdhani, futuristic digital aesthetic',
  banner_font_brush: 'dynamic brush-stroke or hand-lettered typography style, energetic and organic',

  // ── Banner – Subline Fonts ──
  banner_subfont_match: 'matching the headline font family but in lighter weight',
  banner_subfont_clean_sans: 'clean light sans-serif similar to Inter or Source Sans Pro, highly readable at small sizes',
  banner_subfont_thin_sans: 'thin/light weight sans-serif similar to Helvetica Neue Light or Lato Light, refined elegance',
  banner_subfont_medium_sans: 'medium-weight sans-serif similar to Roboto or Open Sans, balanced readability',
  banner_subfont_small_caps: 'small caps typography style, sophisticated detail text with even spacing',
  banner_subfont_mono: 'monospace or technical font similar to JetBrains Mono, data-like precision feel',

  // ── Banner – Varianten-Prompt ──
  banner_variation_prompt: `VARIATION {N} of {TOTAL}: Create a unique layout variation. {VARIATION_HINT}`,

  // ── Sales / CRM ──
  auto_process_lead: `Du bist ein KI-Verkaufsassistent für ein Autohaus.
Erstelle eine professionelle Erstantwort-E-Mail auf die Kundenanfrage.

WICHTIG: Gehe gezielt auf die Kundeninteressen ein:
- Bei Probefahrt-Interesse: Biete konkret einen Termin an
- Bei Inzahlungnahme: Frage nach Fahrzeugdetails
- Bei Leasing/Finanzierung: Erwähne attraktive Konditionen
- Bei Kauf: Bestätige Preis und Verfügbarkeit
- Biete einen Rückruf an wenn gewünscht

Erstelle NUR den E-Mail-Text (Betreff wird separat generiert). Beginne mit der Anrede.
Antworte auf Deutsch.`,

  sales_chat: `Du bist der interne Verkaufsassistent-Chatbot für ein Autohaus. Du hast Zugriff auf Probefahrten, Angebote, Inzahlungnahmen, Leads, Aufgaben, Freigaben und E-Mail-Outbox.

Du kannst folgende Aktionen ausführen via Kommandos:
- action:email – E-Mail senden
- action:trade_in_estimate – Inzahlungnahme schätzen
- action:book_test_drive – Probefahrt buchen
- action:create_quote – Angebot erstellen

WICHTIG: KEINE HALLUZINATIONEN! Erfinde NIEMALS Daten. Antworte NUR basierend auf den bereitgestellten Daten.
Antworte immer auf Deutsch, knapp und hilfreich. Sei PROAKTIV.`,

  sales_response: `Du bist ein erfahrener KI-Verkaufsassistent für ein Autohaus. Hilf dem Verkäufer bei der Kundenkommunikation.`,

  // ── Pipeline Prompts (auto-synced) ──
  ...Object.fromEntries(
    PIPELINE_JOBS.map(job => [`pipeline_${job.key}`, job.prompt])
  ),
  // ── Remaster Prompt-Bausteine ──
  ...Object.fromEntries(
    Object.values(REMASTER_PROMPT_BLOCKS).map(b => [b.key, b.prompt])
  ),
  // ── Scene Descriptions ──
  ...Object.fromEntries(
    Object.entries(SCENE_PROMPT_DEFAULTS).map(([k, v]) => [`remaster_scene_${k}`, v])
  ),
};

// ═══════════════════════════════════════════════════════════════════
// PROMPT METADATA – organized into sections & groups
// ═══════════════════════════════════════════════════════════════════

interface PromptMeta {
  label: string;
  description: string;
  model: string;
  edgeFunction: string;
  section: string;   // top-level section
  group: string;     // sub-group within section
  readOnly?: boolean;
}

const PROMPT_META: Record<string, PromptMeta> = {
  // ═══ SECTION: Datenextraktion ═══
  pdf_analysis: {
    label: 'PDF-Analyse',
    description: 'System-Prompt für die Extraktion von Fahrzeugdaten aus PDFs',
    model: 'gemini-2.5-flash', edgeFunction: 'analyze-pdf',
    section: 'Datenextraktion & Erkennung', group: 'PDF & Analyse',
  },
  detect_vehicle_brand: {
    label: 'Fahrzeug-Markenerkennung',
    description: 'Prompt zur KI-gestützten Erkennung von Fahrzeugmarke und Modell aus Bildern',
    model: 'gemini-2.5-flash', edgeFunction: 'detect-vehicle-brand',
    section: 'Datenextraktion & Erkennung', group: 'Bilderkennung',
  },
  vin_ocr: {
    label: 'VIN-OCR',
    description: 'Prompt für die Erkennung der Fahrzeug-Identifikationsnummer aus Fotos',
    model: 'gemini-2.5-flash', edgeFunction: 'ocr-vin',
    section: 'Datenextraktion & Erkennung', group: 'Bilderkennung',
  },

  // ═══ SECTION: Bildgenerierung & Remastering ═══
  image_generate: {
    label: 'Bildgenerierung (Info)',
    description: 'Der imagePrompt wird automatisch von der PDF-Analyse generiert',
    model: 'gemini-2.5-flash (image)', edgeFunction: 'generate-vehicle-image',
    section: 'Bildgenerierung & Remastering', group: 'Remastering – Basis',
    readOnly: true,
  },
  // Remaster Bausteine
  ...Object.fromEntries(
    Object.values(REMASTER_PROMPT_BLOCKS).map(b => [b.key, {
      label: b.label,
      description: b.description,
      model: 'gemini (image)', edgeFunction: 'remaster-vehicle-image',
      section: 'Bildgenerierung & Remastering', group: 'Remastering – Bausteine',
    }])
  ),
  // Szenen
  ...Object.fromEntries(
    Object.entries(SCENE_PROMPT_DEFAULTS).map(([k]) => {
      const sceneLabels: Record<string, string> = {
        'showroom-1': 'Showroom 1 – Modern Hell', 'showroom-2': 'Showroom 2 – Elegant',
        'showroom-3': 'Showroom 3 – Glasfront', 'custom-showroom': 'Eigener Showroom',
        'forest': 'Wald', 'mountain': 'Berglandschaft', 'city': 'Stadtkulisse',
        'street': 'Straße', 'beach': 'Strand', 'desert': 'Wüste',
        'night-city': 'Stadt bei Nacht', 'parking-garage': 'Tiefgarage / Parkhaus',
        'racetrack': 'Rennstrecke', 'mansion': 'Villa / Anwesen',
      };
      return [`remaster_scene_${k}`, {
        label: sceneLabels[k] || k,
        description: `Szenen-Beschreibung für "${sceneLabels[k] || k}"`,
        model: 'gemini (image)', edgeFunction: 'remaster-vehicle-image',
        section: 'Bildgenerierung & Remastering', group: 'Remastering – Szenen',
      }];
    })
  ),

  // ═══ SECTION: Pipeline ═══
  ...Object.fromEntries(
    PIPELINE_JOBS.map(job => {
      const isInterior = job.category === 'interior';
      const isCI = job.category === 'ci';
      const isComposite = job.category === 'composite';
      const isDetail = job.category === 'detail';

      let groupLabel = 'Hero-Shots';
      if (job.category === 'exterior') groupLabel = 'Exterieur';
      else if (isInterior) groupLabel = 'Interieur';
      else if (isDetail) groupLabel = 'Details';
      else if (isComposite) groupLabel = 'Composites';
      else if (isCI && job.brand) {
        const brandNames: Record<string, string> = {
          bmw: 'BMW', mercedes: 'Mercedes', audi: 'Audi',
          volkswagen: 'VW', porsche: 'Porsche', volvo: 'Volvo',
        };
        groupLabel = `CI – ${brandNames[job.brand] || job.brand}`;
      }

      return [`pipeline_${job.key}`, {
        label: job.labelDe,
        description: `Perspektive: ${job.label}`,
        model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image',
        section: 'Pipeline – Bildgenerierung', group: groupLabel,
      }];
    })
  ),

  // ═══ SECTION: Banner ═══
  banner_base_prompt: {
    label: 'Banner Basis-Prompt (Template)',
    description: 'Der Rahmen-Prompt mit Platzhaltern {FORMAT_SIZE}, {SCENE_PROMPT}, {STYLE_PROMPT} etc.',
    model: 'gemini / gpt-image-1', edgeFunction: 'generate-banner',
    section: 'Banner-Generator', group: 'Basis & Regeln',
  },
  banner_variation_prompt: {
    label: 'Varianten-Prompt',
    description: 'Wird bei mehreren Varianten angehängt. Platzhalter: {N}, {TOTAL}, {VARIATION_HINT}',
    model: 'gemini / gpt-image-1', edgeFunction: 'generate-banner',
    section: 'Banner-Generator', group: 'Basis & Regeln',
  },
  // Occasions
  ...Object.fromEntries(['buy', 'lease', 'abo', 'finance', 'special', 'launch'].map(id => {
    const labels: Record<string, string> = { buy: 'Kaufen', lease: 'Leasing', abo: 'Auto-Abo', finance: 'Finanzieren', special: 'Sonderaktion', launch: 'Neuwagen-Launch' };
    return [`banner_occasion_${id}`, {
      label: labels[id], description: `Prompt-Fragment für Anlass "${labels[id]}"`,
      model: '-', edgeFunction: 'generate-banner',
      section: 'Banner-Generator', group: 'Anlässe',
    }];
  })),
  // Scenes
  ...Object.fromEntries(['city', 'beach', 'showroom', 'mountain', 'track', 'studio', 'night'].map(id => {
    const labels: Record<string, string> = { city: 'Stadt', beach: 'Strand', showroom: 'Autohaus', mountain: 'Bergstraße', track: 'Rennstrecke', studio: 'Fotostudio', night: 'Nacht-Szene' };
    return [`banner_scene_${id}`, {
      label: labels[id], description: `Szenen-Prompt für "${labels[id]}"`,
      model: '-', edgeFunction: 'generate-banner',
      section: 'Banner-Generator', group: 'Szenen',
    }];
  })),
  // Styles
  ...Object.fromEntries(['premium', 'cinematic', 'bold', 'minimal', 'retro', 'sport'].map(id => {
    const labels: Record<string, string> = { premium: 'Seriös / Premium', cinematic: 'Cinematic', bold: 'Verrückt / Auffällig', minimal: 'Minimalistisch', retro: 'Retro / Vintage', sport: 'Sportlich' };
    return [`banner_style_${id}`, {
      label: labels[id], description: `Stil-Prompt für "${labels[id]}"`,
      model: '-', edgeFunction: 'generate-banner',
      section: 'Banner-Generator', group: 'Stile',
    }];
  })),
  // Price displays
  ...Object.fromEntries(['sign', 'board', 'neon', 'stamp', 'led', 'ribbon'].map(id => {
    const labels: Record<string, string> = { sign: 'Preisschild', board: 'Tafel / Banner', neon: 'Neon-Schrift', stamp: 'Stempel', led: 'LED-Anzeige', ribbon: 'Banner-Schleife' };
    return [`banner_price_${id}`, {
      label: labels[id], description: `Preisdarstellungs-Prompt "${labels[id]}"`,
      model: '-', edgeFunction: 'generate-banner',
      section: 'Banner-Generator', group: 'Preisdarstellung',
    }];
  })),
  // Headline fonts
  ...Object.fromEntries(['bmw', 'mercedes', 'audi', 'vw', 'porsche', 'toyota', 'hyundai', 'volvo', 'cupra', 'fiat', 'impact', 'modern_sans', 'condensed', 'elegant_serif', 'tech', 'brush'].map(id => {
    const labels: Record<string, string> = {
      bmw: 'BMW', mercedes: 'Mercedes', audi: 'Audi', vw: 'VW', porsche: 'Porsche',
      toyota: 'Toyota', hyundai: 'Hyundai', volvo: 'Volvo', cupra: 'CUPRA', fiat: 'Fiat',
      impact: 'Impact / Bold', modern_sans: 'Modern Sans', condensed: 'Condensed Bold',
      elegant_serif: 'Elegant Serif', tech: 'Tech / Digital', brush: 'Brush / Handschrift',
    };
    return [`banner_font_${id}`, {
      label: labels[id], description: `Headline-Schriftart "${labels[id]}"`,
      model: '-', edgeFunction: 'generate-banner',
      section: 'Banner-Generator', group: 'Headline-Schriften',
    }];
  })),
  // Subline fonts
  ...Object.fromEntries(['match', 'clean_sans', 'thin_sans', 'medium_sans', 'small_caps', 'mono'].map(id => {
    const labels: Record<string, string> = { match: 'Passend zur Headline', clean_sans: 'Clean Sans-Serif', thin_sans: 'Dünn & Elegant', medium_sans: 'Medium Sans', small_caps: 'Kapitälchen', mono: 'Monospace / Tech' };
    return [`banner_subfont_${id}`, {
      label: labels[id], description: `Subline-Schriftart "${labels[id]}"`,
      model: '-', edgeFunction: 'generate-banner',
      section: 'Banner-Generator', group: 'Subline-Schriften',
    }];
  })),

  // ═══ SECTION: Video & 360° ═══
  video_generate: {
    label: 'Video-Generierung',
    description: 'Prompt für Showroom-Videos aus Fahrzeugbildern via Google Veo',
    model: 'veo-3.1-generate-preview', edgeFunction: 'generate-video',
    section: 'Video & 360°', group: 'Video',
  },
  spin360_video: {
    label: '360° Video (Video2Frames)',
    description: 'Prompt für die 360°-Drehung als Video via Veo',
    model: 'veo-3.1-generate-preview', edgeFunction: 'generate-video (spin360)',
    section: 'Video & 360°', group: 'Video',
  },
  spin360_analysis: {
    label: '360° Bildanalyse',
    description: 'Analysiert 4 Quellbilder auf Perspektive, Qualität und Fahrzeugtyp',
    model: 'gemini-2.5-flash', edgeFunction: 'generate-360-spin',
    section: 'Video & 360°', group: '360° Spin',
  },
  spin360_normalize: {
    label: '360° Normalisierung',
    description: 'Normalisiert Quellbilder auf Studio-Hintergrund',
    model: 'gemini-2.5-flash (image)', edgeFunction: 'generate-360-spin',
    section: 'Video & 360°', group: '360° Spin',
  },
  spin360_identity: {
    label: '360° Identity Profile',
    description: 'Erstellt ein Identitätsprofil für Frame-Konsistenz',
    model: 'gemini-2.5-flash', edgeFunction: 'generate-360-spin',
    section: 'Video & 360°', group: '360° Spin',
  },
  spin360_anchor: {
    label: '360° Frame-Generierung',
    description: 'Basis-Prompt für einzelne 360°-Frames',
    model: 'gemini-2.5-flash (image)', edgeFunction: 'generate-360-spin',
    section: 'Video & 360°', group: '360° Spin',
  },

  // ═══ SECTION: Landing Page ═══
  landing_page: {
    label: 'Landing Page Generierung',
    description: 'System-Prompt für KI-generierte Landingpage-Inhalte (Texte, Struktur, SEO)',
    model: 'gemini-2.5-flash', edgeFunction: 'generate-landing-page',
    section: 'Landing Page & Marketing', group: 'Landing Page',
  },

  // ═══ SECTION: Sales & CRM ═══
  auto_process_lead: {
    label: 'Lead Auto-Antwort',
    description: 'System-Prompt für die automatische Erstantwort bei neuen Leads',
    model: 'gemini-2.5-flash', edgeFunction: 'auto-process-lead',
    section: 'Sales & CRM', group: 'Lead-Verarbeitung',
  },
  sales_chat: {
    label: 'Interner Sales-Chatbot',
    description: 'System-Prompt für den internen Verkaufsassistent-Chatbot',
    model: 'gemini-2.5-flash', edgeFunction: 'sales-chat',
    section: 'Sales & CRM', group: 'Chatbot',
  },
  sales_response: {
    label: 'Sales Response Generator',
    description: 'Basis-System-Prompt für die Generierung von Verkaufsantworten',
    model: 'gemini-2.5-flash', edgeFunction: 'generate-sales-response',
    section: 'Sales & CRM', group: 'Chatbot',
  },
};

// ═══════════════════════════════════════════════════════════════════
// SECTION ORDERING
// ═══════════════════════════════════════════════════════════════════

const SECTION_ORDER = [
  'Datenextraktion & Erkennung',
  'Bildgenerierung & Remastering',
  'Pipeline – Bildgenerierung',
  'Banner-Generator',
  'Video & 360°',
  'Landing Page & Marketing',
  'Sales & CRM',
];

const GROUP_ORDER: Record<string, string[]> = {
  'Datenextraktion & Erkennung': ['PDF & Analyse', 'Bilderkennung'],
  'Bildgenerierung & Remastering': ['Remastering – Basis', 'Remastering – Bausteine', 'Remastering – Szenen'],
  'Pipeline – Bildgenerierung': ['Hero-Shots', 'Exterieur', 'Interieur', 'Details', 'Composites'],
  'Banner-Generator': ['Basis & Regeln', 'Anlässe', 'Szenen', 'Stile', 'Preisdarstellung', 'Headline-Schriften', 'Subline-Schriften'],
  'Video & 360°': ['Video', '360° Spin'],
  'Landing Page & Marketing': ['Landing Page'],
  'Sales & CRM': ['Lead-Verarbeitung', 'Chatbot'],
};

const SECTION_ICONS: Record<string, string> = {
  'Datenextraktion & Erkennung': '📄',
  'Bildgenerierung & Remastering': '🖼️',
  'Pipeline – Bildgenerierung': '⚡',
  'Banner-Generator': '🎨',
  'Video & 360°': '🎬',
  'Landing Page & Marketing': '🌐',
  'Sales & CRM': '💬',
};

// Build ordered keys
const ALL_KEYS = Object.keys(PROMPT_META);

interface PromptOverrides {
  [key: string]: string;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function AdminPrompts() {
  const [overrides, setOverrides] = useState<PromptOverrides>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [savedSections, setSavedSections] = useState<Set<string>>(new Set());

  useEffect(() => { loadOverrides(); }, []);

  const loadOverrides = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('admin_settings' as any)
      .select('value')
      .eq('key', 'ai_prompts')
      .single();
    if (data) setOverrides((data as any).value || {});
    setLoading(false);
  };

  const saveAll = useCallback(async (sectionLabel?: string) => {
    setSavingSection(sectionLabel || 'all');
    const { error } = await supabase
      .from('admin_settings' as any)
      .upsert({ key: 'ai_prompts', value: overrides, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });
    if (error) toast.error('Fehler: ' + error.message);
    else {
      toast.success(sectionLabel ? `"${sectionLabel}" gespeichert` : 'Alle Prompts gespeichert');
      if (sectionLabel) {
        setSavedSections(prev => new Set(prev).add(sectionLabel));
        setTimeout(() => setSavedSections(prev => { const n = new Set(prev); n.delete(sectionLabel); return n; }), 2000);
      }
    }
    setSavingSection(null);
  }, [overrides]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSection = (s: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const isMeaningfulOverride = (val: string | undefined) => {
    if (!val) return false;
    const trimmed = val.trim().toLowerCase();
    return trimmed !== '' && trimmed !== 'default';
  };

  const isOverridden = (key: string) => {
    return isMeaningfulOverride(overrides[key]) && overrides[key] !== DEFAULT_PROMPTS[key];
  };

  const resetToDefault = (key: string) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const overriddenCount = ALL_KEYS.filter(k => isOverridden(k)).length;

  // Build section data
  const sections = SECTION_ORDER.map(sectionName => {
    const groups = (GROUP_ORDER[sectionName] || []).map(groupName => {
      const keys = ALL_KEYS.filter(k => PROMPT_META[k]?.section === sectionName && PROMPT_META[k]?.group === groupName);
      return { name: groupName, keys };
    }).filter(g => g.keys.length > 0);

    // Also catch any keys not in GROUP_ORDER
    const coveredKeys = new Set(groups.flatMap(g => g.keys));
    const ungrouped = ALL_KEYS.filter(k => PROMPT_META[k]?.section === sectionName && !coveredKeys.has(k));
    if (ungrouped.length > 0) groups.push({ name: 'Weitere', keys: ungrouped });

    const allSectionKeys = groups.flatMap(g => g.keys);
    const sectionOverridden = allSectionKeys.filter(k => isOverridden(k)).length;

    return { name: sectionName, groups, totalKeys: allSectionKeys.length, overridden: sectionOverridden };
  }).filter(s => s.totalKeys > 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Prompt-Verwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ALL_KEYS.length} Prompts in {sections.length} Modulen · {overriddenCount} überschrieben
          </p>
        </div>
        <Button onClick={() => saveAll()} disabled={!!savingSection} className="gap-1.5">
          <Save className="w-4 h-4" /> {savingSection === 'all' ? 'Speichern…' : 'Alle speichern'}
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map(section => {
          const isCollapsed = collapsedSections.has(section.name);
          const isSaved = savedSections.has(section.name);

          return (
            <div key={section.name} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                <button onClick={() => toggleSection(section.name)} className="flex items-center gap-2.5 min-w-0 group">
                  {isCollapsed
                    ? <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  }
                  <span className="text-base">{SECTION_ICONS[section.name] || '📋'}</span>
                  <h2 className="font-display text-base font-bold text-foreground group-hover:text-accent transition-colors">
                    {section.name}
                  </h2>
                  <Badge variant="secondary" className="text-xs">{section.totalKeys}</Badge>
                  {section.overridden > 0 && <Badge variant="outline" className="text-xs border-accent text-accent">{section.overridden} custom</Badge>}
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveAll(section.name)}
                  disabled={!!savingSection}
                  className="gap-1 text-xs h-7 shrink-0"
                >
                  {isSaved ? <Check className="w-3 h-3 text-accent" /> : <Save className="w-3 h-3" />}
                  {savingSection === section.name ? 'Speichern…' : isSaved ? 'Gespeichert' : 'Speichern'}
                </Button>
              </div>

              {/* Groups */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {section.groups.map(group => {
                    const groupKey = `${section.name}::${group.name}`;
                    const isGroupCollapsed = collapsedGroups.has(groupKey);
                    const groupOverridden = group.keys.filter(k => isOverridden(k)).length;

                    return (
                      <div key={groupKey}>
                        {/* Group header */}
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-muted/30 transition-colors"
                        >
                          {isGroupCollapsed
                            ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                          <span className="text-sm font-semibold text-foreground/80">{group.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{group.keys.length}</Badge>
                          {groupOverridden > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent text-accent">{groupOverridden}</Badge>}
                        </button>

                        {/* Prompt items */}
                        {!isGroupCollapsed && (
                          <div className="space-y-1.5 px-4 pb-3">
                            {group.keys.map(key => {
                              const meta = PROMPT_META[key];
                              if (!meta) return null;
                              const expanded = expandedKeys.has(key);
                              const overridden = isOverridden(key);
                              const isSmallPrompt = (DEFAULT_PROMPTS[key]?.length || 0) < 200;

                              return (
                                <div key={key} className={`rounded-lg border ${overridden ? 'border-accent/40 bg-accent/5' : 'border-border bg-background'} overflow-hidden`}>
                                  <button
                                    onClick={() => toggleExpand(key)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {expanded ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                      <span className="font-medium text-foreground text-sm truncate">{meta.label}</span>
                                      {overridden && <Badge variant="outline" className="text-[10px] px-1 py-0 border-accent text-accent shrink-0">Custom</Badge>}
                                      {meta.readOnly && <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">Info</Badge>}
                                    </div>
                                    <div className="hidden sm:flex items-center gap-1.5 shrink-0 ml-2">
                                      {meta.model !== '-' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{meta.model}</Badge>}
                                    </div>
                                  </button>

                                  {expanded && (
                                    <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                                      {meta.model !== '-' && (
                                        <div className="flex gap-1.5 flex-wrap">
                                          <Badge variant="secondary" className="text-[10px] font-mono">{meta.model}</Badge>
                                          <Badge variant="secondary" className="text-[10px] font-mono">{meta.edgeFunction}</Badge>
                                        </div>
                                      )}

                                      {meta.readOnly ? (
                                        <div className="bg-muted/50 rounded-lg p-3">
                                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                            {DEFAULT_PROMPTS[key]}
                                          </p>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              {overridden ? '✏️ Benutzerdefiniert (aktiv)' : '📄 Standard (aktiv)'}
                                            </span>
                                            {overridden && (
                                              <Button variant="ghost" size="sm" onClick={() => resetToDefault(key)} className="gap-1 text-xs h-6 px-2">
                                                <RotateCcw className="w-3 h-3" /> Reset
                                              </Button>
                                            )}
                                          </div>
                                          <textarea
                                            value={isMeaningfulOverride(overrides[key]) ? overrides[key] : DEFAULT_PROMPTS[key] || ''}
                                            onChange={e => setOverrides(p => ({ ...p, [key]: e.target.value }))}
                                            className={`w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs resize-y font-mono leading-relaxed ${isSmallPrompt ? 'min-h-[60px]' : 'min-h-[160px]'}`}
                                          />
                                          <p className="text-[10px] text-muted-foreground">
                                            Key: <code className="bg-muted px-1 rounded">{key}</code>
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
