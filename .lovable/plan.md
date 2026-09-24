# Paid-Funnel nach den gelieferten Vorlagen neu gestalten

## Ziel
Die Seiten `/autohaus-fahrzeugbilder`, `/autohaus-marketing`, `/fahrzeug-testen` und `/fahrzeug-testen/danke` werden als zusammenhängender, conversion-orientierter Funnel neu gestaltet. Aufbau, Hierarchie, Dichte, Farbwirkung und Seitenführung folgen eng den vier gelieferten Referenzlayouts. Bestehende Lead-Erfassung, Attribution, Consent-Logik und GA4-Ereignisse bleiben erhalten.

## Umsetzung

### 1. Gemeinsamer Funnel-Rahmen
- Header, Navigation, Fortschrittsanzeige, mobile Aktionsleiste und Footer an die Vorlagen angleichen.
- Einheitliche 1120-px-Inhaltsbreite, klare weiße Flächen, petrolfarbene Akzente und kompakte Karten verwenden.
- Alle vier Seiten visuell und sprachlich als durchgängige Strecke verbinden.

### 2. `/autohaus-fahrzeugbilder`
- Einstiegsbereich exakt nach der ersten Landingpage-Vorlage aufbauen: Nutzenversprechen links, Vorher/Nachher rechts, primäre Test-CTA und sekundäre Demo-CTA.
- Das gelieferte `before.png` links zeigen; die fünf gelieferten Nachher-Bilder rechts automatisch weich übereinander wechseln lassen.
- Prozess, Nutzenleiste, Problem/Nutzen-Vergleich, Funktionskacheln, Referenzbereich, FAQ und Abschluss-CTA entsprechend der Vorlage neu ordnen.
- Keine erfundenen Kundenstimmen, Kennzahlen oder Garantien verwenden; vorhandene belegbare Aussagen beibehalten.

### 3. `/autohaus-marketing`
- Als passende zweite Paid-Landingpage im gleichen System aufbauen, mit Fokus auf den vollständigen Fahrzeugmarketing-Prozess.
- Workflow, Module, Rollen/Nutzen, Integrationen, FAQ und Prozesscheck für Händlergruppen kompakt und conversion-orientiert darstellen.
- Prozesscheck-Formular funktional unverändert integrieren und visuell an den neuen Funnel anpassen.

### 4. `/fahrzeug-testen`
- Formularseite nach der gelieferten Vorlage strukturieren: Fortschritt oben, starke Einleitung, Hauptformular links und Nutzen-/Vertrauensspalte rechts.
- Bestehende Pflichtfelder, Validierung, Upload, Fehlertexte, Rate-Limit-Rückmeldung, Lead-Speicherung und GA4-Ereignisse unverändert erhalten.
- Hochgeladenes Fahrzeug sofort als klare Vorschau zeigen; Vorher/Nachher-Beispiel und Datenschutzinformationen sichtbar ergänzen.

### 5. `/fahrzeug-testen/danke`
- Danke-Seite nach der gelieferten Vorlage gestalten: Bestätigung, nächste Schritte, ergänzende Angaben, Demo-Wunsch und Rückweg zur Hauptseite.
- Den bestehenden optionalen zweiten Datensatz-Schritt und `demo_requested` vollständig erhalten.
- Keine erfundene Terminbestätigung oder Kalenderbuchung darstellen; stattdessen den tatsächlich vorhandenen Demo-Wunsch sauber und glaubwürdig abbilden.

### 6. Medien und Qualität
- Die sechs gelieferten Fahrzeugbilder als optimierte WebP-Dateien über den Projekt-Assetfluss einbinden.
- Sanfte automatische Nachher-Überblendung mit reduzierter Bewegung bei entsprechender Systemeinstellung umsetzen.
- Desktop und Mobil prüfen; besonders Bildzuschnitt, Textüberläufe, Formularbedienung, CTA-Sichtbarkeit und Seitenwechsel testen.
- Build- und Laufzeitfehler prüfen sowie den vollständigen Formularablauf einschließlich Tracking unverändert verifizieren.

## Nicht Teil der Änderung
- Keine Änderungen an Datenbank, Edge-Funktionen, Consent-Regeln, GA4-Konfiguration, Google Ads, Preisen, Authentifizierung oder Admin-Leadlogik.
- Keine Veröffentlichung; nur Umsetzung in der Vorschau.
