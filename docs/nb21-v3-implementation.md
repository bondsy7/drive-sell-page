# NB21 V3 – Implementierungs- und Prüfbericht

## Status

V3 ist eine **explizit auswählbare Testversion** im vorhandenen NB21-Pipeline-Dialog. `NB21_CURRENT_VERSION` bleibt V2, historische unversionierte NB21-Läufe bleiben V1. Keine Bereitstellung, keine echte Bildgenerierung, keine Preis-/Creditänderung.

## Dateien

Neu:
- `supabase/functions/_shared/nb21-v3-contract.ts`: eigenständige Job-/View-Policies, Resolver, Wire-Guard, Quellenprovenienz und Retry-Schema.
- `supabase/functions/_shared/nb21-v3-lighting.ts`: unveränderliches, servervalidiertes Serien-Lichtprofil mit Version und SHA-256-Hash.
- `supabase/functions/_shared/nb21-v3-prompt.ts`: serverseitig neu aufgebaute Sichtflächen-, Identitäts-, Klassen- und Relighting-Abschnitte.
- `src/prompts/nb21/v3/{builder,index}.ts`: V3-Prompt und ausschließlich vorbereiteter Harmonize-only-Builder.
- `src/lib/nb21-{version-dispatch,v3-preflight,v3-invoke}.ts`: Versionsdispatch, Startprüfung und V3-Dispatch mit bestehendem run-scoped Uploadcache.
- `src/test/nb21-v3{,-invoke,-preflight-ui}.test.ts[x]`: Verträge, Upload-/Dispatch- und UI-Integrationstests.

Additiv integriert:
- `src/components/PipelineRunner.tsx`: V3-Auswahl, Startprüfung, Profilerzeugung.
- `src/components/Nb21V2ReferenceCheck.tsx`: V3-Seitenwarnungen, Zuordnung und Abwahl.
- `src/components/GalleryLightbox.tsx`: versionsgenaue V3-Regeneration und manueller Korrekturgrund.
- `src/contexts/PipelineContext.tsx`: V3-Start/Jobs/Retry und Ergebnisprovenienz.
- `src/lib/{remaster-invoke,regeneration-context}.ts`: V3-Payload und historische Metadaten.
- `supabase/functions/remaster-vehicle-image/index.ts`: additive V3-Validierung, Promptdurchsetzung und Telemetrie.
- `AGENTS.md`, `roadmap.md`: Architekturregel und Aufgabenstatus.

V1/V2-Builder, V2-Contract/Wire/Class und bestehende 2.0-Jobdefinitionen wurden nicht überschrieben.

## Sechs harte View-Contracts

| Contract | Sichtbare Flächen | Zwingende Originalrollen |
|---|---|---|
| side-left | physische linke Seite | linke Seite |
| side-right | physische rechte Seite | rechte Seite |
| 34-front-left | Front + linke Seite | Front + linke Seite |
| 34-front-right | Front + rechte Seite | Front + rechte Seite |
| 34-rear-left | Heck + linke Seite | Heck + linke Seite |
| 34-rear-right | Heck + rechte Seite | Heck + rechte Seite |

Historische Rollen `side`/`side-left` sind links, `side-right` rechts. Ein 3/4-Frontoriginal belegt die Front, ersetzt aber **nicht** das separate benötigte Seitenoriginal. Die Originalprüfung beruht auf expliziten Rollen, nicht auf neu erfundener Bildklassifizierung. Falsch deklarierte oder unzureichend sichtbare Originale lassen sich damit nicht visuell erkennen.

Reale Keys wie `EXT_SIDE_LEFT/RIGHT`, `EXT_34_FRONT_RIGHT`, `EXT_34_REAR_LEFT/RIGHT` sowie `CI_VOLVO_34_FRONT_LEFT/RIGHT` und `CI_VOLVO_34_REAR_LEFT/RIGHT` werden den passenden Contracts zugeordnet. `CI_VOLVO_SIDE` ist ausdrücklich **rechts**, entsprechend dem realen Pipeline-Prompt `Right Side Profile`; die widersprüchliche historische V2-Seitenlogik bleibt unverändert.

Opposite-side Mirroring, Marken-/Modellwissen und generierte Geometrie sind verbotene Ersatzautoritäten. Assets dürfen ausschließlich ihren eigenen Bereich bestimmen; Umgebung ist niemals Fahrzeugautorität. Fehlende Pflichtrollen blockieren Start und Job. Unbekannte Ansichten/Composites ohne expliziten Vertrag werden ebenfalls blockiert, nicht generisch ergänzt.

## Serienlicht

`PipelineRunner` erzeugt einmal vor Start ein Profil mit Run-ID; `PipelineContext` übernimmt eine unveränderliche Kopie. Jeder V3-Job und jeder Retry nutzt denselben Hash und dieselbe Version `nb21-v3-lighting-1`. Die Serverfunktion validiert Profilinhalt/Hash und baut den Lichtabschnitt aus diesem Profil neu auf.

Das Profil legt 5500 K, neutrale Mitteltöne, moderaten Kontrast, geschützte Highlights, weiches festes Key-/Fill-Licht und kontrollierte Reflexionshärte/-intensität fest. Originalbelichtung, Farbstich, Kontrast-, Schatten- und Reflexionsstimmung dürfen nicht übernommen werden. Intrinsische Lackfarbe, Materialien und Geometrie bleiben geschützt.

