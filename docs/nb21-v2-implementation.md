# NB21 V2 — Implementierung und Prüfstand

## Abgrenzung
- Neue Aufnahme-/Pipeline-Läufe mit `nb21` verwenden `nb21-v2`.
- Die fünf V1-Promptmodule bleiben SHA-256-identisch. Unversionierte historische NB21-Kontexte bleiben V1; explizite V1-Kontexte reproduzieren V1.
- Nicht-NB21-Promptbuilder, Modellrouting und 2.0-Admin-Overrides bleiben unverändert.
- Keine kostenpflichtigen Bildanfragen und kein Funktions-/Website-Deployment ausgeführt. Nullable Versions-/Telemetriespalten wurden additiv angewendet.

## V2-Architektur
1. Explizite Quellenobjekte tragen `sourceId`, `sourceType`, `sourceRole`, Bild und optional dauerhafte `assetId`.
2. Der gemeinsame, reine Resolver wählt vor Upload und Promptbau zielabhängige Originalbelege. Fehlende notwendige Originalrollen brechen ab; Kontext ersetzt sie nie.
3. Tier A = Original; Tier B = bereichsgebundenes Asset; Tier C = generierter Look-/Umgebungskontext.
4. Referenzbudget: lokale und Innenraumjobs meist drei, Seite/Heck vier, Front fünf, Edit sechs. Aktivierte Assets erhalten begrenztes Zusatzbudget; maximal acht Bilder. Originalbelege werden vor allen Assets/Kontext gewählt.
5. Neun strukturierte Abschnitte; Edit- und View-Synthesis-Contracts getrennt. Kritische lokale Regeln werden eigenständig formuliert, nicht aus 2.0-Prompts extrahiert.
6. Ein gemeinsames geordnetes Manifest bestimmt Bilder, Rollen, Gemini File-URI, Inline-Fallback und OpenAI-File-Zuordnung. NB21 bleibt Gemini: vorhandene OpenAI-Dateien werden nur mit denselben mitgelieferten Bytes materialisiert, nicht über beliebige private Workspace-Dateiabrufe.
7. Servervalidierung rekonstruiert dieselbe Job-Policy, prüft Autorität/Reihenfolge/Version/Abschnitte und baut den Rollenabschnitt aus dem validierten Manifest.
8. `project_images.generation_context` erhält Version/Job bzw. Edit-Slot und Quellenprovenienz pro Ergebnis. Die vorhandenen Versuchsdaten speichern ungekürzte `reference_manifest` und `transport_manifest` mit tatsächlicher Versandposition und File-ID oder Hash dekodierter Inline-Bildbytes, niemals Base64.

## Die sechs kritischen Referenzsets
Bei vorhandenen passenden Originals und ohne aktivierte Marken-/Kennzeichenassets:

| Job | Reihenfolge / Autorität |
|---|---|
| Elevated Front | Original `front`, bevorzugt zusätzlich Original `frontpanel`/`grille`/`headlight`, gegebenenfalls linke Seitengeometrie; höchstens ein Umgebungskontext |
| Frontpanel | Original `frontpanel`/`grille`/`front-panel`, sonst geeignetes Frontoriginal; höchstens ein weiteres Front-Geometrieoriginal und ein Kontext |
| Kofferraum | Original `cargo`/`boot`/`open-boot`/`cargo-area` + eigenständiger originaler Heckbeleg; höchstens ein Kontext; ohne Cargo- oder Heckbeleg Abbruch |
| Lenkrad | Original `steering`/`steering-wheel`, sonst zugeordnetes Cockpitoriginal; optional separates Cockpit-Geometrieoriginal + Kontext; keine Außen-/Felgenautorität |
| Instrumente | Original `cluster`/`instrument-cluster`, gegebenenfalls Lenkrad-/Cockpitoriginal; optional separates Cockpit-Geometrieoriginal + Kontext; keine Außen-/Felgenautorität |
| Rücksitze | Original `interior-rear`/`rear-seats`; Frontcockpit nur unterstützend; höchstens ein Kontext |

