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
    "interestRate": "string (eff. Jahreszins, z.B. '3,99 %')"
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
  pipeline_MASTER_IMAGE: `Create a single photorealistic 8K image of the EXACT vehicle from the provided reference photos. Position the car in the PROVIDED SHOWROOM environment. Camera: Front-left 3/4 perspective at eye level, full-frame layout. The Company Logo MUST be physically integrated onto a large background feature wall behind the car with realistic 3D properties, perspective skew and reflections. Do NOT modify the car body color, rims, or accessories. No humans. Clean luxury studio lighting with realistic floor reflections.`,
  pipeline_EXT_FRONT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Direct head-on front view at eye level, centered in frame. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Realistic floor reflections and showroom lighting. No humans.`,
  pipeline_EXT_REAR: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Direct rear view at eye level, centered in frame showing taillights, exhaust, and rear badge. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Realistic shadows and lighting. No humans.`,
  pipeline_EXT_SIDE_LEFT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Perfect left side profile view, completely flat/perpendicular to the car body. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Highlight body lines and wheel design. No humans.`,
  pipeline_EXT_SIDE_RIGHT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Perfect right side profile view, completely flat/perpendicular to the car body. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Highlight body lines and wheel design. No humans.`,
  pipeline_EXT_34_FRONT_RIGHT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Front-right 3/4 perspective at eye level. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the background wall with correct perspective. Realistic lighting and reflections. No humans.`,
  pipeline_EXT_34_REAR_LEFT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Rear-left 3/4 perspective at eye level showing the rear quarter and side. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the wall behind. Dramatic lighting emphasizing body contours. No humans.`,
  pipeline_EXT_34_REAR_RIGHT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Rear-right 3/4 perspective at eye level. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the wall with correct perspective. Smooth showroom lighting. No humans.`,
  pipeline_EXT_LOW_ANGLE: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Low-angle hero shot from the ground level looking up at the front bumper and grille. Place the car in the PROVIDED SHOWROOM environment. Dramatic perspective making the car look powerful and imposing. The Company Logo visible on the background wall. No humans.`,
  pipeline_EXT_ELEVATED_FRONT: `Create a single photorealistic image of the EXACT vehicle from the reference photos. Elevated front 3/4 view looking down at the hood and windshield from above. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the wall. Bird-eye perspective showing roof and bonnet lines. No humans.`,
  pipeline_INT_DASHBOARD: `Create a single photorealistic image of the EXACT vehicle interior from the reference photos. Driver's seat perspective looking at the steering wheel and full dashboard. Maintain every interior detail exactly as in reference. Bright, even professional lighting. CRITICAL: Do NOT rotate or flip the perspective. The Company Logo is subtly visible through the windshield on the showroom wall outside. No humans.`,
  pipeline_INT_CENTER_CONSOLE: `Create a single photorealistic macro close-up of the center console and infotainment screen of the EXACT vehicle from the reference photos. Show gear selector, controls, and screen in sharp detail. Professional interior lighting. Do NOT change any interior element. No humans.`,
  pipeline_INT_REAR_SEATS: `Create a single photorealistic image from the front looking back at the rear seats of the EXACT vehicle from the reference photos. Show legroom, seat materials, and rear amenities. Clean professional lighting. Do NOT rotate or change perspective. No humans.`,
  pipeline_INT_WIDE_CABIN: `Create a single photorealistic wide-angle view of the full front cabin from the center of the rear seats of the EXACT vehicle. Show the entire dashboard, both front seats, and windshield. Maintain exact interior details. The Company Logo is visible through the windshield on the showroom wall. Professional even lighting. No humans.`,
  pipeline_DET_HEADLIGHT: `Create a single photorealistic macro close-up of the front headlight of the EXACT vehicle from the reference photos. Reveal internal LED textures, DRL signatures, and lens details. High-contrast studio lighting. Solid or highly blurred showroom background. No humans.`,
  pipeline_DET_TAILLIGHT: `Create a single photorealistic macro close-up of the rear taillight signature pattern of the EXACT vehicle from the reference photos. Show LED elements and light design in detail. High-contrast studio lighting against blurred showroom background. No humans.`,
  pipeline_DET_WHEEL: `Create a single photorealistic ultra-sharp close-up of the front wheel of the EXACT vehicle from the reference photos. Match the exact rim design without distortion. Show tire profile and brake caliper if visible. High-contrast studio lighting. Blurred showroom background. No humans.`,
  pipeline_DET_GRILLE: `Create a single photorealistic close-up of the front grille mesh and central badge of the EXACT vehicle from the reference photos. Show chrome/material textures in detail. High-contrast studio lighting emphasizing materials. Blurred showroom background. No humans.`,
  pipeline_GRID_EXTERIOR_4: `Create a photorealistic 2x2 image grid of the EXACT vehicle from the reference photos. Top-left: front 3/4 view. Top-right: direct side profile. Bottom-left: rear 3/4 view. Bottom-right: direct rear view. All in the same PROVIDED SHOWROOM environment with consistent lighting. Each cell shows the complete car. Thin white divider between cells. Company Logo visible on the showroom wall. No humans.`,
  pipeline_GRID_HIGHLIGHTS_6: `Create a photorealistic 3x2 image grid of the EXACT vehicle from the reference photos. Row 1: front 3/4 hero shot | side profile | rear 3/4 view. Row 2: headlight close-up | dashboard interior | wheel/rim close-up. All images in the same PROVIDED SHOWROOM with consistent lighting. Thin white dividers between cells. Company Logo on background wall. No humans.`,
  pipeline_GRID_INTERIOR_4: `Create a photorealistic 2x2 image grid of the EXACT vehicle interior from the reference photos. Top-left: full dashboard from driver seat. Top-right: center console close-up with infotainment. Bottom-left: rear seats from front. Bottom-right: steering wheel close-up. Consistent professional interior lighting. Thin white dividers. Do NOT rotate or flip any perspective. No humans.`,
  pipeline_GRID_SOCIAL_MEDIA: `Create a single photorealistic social-media-ready collage of the EXACT vehicle from the reference photos. One large hero image (front 3/4) taking 60% of the canvas on the left, with 3 smaller images stacked vertically on the right: side profile, interior dashboard, and wheel detail. PROVIDED SHOWROOM environment. Company Logo watermark. Modern, clean layout. No humans.`,

  // ── CI Brand Pipelines (individual jobs) ──
  // BMW
  pipeline_CI_BMW_34_FRONT: `BMW Corporate Identity photography: Front 3/4 view at eye level with the BMW kidney grille clearly visible and centered. Clean white/grey studio background. BMW corporate lighting setup with strong key light from front-left.`,
  pipeline_CI_BMW_SIDE: `BMW Corporate Identity photography: Direct side profile, perfectly flat/perpendicular. Wheels at 20° angle showing BMW logo on center caps. Clean white/grey studio background.`,
  pipeline_CI_BMW_34_REAR: `BMW Corporate Identity photography: Rear 3/4 view showing the BMW roundel badge, exhaust outlets, and rear light bar. Clean white/grey studio background.`,
  pipeline_CI_BMW_REAR: `BMW Corporate Identity photography: Direct rear view, centered, showing full width of taillights, exhaust, and rear badge. Clean white/grey studio background.`,
  pipeline_CI_BMW_GRILLE: `BMW Corporate Identity detail photography: Close-up of the BMW kidney grille with angel-eye/adaptive LED headlights. Emphasize the BMW roundel badge. High-contrast studio lighting on clean background.`,
  pipeline_CI_BMW_INTERIOR: `BMW Corporate Identity detail photography: Dashboard and iDrive infotainment system from driver perspective. Show BMW curved display and ambient lighting. Professional interior lighting.`,
  pipeline_CI_BMW_WHEEL: `BMW Corporate Identity detail photography: Wheel and M-Sport brake caliper close-up. Show exact rim design and BMW center cap. Studio lighting with blurred background.`,
  // Mercedes
  pipeline_CI_MERCEDES_34_FRONT: `Mercedes-Benz Corporate Identity photography: Front 3/4 view emphasizing the star emblem and radiator grille. Elegant studio with subtle gradient background. Mercedes signature lighting: soft, even, premium.`,
  pipeline_CI_MERCEDES_SIDE: `Mercedes-Benz Corporate Identity photography: Side profile showing the full body silhouette and chrome details. Subtle gradient studio background.`,
  pipeline_CI_MERCEDES_34_REAR: `Mercedes-Benz Corporate Identity photography: Rear 3/4 view highlighting the LED light strip, star badge, and exhaust. Elegant studio.`,
  pipeline_CI_MERCEDES_FRONT: `Mercedes-Benz Corporate Identity photography: Direct front view, perfectly centered, showcasing the three-pointed star and grille design. Even studio lighting.`,
  pipeline_CI_MERCEDES_MBUX: `Mercedes-Benz Corporate Identity detail: MBUX hyperscreen/infotainment close-up from driver seat. Show digital cockpit and ambient lighting. Premium interior photography.`,
  pipeline_CI_MERCEDES_GRILLE: `Mercedes-Benz Corporate Identity detail: Front grille and star emblem macro shot. Show chrome textures and LED headlight internals. Studio lighting.`,
  pipeline_CI_MERCEDES_WHEEL: `Mercedes-Benz Corporate Identity detail: Wheel with AMG/standard rim design and brake caliper. Star center cap visible. Studio lighting.`,
  // Audi
  pipeline_CI_AUDI_34_FRONT: `Audi Corporate Identity photography: Front 3/4 view with Singleframe grille and four rings emblem clearly visible. Audi-signature clean, bright studio with minimal shadows.`,
  pipeline_CI_AUDI_SIDE: `Audi Corporate Identity photography: Perfect side profile highlighting Audi design DNA with Tornado line. Clean bright studio.`,
  pipeline_CI_AUDI_34_REAR: `Audi Corporate Identity photography: Rear 3/4 view showing connected LED light strip and Audi four rings badge. Clean studio.`,
  pipeline_CI_AUDI_REAR: `Audi Corporate Identity photography: Direct rear view centered on the full-width LED light bar and Audi lettering. Bright studio background.`,
  // VW
  pipeline_CI_VW_34_FRONT: `Volkswagen Corporate Identity photography: Front 3/4 view with VW logo and IQ.Light LED headlights prominent. Clean, modern white studio. Friendly, approachable lighting setup.`,
  pipeline_CI_VW_SIDE: `Volkswagen Corporate Identity photography: Side profile showing clean body lines and wheel design. Modern white studio.`,
  pipeline_CI_VW_34_REAR: `Volkswagen Corporate Identity photography: Rear 3/4 view with VW logo, taillights, and lettering visible. White studio.`,
  pipeline_CI_VW_FRONT: `Volkswagen Corporate Identity photography: Direct front view centered on VW badge and light signature. White studio.`,
  // Porsche
  pipeline_CI_PORSCHE_34_FRONT: `Porsche Corporate Identity photography: Front 3/4 view emphasizing the iconic silhouette, headlight design, and Porsche crest. Dark dramatic studio with controlled highlights.`,
  pipeline_CI_PORSCHE_SIDE: `Porsche Corporate Identity photography: Side profile capturing the sports car proportions. Dark dramatic studio with rim focus.`,
  pipeline_CI_PORSCHE_34_REAR: `Porsche Corporate Identity photography: Rear 3/4 view showing the rear light bar, PORSCHE lettering, and exhaust. Dramatic lighting.`,
  pipeline_CI_PORSCHE_LOW: `Porsche Corporate Identity photography: Low-angle front view emphasizing power and stance. Dark studio, dramatic key light.`,
  // Volvo
  pipeline_CI_VOLVO_34_FRONT_LEFT: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 front, facing left. Environment: minimalist, high-tech showroom with highly reflective dark polished resin floor. Background: large seamless frosted glass panels subtly illuminated from behind with soft diffused cool-white gradient light, creating infinite depth. No extraneous objects, humans, or other vehicles. License plates blank and body-colored. Strict Detail Preservation: Replicate exact headlight internal structure, DRL signatures, front grille shape/mesh/texture, wheel spoke pattern, body contours, trim, color and rims with absolute precision. No simplification. Interior subtly visible through windows. Composition: clean, centered, premium magazine quality.`,
  pipeline_CI_VOLVO_34_FRONT_RIGHT: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 front, facing right. Environment: minimalist high-tech showroom with highly reflective dark polished resin floor and seamless frosted glass panels with soft cool-white gradient light. No humans, no other vehicles. License plates blank. Replicate exact headlight DRL signatures, grille mesh, wheel design, body lines with microscopic accuracy. No color/rim modifications. Premium magazine composition.`,
  pipeline_CI_VOLVO_34_REAR_LEFT: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 rear, facing left. Environment: minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels with cool-white gradient. No humans. Replicate exact tail light internal structure, LED signatures, wheel design, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.`,
  pipeline_CI_VOLVO_34_REAR_RIGHT: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 rear, facing right. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact tail lights, wheels, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.`,
  pipeline_CI_VOLVO_SIDE: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of flat passenger side facing right. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact headlights, grille, wheel design, body lines with microscopic accuracy. No color/rim modifications. Premium magazine composition.`,
  pipeline_CI_VOLVO_FRONT: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of flat front. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact headlight DRL signatures, grille mesh pattern, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.`,
  pipeline_CI_VOLVO_REAR: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of flat rear. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact tail light internal structure, LED signatures, rear badges, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.`,
  pipeline_CI_VOLVO_INT_PASSENGER: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior from reference images. Front Interior Shot from Front Passenger Side: Looking from open front passenger door towards dashboard, center console, steering wheel, and driver seat. Showroom visible through windows (frosted glass, dark resin floor). Replicate exact leather grain texture, stitching, trim materials (open-pore wood, metal mesh). Replicate exact button layout, infotainment UI, instrument cluster, gear selector. LHD configuration. Focus: full dashboard span, center vertical screen, passenger-side trim, steering wheel, center console gear selector. Premium magazine quality.`,
  pipeline_CI_VOLVO_INT_CENTER: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Front Interior Shot: Looking from between front seats towards driver console and passenger dashboard. Showroom visible through windows. Replicate exact leather grain, stitching, trim materials, button layouts, UI screens, gear selector with microscopic accuracy. LHD configuration. Focus: driver door panel button array, steering wheel controls, instrument cluster, pedals, view across to passenger side. Premium quality.`,
  pipeline_CI_VOLVO_INT_REAR: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Rear Interior Shot: Looking from open rear passenger door towards rear seats, legroom, and rear center console. Showroom visible through windows. Replicate exact seat material, stitching, rear center console/armrest controls (climate, heated seats), rear air vents. LHD configuration. Focus: second-row seating layout, floor mat texture. Premium quality.`,
  pipeline_CI_VOLVO_INT_BOOT: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle. Boot Open Rear Shot: Straight-on exterior view with tailgate fully open, looking into cargo space. Showroom environment with reflective dark resin floor and frosted glass panels. Replicate exact cargo floor texture, sidewalls, load-bearing lip, cargo net hooks, rear-seat release handles. Surrounding exterior panels and taillights perfectly matched. Premium quality.`,
  pipeline_CI_VOLVO_INT_STEERING: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Close-Up Steering Shot: Tight macro-style shot of steering wheel, central horn pad, and surrounding stalks. Complete steering wheel visible. Exterior showroom visible through windshield. Replicate exact steering wheel hub texture (leather/plastic/metal), precise button iconography on left/right spokes (media, cruise control, voice assistant), paddle shifters if present. Center logo perfectly legible. LHD configuration. Premium quality.`,
  pipeline_CI_VOLVO_DET_CLUSTER: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Closeup Driver Infotainment Screen (Instrument Cluster): Tight macro-style shot of digital screen/cluster behind steering wheel. Replicate exact UI layout including digital gauges (speedometer, tachometer/power meter), central information display, warning light placements. All text and iconography sharp and legible. Surrounding cluster bezel material detailed. LHD configuration. Premium quality.`,
  pipeline_CI_VOLVO_DET_SCREEN: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Closeup Center Infotainment Screen: Tight macro-style shot of main dashboard central screen and surrounding controls. Replicate exact screen orientation (portrait/vertical), bezel design, precise UI layout with app icons, climate overlay, navigation. Surrounding air vents, physical buttons, dash material texture in sharp focus. LHD configuration. Premium quality.`,
  pipeline_CI_VOLVO_DET_WHEEL: `Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle. Macro Close-up of Wheel, Alloy Rim, and Surrounding Fender. Environment: minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels. Replicate exact multi-spoke alloy wheel design, spoke pattern, concavity, lug nut configuration, center cap, metallic/machined finish with absolute precision. Accurately reproduce visible brake calipers, rotor pattern. Replicate tire profile, sidewall texture. Surrounding fender body contours and paint color perfectly matched. Depth of field keeps rim sharp, wheel well falls to shadow. Premium detail shot quality.`,
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
