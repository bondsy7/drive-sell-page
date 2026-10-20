# Volvo-Vergleich: Detailtreue von NB 2.1 gezielt absichern

## Ergebnis der Prüfung

**NB 2.1 zeigt in den geprüften Ansichten Vorteile, ist aber noch nicht zuverlässig fahrzeugtreu. Ein Standardwechsel ist deshalb derzeit nicht begründet.** Die Fehler sind keine bloßen Stilunterschiede: Ausstattung und Fahrzeuggeometrie werden verändert. Die vorhandenen Originale zeigen die beanstandeten Merkmale; hier liegt nicht einfach ein Mangel an Kundenfotos vor.

### Sichtbar belegte Fehler
- **NB 2:** Kühlergrill mit Waben und Chromrahmen statt geschlossenem Original-Frontpanel. Bei Rücksitzen verschwindet der Vordersitz; eine unpassende große Konsole und andere Türdetails werden erzeugt. Lenkstockhebel, Lenkradtasten und Displayinhalte weichen ab.
- **NB 2.1:** Erhöhte Frontansicht verändert Frontpanel, Scheinwerfer, Stoßfänger und Karosserieform deutlich. Der separate Frontpanel-Detailshot ist dagegen wesentlich näher am Original. Das zeigt Inkonsistenz innerhalb derselben Serie.
- **Beide:** Kofferraumabdeckung, Boden, Lehnen und Verkleidung stimmen nicht mit dem offenen Kofferraumfoto überein. Bei 2.1 erscheinen helle Lehnen mit zusätzlicher mittiger Klappe; bei 2 fehlen bzw. verändern sich Abdeckung und Boden. Beide ersetzen die breiten rechteckigen Lenkstockhebel durch andere Formen; rechts geht die originalgetreue Fahrwahl verloren.
- Unterschiedliche Kameraausschnitte allein sind kein Identitätsfehler. Die genannten Bauteiländerungen sind es.

### Gemessene Geschwindigkeit und Credits — 20.10.2026
| Kennzahl | NB 2 / Qualität | NB 2.1 |
|---|---:|---:|
| Erfolgreiche Folgeansichten | 35 | 35 |
| Dauer der Folgeansichten, parallel | 1:40 min | 3:02 min |
| Durchschnitt erfolgreicher Generierungsaufruf | 13,0 s | 25,2 s |
| Gesamtbilder inkl. fünf Aufnahme-Remasters | 40 | 40 |
| Tatsächlich abgebuchte Bild-Credits | 40 | 120 |
| Separat protokollierte Felgenanalysen im Zeitfenster | 1 Credit | 2 Credits |

Die Bildabbuchungen sind anhand der getrennten Laufzeitfenster zugeordnet; die Abbuchungszeilen selbst speichern hier keine Fahrzeug-/Modellreferenz. NB 2 ist im Serienlauf rund 45 % schneller; NB 2.1 dauert rund 82 % länger und kostet aktuell dreimal so viele App-Credits. Das ist **kein Nachweis dreifacher Anbieter-Kosten**: Für diese Läufe fehlen Einträge in `api_cost_events`, deshalb sind tatsächliche API-Euro-/Dollar-Kosten unbekannt. Die Gesamtzeiten enthalten Parallelisierung, Wartezeiten und Wiederholungen, nicht den kompletten Nutzerprozess ab Upload. Vier NB-2.1-Jobs und zwei NB-2-Jobs haben einen höheren Versuchszähler. „35 erfolgreich“ bedeutet technisch geliefert, nicht visuell fehlerfrei.

Beleg: `pipeline_timing_logs` fc0f7bc4-939c-4588-b045-5e18928d5628 (06:41:28 UTC), 75c39403-f115-418d-90be-1f17a29ce196 (06:57:23 UTC); fahrzeugbezogene `generation_attempt_logs`; tatsächliche `credit_transactions`.

## Was zuerst verbessert wird

