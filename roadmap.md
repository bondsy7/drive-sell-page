- [x] Fahrzeugaufnahme exakt als kompaktes 736-px Single-Column-/Hybrid-Layout ohne Sidebar umsetzen
- [x] Smartphone-Ansicht nach Referenz mit echten mobilen Sektionen und sticky Bottom Bar umsetzen
- [x] Nur PKW, LKW und Motorrad zeigen; bestehende Logik vollständig erhalten
- [x] Showroom-Auswahl auf 1–4 plus „Mehr …“ verdichten
- [x] Kennzeichenmotive einzeilig und höhenoptimiert darstellen
- [x] Fahrzeugfarbe und Branding kompakt und responsiv anordnen
- [x] Spezifische Bereinigung standardmäßig einklappen
- [x] Vorschaubilder für zwölf zusätzliche Settings ergänzen
- [x] Perspektiv-Icons der Pkw-Pflichtaufnahmen ersetzen und Bildlabel kollisionsfrei positionieren
- [x] VIN-Bereich mit neuem Motiv als kompakte Foto-, Status- und Aktionszeile gestalten
- [x] Smartphone-Aufnahmen als horizontale Reihe und alle Hauptbereiche als Accordions gestalten
- [x] Lkw-Konfigurationsbilder durch die sechs neuen Motive ersetzen
- [x] Showroom 1 vorauswählen, VIN und Innenraum optional machen und seitliches Scrollen entfernen
- [x] Lkw-Aufnahmeicons ersetzen und Kacheltexte gegen Überlauf optimieren
- [x] Lkw-Konfigurationskacheln an das kompakte 4:3-Aufnahmeraster angleichen
- [x] Doppelte Galerieeinträge verhindern und bestehende exakte Dubletten bereinigen
- [x] VIN-lose neue Vorgänge immer als getrennte Fahrzeuge anlegen; bestehende Fahrzeugakte nur nach Eigentumsprüfung verwenden
- [x] PKW-Seitenansichten eindeutig ausrichten und ausschließlich den gewählten Showroom verwenden
- [x] Referenzgebundenen Shift-by-Wire-/Konsolenschutz im Armaturenbrett und allen Innenraum-Folgejobs ergänzen und prüfen (24 Tests erfolgreich; keine kostenpflichtige Neugenerierung ausgelöst)

## B2B-Paid-Funnel (Phase 1)
- [x] Öffentliche Routen /autohaus-fahrzeugbilder, /autohaus-marketing, /fahrzeug-testen, /fahrzeug-testen/danke
- [x] Attribution-Utility (First Touch, UTM/Click-IDs)
- [x] Backend: Tabelle b2b_marketing_leads, Bucket b2b-test-uploads, Edge Functions submit-b2b-lead / request-b2b-demo
- [x] Adminseite /admin/b2b-leads inkl. CSV-Export
- [ ] TODO: rechtsverbindliche Datenschutzerklärung unter /datenschutz ergänzen

## Rechts-/B2B-Launch-Paket (15.09.2026)
- [ ] Rechtsseiten /impressum /datenschutz /agb /avv /toms /unterauftragsverarbeiter
- [ ] Wiederverwendbarer SiteFooter inkl. Cookie-Einstellungen
- [ ] Consent-Layer mit Basic Google Consent Mode V2 (Notwendig/Analyse/Marketing)
- [ ] B2B-Registrierung: Firmenname, §14-BGB-/AGB-Bestätigung, Onboarding-Gate für OAuth
- [ ] legal_acceptances-Tabelle (additiv, RLS)
- [ ] Preise als Netto zzgl. USt., Abrechnung/Verlängerung/Kündigung ausweisen
- [ ] Stripe: Basis-Produkt-Mapping ergänzen, create-checkout Preis-Allowlist
- [ ] docs/LEGAL_GO_LIVE_CHECKLIST.md pflegen
- [ ] Diese Runde ohne Stripe-/Auth-/DB-Änderungen: nur Rechtsseiten, Footer, Consent, Checkliste

## Preismodell autohaus.ai (22.09.2026)
- [x] Pakete Basic/Advanced/Premium/Ultra und Fotoservice 1/25/50/100/200 in Stripe und Datenbank
- [x] Einmalige Implementierung 990 € netto bei Erstbuchung
- [x] Preisseite mit Umschalter Fotoservice / All-Incl-Marketing, Zusatzapplikationen, Zusatzpakete
- [x] Credit-Verbrauch vereinheitlicht (Banner/Post 5, Video 17, Landingpage 19)
- [x] Mindestlaufzeit 12 Monate (AGB § 7 + Preisseite); Whitelabel/Flipping nur auf Anfrage

