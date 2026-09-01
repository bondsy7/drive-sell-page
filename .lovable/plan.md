# Strict-Reference-Remastering: Analyse und Zielarchitektur

Analyse der bestehenden Remastering-Kette (keine Codeänderung durchgeführt). Alle Aussagen sind an konkreten Stellen belegt.

## 1) Wo widersprüchliche Signale entstehen

**a) Marken-/Modelltext gelangt über mehrere Kanäle in den Prompt**
- `src/components/OneShotStudio.tsx:858` übergibt `"${brand} ${model} ${variant}"` an `buildMasterPrompt`.
- `OneShotStudio.tsx:904` und `:958` bauen den `vehicleDescription`-String ein zweites und drittes Mal – mit leicht anderem Inhalt (mal mit, mal ohne Modelljahr).
- `PipelineContext.tsx:296-302` baut den Prompt pro Job erneut, `:379` sendet zusätzlich die **rohe** `vehicleDescription` an die Edge Function.

**b) Zwei parallele, handgepflegte Sanitizer**
- Client: `src/lib/vehicle-generation-lock.ts:8-93` (BRAND_TOKENS, `sanitizeVehicleDescriptionForPrompt`, `buildVehicleGenerationLock`).
- Server: `supabase/functions/remaster-vehicle-image/index.ts:97-168` – nahezu identische Kopie. Der Lock wird serverseitig bei **jedem** Request nochmals angehängt (`index.ts:439-440`) und ein drittes Mal als `postReferenceGenerationGuard` (`index.ts:639-653`).
- Folge: dieselbe Redaktionslogik läuft doppelt, mit zwei Token-Listen, die auseinanderlaufen können.

**c) Lücken der Redaktion**
- `sanitizeVehicleDescriptionForPrompt` entfernt nur „Markentoken + 1 Folgetoken" (`vehicle-generation-lock.ts:38-39`). Mehrwort-Trims („AMG Line Sport", „R-Design Plus") überleben teilweise.
- Trotz Redaktion wird das **Modelljahr** als „Neutral context only: Modelljahr YYYY" wieder eingespielt (`vehicle-generation-lock.ts:63,84`) – genau der Trigger für Katalogabruf nach Baujahr.

**d) Inhaltliche Widersprüche im Prompt**
- „Marke/Modell sind DELIBERATELY WITHHELD" (`vehicle-generation-lock.ts:82-93`) steht direkt neben dem angehängten **Herstellerlogo-Bild** mit „PIXEL-PERFECT REPRODUCTION, HIGHEST PRIORITY" (`remaster-prompt.ts:296-305`, `index.ts:683-697`). Das Logo verrät dem Modell die Marke visuell – die textliche Anonymisierung ist damit wirkungslos.
- Fünf bis sechs Blöcke beanspruchen gleichzeitig „highest priority": Hauptbild (`PRIMARY_BLUEPRINT_LOCK`), Felgenreferenz (`remaster-prompt.ts:243-244`), Herstellerlogo (`index.ts:684`), Custom-Showroom („IMMUTABLE BASE SCENE", `index.ts:489-533`), `REFLECTION_PURGE` („higher priority than preserving the reference", `remaster-prompt.ts:427`). Es gibt keine explizite Arbitrierung.
- Der `REFLECTION_PURGE`-Block und `TRACTOR_TRAILER_SEPARATION` (`remaster-prompt.ts:510`) erklären sich selbst zu Ausnahmen vom Reference-Truth-Protokoll – das relativiert die Kernregel.
- Server-Fallback `buildFallbackPrompt` (`index.ts:24-204`) ist ein deutlich schwächerer Teil-Prompt (ohne mirror_system_lock, scene_lighting, interior_rules, license_plate) und greift lautlos, wenn `dynamicPrompt` fehlt (`index.ts:425`).

**e) Marken-/modellspezifische Sonderregel**
- Der Škoda-Enyaq-Facelift-Guard existiert doppelt (`vehicle-generation-lock.ts:65-79`, `index.ts:144-156`) plus fokussierte Wiederholung (`index.ts:647-653`). Er ist die einzige echte Modell-Sonderregel und skaliert nicht.

## 2) Warum das Modell trotzdem driftet

- **Textprior schlägt Bildprior:** Sobald irgendein Signal (Logobild, Modelljahr, Resttrim, Szenenkontext) die Marke identifizierbar macht, aktiviert das Bildmodell seinen Katalogprior. Der ist statistisch dicht (tausende Trainingsbilder der verbreiteten Vor-Facelift-Version) und schlägt einen einzelnen Referenz-Foto-Kontext.
- **Verdünnung durch Promptlänge:** Der finale Prompt enthält >15 XML-Blöcke; die Identitätsregel steht dreimal, konkurriert aber mit hunderten Zeilen Lighting-, Reflection-, Scene- und Logo-Anweisungen. Bei zu vielen konkurrierenden „highest priority"-Regeln sinkt die effektive Gewichtung jeder einzelnen.
- **Konfliktsignal Logo:** Das Logo lädt exakt den Markenprior, den der Generation-Lock unterdrücken will.
- **Referenzverdünnung:** Bis zu 10 zusätzliche Bilder (`index.ts:629`), bei OpenAI bis 16 (`index.ts:857`). Je mehr gleichrangige Bilder, desto schwächer die Front-/Seitenwahrheit des einen entscheidenden Fotos.
- **Neubau statt Bearbeitung:** `REFLECTION_PURGE` verlangt das vollständige Neu-Rendern von Lack, Glas, Chrom und Licht. Wer neu rendert, rekonstruiert Geometrie aus dem Prior – dabei kippen Grill, Scheinwerfer und Schürze auf die „bekannte" Version.
- **Keine Durchsetzung:** Es existiert keine Ausgangsprüfung für Generation/Facelift. Der Name `postReferenceGenerationGuard` (`index.ts:639`) suggeriert eine Prüfung, ist aber nur weiterer Prompttext.

