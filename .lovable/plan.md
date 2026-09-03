# Autohaus.AI — Read-only Status-Audit (HEAD, 3. Sep 2026)

Keine Datei, Migration, Einstellung oder Deployment wurde verändert. Grundlage: aktueller HEAD, ausgeführte Verifikation (Tests, Typecheck, Build, Lint) und Code-/Doku-Inspektion.

## 0. Verifikations-Ergebnisse (heute ausgeführt)

| Prüfung | Ergebnis |
|---|---|
| `vitest run` | 29 Dateien, **949 Tests, alle grün** (~40 s). 24 davon Reference V2, 5 sonstige (`utils`, `dashboard-hooks`, `spin360-core`, `vehicle-generation-lock`, `example`) |
| Typecheck (`tsconfig.app.json`, noEmit) | **fehlerfrei** |
| Production-Build (`vite build`) | **erfolgreich** (~30 s); Warnung: mehrere Chunks > 500 kB (index 719 kB, CanvasBannerStudio 616 kB, Index 405 kB) |
| Lint (`eslint .`) | **984 Probleme (921 Fehler, 63 Warnungen)** — dominiert von `no-explicit-any`. Baseline, kein Build-Blocker |
| Dedizierte Auth-E2E-Suite | **existiert nicht** — kein Playwright/Cypress/E2E-Setup im Repo, keine Testdatei zu Auth/Login/Signup/OAuth |

Wichtig: Die 949 Tests sind fast ausschließlich **Unit-/Domänen-Tests des neuen Reference-V2-Kerns**. Die produktiven Kernmodule (PDF-Generator, Remastering-Pipeline, Banner, Spin360-Runtime, Sales-CRM, Stripe, Auth) haben **keine automatisierten Tests**.

## 1. Implementiert vs. verifiziert

IMPLEMENTIERT = Code vorhanden und im UI erreichbar. VERIFIZIERT = automatisierte Testabdeckung im Repo.

| Modul | Status | Automatisierte Tests |
|---|---|---|
| PDF-Angebotsseiten-Generator (Analyse, Templates, Editor, Undo, Export, Pflichtangaben) | Implementiert, produktiv genutzt | Keine |
| Foto-Remastering / OneShot Studio (Pkw, Lkw, Motorrad, Slots, Szenen) | Implementiert | Keine (nur `vehicle-generation-lock`, 5 Tests) |
| Pipeline-Runner / Hintergrundverarbeitung | Implementiert | Keine |
| 360° Spin V2 (Keyframes, QA/Repair, Viewer) | Implementiert | `spin360-core` (Teilabdeckung Kernlogik) |
| Banner-Generator / Canvas Banner Studio | Implementiert | Keine |
| Hintergrund tauschen (remove.bg) | Implementiert | Keine |
| Schadensanalyse & -reparatur | Implementiert | Keine |
| Sales-Assistent / CRM / Termine / Angebote | Implementiert | Keine |
| Fahrzeug-Dashboard + Pagination | Implementiert | `dashboard-hooks` (7 Tests, Hook-Ebene) |
| Credits / Abos / Stripe-Checkout & Webhook | Implementiert | Keine |
| Admin-Bereich (27 Unterseiten) | Implementiert | Keine |
| KI-Kennzeichnung (Badges, /ki-transparenz) | Implementiert | Keine; Phase 3 (C2PA) bewusst offen |
| Reference V2 Domänenkern + Planner + Persistenz | Implementiert (Teil-Pipeline) | **Hoch: 949 Tests** |
| Musik-Studio, Rechner, API-Docs, QR-Login | Implementiert | Keine |

Belastbar „complete + verifiziert" ist damit ausschließlich der **Reference-V2-Domänenkern**. Alles andere ist „implementiert, manuell erprobt".

## 2. Bekannte Fehler / Limitierungen / aktive Neuentwicklung