## Markenwechsel und öffentliche Seiten (22.09.2026)
- [x] Marke von AUTO3 auf autohaus.ai umstellen, inklusive Logo, E-Mails und Angebots-PDF
- [x] Öffentliche Seiten nach gelieferter Designreferenz neu gestalten
- [x] Desktop- und Mobilansicht sowie PDF-Download prüfen
- [x] Startseite eng an die neue Referenz mit Bildplatzhaltern, Kennzahlen, vier Schritten und Kundenstimme angleichen

## Rechtliche Informationsarchitektur (22.09.2026)
- [x] Footer auf fünf primäre Rechtszugänge reduzieren
- [x] Öffentliche Übersicht /rechtliches mit zentralen Dokumentständen erstellen
- [x] LegalLayout-Navigation und Rückweg vereinheitlichen
- [x] KI-Transparenz in das gemeinsame LegalLayout überführen
- [x] Unverifizierte DSB-Aussage in der Datenschutzerklärung neutralisieren
- [x] TypeScript, Build und responsive Preview prüfen
## Einheitliche Desktopbreite (23.09.2026)
- [x] Reguläre Seiten und Unterseiten auf eine gemeinsame 1120-px-Nutzbreite ausrichten
- [x] Generator und Fahrzeugaufnahme von 768/736 px auf die gemeinsame Desktopbreite erweitern
- [x] Desktop- und Mobilansicht sowie Build prüfen

## Generator-Bento-Redesign (24.09.2026)
- [x] Generator-Startseite in die gewählte grafische Bento-Struktur überführen
- [x] Alle bestehenden Werkzeuge, Berechtigungen und Klickpfade erhalten
- [x] Desktop- und Mobilansicht sowie zentrale Klickpfade prüfen

## Generator-Grafiken (23.09.2026)
- [x] Fahrzeugarten und Aufnahmegrafiken zuschneiden, als WebP optimieren und größer darstellen
- [x] Reisemobil-Aufbautypen mit den fünf gelieferten, optimierten WebP-Bildern ausstatten


## Paid-Funnel Redesign nach Referenz (24.09.2026)
- [x] Gemeinsamen Funnel-Rahmen und Vorher/Nachher-Bühne umsetzen
- [x] /autohaus-fahrzeugbilder und /autohaus-marketing nach Vorlagen überarbeiten
- [x] /fahrzeug-testen und Danke-Seite nach Vorlagen überarbeiten
- [x] Desktop, Mobil, Formulare und Tracking prüfen

## Smartphone-Reveal im Fahrzeugbilder-Hero (25.09.2026)
- [x] Verschiebbare Smartphone-Maske mit feststehendem Ergebnisbild umsetzen
- [x] Fünf konfigurierbare Bearbeitungsvarianten mit Überblendung ergänzen
- [x] Desktop, Mobil, Bewegungsgrenzen und reduzierte Animation prüfen

## Landingpage „Standtage vermeiden" (30.09.2026)
- [x] Screenlayout und Seitenkonzept als fokussierte Paid-Landingpage erstellt
- [x] Seite /standtage-vermeiden im FunnelLayout mit Meta und Attribution umgesetzt
- [x] Hero-Motive produziert: Fahrzeug auf dem Anhänger und dasselbe Fahrzeug als Showroom-Motiv, als WebP
- [x] Problemkette, Prozessvergleich „klassisch vs. autohaus.ai", Nutzenkarten und Beweisbereich umgesetzt
- [x] Kurz-FAQ und Abschluss-CTA ergänzt, CTA-Ziel auf den Fahrzeugtest mit Quelle standtage
- [x] Desktop, Mobil, Formularablauf und Build geprüft – nicht veröffentlicht

## Standtage-Seite: Prozessmotiv und Feinschliff (30.09.2026)
- [x] Gelieferte Prozessgrafik ohne fremde Logos und überladene Beschriftungen als Bildgeschichte aufbereiten
- [x] Vergleich prominent direkt nach dem Einstieg platzieren und mobil in zwei lesbare Bildhälften aufteilen
- [x] Darstellung und Bildladen auf Desktop und Smartphone prüfen

