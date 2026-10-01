# Meta-Pixel für app.autohaus.ai vorbereiten (Pixel-ID 1491394502834323)

## Bestandsaufnahme: was schon da ist
- **Einwilligung:** Banner mit Kategorien Analyse/Marketing. Google Consent Mode V2 ist auf „verweigert“ voreingestellt. `applyConsent` lädt den Meta-Pixel nur bei Marketing-Einwilligung und widerruft ihn, wenn die Einwilligung zurückgenommen wird.
- **Pixel-Datei vorhanden** (`src/lib/meta-pixel.ts`): lädt `fbevents.js`, sendet `consent grant`, `init` und einen PageView, kein Advanced Matching. Es passiert nichts, solange `VITE_META_PIXEL_ID` fehlt. Dieser Wert ist bisher nirgends gesetzt.
- **Events schon verdrahtet** (`funnel-tracking.ts`): `generate_lead` löst Meta `Lead` aus, `demo_requested` löst Meta `Schedule` aus. Beide nutzen dieselbe event_id wie Google, die Daten werden vorher von personenbezogenen Angaben bereinigt.
- **Alle 7 Funnel-Seiten** nutzen `FunnelLayout`. Dieses sendet einmal pro Route `page_view` an GA4 und an die interne Zählung, `cta_click` geht nur dorthin. First- und Last-Touch-Attribution sind vorhanden (inklusive fbclid).
- **Calendly** (Danke-Seite): wird direkt beim Aufruf geladen, ohne Einwilligungsprüfung. `calendly.event_scheduled` löst `demo_requested` und damit `Schedule` aus.

## Lücken und Risiken
1. **Pixel-ID fehlt:** Ohne gesetzte ID ist der Pixel komplett aus.
2. **Nur ein PageView pro Besuch:** Meta zählt nur den ersten Seitenaufruf, Seitenwechsel innerhalb der App kommen nicht an. Das ist eine Lücke, keine Doppelzählung. Wer die Einwilligung erst später gibt, erzeugt zum Zeitpunkt der Zustimmung einen PageView für die gerade offene Seite.
3. **Lead-ID und Token in der Adresse:** Die Danke-Seite enthält `?lead=<uuid>&t=<token>`. Der Pixel schickt die vollständige Adresse automatisch an Meta. Der Token gibt Zugriff auf die Ergänzung der Kontaktdaten, das ist ein echtes Datenleck-Risiko. Bei Calendly kommt zusätzlich der Name über `&name=` in der Calendly-Adresse dazu, nicht in unserer eigenen.
4. **Calendly ohne Einwilligung:** Calendly ist ein externer Dienst mit eigenen Cookies und wird geladen, bevor zugestimmt wurde. Das sollte erst nach einem Klick laden („Kalender laden“) oder in der Datenschutzerklärung als Terminbuchung auf Anfrage begründet werden.
5. **Rechtstexte fehlen:** In der Datenschutzerklärung erscheint Meta nur als Ziel für Social Publishing, der Meta-Pixel steht nicht drin. Auf der Cookie-Seite fehlt er ebenso, und Calendly wird nirgends genannt. Die Unterauftragsverarbeiter-Liste führt Meta nur für Veröffentlichungen. Der Bannertext muss Meta als Empfänger nennen.
6. **Kein Calendly-Fallback ohne Einwilligung:** `Schedule` geht nur mit Marketing-Einwilligung raus. Das ist korrekt und braucht keine Änderung.

## Nicht doppelt einbauen
- Kein zweites Pixel-Snippet in `index.html`, kein GTM und kein Plugin. Es bleibt bei `meta-pixel.ts`.
- `Lead` und `Schedule` nicht zusätzlich in den Seiten auslösen, beide laufen bereits zentral über `trackFunnelEvent`.
- Keinen eigenen PageView-Listener am Router: Meta-PageViews kommen in die bestehende `page_view`-Logik im `FunnelLayout` bzw. in `trackFunnelEvent`.
- Keine zweite Einwilligungsabfrage: Der Pixel hängt an der bestehenden Kategorie „Marketing“.