- **Reference V2 ist in aktiver Entwicklung** und ausdrücklich unvollständig — Kachel im Code selbst als „Admin, im Aufbau" markiert; erreichbar nur über `/admin/reference-v2` (Admin-Gate).
- **Adjazenz-Substitution ist Vertragsfeld, aber nicht implementiert** (`planner-contract.ts:474`).
- **Kein Generierungspfad in V2**: kein Provider-Call, kein Generate-Button, keine Ausgabe-Persistenz — V2 endet vor der Bildgenerierung.
- Legacy-Remastering hat dokumentierte Qualitätsrisiken (Fahrzeug-Identität bei Facelifts, Perspektive/Seite, Spiegel/Kameras bei Lkw, Sideskirts, Sticker-Erkennung) — mehrfach durch Prompt-Locks nachgebessert, ohne automatisierte Regressionsprüfung.
- Externe Abhängigkeiten mit bekanntem Ausfallverhalten (z. B. VIN-Lookup 503) — nur defensiv abgefangen, nicht getestet.
- Lint-Baseline mit ~921 Fehlern, ~1000 `as any` (auch in ARCHITECTURE.md als offen geführt).
- Bundle-Größe/Code-Splitting nicht optimiert.

## 3. Foto-/Remaster-Workflow: Legacy vs. Reference Engine V2

**Legacy (produktiv):** OneShot Studio + RemasterOptions + PipelineRunner + `remaster-prompt.ts`. Steuerung über Prompt-Locks (Modell-, Lenkrad-, Spiegel-, Sideskirt-Lock, Marken-Sanitizing). Klassen: Pkw, Lkw, Motorrad. Keine automatisierten Tests; Qualität hängt an Prompt-Heuristik und Metadaten, die die KI in die Irre führen können.

**Zweck von V2:** Referenzbild als einzige visuelle Wahrheit. Strukturell ausgeschlossen sind Marke/Modell/Baujahr/VIN im Generierungs-Request; falsche Fahrzeugseite ist ein Hard-Fail; Perspektive, Flächenabdeckung und Referenzauswahl werden deterministisch statt heuristisch bestimmt.

**In V2 gebaut (HEAD, verifiziert per Dateiliste + Tests):**
- Phase 0: Domänenkern, 57 versionierte Perspective Specs, Winkel-/Seitenkonvention, Editing-Module, QA-Schwellen (provisorisch), deterministischer Prompt-Assembler.
- Phase 1: Referenz-Store, Ingestion-Governance, Vehicle/Perspective Master, Farbfamilien, Admin-UI.
- Phase 1.5: automatische Vision-Aufnahme, Edge Functions `reference-v2-analyze-image` und `reference-v2-upload-file`, serverseitige Validierung.
- Phase 2.0–2.5: Eligibility, Candidate-Scoring, Planner, Framing-Evidence (+Sidecar/Runtime), Output-Planner-UI (Preflight, ohne Generierung).
- Phase 2.6A–2.6C: Persistenz-Contract + DB-Schema (3 Tabellen mit RLS und Protection-Trigger), typisiertes Repository mit Row-Mappern, Original-Storage-Service (SHA-256, deterministische Pfade).

**Offen bis V2 die Produktion stützen/ablösen kann:**
1. Runtime-Orchestrierung: Upload → Analyse → Persistenz → Planner in einem durchgehenden Ablauf.
2. Generierungspfad: Provider-Anbindung, Bilderzeugung, Ergebnis-Persistenz.
3. QA-Runtime inkl. Repair-Loop; Schwellenwerte sind explizit „provisorisch, empirisch zu kalibrieren".
4. Adjazenz-Substitution.
5. Szenen/Logos in der Runtime, Kredit-/Kostenanbindung, Nutzer-UI außerhalb Admin.
6. Migrationsstrategie und A/B-Vergleich gegen Legacy.

## 4. Authentifizierung — Ist-Stand

Vorhanden im Code:
- `/auth`: Login und Registrierung (E-Mail/Passwort), Plan-/Cycle-Parameter, Google-OAuth-Button über den Lovable-Auth-Client, Weiterleitung nach Stripe-Checkout bei bezahlten Plänen.
- `AuthProvider` (`useAuth.tsx`): Session-Listener, Konsum von OAuth-Tokens aus Hash/Query (Mobile-Redirect), URL-Bereinigung, `signOut` mit lokalem Storage-Cleanup und Hard-Redirect auf `/auth`.
- `ProtectedRoute` (App.tsx): Redirect auf `/auth` ohne Session **plus E-Mail-Verifikations-Gate** (`email_confirmed_at`).
- `AdminRoute`: serverseitige Rollenprüfung über RPC `has_role` (Rollen in eigener Tabelle `user_roles`) — architektonisch korrekt.
- QR-Login (`/qr-login`, `verify-qr-token`, `generate-magic-link`).
- Passwort **ändern** im Profil (`updateUser`).

