import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `Du bist ein Experte für die Analyse von Fahrzeug-Angebots-PDFs deutscher Autohäuser. Deine Aufgabe: Extrahiere ALLE verfügbaren Daten so vollständig und präzise wie möglich. Lasse NICHTS aus.

WICHTIG: Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

EXTRAKTIONS-STRATEGIE:
1. Lies das GESAMTE Dokument Seite für Seite durch
2. Suche nach ALLEN Tabellen, Fußnoten, Kleingedrucktem, Seitenleisten
3. Fahrzeugdaten stehen oft in strukturierten Tabellen oder als Key-Value-Paare
4. Verbrauchswerte und CO₂-Daten stehen häufig im Kleingedruckten oder in Pflichtangaben am Ende
5. Händlerdaten stehen oft im Kopf/Fuß oder auf der letzten Seite
6. Finanzierungsdaten können in Tabellen, Hervorhebungen oder separaten Abschnitten stehen
7. Ausstattungsmerkmale stehen oft als Aufzählungen, Listen oder in Paketen

CO₂-KLASSE (NUR A bis G, KEINE Plus-Klassen mehr!):
WICHTIG: Seit der neuen Pkw-EnVKV gibt es NUR NOCH die Klassen A bis G.
Klassen wie "A+", "A++", "A+++" sind UNGÜLTIG und dürfen NICHT mehr ausgegeben werden.
Wenn im PDF "A+++" o.ä. steht, IGNORIERE diesen Wert und leite die Klasse aus den g/km-Werten ab:
- 0 g/km → A
- 1–95 g/km → B  
- 96–115 g/km → C
- 116–135 g/km → D
- 136–155 g/km → E
- 156–175 g/km → F
- >175 g/km → G
Bei PHEVs: co2Class = aus gewichteten g/km, co2ClassDischarged = aus entladenen g/km. Diese können stark abweichen (z.B. C gewichtet, G entladen).

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
- Extrahiere NUR die HIGHLIGHTS der Ausstattung (max. 15-20 Einträge)
- Fokus auf: Pakete (z.B. "Business Paket", "AMG Line"), besondere Extras, Assistenzsysteme, Infotainment-Highlights
- KEINE trivialen Standardausstattungen (z.B. "Warndreieck", "Verbandskasten", "Fußmatten")
- KEINE Einträge die mit "Ohne" oder "Kein" beginnen (z.B. "Ohne Fußmatten", "Keine Metallic-Lackierung")
- Wenn das PDF MEHRERE Fahrzeugvarianten enthält, extrahiere NUR die Ausstattung des ERSTEN/HAUPT-Angebots
- Keine Duplikate, keine redundanten Einträge

FINANZIERUNG:
- Achte auf: Brutto vs. Netto, MwSt-Hinweise
- "Sonderzahlung" = "Anzahlung" bei manchen Händlern
- "Schlussrate" = "Restwert" bei manchen Angeboten
- Leasingfaktor, eff. Jahreszins wenn vorhanden
- "Gesamtbetrag" = "Darlehenssumme" = "Gesamtdarlehensbetrag" - dies ist die Summe aller Zahlungen des Kreditnehmers (inkl. Zinsen), NICHT der Fahrzeugpreis

VERBRAUCH - Suche nach ALLEN dieser Werte:
- Kombiniert, Innerorts/Innenstadt, Außerorts/Stadtrand, Landstraße, Autobahn
- WLTP vs NEFZ (bevorzuge WLTP)
- Energiekosten pro Jahr, Kraftstoffpreis (Berechnungsgrundlage)
- CO₂-Kosten: niedrig, mittel, hoch (jeweils über 10 Jahre)
- Kfz-Steuer pro Jahr
- Bei Elektro/PHEV: Stromverbrauch in kWh/100km

JSON-Schema:
{
  "category": "Leasing|Finanzierung|Barkauf|Neuwagen|Gebrauchtwagen|Tageszulassung",
  "vehicle": {
    "brand": "string (Marke, z.B. 'BMW', 'Mercedes-Benz', 'Volkswagen')",
    "model": "string (volles Modell, z.B. 'X3 xDrive30e')",
    "variant": "string (Ausstattungslinie/Variante, z.B. 'M Sport, xLine')",
    "year": "number (Modelljahr oder EZ-Jahr)",
    "firstRegistration": "string (Erstzulassungsdatum, Format 'MM/YYYY' oder 'TT.MM.YYYY', z.B. '03/2023'. Leer bei Neuwagen ohne Zulassung)",
    "condition": "Neuwagen|Gebrauchtwagen|Tageszulassung|Vorführwagen|Jahreswagen (Fahrzeugzustand)",
    "color": "string (Außenfarbe, z.B. 'Alpinweiß uni')",
    "fuelType": "Benzin|Diesel|Elektro|Hybrid|Plug-in-Hybrid",
    "transmission": "Automatik|Manuell|Doppelkupplungsgetriebe|CVT",
    "power": "string (z.B. '150 PS / 110 kW' oder Systemleistung bei Hybrid)",
    "features": ["NUR Highlights, max 15-20, keine 'Ohne'-Einträge, keine Trivialausstattung"],
    "description": "string (2-3 Sätze Fahrzeugbeschreibung: Beschreibe das Fahrzeug und seine wichtigsten Ausstattungsmerkmale in verkaufsförderndem Ton. Erwähne Marke, Modell, Motorisierung, besondere Highlights und Zustand.)"
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
    "nominalInterestRate": "string (gebundener Sollzinssatz, z.B. '3,49 % p.a.')",
    "totalAmount": "string mit € (Gesamtbetrag / Darlehenssumme / Gesamtdarlehensbetrag, z.B. '33.984,91 €' - dies ist die Summe aller Zahlungen inkl. Zinsen)",
    "excessMileageCost": "string (Kosten pro Mehrkilometer, z.B. '0,126 € pro km' - nur bei Leasing)",
    "underMileageCost": "string (Vergütung/Erstattung pro Minderkilometer, z.B. '0,072 € pro km' - nur bei Leasing)",
    "mileageTolerance": "string (Freigrenze Kilometer, z.B. '2.500' - nur bei Leasing)"
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

Für den imagePrompt: Erstelle einen detaillierten englischen Prompt mit exaktem Fahrzeugmodell (Marke, Modell, Farbe, Karosserieform) in einem modernen, hellen Autohaus-Showroom. Der Prompt MUSS eine professionelle Automotive-Aufnahme beschreiben: sichtbare Decken-LEDs/Fensterlicht als Lichtquellen, natürliche neue Reflexionen dieser Lichtquellen in Lack, Glas, Chrom und Felgen, weiche Kontaktschatten unter den Reifen, dezente Bodenreflexion auf poliertem Boden und vollständige Entfernung fremder/alter Reflexionen. Keine Personen, keine anderen Fahrzeuge, keine Wasserzeichen, keine alten Händlerlogos oder Textartefakte.

KATEGORIE-ERKENNUNG (WICHTIG!):
Erkenne den Angebotstyp so dynamisch wie möglich:
- "Leasing" → Wenn Begriffe wie "Leasingrate", "Leasingvertrag", "mtl. Leasingrate", "Sonderzahlung" vorkommen
- "Finanzierung" → Wenn Begriffe wie "Finanzierungsrate", "eff. Jahreszins", "Sollzinssatz", "Kreditvertrag", "Darlehen", "Gesamtdarlehensbetrag" vorkommen
- "Barkauf" → Wenn ein Fahrzeug zum Direktkauf angeboten wird ohne Finanzierung/Leasing
- "Neuwagen" → Wenn es ein Neuwagen/Werksfahrzeug ist (0 km, Neufahrzeug, Bestellung, Konfigurator)
- "Gebrauchtwagen" → Wenn Kilometerstand > 100 km, "Gebrauchtwagen", "Vorbesitzer" etc.
- "Tageszulassung" → Wenn "Tageszulassung", "TZ", niedriger km-Stand (< 100 km) mit Erstzulassung
Kombiniere wenn nötig: Ein Gebrauchtwagen kann per Finanzierung angeboten werden → dann "Finanzierung". Der Angebotstyp (Leasing/Finanzierung/Barkauf) hat VORRANG vor dem Fahrzeugzustand.

FAHRZEUGZUSTAND-ERKENNUNG (vehicle.condition) — gemäß Pkw-EnVKV (Fassung seit 23.02.2024):
Bestimme den Zustand ROBUST aus Erstzulassung + Kilometerstand + Begriffen:
- "Neuwagen" → § 2 Nr. 1 Pkw-EnVKV: noch nicht zum Weiterverkauf zugelassen UND (Erstzulassung ≤ 8 Monate ODER mileage ≤ 1.000 km). Auch "Neufahrzeug", "Konfigurator", "Bestellung".
- "Tageszulassung" → Erstzulassung < 14 Tage alt UND mileage < 100 km, oder explizit „Tageszulassung"/„TZ"
- "Vorführwagen" → Begriffe „Vorführwagen", „Vorführfahrzeug", „Demo" (meist < 6 Monate alt, < 10.000 km)
- "Jahreswagen" → Erstzulassung 6–18 Monate alt, mileage < 25.000 km, oder explizit „Jahreswagen"
- "Gebrauchtwagen" → Erstzulassung > 8 Monate alt UND mileage > 1.000 km (Neuwagen-Definition NICHT erfüllt) ODER „Gebrauchtwagen"/„Vorbesitzer"
WICHTIG: Wenn Erstzulassung UND mileage vorhanden sind, haben diese VORRANG vor Begriffen.
Setze IMMER vehicle.firstRegistration und vehicle.condition wenn ableitbar.

DOKUMENTTYP-ERKENNUNG:
Prüfe ZUERST, ob es sich um ein Fahrzeug-Angebot handelt (Leasing, Finanzierung, Kauf, Barkauf, Neuwagen, Gebrauchtwagen, Tageszulassung).
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
3. Leite co2Class und co2ClassDischarged IMMER aus den g/km-Werten ab. NUR A-G erlaubt, NIE A+/A++/A+++!
4. Setze isPluginHybrid=true sobald irgendein PHEV-Hinweis erkannt wird. Bei PHEV IMMER beide Werte (gewichtet + entladen) ausgeben.
5. Bestimme vehicle.condition aus Erstzulassung + Kilometerstand (siehe FAHRZEUGZUSTAND-ERKENNUNG)
6. Features: NUR Highlights (max 15-20), keine "Ohne/Kein"-Einträge, keine Trivialausstattung
7. Einheiten IMMER mit angeben (€, km, l/100km, g/km, kW, PS, cm³, kWh/100km)
8. Fehlende Werte = leerer String "", fehlende booleans = false
9. Antworte NUR mit JSON`;