## Umsetzungsschritte (nach Freigabe)
1. `VITE_META_PIXEL_ID=1491394502834323` als öffentliche Umgebungsvariable setzen. Die Pixel-ID ist keine geheime Angabe.
2. `meta-pixel.ts`: Beim Laden `autoConfig false` setzen, damit keine automatischen Formular- und Button-Daten erfasst werden. Den Init-PageView mit `dedupe` gegen den ersten Routen-PageView absichern. Vor dem Laden die sensible Danke-Adresse bereinigen.
3. `funnel-tracking.ts`: `page_view` zusätzlich als Meta `PageView` senden, außer beim ersten Aufruf direkt nach dem Init. `ViewContent` für Landingpages vorbereiten (content_name = Seitenschlüssel, z. B. `lp_standtage`).
4. **Danke-Seite absichern:** Lead-ID und Token nach dem Einlesen sofort per `history.replaceState` aus der Adresse entfernen und intern im Seitenzustand behalten. Auf der Danke-Seite den Meta-PageView erst nach der Bereinigung senden.
5. **Calendly per Klick laden:** Platzhalter mit dem Hinweis „Kalender von Calendly laden“ zeigen, das Laden startet erst nach dem Klick. Den Namen nur mitgeben, wenn er selbst eingetragen wurde.
6. **Rechtstexte:** Datenschutz um einen Abschnitt „Meta-Pixel“ (Meta Platforms Ireland, Zweck, Einwilligung, Drittlandtransfer/DPF, Widerruf) und einen Abschnitt „Calendly“ ergänzen. Auf der Cookie-Seite Einträge für Meta-Pixel (`_fbp`, Marketing) und Calendly ergänzen. In den Unterauftragsverarbeitern Meta um Werbemessung erweitern. Im Banner Meta als Empfänger im Bereich Marketing nennen. Die Stände in `legal-config` aktualisieren. Die Einwilligungsversion nur nach Rücksprache erhöhen, weil das die erneute Abfrage bei allen auslöst.
7. **Prüfen:** mit Meta Pixel Helper und Events Manager (Test-Events). Vor der Einwilligung darf keine Anfrage an `facebook.com` oder `connect.facebook.net` gehen. Nach der Einwilligung genau ein PageView pro Route, Lead einmal pro Anfrage, Schedule einmal pro Termin. Die Danke-Adresse darf ohne Token ankommen. Nicht veröffentlichen.

## Spätere Ergänzungen (noch nicht bauen)
- **ViewContent:** pro Funnel-Landingpage einmal, mit Seitenschlüssel. Eignet sich für Zielgruppen, nicht als Conversion.
- **CompleteRegistration:** bei erfolgreicher Registrierung im Portal mit event_id `signup:<userId>` und ohne E-Mail.
- **Purchase:** nur über den Zahlungseingang (Stripe-Webhook) per Meta Conversions API auf dem Server, mit Nettowert, EUR und Dedup-event_id. Nicht auf der Erfolgsseite im Browser, weil sonst Doppelzählungen und Manipulation möglich sind. Dafür ist ein Conversions-API-Token als geheimer Schlüssel nötig.
- Zur Server-Ergänzung von Lead und Schedule über die Conversions API mit derselben event_id: optional später.

## Betroffene Dateien
- `src/lib/meta-pixel.ts`, `src/lib/funnel-tracking.ts`, `src/lib/consent.ts` (nur prüfen, Ladepunkt bleibt)
- `src/pages/funnel/FahrzeugTestenDanke.tsx`, `src/pages/funnel/FahrzeugTesten.tsx` (Weiterleitung)
- `src/components/consent/ConsentManager.tsx`
- `src/pages/legal/Datenschutz.tsx`, `Cookies.tsx`, `Unterauftragsverarbeiter.tsx`, `src/lib/legal-config.ts`, `docs/legal/SUBPROCESSORS-AUTO3.md`
- Nicht betroffen: `index.html`, Impressum, AGB, Footer, Rechtliches (nur der Stand wird automatisch übernommen), Generator, Stripe, Datenbank.