## Standtage-Funnel: Tracking für Ads (30.09.2026)
- [x] Scrolltiefe, Klicks auf Test-Buttons, ergänzte Kontaktdaten und Demo-Buchung messen
- [x] Meta-Pixel nur mit Marketing-Einwilligung; Lead + Terminbuchung auch an Google Ads (sobald Konto verbunden)
- [ ] Google-Ads-Konto verbinden und Conversions anlegen (wartet auf Nutzer)
- [ ] Meta-Pixel-ID hinterlegen (wartet auf Nutzer)
- [ ] Seite veröffentlichen, bevor Anzeigen laufen

## Landingpage „Werbemittel" (30.09.2026)
- [x] /autohaus-werbemittel mit Hero-Formatcollage, Problem, Vergleich, Marketing-Wall, Nutzen, Praxis, CI-Welten, Test, FAQ, Abschluss-CTA
- [x] CTA → /fahrzeug-testen?source=werbemittel, Herkunft lp_werbemittel, Scrolltiefe und Klicks gemessen

## Paid-Funnel „Fahrzeug-Landingpages“ (30.09.2026)
- [x] Eigenständige Seite /autohaus-landingpages mit Fahrzeugseite, Verkaufsassistent, Datenfluss, Kampagnen, FAQ und Testweg erstellen
- [x] Bestehende Consent-, CTA-, Scroll- und Quellenmessung für lp_landingpages wiederverwenden
- [x] Desktop/Mobil, CTA-Ziel und Vorschau geprüft; nicht veröffentlicht

## Paid-Funnel „Fahrzeugvideos“ (30.09.2026)
- [x] Eigenständige Seite /autohaus-videos mit Formaten, Prozessvergleich, Stilen, Kanälen, Testweg und FAQ erstellen
- [x] Bestehende Consent-, CTA-, Scroll- und Quellenmessung für lp_videos wiederverwenden
- [x] Desktop/Mobil, CTA-Ziel und Vorschau prüfen; nicht veröffentlichen

## Startseiten-Headergrafik (02.10.2026)
- [x] Text und Buttons über die vollbreite Vorher/Nachher-Grafik setzen
- [x] Proportionalen Video-Rahmen über der weißen Fläche vorbereiten; Platzhalter bis zur Videolieferung erhalten

## Startseite: echtes Hof-Foto in Schritt 01 (02.10.2026)
- [x] Originalaufnahme vom Hof (schlammiger SUV, nasser Platz) statt Platzhalter im Bereich „So funktioniert's"
- [x] Bild als Medien-Adresse angelegt; Schritt 02/03 und Ergebnisse bleiben bis zur Lieferung Platzhalter
- [x] Schritt 02 „Gestalten" mit aufbereitetem Showroom-Bild füllen; KI-Kennzeichnung (AI MODIFIED) oben rechts

## Startseite: 12 Ergebnis-Perspektiven im Raster (02.10.2026)
- [x] Bilder 1–12 nach Dateinummer in die zwölf Kacheln des Bereichs „Ergebnisse" einsetzen
- [x] Kacheln 11 und 12 mit web_11/web_12 füllen; Hinweiszeile auf „12 Perspektiven · Ergebnisse" stellen
- [x] Kacheln 6 und 7 tauschen (Scheinwerfer-Detail nach 6, 2×2-Collage nach 7)
- [x] Heckleuchten-Detail und Frontansicht (web_11/web_12) vor die Seiten-/Heck-/Rückbank-Kacheln ziehen

## Startseite: Social-Media-Formate im Ergebnis-Bereich (02.10.2026)
- [x] Story, quadratischer Beitrag, Werbeanzeige und schmales Hochformat als schlanke WebP in die Medienablage legen
- [x] Reiter „Social Media" mit den vier Motiven in ihren echten Seitenverhältnissen befüllen (dreispaltige Collage, Kasten bleibt 1104 × 840)
- [x] Mobil als wischbare Leiste mit Rastsprung; alle Höhenkanten bündig, kein Beschnitt

