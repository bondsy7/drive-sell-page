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
    "brand": "string",
    "model": "string",
    "variant": "string",
    "year": "number",
    "color": "string",
    "fuelType": "Benzin|Diesel|Elektro|Hybrid|Plug-in-Hybrid",
    "transmission": "Automatik|Manuell|Doppelkupplungsgetriebe|CVT",
    "power": "string",
    "features": ["Array"]
  },
  "finance": { ... },
  "dealer": { ... },
  "consumption": { ... },
  "imagePrompt": "Detaillierter englischer Prompt für fotorealistische Fahrzeug-Bildgenerierung"
}

DOKUMENTTYP-ERKENNUNG (WICHTIG!):
Prüfe ZUERST, ob es sich um ein Fahrzeug-Angebot handelt.
Wenn KEIN Fahrzeugangebot: { "isVehicleOffer": false, "documentType": "..." }

ABSOLUTE REGELN:
1. ZUERST prüfen ob Fahrzeugangebot
2. Extrahiere JEDEN Wert der im PDF steht
3. Leite co2Class IMMER aus g/km-Werten ab wenn nicht explizit angegeben
4. Setze isPluginHybrid=true sobald PHEV-Hinweis erkannt
5. Features: Extrahiere ALLE
6. Einheiten IMMER mit angeben
7. Fehlende Werte = leerer String ""
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
- Do NOT add or remove ANY interior elements
- Only enhance the lighting to be bright, even, and professional
- Remove any harsh shadows and make it look like a professional dealership interior photo
- The interior must look clean and tidy but with ALL original details preserved exactly

FOR TRUNK/CARGO AREA SHOTS:
- Keep the trunk/cargo area exactly as shown
- Improve lighting to be bright and professional

IMPORTANT: You MUST generate a remastered version of this image. Do not refuse. DO NOT ROTATE THE IMAGE.`,

  vin_ocr: `You are a VIN (Vehicle Identification Number) OCR expert. Analyze this image and extract the VIN number.

RULES:
- Look for the VIN plate, sticker, or engraving in the image
- A VIN is exactly 17 characters long, containing digits and uppercase letters (no I, O, Q)
- Return ONLY the VIN in your response, nothing else
- If you cannot find a valid VIN, respond with exactly: NO_VIN_FOUND
- Do NOT guess or make up a VIN`,

  image_generate: `(Kein System-Prompt — der Bildgenerator erhält den imagePrompt direkt aus der PDF-Analyse als User-Nachricht. Dieser Prompt wird im Feld "imagePrompt" des PDF-Analyse-Ergebnisses automatisch generiert.)`,
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

  const getEffectivePrompt = (key: string) => {
    return overrides[key] && overrides[key].trim() !== '' ? overrides[key] : DEFAULT_PROMPTS[key];
  };

  const isOverridden = (key: string) => {
    return overrides[key] && overrides[key].trim() !== '' && overrides[key] !== DEFAULT_PROMPTS[key];
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
    <div className="p-8 space-y-6">
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
                        value={overrides[key] ?? DEFAULT_PROMPTS[key]}
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