Nicht vorhanden / nicht verifiziert:
- **Kein „Passwort vergessen" / Recovery-Flow** — `resetPasswordForEmail` existiert nirgends im Code; auf `/auth` gibt es keinen entsprechenden Link.
- **Keine automatisierten Tests für irgendeinen Auth-Flow** — kein Unit-, Integrations- oder E2E-Test zu Login, Signup, Verifikation, Logout, OAuth, Admin-Gate, QR-Login, Stripe-Redirect.
- Google OAuth, Stripe-Checkout-Redirect, E-Mail-Zustellung (Verifikation) sind nur codeseitig vorhanden; im Repo existiert **kein Beleg für erfolgreiche E2E-Durchläufe**.

## 5. Offene technische/sicherheitsrelevante Punkte (aus Code/Doku)

- Kein E2E-Testframework, keine CI-Verifikationsstufe im Repo.
- Lint-Baseline 921 Fehler; ~1000 `as any`.
- ARCHITECTURE.md trägt **Stand 1. April 2026, Version 2.3** — deutlich älter als der aktuelle Stand (Reference V2, Spin V2, Background Swap, KI-Kennzeichnung). Doku ist **kein Testnachweis** und in Teilen veraltet.
- In der Doku als offen geführt: Leaked-Password-Protection, FTP-Passwörter im Klartext (pgcrypto empfohlen).
- KI-Kennzeichnung Phase 3 (C2PA/maschinenlesbar) offen; `/ki-transparenz` führt selbst eine Sektion „Noch offen".
- Kostenthema: Storage-Egress und DB-Bloat durch große HTML-Inhalte (früher analysiert, nicht abschließend behoben).
- V2-Kachel im Generator führt in einen Admin-Bereich — für normale Nutzer nicht sichtbar; in einer Demo erklärungsbedürftig.
- Bundle-Größe / fehlendes Code-Splitting.

## 6. Priorisierung für die DEKRA-Präsentation

**MUST-FIX vor der Präsentation**
1. Manuell verifizierter, protokollierter End-to-End-Durchlauf des Demo-Pfads (Login → Fahrzeug → Fotos/Remastering → Ergebnis → PDF-/Landingpage-Export) auf der Zielumgebung.
2. Auth-Happy-Path real durchspielen (Signup + E-Mail-Verifikation, Login, Logout, Google OAuth) auf der Demo-Domain; oder Demo-Accounts vorab anlegen und OAuth aus der Demo ausklammern.
3. Entscheidung + Beschriftung zu Reference V2: als „in Entwicklung" kennzeichnen oder Kachel für die Demo ausblenden.
4. Demo-Daten und Credits der Demo-Accounts sicherstellen (Kontingente, Rate-Limits, Plan-Zuordnung).
5. Fallback-Plan für externe Dienste (VIN, Gemini, remove.bg): vorbereitete Ergebnisse als Backup.

**Demo-abhängig**
- Stripe-Checkout live zeigen (sonst nur Pricing-Seite zeigen).
- Sales-CRM/E-Mail-Versand, 360°-Spin live-generieren (lange Laufzeit) vs. vorproduziert.
- Lkw-/Motorrad-Workflow, Banner-Studio, Musik-Studio.

**Post-Demo**
- Reference V2 Phase 2.6D+ und Generierungspfad.
- E2E-Suite (Auth + Kernworkflow), CI-Gate.
- Lint-/`any`-Abbau, Bundle-Splitting, Storage-/DB-Kostenoptimierung.
- Passwort-Reset-Flow, Leaked-Password-Protection, FTP-Passwort-Verschlüsselung.
- ARCHITECTURE.md aktualisieren.

