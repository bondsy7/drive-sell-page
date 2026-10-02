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