## 3) Generische Zielarchitektur statt Sonderregeln

1. **Ein einziger Sanitizer als geteilte Quelle** (`supabase/functions/_shared/`), von Client und Edge Function importiert. Keine zweite Token-Liste.
2. **Server-seitige Redaktion als einzige Instanz.** Der Client sendet strukturierte Felder, nicht fertige Freitextstrings; die Edge Function entscheidet allein, was in den Prompt gelangt.
3. **Strict-Reference-Modus als Default:** kein Modelljahr, kein Trim, kein Freitext – nur neutrale, physikalisch beschreibende Felder (siehe Punkt 4).
4. **Herstellerlogo entkoppeln:** Logo nur noch als *Umgebungs-Asset* deklarieren („Wandpanel, gehört nicht zum Fahrzeug, verrät keine Fahrzeuggeneration") oder bei Strict-Reference standardmäßig deaktivieren. Kein „HIGHEST PRIORITY" mehr für das Logo.
5. **Explizite Prioritätshierarchie** statt paralleler Superlative, ein einziger Block, z. B.: (1) Fahrzeuggeometrie/Identität aus Hauptreferenz, (2) Felgenreferenz nur für Räder, (3) Szene/Licht/Reflexion, (4) Assets (Logo/Kennzeichen). Alle anderen Blöcke verweisen nur noch darauf.
6. **Enyaq-Guard durch generische Regel ersetzen:** „Frontfläche zwischen den Leuchten ist so zu übernehmen, wie sie im Referenzbild erscheint – geschlossen bleibt geschlossen, offen bleibt offen; niemals Lamellen, Gitter oder Öffnungen hinzufügen, die nicht sichtbar sind." Gilt für jede Marke.
7. **Referenzbudget begrenzen:** genau eine perspektivgleiche Primärreferenz + max. 2–3 gezielte Detailreferenzen pro Job, statt bis zu 10/16.
8. **Fallback-Prompt entfernen** oder mit dem echten Blockregister vereinheitlichen, damit es keinen schwächeren Zweitpfad gibt.

## 4) Welche Felder im Strict-Reference-Modus überhaupt gesendet werden sollten

**Erlaubt (rein visuell/physikalisch, keine Katalogidentität):**
- Fahrzeugklasse (`car` / `truck` / `motorcycle`) und Innen/Außen-Slot
- Perspektivrolle des Bildes (Front, 3/4 links, Seite rechts, Heck, Fahrersitz …)
- Zielszene, Beleuchtungsprofil, Bildformat
- Explizite Nutzerwünsche: Farbwechsel-Hex, Kennzeichenoption, spezifische Bereinigung
- Aufbau-/Konfigurationsdaten bei Lkw (Achsen, Aufbautyp, Ladezustand)

**Nicht senden:**
- Marke, Modell, Baureihe, Trim/Ausstattungslinie
- Modelljahr / Generation / Facelift-Bezeichnung
- Fahrzeugtitel, PDF-Titel, Anzeigenüberschrift, VIN-abgeleiteter Klartext
- „Neutral context only"-Reststring in jeglicher Form

**Ausschließlich für Nicht-Bild-Zwecke behalten:** Marke/Modell dürfen weiterhin für Logo-Auswahl, DB, Galerie und API genutzt werden – aber nie in den Bildprompt gelangen.

## 5) Nachgelagerte visuelle Identitätsprüfung

Vorbild ist der bereits existierende, aber nur beratende Felgencheck (`index.ts:1033-1072`): zweiter Gemini-Call, JSON-Antwort, kein Enforcement.

Zielbild einer generischen Identitätsprüfung:
- **Eingabe:** Originalreferenz (gleiche Perspektive) + generiertes Bild, kein Marken-/Modelltext.
- **Merkmalsraster statt Freitext**, je Merkmal Score 0–100: Frontfläche (geschlossen/offen, Lamellenanzahl), Scheinwerferkontur + LED-Signatur, Stoßfängeröffnungen, Heckleuchtensignatur, Fensterlinie/Dachlinie, Radhausform, Felgendesign, Lenkrad/Cockpit bei Interieur.
- **Gate:** identitätskritische Merkmale (Front, Leuchten, Seitenlinie) ≥ 90, sekundäre ≥ 85, Confidence ≥ 85 – analog zur bereits etablierten Spin360-V2-QA-Schwelle.
- **Repair-Loop:** bei Fail genau ein gezielter Re-Run mit einer aus dem Prüfergebnis erzeugten Korrekturanweisung („die generierte Frontfläche zeigt vertikale Lamellen, das Referenzbild zeigt eine geschlossene Fläche") plus reduziertem Referenzset (nur Primärbild).
- **Telemetrie:** Scores in `reference_metadata` persistieren, damit Driftquoten pro Szene/Tier messbar werden.
- **UI:** Ergebnis sichtbar machen („Identität geprüft" / „Prüfung nötig"), statt wie beim Felgencheck stillschweigend zu verwerfen.

## Nächster Schritt

Diese Analyse enthält bewusst keine Codeänderung. Auf Wunsch setze ich sie in Ausbaustufen um: (A) geteilter Sanitizer + Strict-Reference-Felder, (B) Prioritätshierarchie + Entfernung der Enyaq-Sonderregel, (C) visuelle Identitätsprüfung mit Repair-Loop.
