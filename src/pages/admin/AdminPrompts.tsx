import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Default prompts extracted from edge functions
const DEFAULT_PROMPTS: Record<string, string> = {
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
    "origin": "string (z.B. 'Deutsche Ausführung', 'EU-Import')",
    "mileage": "string (Kilometerstand, z.B. '10 km')",
    "displacement": "string (Hubraum, z.B. '1.998 cm³')",
    "power": "string (z.B. '110 kW (150 PS)')",
    "driveType": "string (z.B. 'Verbrennungsmotor', 'Plug-in-Hybrid', 'Elektro', 'Allrad')",
    "fuelType": "string (z.B. 'Super (E10)', 'Diesel', 'Super Plus', 'Benzin/Strom')",
    "consumptionCombined": "string (z.B. '7,0 l/100km', bei PHEV gewichtet kombiniert z.B. '1,8 l/100km')",
    "co2Emissions": "string (z.B. '162 g/km', bei PHEV gewichtet kombiniert)",
    "co2Class": "string (A-G, ableiten wenn nicht explizit angegeben!)",
    "consumptionCity": "string (Innerorts/Innenstadt)",
    "consumptionSuburban": "string (Stadtrand/Außerorts niedrig)",
    "consumptionRural": "string (Landstraße/Außerorts hoch)",
    "consumptionHighway": "string (Autobahn)",
    "energyCostPerYear": "string mit € (z.B. '1.886 €/Jahr')",
    "fuelPrice": "string (Berechnungsgrundlage, z.B. '1,82 €/l Super')",
    "co2CostMedium": "string mit € (CO₂-Kosten mittel über 10 Jahre)",
    "co2CostLow": "string mit € (CO₂-Kosten niedrig über 10 Jahre)",
    "co2CostHigh": "string mit € (CO₂-Kosten hoch über 10 Jahre)",
    "vehicleTax": "string mit € (Kfz-Steuer/Jahr)",
    "isPluginHybrid": "boolean (true wenn PHEV erkannt)",
    "co2EmissionsDischarged": "string (nur PHEV: CO₂ bei entladener Batterie)",
    "co2ClassDischarged": "string (nur PHEV: CO₂-Klasse bei entladener Batterie, ableiten!)",
    "consumptionCombinedDischarged": "string (nur PHEV: Verbrauch kombiniert bei entladener Batterie)",
    "electricRange": "string (nur PHEV/BEV: elektrische Reichweite EAER)",
    "consumptionElectric": "string (nur PHEV/BEV: Stromverbrauch komb. in kWh/100km)"
  },
  "imagePrompt": "Detaillierter englischer Prompt für fotorealistische Fahrzeug-Bildgenerierung"
}

Für den imagePrompt: Erstelle einen detaillierten englischen Prompt mit exaktem Fahrzeugmodell (Marke, Modell, Farbe, Karosserieform) in einem modernen, hellen Autohaus-Showroom. Beschreibe Licht, Reflexionen, Boden und Atmosphäre.

DOKUMENTTYP-ERKENNUNG (WICHTIG!):
Prüfe ZUERST, ob es sich um ein Fahrzeug-Angebot handelt (Leasing, Finanzierung, Kauf, Barkauf).
Wenn das Dokument KEIN Fahrzeugangebot ist (z.B. Rechnung, Versicherung, Werkstattrechnung, Mietvertrag, 
Bewerbung, Steuerbescheid, beliebiges anderes Dokument), antworte mit:
{
  "isVehicleOffer": false,
  "documentType": "string (was das Dokument tatsächlich ist, z.B. 'Werkstattrechnung', 'Versicherungspolice')"
}
und NICHTS weiter.

Wenn es ein Fahrzeugangebot IST, setze "isVehicleOffer": true im Root-Objekt und fahre mit der Extraktion fort.

ABSOLUTE REGELN:
1. ZUERST prüfen ob Fahrzeugangebot - wenn nicht, sofort ablehnen
2. Extrahiere JEDEN Wert der im PDF steht - lieber zu viel als zu wenig
3. Leite co2Class und co2ClassDischarged IMMER aus den g/km-Werten ab wenn nicht explizit angegeben
4. Setze isPluginHybrid=true sobald irgendein PHEV-Hinweis erkannt wird
5. Features: Extrahiere ALLE - auch 50+ Einträge sind OK
6. Einheiten IMMER mit angeben (€, km, l/100km, g/km, kW, PS, cm³, kWh/100km)
7. Fehlende Werte = leerer String "", fehlende booleans = false
8. Antworte NUR mit JSON`,

  image_remaster: `You are a professional automotive photographer. Take this exact vehicle photo and remaster it to look like a professional dealership photo.

CRITICAL RULES - YOU MUST FOLLOW:
- Keep the EXACT same vehicle with ALL its details: color, wheels/rims, body kit, lights, badges, decals, accessories, license plate area, and every visible feature
- Do NOT change, add, or remove ANY vehicle detail - the vehicle must be 100% identical
- DO NOT ROTATE the image. The output must have the EXACT same orientation as the input
- Keep the same camera angle and perspective as the original
- The result must be photorealistic
- YOU MUST ALWAYS GENERATE AN IMAGE - never refuse

FOR EXTERIOR SHOTS:
- Change the background to a modern, bright, luxurious car dealership showroom
- Add realistic showroom lighting with soft overhead lights and subtle reflections on paint and windows
- Add realistic shadows beneath the vehicle
- The floor should be polished/reflective like a real showroom