### 1. Originalreferenzen statt plausibel aussehender Ersatzdetails
- Für NB 2.1 die vorhandenen Originale und passenden Original-Detailfotos gezielt an die jeweilige Ansicht übergeben.
- Frontansichten erhalten originale Frontbelege, Kofferraum die offene Kofferraumaufnahme, Lenkrad/Instrumente das originale Detailfoto.
- Generierte Remasters dürfen Look und Umgebung unterstützen, aber sichtbare Fahrzeugmerkmale aus Originalen nicht überstimmen.
- Keine zusätzlichen Pflichtfotos, keine neue automatische Upload-Plausibilitätsprüfung und keine neue Kundenbestätigung.
- Detailfotos müssen ihre fachliche Rolle behalten; ein beliebiges Innenraumfoto ersetzt kein offenes Kofferraumfoto. Wo eine Rolle fehlt, vorhandene Auswahl-/Zuordnungslogik wiederverwenden; keine ungesicherte Zuordnung anhand der Reihenfolge.

### 2. Markenspezifische Innenraumansichten korrekt behandeln
- NB-2.1-intern zwischen Außenansicht, Innenraum, Innenraumdetail, Kofferraum und Felgendetail unterscheiden, auch wenn die bestehende Jobgruppe „CI“ heißt.
- Alle Marken-CI-Jobs prüfen, nicht nur Volvo: Lenkrad, Instrumente, Displays und Sitze dürfen keine Außenregeln oder Felgenbilder als maßgebliche Innenraumquelle bekommen.
- Kofferraum erhält sowohl originale Innenraum-/Laderaumdetails als auch Heckbelege für Klappe und umliegende Karosserie.

### 3. Kurze, referenzgebundene Detailregeln
- Erhöhte Front: komplettes Frontpanel, Leuchtensignatur, Stoßfänger und Karosserie bleiben dieselben; nur der Kamerastandpunkt ändert sich.
- Kofferraum: tatsächliche Abdeckungsstellung, Bodenebene, Lehnen, Haken und Verkleidung erhalten. Keine erfundene mittige Klappe.
- Lenkrad/Instrumente: tatsächliche Hebelkonturen, Fahrwahl, Tasten und Displayanordnung kopieren. Keine pauschale Volvo-Standardausstattung erzwingen.
- Ein klarer Vorrang: Originaldetails bestimmen Identität, Remasters den fotografischen Look, Showroom/Logo nur Umgebung und Branding.
- Nicht einfach weitere widersprüchliche Verbote an den bestehenden Prompt anhängen.

### 4. Erst kleine Vergleichsprobe, dann breitere Freigabe
- Nach Umsetzung zunächst nur Front erhöht, Frontpanel-Detail, Kofferraum, Lenkrad, Instrumente und Rücksitze testen — kein erneuter kompletter 40-Bilder-Lauf.
- Originale, Einstellungen und Ausgabegrößen gleich halten; Version und übergebene Referenzrollen festhalten.
- Kostenpflichtige Tests erst nach ausdrücklicher Freigabe und vorherigem Gesamtpreis; NB 2 bleibt als vorhandene Vergleichsserie erhalten.
- Jede Ansicht manuell gegen Original prüfen; insbesondere kein anderes Fahrzeug, keine erfundenen Teile, keine verschwundenen Sitze und keine falsche Fahrwahl.
- Anschließend wiederholte Stichproben mit Volvo, California und einem weiteren Fahrzeug. Keine Fehlerquote oder Qualitätsgarantie aus einem einzigen Lauf ableiten.
- Falls Fehler trotz korrekter Originalübergabe bleiben: originalnahe Bildbearbeitung für kritische Details bevorzugen und weniger neue Perspektiven extrapolieren; keine unverifizierte Ansicht als verkaufsfertig behandeln. Das wäre eine gesonderte Produktentscheidung, keine automatische Änderung dieser Runde.

## Technische Umsetzung und Absicherung