## 7. Aufwandsschätzung (Personenstunden, Implementierung vs. Test)

| Punkt | Implementierung | Regression/E2E-Test |
|---|---|---|
| Demo-Pfad manuell verifizieren + Fehlerbehebung aus Funden | 8–20 | 6–12 |
| Auth-Happy-Path real prüfen + Demo-Accounts | 3–6 | 3–6 |
| V2-Kachel-Kennzeichnung/Ausblenden | 1–2 | 1–2 |
| Demo-Daten, Credits, Limits | 3–6 | 2–4 |
| Fallback-Assets/Notfallplan | 4–8 | 2–4 |
| Stripe-Checkout live absichern (falls Demo-Bestandteil) | 4–10 | 4–8 |
| Passwort-Reset-Flow | 6–12 | 4–8 |
| Auth-E2E-Suite (Playwright, Setup + Kernflows) | 16–30 | 12–24 |
| E2E-Suite Kernworkflow (Foto/Remaster/PDF) | 24–48 | 20–40 |
| Reference V2 Runtime-Orchestrierung + Generierung + QA-Runtime | 120–260 | 60–120 |
| Adjazenz-Substitution | 16–32 | 10–20 |
| Lint-/`any`-Abbau + Bundle-Splitting | 40–90 | 10–20 |
| Sicherheits-Punkte (Leaked PW, FTP-Verschlüsselung, RLS-Review) | 16–36 | 8–16 |
| Kosten-/Storage-Optimierung (HTML aus DB) | 24–50 | 10–20 |
| Doku-Aktualisierung | 10–20 | – |

## 8. Gesamtaufwand

**(a) Kontrollierte DEKRA-Demo des Kern-Workflows: 25–60 Personenstunden.**
Annahmen: Demo läuft auf vorbereiteten Accounts und Fahrzeugen, Reference V2 wird nicht als fertiges Produkt gezeigt, Stripe/OAuth optional, Verifikation manuell und protokolliert (keine neue Automatisierung), keine unvorhergesehenen Blocker in den Kernpfaden.

**(b) Wirklich produktionsreife, stabile Gesamtplattform: 400–800 Personenstunden.**
Annahmen: Reference V2 wird bis zum produktiven Generierungspfad geführt und löst Legacy ab, E2E-Automatisierung für Auth und Kernworkflows, CI-Gate, Sicherheits- und Kostenpunkte abgearbeitet, Doku aktuell; ohne neue Features und ohne Lastests/Zertifizierungsaufwand.

## 9. „Vollständig funktionsfähig, getestet und präsentationsbereit"?

**Nein — qualifiziert.**
- *Funktionsfähig:* weitgehend ja für die Legacy-Kernmodule; Build und Typecheck sind sauber, die Module sind erreichbar und produktiv im Einsatz.
- *Getestet:* nein. 949 grüne Tests decken fast ausschließlich den neuen Reference-V2-Domänenkern ab. Auth, Zahlungen, Remastering, PDF-Generator, Spin, Banner und CRM haben keine automatisierten Tests und keine E2E-Suite.
- *Präsentationsbereit:* ja für eine **kontrollierte, vorbereitete Demo** des Kern-Workflows; nein für eine freie Exploration der gesamten Plattform, weil Reference V2 unfertig ist, kein Passwort-Reset existiert und externe Integrationen ohne Nachweis laufen.

Formulierungsempfehlung gegenüber DEKRA: „produktiv nutzbarer Kern-Workflow, in kontrollierter Demo vorführbar; neue Reference-Engine V2 in aktiver Entwicklung mit umfangreicher Testabdeckung des Kerns; plattformweite automatisierte Verifikation steht noch aus."

## 10. Hinweise zur Belastbarkeit dieses Audits

- Keine Aussage in diesem Dokument behauptet einen verifizierten Live-Betrieb von Stripe, Google OAuth, Resend, OutVin, Gemini oder remove.bg — dafür gibt es im Repository keine Integrationstests.
- Architektur-Dokumente (ARCHITECTURE.md, Stand April 2026; Pläne unter `.lovable/`) sind Planungsartefakte, kein Testnachweis, und teilweise überholt.
