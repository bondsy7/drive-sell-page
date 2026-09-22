# Rechtliche Informationsarchitektur überarbeiten

## Ziel
Die öffentlichen Rechtsinformationen werden über eine ruhige zentrale Übersicht erreichbar. Bestehende Direkt-URLs, Inhalte, Consent-Verhalten und die einmalige AGB-Annahme bleiben erhalten.

## Umsetzung
1. **Zentrale Dokumentstände**
   - `legal-config` um getrennte Versionen und sichtbare Standdaten für AGB, Datenschutz, Consent, AVV, TOMs, Unterauftragsverarbeiter und KI-Transparenz ergänzen.
   - Bestehende AGB-, Datenschutz- und Consent-Versionen bei `2026-09-16` belassen, damit keine erneute Annahme oder Consent-Abfrage ausgelöst wird.
   - Das Redaktionsdatum `22.09.2026` nur für die neue Übersicht bzw. die reine UI-Überarbeitung verwenden.

2. **Footer vereinfachen**
   - Sichtbare Einträge auf Impressum, Datenschutz, AGB, Cookie-Einstellungen und Rechtliches reduzieren.
   - Cookie-Einstellungen bleiben der bestehende Dialog-Button; Detailseiten bleiben unverändert direkt erreichbar.
   - B2B-Hinweis und Copyright in der vollständigen Variante kompakter ordnen und Fokuszustände beibehalten.

3. **Öffentliche Seite `/rechtliches`**
   - Neue Übersicht mit den drei Bereichen „Vertrag & Nutzung“, „Datenschutz & Sicherheit“ und „KI & Transparenz“ erstellen.
   - Jede Dokumentkarte erhält eine kurze sachliche Beschreibung, ihren Direktlink sowie den zentral gepflegten Stand.
   - App-weite öffentliche Route, Seitentitel, Beschreibung und selbstreferenzierende Canonical-URL über `usePageMeta` ergänzen.

4. **Gemeinsames LegalLayout**
   - Logo weiterhin mit der Startseite verlinken; den bisherigen Link „Zurück“ durch „Rechtliches“ nach `/rechtliches` ersetzen.
   - Bei langen Dokumenten mit Inhaltsverzeichnis am Ende einen dezenten Rückweg zur Übersicht ergänzen.
   - Bestehendes Inhaltsverzeichnis und semantische Struktur erhalten.

5. **Dokumente angleichen**
   - KI-Transparenz ohne fachliche Abschwächung in das gemeinsame LegalLayout und den SiteFooter übernehmen; die Trennung von Art. 50 Abs. 2 und Abs. 4 sowie die genannte Übergangsfrist bleiben bestehen.
   - In der Datenschutzerklärung nur die unverifizierte Aussage zum Datenschutzbeauftragten durch die gewünschte neutrale Kontaktformulierung ersetzen.
   - Die sichtbaren Standangaben der vorhandenen Dokumente an die zentrale Konfiguration anbinden.

## Technische Details
- Keine neue Bibliothek, keine Datenbankänderung, kein Deployment und kein Publish.
- Keine Änderungen an Auth, Vertragsannahme, Consent-Funktion, Preisen, Stripe oder Produktfunktionen.
- Prüfung mit TypeScript-/Build-Signal sowie Desktop- und Mobilansicht der neuen Übersicht und eines langen Rechtsdokuments.

## Annahme
Materiell unveränderte Dokumente behalten Version und Stand `2026-09-16`; nur die Übersichtsseite trägt den redaktionellen Stand `22.09.2026`.