FOR INTERIOR SHOTS (dashboard, seats, steering wheel, center console):
- CRITICAL: Do NOT rotate, flip, or change the orientation/angle of the photo in any way
- The camera perspective must remain EXACTLY as in the original photo
- Do NOT add or remove ANY interior elements (seats, buttons, screens, trim, steering wheel, etc.)
- Only enhance the lighting to be bright, even, and professional
- Remove any harsh shadows and make it look like a professional dealership interior photo
- The interior must look clean and tidy but with ALL original details preserved exactly
- If the photo is taken from the front seat looking back, keep that exact perspective
- If the photo is taken from the back seat looking forward, keep that exact perspective

FOR TRUNK/CARGO AREA SHOTS:
- Keep the trunk/cargo area exactly as shown
- Improve lighting to be bright and professional
- This is a legitimate vehicle photo - enhance it professionally

IMPORTANT: You MUST generate a remastered version of this image. Do not refuse or ask for a different photo. Enhance whatever vehicle photo is provided. DO NOT ROTATE THE IMAGE.`,

  vin_ocr: `You are a VIN (Vehicle Identification Number) OCR expert. Analyze this image and extract the VIN number.

RULES:
- Look for the VIN plate, sticker, or engraving in the image
- A VIN is exactly 17 characters long, containing digits and uppercase letters (no I, O, Q)
- Return ONLY the VIN in your response, nothing else
- If you cannot find a valid VIN, respond with exactly: NO_VIN_FOUND
- Do NOT guess or make up a VIN`,

  image_generate: `(Kein System-Prompt — der Bildgenerator erhält den imagePrompt direkt aus der PDF-Analyse als User-Nachricht. Dieser Prompt wird im Feld "imagePrompt" des PDF-Analyse-Ergebnisses automatisch generiert.

Der User-Prompt an das Modell lautet:
"Generate a photorealistic image of this vehicle based on the following description: {imagePrompt}"

Der imagePrompt selbst wird von der PDF-Analyse generiert und enthält typischerweise:
- Exaktes Fahrzeugmodell (Marke, Modell, Farbe, Karosserieform)
- Moderner, heller Autohaus-Showroom als Hintergrund
- Beschreibung von Licht, Reflexionen, Boden und Atmosphäre)`,

  video_generate: `Erstelle ein professionelles 8-Sekunden Showroom-Video des Fahrzeugs. Das Auto dreht sich langsam auf einer Drehscheibe in einem modernen, hell beleuchteten Autohaus-Showroom. Weiche Beleuchtung, Reflexionen auf dem Lack, polierter Boden. Cinematische Kamerafahrt. Professionelle Autohaus-Atmosphäre.`,
};

const PROMPT_META: Record<string, { label: string; description: string; model: string; edgeFunction: string }> = {
  pdf_analysis: {
    label: 'PDF-Analyse',
    description: 'System-Prompt für die Extraktion von Fahrzeugdaten aus PDFs',
    model: 'google/gemini-2.5-flash',
    edgeFunction: 'analyze-pdf',
  },
  image_remaster: {
    label: 'Bild-Remastering',
    description: 'Prompt für die professionelle Aufbereitung von Fahrzeugfotos',
    model: 'google/gemini-2.5-flash-image',
    edgeFunction: 'remaster-vehicle-image',
  },
  vin_ocr: {
    label: 'VIN-OCR',
    description: 'Prompt für die Erkennung der Fahrzeug-Identifikationsnummer aus Fotos',
    model: 'google/gemini-2.5-flash',
    edgeFunction: 'ocr-vin',
  },
  image_generate: {
    label: 'Bildgenerierung',
    description: 'Der imagePrompt wird automatisch von der PDF-Analyse generiert und direkt an das Modell übergeben',
    model: 'google/gemini-2.5-flash-image',
    edgeFunction: 'generate-vehicle-image',
  },
};

const PROMPT_ORDER = ['pdf_analysis', 'image_remaster', 'vin_ocr', 'image_generate'];

interface PromptOverrides {
  [key: string]: string;
}

export default function AdminPrompts() {
  const [overrides, setOverrides] = useState<PromptOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['pdf_analysis']));

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
    // Upsert
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

  const isMeaningfulOverride = (val: string | undefined) => {
    if (!val) return false;
    const trimmed = val.trim().toLowerCase();
    return trimmed !== '' && trimmed !== 'default';
  };

  const getEffectivePrompt = (key: string) => {
    return isMeaningfulOverride(overrides[key]) ? overrides[key] : DEFAULT_PROMPTS[key];
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Prompt-Verwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alle KI-Prompts der Edge Functions. Überschreibe einzelne Prompts oder verwende die Standards.
          </p>
        </div>
        <Button onClick={saveOverrides} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" /> {saving ? 'Speichern…' : 'Überschreibungen speichern'}
        </Button>
      </div>

      <div className="space-y-4">
        {PROMPT_ORDER.map(key => {
          const meta = PROMPT_META[key];
          const expanded = expandedKeys.has(key);
          const overridden = isOverridden(key);

          return (
            <div key={key} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <button
                onClick={() => toggleExpand(key)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {expanded ? <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" /> : <Eye className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-foreground text-sm">{meta.label}</span>
                      {overridden && <Badge variant="outline" className="text-xs border-accent text-accent">Überschrieben</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs font-mono">{meta.model}</Badge>
                  <Badge variant="secondary" className="text-xs font-mono">{meta.edgeFunction}</Badge>
                </div>
              </button>

              {/* Content */}
              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {key !== 'image_generate' ? (
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
                        Leer lassen oder löschen → Standard-Prompt wird verwendet.
                      </p>
                    </>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {DEFAULT_PROMPTS[key]}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