// ── Helpers ──

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_prompts")
      .single();
    const overrides = data?.value as Record<string, string> | null;
    const override = overrides?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") {
      return override;
    }
  } catch (e) {
    console.warn("Could not load custom prompts, using default:", e);
  }
  return defaultPrompt;
}

async function authenticateAndDeductCredits(req: Request, actionType: string, cost: number): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await sb.auth.getClaims(token);
  const userId = data?.claims?.sub as string | undefined;
  if (error || !userId) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Deduct credits using service role client
  const serviceSb = createServiceClient();
  const { data: result, error: deductError } = await serviceSb.rpc("deduct_credits", {
    _user_id: userId,
    _amount: cost,
    _action_type: actionType,
    _description: `${actionType} (serverseitig)`,
  });

  if (deductError) {
    console.error("Credit deduction error:", deductError);
    return new Response(JSON.stringify({ error: "Credit-Fehler: " + deductError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const r = result as any;
  if (!r?.success) {
    return new Response(JSON.stringify({ 
      error: "insufficient_credits",
      balance: r?.balance || 0,
      cost: r?.cost || cost,
    }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { userId };
}

function deriveCO2Class(emissionsStr: string): string {
  const match = emissionsStr?.match(/(\d+)/);
  if (!match) return '';
  const gkm = parseInt(match[1], 10);
  if (gkm === 0) return 'A';
  if (gkm <= 95) return 'B';
  if (gkm <= 115) return 'C';
  if (gkm <= 135) return 'D';
  if (gkm <= 155) return 'E';
  if (gkm <= 175) return 'F';
  return 'G';
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Parse request – support single or multiple PDFs
    const reqBody = await req.json();
    const pdfBase64Array: string[] = reqBody.pdfBase64Array
      ? reqBody.pdfBase64Array
      : reqBody.pdfBase64
        ? [reqBody.pdfBase64]
        : [];
    if (pdfBase64Array.length === 0) throw new Error("No PDF data provided");

    const pdfCount = pdfBase64Array.length;

    // Authenticate & deduct credits (1 per PDF)
    const authResult = await authenticateAndDeductCredits(req, "pdf_analysis", pdfCount);
    if (authResult instanceof Response) return authResult;

    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // 2. Load custom prompt
    const systemPrompt = await getCustomPrompt("pdf_analysis", DEFAULT_SYSTEM_PROMPT);

    const userText = pdfCount === 1
      ? `Analysiere dieses Fahrzeug-PDF vollständig. Extrahiere ALLE verfügbaren Daten:
- Fahrzeugdaten (Marke, Modell, Variante, Farbe, Leistung, Getriebe, Baujahr)
- Finanzierung/Leasing (Rate, Laufzeit, Anzahlung, Sonderzahlung, Restwert, Preis)
- Händler (Name, Adresse, Telefon, E-Mail, Website)
- ALLE Verbrauchswerte (kombiniert, Stadt, Landstraße, Autobahn)
- CO₂-Emissionen und CO₂-Klasse (bei PHEV: BEIDE Klassen!)
- Energiekosten, Kraftstoffpreis, CO₂-Kosten, Kfz-Steuer
- Ausstattungs-HIGHLIGHTS (max 15-20, keine "Ohne"-Einträge, keine Trivialausstattung, NUR vom Hauptfahrzeug!)
- Fahrzeugbeschreibung: 2-3 verkaufsfördernde Sätze über das Fahrzeug (Marke, Modell, Motor, Highlights, Zustand)
- Bei Plug-in-Hybrid: gewichtete UND entladene Werte, Stromverbrauch, E-Reichweite

Wenn CO₂-Klasse nicht angegeben aber g/km-Wert vorhanden: Klasse ableiten!
Gib das Ergebnis als JSON zurück.`
      : `Du erhältst ${pdfCount} verschiedene PDF-Dokumente, die ALLE zum GLEICHEN Fahrzeug gehören. 
Jedes Dokument kann unterschiedliche Informationen enthalten:
- Ein PDF kann Leasing-/Finanzierungsdaten haben
- Ein anderes die Ausstattungsliste
- Ein weiteres technische Daten oder Verbrauchswerte
- Wieder ein anderes die Händlerinformationen

DEINE AUFGABE: Führe die Informationen aus ALLEN PDFs zu EINEM vollständigen Datensatz zusammen.
Wenn dasselbe Feld in mehreren PDFs vorkommt, verwende den spezifischeren/detaillierteren Wert.
Gib das Ergebnis als EIN einziges JSON-Objekt zurück.

Extrahiere:
- Fahrzeugdaten (Marke, Modell, Variante, Farbe, Leistung, Getriebe, Baujahr)
- Finanzierung/Leasing (Rate, Laufzeit, Anzahlung, Sonderzahlung, Restwert, Preis)
- Händler (Name, Adresse, Telefon, E-Mail, Website)
- ALLE Verbrauchswerte (kombiniert, Stadt, Landstraße, Autobahn)
- CO₂-Emissionen und CO₂-Klasse (bei PHEV: BEIDE Klassen!)
- Energiekosten, Kraftstoffpreis, CO₂-Kosten, Kfz-Steuer
- Ausstattungs-HIGHLIGHTS (max 15-20, keine "Ohne"-Einträge, keine Trivialausstattung)
- Fahrzeugbeschreibung: 2-3 verkaufsfördernde Sätze über das Fahrzeug
- Bei Plug-in-Hybrid: gewichtete UND entladene Werte, Stromverbrauch, E-Reichweite

Wenn CO₂-Klasse nicht angegeben aber g/km-Wert vorhanden: Klasse ableiten!
Gib das Ergebnis als JSON zurück.`;

    // Build content parts: text + all PDFs
    const contentParts: any[] = [{ text: userText }];
    for (let i = 0; i < pdfBase64Array.length; i++) {
      if (pdfCount > 1) {
        contentParts.push({ text: `--- PDF-Dokument ${i + 1} von ${pdfCount} ---` });
      }
      contentParts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64Array[i] } });
    }

    // 3. Call Gemini API
    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    console.log(`[analyze-pdf] Calling Gemini API with ${pdfCount} PDF(s)...`);
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: contentParts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es später erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("[analyze-pdf] Raw response length:", content.length);
    console.log("[analyze-pdf] First 500 chars:", content.substring(0, 500));
    
    // Clean markdown wrappers if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    if (!content) {
      console.error("[analyze-pdf] Empty response from Gemini. Full response:", JSON.stringify(data).substring(0, 1000));
      throw new Error("Leere Antwort von der KI erhalten");
    }
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error("[analyze-pdf] JSON parse error:", parseErr, "Content:", content.substring(0, 500));
      throw new Error("KI-Antwort konnte nicht verarbeitet werden");
    }
    
    console.log("[analyze-pdf] Parsed keys:", Object.keys(parsed));
    console.log("[analyze-pdf] Vehicle:", parsed.vehicle?.brand, parsed.vehicle?.model);
    console.log("[analyze-pdf] Finance totalPrice:", parsed.finance?.totalPrice);

    // === DOCUMENT TYPE CHECK ===
    if (parsed.isVehicleOffer === false) {
      return new Response(JSON.stringify({ 
        error: "not_vehicle_offer",
        documentType: parsed.documentType || 'unbekanntes Dokument',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === CATEGORY NORMALIZATION ===
    const VALID_CATEGORIES = ['Leasing', 'Finanzierung', 'Barkauf', 'Neuwagen', 'Gebrauchtwagen', 'Tageszulassung'];
    const rawCat = (parsed.category || '').toLowerCase().trim();
    const categoryMap: Record<string, string> = {
      'leasing': 'Leasing', 'finanzierung': 'Finanzierung', 'kredit': 'Finanzierung',
      'barkauf': 'Barkauf', 'kauf': 'Barkauf', 'direktkauf': 'Barkauf',
      'neuwagen': 'Neuwagen', 'neufahrzeug': 'Neuwagen',
      'gebrauchtwagen': 'Gebrauchtwagen', 'gebraucht': 'Gebrauchtwagen',
      'tageszulassung': 'Tageszulassung',
    };
    parsed.category = categoryMap[rawCat] || VALID_CATEGORIES.find(c => rawCat.includes(c.toLowerCase())) || parsed.category || 'Barkauf';
    console.log("[analyze-pdf] Detected category:", parsed.category);

    // === POST-PROCESSING ===
    if (!parsed.consumption) parsed.consumption = {};
    const c = parsed.consumption;

    const stringFields = [
      'origin', 'mileage', 'displacement', 'power', 'driveType', 'fuelType',
      'consumptionCombined', 'co2Emissions', 'co2Class',
      'consumptionCity', 'consumptionSuburban', 'consumptionRural', 'consumptionHighway',
      'energyCostPerYear', 'fuelPrice', 'co2CostMedium', 'co2CostLow', 'co2CostHigh',
      'vehicleTax', 'co2EmissionsDischarged', 'co2ClassDischarged',
      'consumptionCombinedDischarged', 'electricRange', 'consumptionElectric',
    ];
    for (const f of stringFields) { c[f] = c[f] || ''; }
    c.isPluginHybrid = c.isPluginHybrid || false;

    // Auto-detect PHEV
    const dtLower = (c.driveType || '').toLowerCase();
    const ftLower = (c.fuelType || '').toLowerCase();
    const vftLower = (parsed.vehicle?.fuelType || '').toLowerCase();
    if (!c.isPluginHybrid) {
      if (dtLower.includes('plug') || dtLower.includes('phev') ||
          ftLower.includes('plug') || ftLower.includes('phev') ||
          vftLower.includes('plug-in') || vftLower === 'plug-in-hybrid' ||
          (ftLower.includes('strom') && (ftLower.includes('benzin') || ftLower.includes('diesel'))) ||
          c.co2EmissionsDischarged || c.consumptionCombinedDischarged) {
        c.isPluginHybrid = true;
      }
    }

    // Auto-derive CO₂ classes (NUR A-G, alle Plus-Klassen verwerfen!)
    const isValidCO2Class = (v: string) => /^[A-G]$/i.test((v || '').trim());
    if (!isValidCO2Class(c.co2Class) && c.co2Emissions) c.co2Class = deriveCO2Class(c.co2Emissions);
    else if (c.co2Class) c.co2Class = c.co2Class.trim().toUpperCase().replace(/\+/g, '').slice(0, 1);
    if (!isValidCO2Class(c.co2ClassDischarged) && c.co2EmissionsDischarged) c.co2ClassDischarged = deriveCO2Class(c.co2EmissionsDischarged);
    else if (c.co2ClassDischarged) c.co2ClassDischarged = c.co2ClassDischarged.trim().toUpperCase().replace(/\+/g, '').slice(0, 1);

    // Auto-derive vehicle.condition aus Erstzulassung + Kilometerstand (Pkw-EnVKV)
    if (parsed.vehicle && !parsed.vehicle.condition) {
      const fr = String(parsed.vehicle.firstRegistration || '').trim();
      const kmMatch = String(c.mileage || '').match(/([\d.,]+)/);
      const km = kmMatch ? parseInt(kmMatch[1].replace(/[.,]/g, ''), 10) : NaN;
      let monthsOld = NaN;
      const dateMatch = fr.match(/(\d{1,2})[./](\d{4})|(\d{1,2})[./](\d{1,2})[./](\d{4})/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1] || dateMatch[3] || '1', 10);
        const year = parseInt(dateMatch[2] || dateMatch[5] || '0', 10);
        if (year > 1990) {
          const now = new Date();
          monthsOld = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
        }
      }
      if (!fr || (!isNaN(km) && km < 50 && isNaN(monthsOld))) {
        parsed.vehicle.condition = 'Neuwagen';
      } else if (!isNaN(monthsOld) && monthsOld <= 1 && !isNaN(km) && km < 100) {
        parsed.vehicle.condition = 'Tageszulassung';
      } else if (!isNaN(monthsOld) && monthsOld <= 18 && !isNaN(km) && km < 25000) {
        parsed.vehicle.condition = 'Jahreswagen';
      } else {
        parsed.vehicle.condition = 'Gebrauchtwagen';
      }
    }

    // Copy power/fuelType from vehicle to consumption if missing
    if (!c.power && parsed.vehicle?.power) c.power = parsed.vehicle.power;
    if (!c.fuelType && parsed.vehicle?.fuelType) c.fuelType = parsed.vehicle.fuelType;

    // ── AUTO-LOOKUP: Hubraum + EnVKV wenn nicht im PDF ──
    const brand = parsed.vehicle?.brand || '';
    const model = parsed.vehicle?.model || '';
    const variant = parsed.vehicle?.variant || '';
    const vehiclePower = c.power || parsed.vehicle?.power || '';
    const vehicleFuelType = c.fuelType || parsed.vehicle?.fuelType || '';
    const vehicleYear = parsed.vehicle?.year || '';

    const needsDisplacement = !c.displacement || c.displacement.trim() === '';
    const needsEnergyCost = !c.energyCostPerYear || c.energyCostPerYear.trim() === '';
    const needsTax = !c.vehicleTax || c.vehicleTax.trim() === '';
    const needsCo2Costs = !c.co2CostMedium || c.co2CostMedium.trim() === '';

    if (brand && model && (needsDisplacement || needsEnergyCost || needsTax || needsCo2Costs)) {
      console.log("[analyze-pdf] Auto-lookup needed. Displacement missing:", needsDisplacement);
      try {
        const lookupPrompt = `Du bist eine technische Fahrzeugdatenbank. Ermittle die fehlenden technischen Daten für folgendes Fahrzeug:

Marke: ${brand}
Modell: ${model}
Variante: ${variant}
Leistung: ${vehiclePower}
Kraftstoff: ${vehicleFuelType}
Baujahr: ${vehicleYear}

Bereits bekannte Daten:
- Hubraum: ${c.displacement || 'UNBEKANNT'}
- CO₂ kombiniert: ${c.co2Emissions || 'UNBEKANNT'}
- Verbrauch kombiniert: ${c.consumptionCombined || 'UNBEKANNT'}

Antworte NUR mit JSON:
{
  "displacement": "string (Hubraum in cm³, z.B. '1.998 cm³' - NUR angeben wenn oben UNBEKANNT)",
  "co2Emissions": "string (CO₂ g/km WLTP falls oben UNBEKANNT)",
  "consumptionCombined": "string (l/100km WLTP falls oben UNBEKANNT)",
  "vehicleTax": "number (Kfz-Steuer pro Jahr in Euro, berechne basierend auf Hubraum + CO₂ + Antrieb + Jahr)",
  "energyCostPerYear": "number (Energiekosten pro Jahr in Euro bei 15.000 km/Jahr)",
  "co2CostLow": "number (CO₂-Kosten niedrig über 10 Jahre bei 55€/t, 15.000 km/Jahr)",
  "co2CostMedium": "number (CO₂-Kosten mittel über 10 Jahre bei 115€/t, 15.000 km/Jahr)",
  "co2CostHigh": "number (CO₂-Kosten hoch über 10 Jahre bei 190€/t, 15.000 km/Jahr)"
}

Berechne die Kosten mit diesen Formeln:
- Energiekosten = Verbrauch/100 × 15.000 × Kraftstoffpreis (Benzin: 1,80€/l, Diesel: 1,70€/l, Strom: 0,35€/kWh)
- CO₂-Kosten = CO₂_g/km × 15.000/1000 × Preis_pro_Tonne/1000 × 10 Jahre
- Kfz-Steuer für PKW ab 2021: Hubraum-Anteil (Benzin: 2€ je 100cm³, Diesel: 9,50€ je 100cm³) + CO₂-Stufen ab 95 g/km

Wenn du den genauen Hubraum nicht kennst, schätze ihn anhand des Modellnamens und der Leistung.
Antworte NUR mit JSON, keine Erklärungen.`;

        const lookupResp = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: lookupPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        });

        if (lookupResp.ok) {
          const lookupData = await lookupResp.json();
          let lookupContent = lookupData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          lookupContent = lookupContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          
          if (lookupContent) {
            const lookup = JSON.parse(lookupContent);
            console.log("[analyze-pdf] Lookup result:", JSON.stringify(lookup));

            // Fill displacement if missing
            if (needsDisplacement && lookup.displacement) {
              c.displacement = lookup.displacement;
              console.log("[analyze-pdf] Auto-filled displacement:", c.displacement);
            }

            // Fill CO₂ if missing
            if ((!c.co2Emissions || c.co2Emissions.trim() === '') && lookup.co2Emissions) {
              c.co2Emissions = lookup.co2Emissions;
              if (!c.co2Class) c.co2Class = deriveCO2Class(c.co2Emissions);
            }

            // Fill consumption if missing
            if ((!c.consumptionCombined || c.consumptionCombined.trim() === '') && lookup.consumptionCombined) {
              c.consumptionCombined = lookup.consumptionCombined;
            }

            // Fill EnVKV cost fields if missing
            if (needsTax && lookup.vehicleTax) {
              const taxVal = typeof lookup.vehicleTax === 'number' ? lookup.vehicleTax : parseFloat(lookup.vehicleTax);
              if (taxVal > 0) c.vehicleTax = `${Math.round(taxVal).toLocaleString('de-DE')} €/Jahr`;
            }

            if (needsEnergyCost && lookup.energyCostPerYear) {
              const ecVal = typeof lookup.energyCostPerYear === 'number' ? lookup.energyCostPerYear : parseFloat(lookup.energyCostPerYear);
              if (ecVal > 0) c.energyCostPerYear = `${Math.round(ecVal).toLocaleString('de-DE')} €`;
            }

            if (needsCo2Costs) {
              const fmt = (v: any) => {
                const n = typeof v === 'number' ? v : parseFloat(v);
                return n > 0 ? `${Math.round(n).toLocaleString('de-DE')} €` : '';
              };
              if (lookup.co2CostLow) c.co2CostLow = fmt(lookup.co2CostLow);
              if (lookup.co2CostMedium) c.co2CostMedium = fmt(lookup.co2CostMedium);
              if (lookup.co2CostHigh) c.co2CostHigh = fmt(lookup.co2CostHigh);
            }
          }
        }
      } catch (lookupErr) {
        console.warn("[analyze-pdf] Auto-lookup failed (non-critical):", lookupErr);
        // Non-critical: continue without lookup data
      }
    }

    // Ensure arrays/objects exist
    if (parsed.vehicle && !Array.isArray(parsed.vehicle.features)) parsed.vehicle.features = [];

    // Post-process features: remove "Ohne/Kein" entries, duplicates, trivial items, limit to 20
    if (parsed.vehicle?.features?.length) {
      const trivialKeywords = [
        'warndreieck', 'verbandskasten', 'bordwerkzeug', 'wagenheber',
        'reifenreparaturset', 'pannenset', 'abschlepphaken', 'fußmatte',
        'fussmatten', 'fußmatten', 'gummimatte', 'gummimatten',
        'erste-hilfe', 'warnweste',
      ];
      const seen = new Set<string>();
      parsed.vehicle.features = parsed.vehicle.features
        .filter((f: string) => {
          if (!f || typeof f !== 'string') return false;
          const lower = f.trim().toLowerCase();
          // Remove "Ohne..." and "Kein..." entries
          if (lower.startsWith('ohne ') || lower.startsWith('kein ') || lower.startsWith('keine ')) return false;
          // Remove trivial items
          if (trivialKeywords.some(kw => lower.includes(kw))) return false;
          // Remove duplicates (case-insensitive)
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        })
        .slice(0, 20);
    }
    if (!parsed.finance) parsed.finance = {};
    for (const f of ['monthlyRate', 'downPayment', 'duration', 'totalPrice', 'annualMileage', 'specialPayment', 'residualValue', 'interestRate']) {
      parsed.finance[f] = parsed.finance[f] || '';
    }
    if (!parsed.dealer) parsed.dealer = {};
    for (const f of ['name', 'address', 'phone', 'email', 'website']) {
      parsed.dealer[f] = parsed.dealer[f] || '';
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