## Auto3-Verbindung und Arbeitsbereich (05.10.2026)
- [x] Händler-/Mandanten-URL im Profil serverseitig prüfen und als Verbindung speichern
- [x] Auto3-Kachel nur nach erfolgreicher Verbindung im Generator anzeigen
- [x] Bestand, Import und Automatik in ein eigenes Auto3-Center verschieben
- [x] Globale Bildregeln einklappen; Kosten und ausdrückliche Credit-Freigabe sichtbar halten
- [x] Desktop, Smartphone, Verbindung und Bestand im echten Nutzerzustand prüfen

## Fahrzeugbilder: Perspektiven-Sektion (05.10.2026)
- [x] Sektion „Vielfältige Perspektiven ab zwei Fahrzeugfotos" unter „Qualität steckt im Detail" einfügen
- [x] Gruppen Außenansichten, Details und Innenraum mit sieben Ansichten befüllen (CDN-Pointer fb-08-*)
- [x] Kacheln mit vollständiger Ansicht ohne Beschnitt verknüpfen; Sprunglink „Perspektiven" ergänzen
- [ ] Händler-Originale aus Winkeln, Details, Interieur und Exterieur einsetzen (Fotos kamen in der Sandbox nicht an)

## Werbemittel-Seite /autohaus-werbemittel
- [x] Plattform-Logos als hochgeladene Icons8-Motive (Instagram, Facebook, LinkedIn, X, Google, TikTok, YouTube, Website)

## Freisteller & Showroom: Upload-Perspektiven
- [x] Einzelnes Upload-Feld durch optionale Perspektiv-Kacheln ersetzen; jedes Foto eigenständig bearbeiten, Start ab einem Foto
- [x] Hintergrund-Auswahl und Verarbeitung unverändert erhalten; Upload, Austausch und Entfernung geprüft (7 Tests, angemeldete Vorschau; keine kostenpflichtige Verarbeitung gestartet)

- [x] Nano Banana 2.1 als getrennten Prompt-Pfad (nb21-v1) für Remastering und alle Pipeline-Ansichten ergänzen; 2.0 unverändert

## Remastering: Beschriftung, Credits und Sicherung
- [x] Ergebnisbeschriftungen aus tatsächlichen Aufnahmeslots übernehmen, auch bei Nutzfahrzeugen; fünf California-Testbilder korrigiert
- [x] Credit-Anzeige an den tatsächlich berechneten Remasterpreis angleichen, ohne Preise zu ändern
- [x] Fertige Bilder im Aufnahme-Remastering serverseitig sofort sichern und doppelte Ablage beim Galerie-Klick verhindern
- [x] 32 Tests sowie angemeldete Preis-/Speicher-/Galerieprüfung bestanden; ohne kostenpflichtige Neugenerierung

## Volvo: NB 2 / NB 2.1 — Analyse und Plan
- [x] Gespeicherte Volvo-Ausgaben und Originale vergleichen; Laufzeiten und tatsächliche Credits prüfen
- [x] Vergleichsbild erstellen und konkrete NB-2.1-Verbesserungen planen; keine Implementierung oder kostenpflichtigen Läufe

## NB21 v3: strikte Ansichten und Serienlicht
- [x] Eigenständige V3-Policies, sechs View-Contracts und harte serverseitige Evidenzprüfung ergänzt; historische V1/V2-Quelldateien byte-identisch
- [x] Explizite Testversionswahl, Startprüfung, run-spezifisches Lichtprofil und versionsgenaue Regeneration angebunden
- [x] Ergebnisprovenienz, strukturierte manuelle Retry-Gründe und deaktivierten Harmonisierungspfad vorbereitet
- [x] 120 relevante Tests grün, neue V3-Dateien lintsauber, Deno-Check und automatische Typ-/Vorschauprüfung erfolgreich; isolierte Desktop-/Mobil-Bedienprüfung ohne Funktionsaufruf; Gesamt-Lint hat unveränderte Bestandsbefunde
- [ ] V3 bereitstellen und kostenlosen Guard-Smoke-Test vor ausdrücklich freigegebenem Bildtest durchführen — Auftrag untersagt Deployment und echte Generierung

## NB21 v2: Evidence-driven Umsetzung
- [x] V1/2.0 erhalten; explizite V2-Contracts, semantische Ziele und Reference Manifest implementieren
- [x] Original-/Kontext-Metadaten rückwärtskompatibel durch Capture, Pipeline und Regeneration führen
- [x] Servervalidierung und tatsächliche Referenztelemetrie ergänzen
- [x] V2-/Baseline-Tests ausführen; sechs kritische Referenzsets und verbleibende Index-Fallbacks berichten
- [x] Keine kostenpflichtige Live-Generierung, Preis-/Auth-/Galerie-Verhaltensänderung oder Veröffentlichung; nur additive Versions-/Telemetriedaten