Profil, angeforderte physische Seite, Sichtflächen und autoritative Original-IDs pro Fläche werden im Ergebnis-Kontext sowie im serverseitigen Versuchprotokoll gesichert. Historische Regeneration verwendet die gespeicherte Version und bei V3 das ursprüngliche Profil und die gespeicherten Originalquellen; fehlende Provenienz blockiert statt still zu migrieren.

## QA, Retry und Harmonisierung

Vorbereitet sind `wrong_physical_side`, `wrong_view_quadrant`, `unsupported_visible_surface`, `lighting_inconsistent`, `identity_drift`; die Galerie bietet einen manuellen Korrekturgrund. Bestehende technische Retrylogik bleibt erhalten. Keine automatische visuelle QA oder kostenpflichtige Analyse hinzugefügt. Ein manueller Retry bleibt eine normale kostenpflichtige Generierung nach bestehender Preislogik.

`harmonize-only` ist nur ein unverdrahteter Builder und bleibt deaktiviert. Keine automatische zweite Generierung oder doppelte Kosten. Bildmodelltreue und tatsächlich gleiche Ergebnisbelichtung sind durch Text-/Manifestverträge allein nicht garantiert.

## Prüfungen

- **120 Tests in 13 Dateien erfolgreich**, einschließlich aller sechs fehlenden Pflichtbeleg-Konstellationen, falscher Seitenautorität, generiertem Kontext, manipulierten Manifesten, gemeinsamem Profil, Uploadcache, UI-Auswahl/Start und historischer Regeneration.
- V1/V2-SHA-256-Baselines bestanden; bestehende 2.0-Promptausgaben enthalten keine V3-Marker.
- Neue V3-Dateien und Referenzprüfung: ESLint ohne Befunde.
- Gesamter Integrationsscope: **nicht lintsauber**; 64 `no-explicit-any`-Fehler und 7 bestehende Hook-/Refresh-Warnungen in den großen Bestandsdateien. Kein pauschales „Lint grün“.
- `deno check supabase/functions/remaster-vehicle-image/index.ts`: erfolgreich.
- Automatische Typecheck-/Vorschauprüfung: `build OK`.
- Isolierte Browserprüfung der echten Bedienelemente mit angemeldeter Sitzung: V3 auswählbar, fehlende rechte Seite sichtbar, Start gesperrt; Desktop/Mobil ohne horizontalen Überlauf oder Laufzeitfehler. Sämtliche Funktionsaufrufe während dieser Prüfung gesperrt, keine Funktionsanfrage entstanden.
- Echter Volvo-Durchlauf samt neu erzeugtem und wieder eingelesenem Ergebnis **nicht ausgeführt**, da ausdrücklich untersagt.

## Echte Blocker vor dem Volvo-Test

### Kabinenübersicht und minimale Referenzen (20.10.2026)

- Die V3-Kabinenübersicht ist eine einzelne natürliche, zentrierte Armaturenbrettaufnahme von der Rücksitzmitte nach vorne. Sichtbare Türanschlüsse, A-Säulen, Windschutzscheibenrahmen und Dachhimmel bleiben zusammenhängend. Vollständige Vordersitze und Rückbank werden nicht mehr gleichzeitig in den Bildausschnitt gezwungen; physische Sitze bleiben vorhanden und dürfen nicht entfernt oder transparent gemacht werden.
- Kabinen- und Detailjobs wählen genau ein geeignetes Original nach ihrer Rollenpolicy, ohne automatische zusätzliche Kabinen-/Heck-/Frontbelege oder generierten Umgebungskontext. Pflichtbelege für Seiten, 3/4-Ansichten, Kofferraum und einzelne Grid-Zellen bleiben erhalten.
- Kennzeichen-, Felgen- und Wandlogoassets werden nach dem sichtbaren Zielbereich vor Fetch/Upload ausgeschlossen. Die Übersicht transportiert nur das ausgewählte Frontkabinenoriginal; Beispielbilder dienen nur als Kompositionsvorgabe, nicht als Fahrzeugreferenz.
- Serverseitige kanonische Manifestprüfung erzwingt die reduzierten Sets. Deshalb muss diese geänderte gemeinsame V3-Policy vor realen Läufen bereitgestellt werden; nur die App zu aktualisieren reicht nicht. Keine Bereitstellung oder kostenpflichtige Bildgenerierung in diesem Auftrag. Tatsächliche Bildwirkung bleibt unbestätigt.

1. Der additive V3-Servercode ist noch nicht bereitgestellt. Vor V3-Generierung muss er bereitgestellt und durch einen kostenlosen ungültigen V3-Guard-Request live nachgewiesen werden.
2. Die konkret ausgewählten Testjobs brauchen die aufgeführten Originalrollen; fehlende rechte/linke Originale oder Detailbelege müssen ergänzt oder Jobs bewusst abgewählt werden.

Erst danach ausdrücklich freigegebener kleiner Volvo-Bildtest. Keine Garantie für visuelle Detail-/Belichtungsqualität vor dem tatsächlichen Bildvergleich.