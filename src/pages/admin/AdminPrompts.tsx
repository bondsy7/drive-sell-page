import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── ALL DEFAULT PROMPTS (extracted from every edge function) ───

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
  image_remaster: `You are a professional automotive photographer. Take this exact vehicle photo and remaster it into a professional dealership-quality image.

IDENTITY LOCK (MANDATORY):
Study the provided vehicle photo and ALL detail reference images with extreme care before generating.
- PAINT COLOR: The vehicle's paint color MUST remain 100% identical to the original. Do NOT shift, tint, saturate, desaturate, lighten, or darken. Only change if explicitly instructed via a hex code.
- WHEELS & RIMS: Reproduce the EXACT rim design – spoke count, shape, concavity, finish. NEVER crop any wheel at image edges.
- HEADLIGHTS & TAILLIGHTS: Reproduce EXACT internal LED structure, DRL signatures, lens shape. NEVER crop or alter lighting elements.
- GRILLE & BADGES: Reproduce EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
- BODY DETAILS: Reproduce EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirrors, door handles.
- MATERIALS & TEXTURES: Match exact finishes – chrome vs. gloss black vs. matte vs. satin.

NEGATIVE CONSTRAINTS (NEVER DO):
- Do NOT invent or hallucinate details not in reference photos
- Do NOT simplify complex details (multi-spoke rims keep all spokes, LED arrays keep all elements)
- Do NOT change proportions, ride height, or stance
- Do NOT add aftermarket parts not in reference
- Do NOT show other vehicles – not in background, not in reflections
- Do NOT add humans, animals, or moving objects
- Do NOT carry over reflections from original environment
- Do NOT rotate, flip, or mirror the image

REFLECTION & LIGHTING RE-RENDER:
- ALL reflections must be COMPLETELY re-rendered for the NEW scene
- Original background reflections must be fully replaced
- Shadows must match the new scene's light direction

FOR EXTERIOR SHOTS:
- Modern, bright showroom background with polished reflective floor
- Full vehicle visible with no cropping at edges

FOR INTERIOR SHOTS (seats, steering wheel, dashboard, center console, rear seats):
- MANDATORY CLEANUP: Remove ALL non-vehicle items (trash, bags, papers, plastic covers, personal belongings) from BOTH front AND rear seats
- Reproduce EXACT materials: leather grain, stitching, trim, button layouts, screen UI from reference
- Do NOT rotate, flip, or change orientation
- Only enhance lighting to be bright, even, professional

FOR TRUNK/CARGO: Keep structure, remove loose items, improve lighting.

IMPORTANT: You MUST generate a remastered image. Do NOT refuse. DO NOT ROTATE.`,

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

  // ── 360° Spin (Image2Spin) ──
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

  // ── Banner ──
  banner_generate: `(Der Banner-Prompt wird clientseitig dynamisch zusammengebaut aus Fahrzeugdaten, Anlass, Szene, Stil und rechtlichen Pflichtangaben (PAngV). Die Funktion buildBannerPrompt() im Frontend erzeugt den finalen Prompt.

Typischer Aufbau:
- Fahrzeugbeschreibung (Marke, Modell, Farbe)
- Szene/Hintergrund
- Textplatzierung (Headlines, Preise auf Schildern)
- Stil und Atmosphäre
- Rechtliche Hinweise (PAngV bei Leasing/Finanzierung))`,

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

  // ── Pipeline Bildgenerierung ──
  // NOTE: These defaults mirror src/lib/pipeline-jobs.ts but without the shared IDENTITY_LOCK block.
  // The IDENTITY_LOCK is automatically prepended at runtime. Admin overrides replace the FULL prompt including the lock.
  pipeline_MASTER_IMAGE: `Create a single photorealistic 8K image of the EXACT vehicle from the provided reference photos. PERSPECTIVE: Front-left 3/4 view at eye level. Camera at 30-40° left of center axis. Full vehicle visible. SCENE: PROVIDED SHOWROOM. Company Logo physically integrated on background wall with 3D properties. Do NOT modify car body color, rims, or accessories. Clean luxury studio lighting with realistic floor reflections. No humans.`,
  pipeline_EXT_FRONT: `PERSPECTIVE: Direct head-on front view at eye level, perfectly centered. Grille, headlights, badge symmetrically framed. Full vehicle width visible. SCENE: PROVIDED SHOWROOM. Company Logo on wall. Realistic floor reflections. No humans.`,
  pipeline_EXT_REAR: `PERSPECTIVE: Direct rear view at eye level, perfectly centered. Taillights, exhaust, rear badge, model designation visible and symmetrical. SCENE: PROVIDED SHOWROOM. Company Logo on wall. No humans.`,
  pipeline_EXT_SIDE_LEFT: `PERSPECTIVE: Perfect left (driver) side profile, camera perpendicular (90°) to left flank. Both left wheels fully visible. SCENE: PROVIDED SHOWROOM. Company Logo on wall. No humans.`,
  pipeline_EXT_SIDE_RIGHT: `PERSPECTIVE: Perfect right (passenger) side profile, camera perpendicular (90°) to right flank. Both right wheels fully visible. SCENE: PROVIDED SHOWROOM. Company Logo on wall. No humans.`,
  pipeline_EXT_34_FRONT_RIGHT: `PERSPECTIVE: Front-right 3/4 view at eye level. Camera at 30-40° RIGHT of center axis. Right headlight, right fender, right front wheel prominently visible. NOT a left-side view. SCENE: PROVIDED SHOWROOM. Company Logo on wall. No humans.`,
  pipeline_EXT_34_REAR_LEFT: `PERSPECTIVE: Rear-left 3/4 view at eye level. Camera behind and to the LEFT. Left taillight, left rear wheel prominent. SCENE: PROVIDED SHOWROOM. Company Logo on wall. Dramatic lighting. No humans.`,
  pipeline_EXT_34_REAR_RIGHT: `PERSPECTIVE: Rear-right 3/4 view at eye level. Camera behind and to the RIGHT. Right taillight, right rear wheel prominent. SCENE: PROVIDED SHOWROOM. Company Logo on wall. No humans.`,
  pipeline_EXT_LOW_ANGLE: `PERSPECTIVE: Low-angle hero shot from ground level (20-30cm above ground) looking up at front bumper and grille. Full bumper and wheels visible. SCENE: PROVIDED SHOWROOM. Company Logo on wall. Dramatic perspective. No humans.`,
  pipeline_EXT_ELEVATED_FRONT: `PERSPECTIVE: Elevated front 3/4 view from 2-3m above. Looking down at hood, windshield, roof. SCENE: PROVIDED SHOWROOM. Company Logo on wall. No humans.`,
  pipeline_INT_DASHBOARD: `PERSPECTIVE: Driver's seat looking at steering wheel and full dashboard. Steering wheel on correct side (LHD/RHD as in reference). Do NOT rotate or flip. Company Logo subtly visible through windshield. INTERIOR RULES: Remove all non-vehicle items. Reproduce exact materials, buttons, screens from reference. Bright professional lighting. No humans.`,
  pipeline_INT_CENTER_CONSOLE: `PERSPECTIVE: Macro close-up of center console from above. Gear selector, controls, infotainment screen in sharp detail. Reproduce exact button layouts, screen UI, materials from reference. Professional interior lighting. No humans.`,
  pipeline_INT_REAR_SEATS: `PERSPECTIVE: From front looking back at rear seats. Show legroom, seat materials, rear amenities. Do NOT rotate. INTERIOR RULES: Clean up both front and rear seats. Reproduce exact materials from reference. Professional lighting. No humans.`,
  pipeline_INT_WIDE_CABIN: `PERSPECTIVE: Wide-angle from rear seat center looking forward. Full dashboard, both front seats, windshield visible. Company Logo visible through windshield. Reproduce exact interior details from reference. Professional lighting. No humans.`,
  pipeline_DET_HEADLIGHT: `Macro close-up of front headlight (60-70% of frame). Reproduce EXACT internal LED modules, DRL signature, projector lens, reflector geometry, housing material from reference. High-contrast studio lighting. Blurred background. No humans.`,
  pipeline_DET_TAILLIGHT: `Macro close-up of rear taillight (60-70% of frame). Reproduce EXACT LED elements, light signature, 3D internal structure, lens material from reference. High-contrast studio lighting. Blurred background. No humans.`,
  pipeline_DET_WHEEL: `Ultra-sharp close-up of front wheel (60-70% of frame). Reproduce EXACT rim design – spoke count, shape, finish (polished/matte/bi-color/diamond-cut), center cap, tire profile, brake caliper from reference. High-contrast studio lighting. Blurred background. No humans.`,
  pipeline_DET_GRILLE: `Close-up of front grille and central badge. Reproduce EXACT grille mesh pattern, chrome/black finish, badge shape and material, model designation lettering (exact font, size, position) from reference. High-contrast studio lighting. Blurred background. No humans.`,
  pipeline_GRID_EXTERIOR_4: `Photorealistic 2×2 grid. Top-left: front-left 3/4. Top-right: left side profile. Bottom-left: rear-left 3/4. Bottom-right: direct rear. All same SHOWROOM, consistent lighting, thin white dividers. Full car in each cell. Company Logo on wall. No humans.`,
  pipeline_GRID_HIGHLIGHTS_6: `Photorealistic 3×2 grid. Row 1: front-left 3/4 | left side | rear-left 3/4. Row 2: headlight macro | dashboard | wheel close-up. Same SHOWROOM, consistent lighting, thin white dividers. Company Logo. No humans.`,
  pipeline_GRID_INTERIOR_4: `Photorealistic 2×2 interior grid. Top-left: dashboard from driver seat. Top-right: center console. Bottom-left: rear seats. Bottom-right: steering wheel. Consistent interior lighting. Thin white dividers. Do NOT rotate. No humans.`,
  pipeline_GRID_SOCIAL_MEDIA: `Social media collage. Large hero (front-left 3/4, 60% left). 3 smaller right: side profile, dashboard, wheel detail. PROVIDED SHOWROOM. Company Logo watermark. Clean layout. No humans.`,

  // ── CI Brand Pipelines ──
  // BMW
  pipeline_CI_BMW_34_FRONT: `BMW CI: Front-left 3/4 at eye level. Kidney grille and headlight design from reference exactly reproduced. Clean white/grey studio. Strong key light from front-left.`,
  pipeline_CI_BMW_SIDE: `BMW CI: Direct left side profile, perpendicular. Both wheels fully visible with exact rim design from reference. BMW center caps. White/grey studio.`,
  pipeline_CI_BMW_34_REAR: `BMW CI: Rear-left 3/4. Exact taillight design, BMW roundel, exhaust from reference. White/grey studio.`,
  pipeline_CI_BMW_REAR: `BMW CI: Direct rear, centered. Exact full taillight width, exhaust, badge, model lettering from reference. White/grey studio.`,
  pipeline_CI_BMW_GRILLE: `BMW CI detail: Kidney grille with headlights close-up. Exact grille slats, roundel badge, LED internals from reference. High-contrast studio.`,
  pipeline_CI_BMW_INTERIOR: `BMW CI interior: Dashboard from driver seat. Exact iDrive/curved display, instrument cluster, steering wheel buttons, ambient lighting from reference. CLEANUP: Remove non-vehicle items. Professional lighting.`,
  pipeline_CI_BMW_WHEEL: `BMW CI detail: Wheel and brake caliper. Exact rim spoke design, finish, BMW center cap, caliper color from reference. Studio lighting, blurred background.`,
  // Mercedes
  pipeline_CI_MERCEDES_34_FRONT: `Mercedes CI: Front-left 3/4. Exact star emblem, grille pattern (diamond/louvre/Panamericana), headlight internals from reference. Elegant studio, subtle gradient. Premium lighting.`,
  pipeline_CI_MERCEDES_SIDE: `Mercedes CI: Left side profile. Full silhouette, chrome surrounds, exact wheel design from reference. Subtle gradient studio.`,
  pipeline_CI_MERCEDES_34_REAR: `Mercedes CI: Rear-left 3/4. Exact LED light strip, star badge, exhaust, diffuser from reference. Elegant studio.`,
  pipeline_CI_MERCEDES_FRONT: `Mercedes CI: Direct front, centered. Exact star and grille design from reference. Even studio lighting.`,
  pipeline_CI_MERCEDES_MBUX: `Mercedes CI detail: MBUX/infotainment from driver seat. Exact screen layout, turbine vents, ambient lighting from reference. CLEANUP: Remove non-vehicle items.`,
  pipeline_CI_MERCEDES_GRILLE: `Mercedes CI detail: Grille and star macro. Exact pattern, chrome, LED internals from reference. Studio lighting.`,
  pipeline_CI_MERCEDES_WHEEL: `Mercedes CI detail: Wheel with exact AMG/standard rim, brake caliper, star center cap from reference. Studio lighting.`,
  // Audi
  pipeline_CI_AUDI_34_FRONT: `Audi CI: Front-left 3/4. Exact Singleframe grille, four rings, headlight internals (matrix LED, DRL) from reference. Bright clean studio.`,
  pipeline_CI_AUDI_SIDE: `Audi CI: Left side profile. Exact body lines, wheel design from reference. Clean bright studio.`,
  pipeline_CI_AUDI_34_REAR: `Audi CI: Rear-left 3/4. Exact LED light strip, four rings badge from reference. Clean studio.`,
  pipeline_CI_AUDI_REAR: `Audi CI: Direct rear. Exact full-width LED bar, Audi lettering from reference. Bright studio.`,
  // VW
  pipeline_CI_VW_34_FRONT: `VW CI: Front-left 3/4. Exact VW logo, IQ.Light headlights from reference. Clean modern white studio.`,
  pipeline_CI_VW_SIDE: `VW CI: Left side profile. Exact body lines and wheel design from reference. White studio.`,
  pipeline_CI_VW_34_REAR: `VW CI: Rear-left 3/4. Exact VW logo, taillight design, model lettering from reference. White studio.`,
  pipeline_CI_VW_FRONT: `VW CI: Direct front. Exact VW badge and light signature from reference. White studio.`,
  // Porsche
  pipeline_CI_PORSCHE_34_FRONT: `Porsche CI: Front-left 3/4. Exact headlight design, front intakes, Porsche crest from reference. Dark dramatic studio.`,
  pipeline_CI_PORSCHE_SIDE: `Porsche CI: Left side profile. Exact proportions and wheel design from reference. Dark dramatic studio.`,
  pipeline_CI_PORSCHE_34_REAR: `Porsche CI: Rear-left 3/4. Exact rear light bar, PORSCHE lettering, exhaust from reference. Dramatic lighting.`,
  pipeline_CI_PORSCHE_LOW: `Porsche CI: Low-angle front. Camera at ground level. Exact front design from reference. Dark studio, dramatic key light.`,
  // Volvo
  pipeline_CI_VOLVO_34_FRONT_LEFT: `Volvo CI: 3/4 front-left. Minimalist high-tech showroom with dark polished resin floor, frosted glass panels with cool-white gradient. Exact headlight DRL (Thor's Hammer), grille, wheel design from reference. No humans. Premium magazine quality.`,
  pipeline_CI_VOLVO_34_FRONT_RIGHT: `Volvo CI: 3/4 front-right. Camera at front-right (NOT left). Minimalist showroom, dark resin floor, frosted glass. Exact headlight, grille, wheels from reference. No color/rim modifications.`,
  pipeline_CI_VOLVO_34_REAR_LEFT: `Volvo CI: 3/4 rear-left. Minimalist showroom. Exact taillight LED signatures, wheel design, body contours from reference.`,
  pipeline_CI_VOLVO_34_REAR_RIGHT: `Volvo CI: 3/4 rear-right. Minimalist showroom. Exact taillights, wheels, body contours from reference.`,
  pipeline_CI_VOLVO_SIDE: `Volvo CI: Flat right side profile. Minimalist showroom. Exact body lines, wheel design from reference.`,
  pipeline_CI_VOLVO_FRONT: `Volvo CI: Flat front, centered. Minimalist showroom. Exact headlight DRL, grille, Iron Mark badge from reference.`,
  pipeline_CI_VOLVO_REAR: `Volvo CI: Flat rear, centered. Minimalist showroom. Exact taillight C-shaped signatures, VOLVO lettering, badges from reference.`,
  pipeline_CI_VOLVO_INT_PASSENGER: `Volvo CI interior: From passenger door toward dashboard. Showroom through windows. Exact leather grain, stitching, trim materials, button layouts, infotainment UI, gear selector from reference. CLEANUP required. LHD.`,
  pipeline_CI_VOLVO_INT_CENTER: `Volvo CI interior: Between front seats looking forward. Exact materials, buttons, steering wheel controls, instrument cluster, gear selector from reference. CLEANUP required. LHD.`,
  pipeline_CI_VOLVO_INT_REAR: `Volvo CI interior: From rear door toward rear seats. Exact seat material, stitching, rear console controls, air vents from reference. CLEANUP required. LHD.`,
  pipeline_CI_VOLVO_INT_BOOT: `Volvo CI: Rear exterior with tailgate open. Showroom environment. Exact cargo floor texture, sidewalls, load lip, cargo hooks from reference. Surrounding panels and taillights matched.`,
  pipeline_CI_VOLVO_INT_STEERING: `Volvo CI interior: Macro of steering wheel and stalks. Exact hub texture, button iconography (media, cruise, voice), paddle shifters, Volvo Iron Mark from reference. LHD.`,
  pipeline_CI_VOLVO_DET_CLUSTER: `Volvo CI detail: Digital instrument cluster macro. Exact UI layout, gauges, info display, warning lights from reference. All text legible. LHD.`,
  pipeline_CI_VOLVO_DET_SCREEN: `Volvo CI detail: Center infotainment screen macro. Exact screen orientation (portrait), bezel, UI layout, surrounding vents and buttons from reference. LHD.`,
  pipeline_CI_VOLVO_DET_WHEEL: `Volvo CI detail: Wheel macro with fender. Minimalist showroom. Exact spoke pattern, concavity, center cap, finish, brake caliper, tire sidewall from reference. Paint color matched. Rim sharp, wheel well in shadow.`,
};