„Passendes Front-/Cockpitoriginal“ heißt explizit zugeordnete Rolle, nicht automatisch erkannte Detail-Sichtbarkeit. Der Resolver führt keine neue Bildanalyse durch.

## Geänderte/neue Dateien
- `src/prompts/nb21/v2/{builder,index}.ts`
- `supabase/functions/_shared/nb21-v2-{contract,wire}.ts`
- `src/lib/nb21-v2-{invoke,originals}.ts`
- `src/lib/{remaster-invoke,regeneration-context}.ts`
- `src/components/{ImageCaptureGrid,PipelineRunner,GalleryLightbox}.tsx`
- `src/contexts/PipelineContext.tsx`
- `supabase/functions/remaster-vehicle-image/index.ts`
- `src/test/nb21-v2.test.ts`, `src/test/nb21-v2-invoke.test.ts`
- `drizzle/migrations/0014_nb21_v2_result_version_and_reference_telemetry.sql`, automatisch aktualisierte Typen
- `AGENTS.md`, `src/prompts/AGENTS.md`, `roadmap.md`, dieses Dokument

## Verbleibende Grenzen
- V2-Pipeline-Start prüft alle ausgewählten Jobs mit derselben Evidence-Policy. Fehlende Rollen blockieren den Start; echte Detailoriginale können explizit zugeordnet oder betroffene Jobs bewusst abgewählt werden. Auswahl und Bild-/Kostenanzahl bleiben synchron. Diese Prüfung beurteilt Rollen, nicht den tatsächlichen Bildinhalt.
- Jede gestartete V2-Pipeline besitzt einen eigenen Asset-/Source-ID-Cache inklusive paralleler Jobs und Wiederholungen. Vorhandene Gemini File URIs werden bevorzugt, erfolgreiche Uploads wiederverwendet; abweichende Bilddaten unter derselben ID werden abgelehnt. Separate Runs und einzelne Galerie-Neugenerierungen besitzen getrennte Caches. Ein fehlgeschlagener Upload bleibt für den Run beim bestehenden Inline-Fallback.
- Der gemeinsame kompakte V2-Subject-Class-Lock steht im Identitätsabschnitt. Der Server ersetzt Clientangaben durch den normalisierten Klassenkontext, einschließlich Wohnwagen, Reisemobil-Aufbau und Lkw-Scope. Originalbelege haben stets Vorrang vor Modell-/Markenwissen; keine alten Großblöcke werden für V2 angehängt.
- Alte V1-/2.0-Pfade behalten bewusst historische Positions-/Index-Fallbacks (`PipelineContext`, `regeneration-seed`, Labels gespeicherter Inputs). V2 benutzt diese nicht als Fahrzeugautorität.
- Die Auto3-Vorbelegung ohne gespeicherte Auswahl hat weiterhin eine historische Reihenfolgezuordnung zu Kacheln. V2 folgt danach den sichtbaren Slotrollen; eine automatische Prüfung des tatsächlichen Fotoinhalts ist nicht enthalten.
- Alte Detailbilder ohne Rolle bleiben unzugeordnet; V2 rät keine Cargo-/Innenraum-/Spezialteilrolle. Neue NB21-Detailuploads können explizit zugeordnet werden.
- Wenn ein neuer V2-Lauf einen Fahrzeugkontext überschrieben hat und ein älteres Bild keine eigene gespeicherte Version besitzt, wird Regeneration gesperrt statt auf V2 zu wechseln. Verlorene historische Lookdaten lassen sich nicht rekonstruieren.
- Mehr Originalbelege und strukturierte Prompts garantieren keine perfekte Modelltreue. Bildqualität und echte Anbieter-/Telemetriespeicherung bleiben bis zur ausdrücklich freigegebenen Live-Prüfung unbestätigt.
- Nur Typ-/Serverprüfung, deterministische und gemockte Aufruftests sowie kostenfreie Vorschauprüfung; kein Qualitätsvergleich neu generierter Bilder.