## NB21 v2: Run-Cache, Klassenvertrag und Startprüfung
- [x] Gemini-Referenzuploads pro Run deduplizieren, bestehende File URIs bevorzugen
- [x] Kompakten gemeinsamen Subject-Class-Lock im Client und finalen Serverprompt absichern
- [x] Geplante Originalrollen vor Start prüfen; Detailzuordnung und bewusstes Überspringen anbieten
- [x] 61 V2-/Baseline-/Integrationstests, gezielten Lint, Server-Typprüfung und isolierte Browser-Bedienprüfung erfolgreich; keine bezahlte Generierung

## Weitere Detailaufnahmen: Perspektivanalyse
- [x] Vorhandene Perspektivanalyse für zusätzliche NB21-Detailoriginale angebunden; sichere Zuordnung mit manueller Korrektur und Wiederverwendung der Dateireferenz
- [x] 65 Tests, gezielter Lint und Bedienprüfung mit simulierten Analyseantworten erfolgreich; echte Anbieteranalyse nicht ausgeführt, keine Bildgenerierung oder Veröffentlichung

## Fahrersitz und Serienbelichtung
- [x] Letzten Volvo-Lauf geprüft: 14 Originale und 40 Ergebnisse; CI-Heck-Farbdrift und Einzelbild statt Vierer-Grid mit fehlendem Sitz bestätigt; V2-Farbbeleg, Kabinenpriorität, Vierer-Layout und neutrale gemeinsame Lichtbasis korrigiert; 62 Tests und Vorschauprüfung erfolgreich, keine kostenpflichtige Generierung
- [ ] Korrigierte gemeinsame V2-Serverpolicy bereitstellen und Bildwirkung in einem ausdrücklich freigegebenen kleinen Vergleichslauf prüfen; bislang kein Deployment oder neuer kostenpflichtiger Lauf
- [x] Verformte/verschmolzene Sitzrücken im gelieferten Ergebnis erkannt; vollständige getrennte Sitzgeometrie und Originalkamera in V2-Edit-Aufnahmen geschützt
- [x] Einheitliche Serienbelichtung und Weißabgleich trotz unterschiedlicher Originalbelichtungen für alle NB21-V2-Ziele verankert; historische V1/2.0-Verträge unverändert
- [x] 56 Regressionstests und gezielter Lint erfolgreich, Vorschau fehlerfrei; tatsächliche Bildwirkung nicht live getestet, keine bezahlte Generierung oder Bereitstellung

## Kennzeichen und Wandbranding
- [x] Kennzeichenassets strikt auf Kennzeichen begrenzen, Wandlogos nur bei expliziter Auswahl zulassen und Originalfoto-Branding ausschließen (V3 und aktuelle Standardverarbeitung; historische V1/V2 unverändert)
- [x] 46 gezielte Tests und Scope-Lint erfolgreich; keine kostenpflichtige Generierung
- [ ] Serverseitige Schutzregel bereitstellen und Bildwirkung prüfen — kein Deployment/Anbieteraufruf in diesem Auftrag

## DEKRA-Report: vollständige Ergänzung
- [x] Version 3 auf 21 Tabellenfälle der drei DEKRA-Accounts begrenzt; California und unzugeordnete Zusatzfahrzeuge entfernt, sieben Fehlerbilder beim Fahrzeug aufgenommen; 113 Originale und alle 34 Seiten visuell sowie Tabellenabdeckung geprüft
- [x] Alle 21 benannten Fahrzeugzeilen und California-Zusatz der aktuellen Tabelle mit dem gesamten Originalexport abgeglichen; offene Namenszuordnungen ausdrücklich markiert
- [x] Alle 152 Export-Originaldateien plus neun California-Originale, sämtliche Tabellenbefunde und vorhandene Ergebnisbelege in PDF-Version 2 aufgenommen; Nutzungslücken von Systemfehlern getrennt
- [x] Alle 45 PDF-Seiten visuell geprüft, Dachzustand und Volvo-Bildbeschreibung korrigiert und Abdeckung geprüft; keine Neugenerierung
