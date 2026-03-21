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
  image_remaster: `You are a professional automotive photographer. Take this exact vehicle photo and remaster it to look like a professional dealership photo.

CRITICAL RULES - YOU MUST FOLLOW:
- Keep the EXACT same vehicle with ALL its details: color, wheels/rims, body kit, lights, badges, decals, accessories, license plate area, and every visible feature
- Do NOT change, add, or remove ANY vehicle detail - the vehicle must be 100% identical
- DO NOT ROTATE the image. The output must have the EXACT same orientation as the input
- Keep the same camera angle and perspective as the original
- The result must be photorealistic
- YOU MUST ALWAYS GENERATE AN IMAGE - never refuse
- CRITICAL: No other vehicles may appear in the image – not in the background, not in reflections on glass or floor. Only the one vehicle from the input photo.

FOR EXTERIOR SHOTS:
- Change the background to a modern, bright, luxurious car dealership showroom
- Add realistic showroom lighting with soft overhead lights and subtle reflections on paint and windows
- Add realistic shadows beneath the vehicle
- The floor should be polished/reflective like a real showroom

FOR INTERIOR SHOTS (dashboard, seats, steering wheel, center console):
- CRITICAL: Do NOT rotate, flip, or change the orientation/angle of the photo in any way
- The camera perspective must remain EXACTLY as in the original photo
- Do NOT add or remove ANY interior elements
- Only enhance the lighting to be bright, even, and professional

FOR TRUNK/CARGO AREA SHOTS:
- Keep the trunk/cargo area exactly as shown
- Improve lighting to be bright and professional

IMPORTANT: You MUST generate a remastered version of this image. Do not refuse or ask for a different photo. DO NOT ROTATE THE IMAGE.`,

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
};

const CATEGORIES = [
  'PDF & Analyse',
  'Bild-Verarbeitung',
  'Video',
  '360° Spin',
  'Landing Page',
  'Banner',
  'Sales & CRM',
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