### Bestätigte Lücken im aktuellen Quellcode
- `src/contexts/PipelineContext.tsx:402–442`: vorhandene `inputImages` verdrängen den Originalpool; Kategorie `ci` nutzt die Außenreferenz-Auswahl und lässt separate Detailbilder aus. Dies ist keine Kette sämtlicher vorheriger Joboutputs, sondern ein Pool aus Capture-Remasters/Referenzen.
- `src/prompts/nb21/perspectives.ts:206–218`: abgeleitete CI-Jobs werden standardmäßig als `exterior` klassifiziert.
- `src/prompts/nb21/builder.ts:59–76,120–130`: dadurch erhalten diese Innenraumjobs nicht die vorgesehenen Innenraum-Schutzregeln und Referenzrollen.
- `supabase/functions/remaster-vehicle-image/index.ts`: widersprüchliche Autoritätsformulierungen für Blueprint und weitere Referenzen im NB-2.1-Zweig bereinigen.
- `src/lib/pipeline-jobs.ts`: ausschließlich als Bestandsquelle lesen, 2.0-Texte unverändert lassen.

Diese Lücken sind belegte Codebefunde und plausible Ursachen, aber kein vollständiger Beweis des konkreten beim Anbieter eingegangenen Bildpakets. Die gespeicherte Version `nb21-v1` und Modell-Logs belegen den gewählten Pfad, nicht den exakten finalen Prompt jedes Live-Aufrufs.

### Änderungsgrenzen
- Ausschließlich NB-2.1-spezifische Prompt-/Referenzentscheidungen erweitern. Alle anderen Tiers behalten ihre bisherigen Builder und Referenzwege.
- Bestehende File-URI-/Uploadwege weiterverwenden; Bildreihenfolge und dazugehörige Rollen gemeinsam erzeugen, sodass sie nicht auseinanderlaufen.
- Neue Fassung als eigene NB-2.1-Promptversion führen; vorhandene v1-Läufe reproduzierbar halten und keine stille Umstellung alter Regenerationen. Versionswechsel und Servervalidierung gemeinsam verdrahten.
- Keine Änderungen an Preisen, Admin-Overrides, Auth, Fahrzeugklassenprofilen, Galerie oder Veröffentlichung. Kein automatischer Modellwechsel und keine automatischen kostenpflichtigen Reparaturläufe.

### Tests vor einem Live-Test
- Alle bestehenden Pipeline-Jobs/Remaster-Slots weiterhin abgedeckt; genau neun Abschnitte in fester Reihenfolge.
- CI-Innenraumjobs aller Marken fachlich korrekt zugeordnet; Innenraumdetails erhalten passende Originalbelege, nie Felgen-/Außenbelege als Innenraumautorität.
- Front/Kofferraum/Lenkrad nutzen passende Originale, auch bei mehr Referenzen als dem Versandlimit; relevante Belege dürfen nicht durch frühe Arraypositionen verdrängt werden.
- File-URI und Inline-Fallback erhalten identische Zuordnung und Rollenreihenfolge.
- Eindeutige Autorität in finalen NB-2.1-Serverprompts; v1 und neue Version bleiben getrennt.
- Bestehende 2.0-Baseline und Nicht-NB-2.1-Routing unverändert; Klassenisolation und physische Seitenrichtung erhalten.
- Diese Tests prüfen Routing/Regeln, nicht visuelle Qualität. Die visuelle Freigabe erfolgt am echten Ergebnis.

## Empfehlung
**Zuerst Referenzübergabe und CI-Innenraumklassifikation korrigieren, dann gezielt testen. Nicht NB 2.1 sofort zum Standard machen und nicht allein mit längeren Prompts eine 100%-Treue versprechen.** Bessere Referenznutzung kann vermeidbare Fehler deutlich reduzieren; generative neue Perspektiven garantieren trotzdem keine pixelidentische Ausstattung.

Bis zur Freigabe wurden ausschließlich Daten und Bilder geprüft und der Vergleich erstellt — keine App-Änderungen, keine Deployments, keine neue kostenpflichtige Bildgenerierung.