// ─── PROMPT METADATA with categories ───

interface PromptMeta {
  label: string;
  description: string;
  model: string;
  edgeFunction: string;
  category: string;
  readOnly?: boolean;
}

const PROMPT_META: Record<string, PromptMeta> = {
  // PDF & Analyse
  pdf_analysis: {
    label: 'PDF-Analyse',
    description: 'System-Prompt für die Extraktion von Fahrzeugdaten aus PDFs',
    model: 'gemini-2.5-flash',
    edgeFunction: 'analyze-pdf',
    category: 'PDF & Analyse',
  },
  // Bild-Verarbeitung
  image_remaster: {
    label: 'Bild-Remastering',
    description: 'Prompt für professionelle Aufbereitung von Fahrzeugfotos (Standard-Prompt ohne Master-Prompt-Optionen)',
    model: 'gemini-2.5-flash (image)',
    edgeFunction: 'remaster-vehicle-image',
    category: 'Bild-Verarbeitung',
  },
  image_generate: {
    label: 'Bildgenerierung (Info)',
    description: 'Der imagePrompt wird automatisch von der PDF-Analyse generiert – nicht direkt editierbar',
    model: 'gemini-2.5-flash (image)',
    edgeFunction: 'generate-vehicle-image',
    category: 'Bild-Verarbeitung',
    readOnly: true,
  },
  detect_vehicle_brand: {
    label: 'Fahrzeug-Markenerkennung',
    description: 'Prompt zur KI-gestützten Erkennung von Fahrzeugmarke und Modell aus Bildern',
    model: 'gemini-2.5-flash',
    edgeFunction: 'detect-vehicle-brand',
    category: 'Bild-Verarbeitung',
  },
  vin_ocr: {
    label: 'VIN-OCR',
    description: 'Prompt für die Erkennung der Fahrzeug-Identifikationsnummer aus Fotos',
    model: 'gemini-2.5-flash',
    edgeFunction: 'ocr-vin',
    category: 'Bild-Verarbeitung',
  },
  // Video
  video_generate: {
    label: 'Video-Generierung',
    description: 'Prompt für Showroom-Videos aus Fahrzeugbildern via Google Veo',
    model: 'veo-3.1-generate-preview',
    edgeFunction: 'generate-video',
    category: 'Video',
  },
  spin360_video: {
    label: '360° Video (Video2Frames)',
    description: 'Prompt für die 360°-Drehung als Video via Veo – wird zu 48 Frames extrahiert',
    model: 'veo-3.1-generate-preview',
    edgeFunction: 'generate-video (spin360)',
    category: 'Video',
  },
  // 360° Spin (Image2Spin)
  spin360_analysis: {
    label: '360° Bildanalyse',
    description: 'Analysiert 4 Quellbilder auf Perspektive, Qualität und Fahrzeugtyp',
    model: 'gemini-2.5-flash',
    edgeFunction: 'generate-360-spin',
    category: '360° Spin',
  },
  spin360_normalize: {
    label: '360° Normalisierung',
    description: 'Normalisiert Quellbilder auf Studio-Hintergrund für konsistente Frames',
    model: 'gemini-2.5-flash (image)',
    edgeFunction: 'generate-360-spin',
    category: '360° Spin',
  },
  spin360_identity: {
    label: '360° Identity Profile',
    description: 'Erstellt ein detailliertes Identitätsprofil des Fahrzeugs für Frame-Konsistenz',
    model: 'gemini-2.5-flash',
    edgeFunction: 'generate-360-spin',
    category: '360° Spin',
  },
  spin360_anchor: {
    label: '360° Frame-Generierung',
    description: 'Basis-Prompt für die Generierung einzelner 360°-Frames aus verschiedenen Blickwinkeln',
    model: 'gemini-2.5-flash (image)',
    edgeFunction: 'generate-360-spin',
    category: '360° Spin',
  },
  // Landing Page
  landing_page: {
    label: 'Landing Page',
    description: 'System-Prompt für die KI-generierte Landingpage-Erstellung (Texte, Struktur, SEO)',
    model: 'gemini-2.5-flash',
    edgeFunction: 'generate-landing-page',
    category: 'Landing Page',
  },
  // Banner
  banner_generate: {
    label: 'Banner Generator (Info)',
    description: 'Der Banner-Prompt wird clientseitig dynamisch zusammengebaut – nicht direkt editierbar',
    model: 'gemini / gpt-image-1',
    edgeFunction: 'generate-banner',
    category: 'Banner',
    readOnly: true,
  },
  // Sales / CRM
  auto_process_lead: {
    label: 'Lead Auto-Antwort',
    description: 'System-Prompt für die automatische Erstantwort bei neuen Leads',
    model: 'gemini-2.5-flash',
    edgeFunction: 'auto-process-lead',
    category: 'Sales & CRM',
  },
  sales_chat: {
    label: 'Interner Sales-Chatbot',
    description: 'System-Prompt für den internen Verkaufsassistent-Chatbot (Dashboard)',
    model: 'gemini-2.5-flash',
    edgeFunction: 'sales-chat',
    category: 'Sales & CRM',
  },
  sales_response: {
    label: 'Sales Response Generator',
    description: 'Basis-System-Prompt für die Generierung von Verkaufsantworten (Kunden-Kommunikation)',
    model: 'gemini-2.5-flash',
    edgeFunction: 'generate-sales-response',
    category: 'Sales & CRM',
  },
  // Pipeline Bildgenerierung
  pipeline_MASTER_IMAGE: { label: 'Master-Bild', description: 'Hero-Aufnahme: 3/4 vorne links im Showroom', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Hero' },
  pipeline_EXT_FRONT: { label: 'Frontansicht', description: 'Direkte Frontansicht auf Augenhöhe', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_REAR: { label: 'Heckansicht', description: 'Direkte Heckansicht mit Rückleuchten', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_SIDE_LEFT: { label: 'Linke Seite', description: 'Seitenprofil links, senkrecht zur Karosserie', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_SIDE_RIGHT: { label: 'Rechte Seite', description: 'Seitenprofil rechts, senkrecht zur Karosserie', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_34_FRONT_RIGHT: { label: '3/4 Vorne Rechts', description: '3/4-Perspektive vorne rechts', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_34_REAR_LEFT: { label: '3/4 Hinten Links', description: '3/4-Perspektive hinten links, dramatische Beleuchtung', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_34_REAR_RIGHT: { label: '3/4 Hinten Rechts', description: '3/4-Perspektive hinten rechts', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_LOW_ANGLE: { label: 'Low-Angle Hero', description: 'Bodenperspektive von unten – kraftvoller Look', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_EXT_ELEVATED_FRONT: { label: 'Erhöhte Frontansicht', description: 'Vogelperspektive auf Motorhaube und Dach', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Exterieur' },
  pipeline_INT_DASHBOARD: { label: 'Armaturenbrett', description: 'Fahrersitz-Perspektive auf Lenkrad und Cockpit', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Interieur' },
  pipeline_INT_CENTER_CONSOLE: { label: 'Mittelkonsole', description: 'Nahaufnahme Mittelkonsole und Infotainment', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Interieur' },
  pipeline_INT_REAR_SEATS: { label: 'Rücksitzbank', description: 'Blick von vorne auf die Rücksitze', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Interieur' },
  pipeline_INT_WIDE_CABIN: { label: 'Kabinen-Übersicht', description: 'Weitwinkel-Aufnahme der gesamten Kabine', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Interieur' },
  pipeline_DET_HEADLIGHT: { label: 'Scheinwerfer', description: 'Makro-Nahaufnahme des Frontscheinwerfers', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Details' },
  pipeline_DET_TAILLIGHT: { label: 'Rücklicht', description: 'Makro-Nahaufnahme der Rücklicht-Signatur', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Details' },
  pipeline_DET_WHEEL: { label: 'Felge', description: 'Ultra-scharfe Nahaufnahme der Felge mit Bremssattel', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Details' },
  pipeline_DET_GRILLE: { label: 'Kühlergrill & Emblem', description: 'Nahaufnahme Kühlergrill und Markenemblem', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Details' },
  pipeline_GRID_EXTERIOR_4: { label: 'Exterieur-Grid (4)', description: '2×2 Grid: 4 Außenansichten', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Composites' },
  pipeline_GRID_HIGHLIGHTS_6: { label: 'Highlight-Grid (6)', description: '3×2 Grid: Außen + Detail-Mix', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Composites' },
  pipeline_GRID_INTERIOR_4: { label: 'Interieur-Grid (4)', description: '2×2 Grid: 4 Innenansichten', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Composites' },
  pipeline_GRID_SOCIAL_MEDIA: { label: 'Social-Media-Collage', description: 'Hero + 3 Detail-Bilder als Collage', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – Composites' },
  // CI Brand Pipelines (individual jobs)
  // BMW
  pipeline_CI_BMW_34_FRONT: { label: 'BMW CI – 3/4 Front', description: 'BMW CI: Front 3/4 mit Niere', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  pipeline_CI_BMW_SIDE: { label: 'BMW CI – Seite', description: 'BMW CI: Seitenprofil', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  pipeline_CI_BMW_34_REAR: { label: 'BMW CI – 3/4 Heck', description: 'BMW CI: Heck 3/4', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  pipeline_CI_BMW_REAR: { label: 'BMW CI – Heck', description: 'BMW CI: Direkte Heckansicht', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  pipeline_CI_BMW_GRILLE: { label: 'BMW CI – Grill/Scheinwerfer', description: 'BMW CI Detail: Niere + Scheinwerfer', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  pipeline_CI_BMW_INTERIOR: { label: 'BMW CI – Cockpit', description: 'BMW CI Detail: iDrive + Curved Display', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  pipeline_CI_BMW_WHEEL: { label: 'BMW CI – Felge', description: 'BMW CI Detail: Felge + M-Bremse', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI BMW' },
  // Mercedes
  pipeline_CI_MERCEDES_34_FRONT: { label: 'Mercedes CI – 3/4 Front', description: 'Mercedes CI: Front 3/4 mit Stern', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  pipeline_CI_MERCEDES_SIDE: { label: 'Mercedes CI – Seite', description: 'Mercedes CI: Seitenprofil mit Chromleisten', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  pipeline_CI_MERCEDES_34_REAR: { label: 'Mercedes CI – 3/4 Heck', description: 'Mercedes CI: Heck 3/4 mit Lichtband', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  pipeline_CI_MERCEDES_FRONT: { label: 'Mercedes CI – Front', description: 'Mercedes CI: Direkte Front mit Stern', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  pipeline_CI_MERCEDES_MBUX: { label: 'Mercedes CI – MBUX', description: 'Mercedes CI Detail: MBUX Hyperscreen', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  pipeline_CI_MERCEDES_GRILLE: { label: 'Mercedes CI – Grill/Stern', description: 'Mercedes CI Detail: Grill + Stern Makro', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  pipeline_CI_MERCEDES_WHEEL: { label: 'Mercedes CI – Felge', description: 'Mercedes CI Detail: AMG-Felge + Bremse', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Mercedes' },
  // Audi
  pipeline_CI_AUDI_34_FRONT: { label: 'Audi CI – 3/4 Front', description: 'Audi CI: Front 3/4 mit Singleframe-Grill', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Audi' },
  pipeline_CI_AUDI_SIDE: { label: 'Audi CI – Seite', description: 'Audi CI: Seitenprofil mit Tornado-Linie', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Audi' },
  pipeline_CI_AUDI_34_REAR: { label: 'Audi CI – 3/4 Heck', description: 'Audi CI: Heck 3/4 mit LED-Lichtband', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Audi' },
  pipeline_CI_AUDI_REAR: { label: 'Audi CI – Heck', description: 'Audi CI: Heck mit LED-Lichtleiste und Schriftzug', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Audi' },
  // VW
  pipeline_CI_VW_34_FRONT: { label: 'VW CI – 3/4 Front', description: 'VW CI: Front 3/4 mit VW-Logo und IQ.Light', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI VW' },
  pipeline_CI_VW_SIDE: { label: 'VW CI – Seite', description: 'VW CI: Seitenprofil mit klaren Linien', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI VW' },
  pipeline_CI_VW_34_REAR: { label: 'VW CI – 3/4 Heck', description: 'VW CI: Heck 3/4 mit VW-Logo', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI VW' },
  pipeline_CI_VW_FRONT: { label: 'VW CI – Front', description: 'VW CI: Direkte Front mit VW-Emblem', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI VW' },
  // Porsche
  pipeline_CI_PORSCHE_34_FRONT: { label: 'Porsche CI – 3/4 Front', description: 'Porsche CI: Front 3/4 mit Wappen', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Porsche' },
  pipeline_CI_PORSCHE_SIDE: { label: 'Porsche CI – Seite', description: 'Porsche CI: Seitenprofil, Sportwagen', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Porsche' },
  pipeline_CI_PORSCHE_34_REAR: { label: 'Porsche CI – 3/4 Heck', description: 'Porsche CI: Heck 3/4 mit Schriftzug', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Porsche' },
  pipeline_CI_PORSCHE_LOW: { label: 'Porsche CI – Low-Angle', description: 'Porsche CI: Low-Angle Front, Power-Pose', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Porsche' },
  // Volvo
  pipeline_CI_VOLVO_34_FRONT_LEFT: { label: 'Volvo CI – 3/4 Front Links', description: 'Volvo CI: 3/4 Front links, High-Tech-Showroom', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_34_FRONT_RIGHT: { label: 'Volvo CI – 3/4 Front Rechts', description: 'Volvo CI: 3/4 Front rechts, Milchglas', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_34_REAR_LEFT: { label: 'Volvo CI – 3/4 Heck Links', description: 'Volvo CI: 3/4 Heck links mit LED-Signaturen', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_34_REAR_RIGHT: { label: 'Volvo CI – 3/4 Heck Rechts', description: 'Volvo CI: 3/4 Heck rechts', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_SIDE: { label: 'Volvo CI – Seite', description: 'Volvo CI: Seitenprofil Beifahrerseite', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_FRONT: { label: 'Volvo CI – Front', description: 'Volvo CI: Direkte Frontansicht', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_REAR: { label: 'Volvo CI – Heck', description: 'Volvo CI: Direkte Heckansicht', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_INT_PASSENGER: { label: 'Volvo CI – Innenraum Beifahrer', description: 'Volvo CI: Blick von Beifahrerseite auf Dashboard', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_INT_CENTER: { label: 'Volvo CI – Innenraum Mitte', description: 'Volvo CI: Blick zwischen Vordersitzen', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_INT_REAR: { label: 'Volvo CI – Rücksitze', description: 'Volvo CI: Rücksitzbank mit Beinfreiheit', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_INT_BOOT: { label: 'Volvo CI – Kofferraum', description: 'Volvo CI: Offener Kofferraum von hinten', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_INT_STEERING: { label: 'Volvo CI – Lenkrad', description: 'Volvo CI: Nahaufnahme Lenkrad und Bedienelemente', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_DET_CLUSTER: { label: 'Volvo CI – Instrumente', description: 'Volvo CI Detail: Digitales Kombiinstrument', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_DET_SCREEN: { label: 'Volvo CI – Infotainment', description: 'Volvo CI Detail: Zentrales Touchscreen-Display', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
  pipeline_CI_VOLVO_DET_WHEEL: { label: 'Volvo CI – Felge', description: 'Volvo CI Detail: Felge, Bremse und Kotflügel', model: 'gemini / gpt-image', edgeFunction: 'remaster-vehicle-image', category: 'Pipeline – CI Volvo' },
};

const CATEGORIES = [
  'PDF & Analyse',
  'Bild-Verarbeitung',
  'Video',
  '360° Spin',
  'Landing Page',
  'Banner',
  'Sales & CRM',
  'Pipeline – Hero',
  'Pipeline – Exterieur',
  'Pipeline – Interieur',
  'Pipeline – Details',
  'Pipeline – Composites',
  'Pipeline – CI BMW',
  'Pipeline – CI Mercedes',
  'Pipeline – CI Audi',
  'Pipeline – CI VW',
  'Pipeline – CI Porsche',
  'Pipeline – CI Volvo',
];

const PROMPT_ORDER = Object.keys(PROMPT_META);

interface PromptOverrides {
  [key: string]: string;
}

export default function AdminPrompts() {
  const [overrides, setOverrides] = useState<PromptOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

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

  const saveOverrides = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('admin_settings' as any)
      .upsert({ key: 'ai_prompts', value: overrides, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });
    if (error) toast.error('Fehler: ' + error.message);
    else toast.success('Prompt-Überschreibungen gespeichert');
    setSaving(false);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
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

  const overriddenCount = PROMPT_ORDER.filter(k => isOverridden(k)).length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Prompt-Verwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {PROMPT_ORDER.length} Prompts in {CATEGORIES.length} Kategorien · {overriddenCount} überschrieben
          </p>
        </div>
        <Button onClick={saveOverrides} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> {saving ? 'Speichern…' : 'Überschreibungen speichern'}
        </Button>
      </div>

      <div className="space-y-6">
        {CATEGORIES.map(category => {
          const prompts = PROMPT_ORDER.filter(k => PROMPT_META[k].category === category);
          const catOverridden = prompts.filter(k => isOverridden(k)).length;
          const isCatCollapsed = collapsedCategories.has(category);

          return (
            <div key={category} className="space-y-2">
              <button
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 w-full text-left group"
              >
                {isCatCollapsed
                  ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                }
                <h2 className="font-display text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                  {category}
                </h2>
                <Badge variant="secondary" className="text-xs">{prompts.length}</Badge>
                {catOverridden > 0 && <Badge variant="outline" className="text-xs border-accent text-accent">{catOverridden} überschrieben</Badge>}
              </button>

              {!isCatCollapsed && (
                <div className="space-y-3 ml-6">
                  {prompts.map(key => {
                    const meta = PROMPT_META[key];
                    const expanded = expandedKeys.has(key);
                    const overridden = isOverridden(key);

                    return (
                      <div key={key} className="bg-card rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => toggleExpand(key)}
                          className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {expanded ? <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" /> : <Eye className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-display font-semibold text-foreground text-sm">{meta.label}</span>
                                {overridden && <Badge variant="outline" className="text-xs border-accent text-accent">Überschrieben</Badge>}
                                {meta.readOnly && <Badge variant="secondary" className="text-xs">Nur Info</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <Badge variant="secondary" className="text-xs font-mono hidden sm:inline-flex">{meta.model}</Badge>
                            <Badge variant="secondary" className="text-xs font-mono hidden sm:inline-flex">{meta.edgeFunction}</Badge>
                          </div>
                        </button>

                        {expanded && (
                          <div className="px-3 sm:px-4 pb-4 space-y-3 border-t border-border pt-3">
                            {/* Mobile badges */}
                            <div className="flex gap-2 sm:hidden">
                              <Badge variant="secondary" className="text-xs font-mono">{meta.model}</Badge>
                              <Badge variant="secondary" className="text-xs font-mono">{meta.edgeFunction}</Badge>
                            </div>

                            {meta.readOnly ? (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                  {DEFAULT_PROMPTS[key]}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {overridden ? 'Benutzerdefinierter Prompt (aktiv)' : 'Standard-Prompt (aktiv)'}
                                  </span>
                                  {overridden && (
                                    <Button variant="ghost" size="sm" onClick={() => resetToDefault(key)} className="gap-1 text-xs h-7">
                                      <RotateCcw className="w-3 h-3" /> Auf Standard zurücksetzen
                                    </Button>
                                  )}
                                </div>
                                <textarea
                                  value={isMeaningfulOverride(overrides[key]) ? overrides[key] : DEFAULT_PROMPTS[key]}
                                  onChange={e => setOverrides(p => ({ ...p, [key]: e.target.value }))}
                                  className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-background text-foreground text-xs resize-y font-mono leading-relaxed"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Leer lassen oder löschen → Standard-Prompt wird verwendet. Key: <code className="bg-muted px-1 rounded">{key}</code>
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
    </div>
  );
}
