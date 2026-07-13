# Plan: KI-Kennzeichnungspflicht ab 2. August 2026 (EU AI Act, Art. 50)

Status: Recherche + Umsetzungsplan. Noch KEINE Codeänderungen.
Letzte Aktualisierung: 2026-07-13

---

## 1. Rechtliche Grundlage – was ab 2.8.2026 gilt

Rechtsquelle: **Verordnung (EU) 2024/1689 (KI-VO / EU AI Act), Artikel 50**.
Stichtag: **2. August 2026** – die Transparenzpflichten aus Art. 50 werden anwendbar (Hochrisiko-Fristen werden durch den „Digital Omnibus" ggf. verschoben, Art. 50 NICHT).

Quellen (Recherche 07/2026):
- EU-Kommission, Code of Practice on Transparency of AI-Generated Content: https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content
- Draft Guidelines der Kommission zu Art. 50 (Mai 2026): https://escaramozzino.legal/wp-content/uploads/2026/05/Draft-Guidelines-on-the-implementation-of-the-transparency-obligations-applicable-to-certain-AI-systems-in-Article-50-AI-Act.pdf
- TÜV: https://consulting.tuv.com/aktuelles/ki-im-fokus/transparenzpflichten-eu-ai-act-art-50
- Melchers: https://blog.melchers-law.com/ki-generierte-bilder-was-sie-ab-august-2026-kennzeichnen-muessen/
- Bird & Bird: https://www.twobirds.com/en/insights/2026/taking-the-eu-ai-act-to-practice-reading-the-commissions-draft-article-50-guidelines
- Cortina Consult: https://cortina-consult.com/ki-compliance/wissen/ki-kennzeichnungspflicht/

### 1.1 Zwei getrennte Pflichten, die uns betreffen

**A) Maschinenlesbare Markierung (Art. 50 Abs. 2)** – Pflicht des **Anbieters** des generativen KI-Systems
- Output (Bild, Video, Audio, synth. Text) muss in einem maschinenlesbaren Format markiert sein und als künstlich erzeugt/verändert erkennbar sein.
- Standards: **C2PA / Content Credentials** (Manifest im Bild), unsichtbare **Wasserzeichen** (z. B. Google SynthID, Meta AI-Wasserzeichen), kryptografische Signaturen.
- Muss „so weit technisch möglich" wirksam, interoperabel, robust und zuverlässig sein.
- Formell trifft das primär die Modell-Anbieter (Google Gemini, OpenAI, Meta). AUTO3 als Reseller/Aggregator ist rechtlich „Deployer", ABER: wir MÜSSEN sicherstellen, dass wir vorhandene Metadaten/Wasserzeichen nicht entfernen und, wo sinnvoll, eigene C2PA-Manifeste hinzufügen.

**B) Sichtbare Kennzeichnung (Art. 50 Abs. 4)** – Pflicht des **Betreibers/Deployers** (das sind WIR und unsere Kunden = Autohäuser)
- Betrifft **Deepfakes**: KI-generierte oder -manipulierte Bild-/Video-/Audioinhalte, die realen Personen, Gegenständen, Orten oder Ereignissen ähneln und **fälschlich als echt** erscheinen könnten.
- „Klar und deutlich" spätestens bei erster Interaktion/Wahrnehmung offenzulegen als **KI-generiert** oder **künstlich verändert**.
- Ausnahmen: Kunst, Satire, offensichtlich fiktional – dann Hinweis „in geeigneter Weise, ohne die Darstellung zu beeinträchtigen".
- Rein privater Gebrauch: ausgenommen. **Sobald veröffentlicht (Social, Website, PDF an Kunde, Landingpage) → Pflicht.**

### 1.2 Konkrete Einordnung für AUTO3

Was AUTO3 tut, fällt größtenteils unter „Deepfake"-Definition (fotorealistische, von realen Fahrzeugen kaum unterscheidbare Bilder):
- **Remastering** (Basis-Foto wird in neue Szene gesetzt) → **kennzeichnungspflichtig** (Manipulation eines realen Objekts)
- **Vollständig generierte Szenen / Banner / Landing-Page-Hero** → **kennzeichnungspflichtig**
- **360°-Spins aus generierten Frames** → **kennzeichnungspflichtig**
- **Repair-Damage-Bilder** (Schadensvisualisierung) → **kennzeichnungspflichtig**, kritisch: könnte täuschen
- **Reine Datenextraktion (VIN-Lookup, PDF-OCR, Text-Zusammenfassungen)** → NICHT unter Art. 50 Abs. 4 (kein synth. Bild/Video/Audio). Für **generierte Verkaufstexte / Landingpage-Texte** greift ggf. Art. 50 Abs. 4 UAbs. 2 (Text zu Angelegenheiten öffentlichen Interesses) – bei uns eher NICHT einschlägig, aber Best Practice: Hinweis.
- **Musik-Studio (KI-Audio)** → **kennzeichnungspflichtig**, wenn veröffentlicht.

### 1.3 Sanktionen
Bis zu **15 Mio. EUR oder 3 % des weltweiten Jahresumsatzes** (Art. 99 Abs. 4 KI-VO). Aufsicht in DE: BNetzA (Marktüberwachung) + BfDI.

---

## 2. Umsetzungsplan für AUTO3

Ziel: bis **2. August 2026** vollständige Compliance, ohne UX, Geschwindigkeit oder Datenpipeline zu verschlechtern.

### Phase 1 – Grundlage (Woche 1)

1. **Content-Register in DB anlegen**
   Neue Tabelle `ai_content_registry`:
   - `id`, `user_id`, `vehicle_id`, `asset_url`, `asset_type` (image/video/audio/text)
   - `generator` (gemini-3-flash-image, gpt-image-1, veo-3, …)
   - `generation_type` (remaster / banner / landing_hero / spin / repair / music / text)
   - `base_image_ref` (Original-Foto-Referenz, falls Manipulation eines Realbildes)
   - `c2pa_manifest_id`, `watermark_status` (`native_present` | `added_by_auto3` | `none`)
   - `is_deepfake` (bool, Default true bei Bild/Video/Audio)
   - `label_required` (bool), `label_applied_at`
   - `created_at`
   - RLS + GRANTs (SELECT/INSERT authenticated + service_role ALL) wie üblich.

2. **Zentrale Konstante `AI_DISCLOSURE`** in `src/lib/ai-disclosure.ts`:
   - `LABEL_DE = "KI-generiert"` / `LABEL_LONG_DE = "Mit KI erstellt oder verändert (EU AI Act Art. 50)"`
   - `LABEL_EN = "AI-generated"`
   - Icon-SVG (Sparkle + „AI")
   - Helper: `getLabelForContext(context)` → passender Text für Social/PDF/LP/Banner.

### Phase 2 – Sichtbare Kennzeichnung (Woche 1–2)

Muss überall greifen, wo generierte Medien nach außen gehen:

| Ausgabekanal | Umsetzung |
|---|---|
| **Banner (Canvas Banner Studio)** | Nicht-entfernbares Label-Layer als eigene Ebene „🅰🅘 KI-generiert" – Position: untere rechte Ecke, halbtransparenter Chip, Mindesthöhe 3 % der Bildhöhe, Kontrast ≥ 4.5:1. Beim Export in Bilddatei einbrennen. Beim Publish (Instagram/FB/Auto3) zusätzlich in Caption: „#KIgeneriert · Bild mit KI erstellt". |
| **Landing Pages** | Sichtbarer Footer-Hinweis + Hover-Badge auf jedem KI-Bild („KI-generiert"). Alt-Text erweitern: `"[…] – KI-generiert"`. |
| **PDF-Datenblatt** | Fußzeile: „Fahrzeugbilder mit KI aufbereitet gem. EU AI Act Art. 50." |
| **360° Spin Viewer** | Overlay-Badge unten links („KI-optimierte Ansicht"). |
| **Damage-Repair „Nachher"-Bild** | Wasserzeichen im Bild: „KI-VISUALISIERUNG – nicht bindend". Strengste Stufe, weil täuschungsanfällig. |
| **Musik-Studio** | Audiotitel-Metadaten + sichtbarer Player-Hinweis „KI-generierte Musik". |
| **Sales Chat / generierte Texte** | Nur wenn kundenseitig veröffentlicht: Hinweis „Antwort mit KI-Unterstützung erstellt" beim Kopieren in Kundenkommunikation. |
| **Social Publish Modal** | Automatisch Suffix in Caption: `\n\n#KIgeneriert #AIgenerated` + „Bild künstlich erstellt/verändert (EU AI Act)". Nicht deaktivierbar für Deepfake-Kategorien. |

### Phase 3 – Maschinenlesbare Markierung (Woche 2–3)

1. **Native-Wasserzeichen erhalten** – aktuell strippt niemand Metadaten, aber prüfen:
   - Gemini 2.5/3 Flash Image: liefert SynthID unsichtbar ✔ (nicht entfernen)
   - GPT-Image-1/2: OpenAI setzt C2PA-Manifest ✔ (bei uns `b64_json` → Manifest geht verloren! **Fix nötig**: `output_format` prüfen bzw. Manifest via response header speichern und re-embedden).

2. **Eigenes C2PA-Manifest hinzufügen** via **`c2pa-node`** (Adobe Open Source, Rust-Binding) in einer neuen Edge Function `stamp-c2pa`:
   - Input: generiertes Bild + Metadaten (generator, prompt-hash, vehicle_id, timestamp, actor=AUTO3)
   - Output: gleiches Bild mit eingebettetem C2PA-Manifest + Content-Credentials-Zertifikat.
   - Wird nach JEDER Bilderzeugung aufgerufen, BEVOR das Bild in Storage geschrieben wird.
   - Performance: Manifest-Embed ~50–150 ms/Bild. Parallelisierbar. Kein spürbarer UX-Impact.

3. **Signaturzertifikat**:
   - Zunächst self-signed Test-Cert (Content Credentials Trust List akzeptiert später produktives Cert)
   - Später: Cert von Adobe/Truepic/DigiCert Content Credentials Trust Program (kostenlos für Publisher).

4. **Videos (Veo)**: C2PA für Video via `c2pa-node` ebenfalls möglich; alternativ Metadaten in MP4-`uuid`-Box. Sichtbares Wasserzeichen im letzten Frame + kontinuierlich unten rechts.

5. **Audio (Musik)**: C2PA-Audio-Manifest + hörbarer Hinweis am Anfang OPTIONAL, sichtbares Label im Player Pflicht.

### Phase 4 – Prozess & Doku (Woche 3)

1. **AGB / Nutzungsbedingungen** ergänzen: „Der Nutzer verpflichtet sich, KI-generierte Inhalte gemäß EU AI Act Art. 50 zu kennzeichnen. AUTO3 stellt technische Mittel bereit."
2. **Dashboard-Onboarding-Hinweis** einmalig: „Ab 2.8.2026 werden alle mit AUTO3 erzeugten Bilder automatisch als KI-generiert gekennzeichnet."
3. **Admin-Panel**: `AdminAiCompliance.tsx` mit Übersicht C2PA-Coverage, fehlende Labels, Report-Export (Aufsichtsbehörden-ready).
4. **Datenschutz-/Info-Seite** `/ki-transparenz` öffentlich – erklärt Verfahren, verwendete Modelle, Wasserzeichen-Standards. Wird von der Aufsicht positiv gewertet (Rechenschaftspflicht Art. 50 Abs. 5).

### Phase 5 – QA & Rollout (bis 25.7.2026)

- Testfälle: jeder Ausgabekanal + Verify-Tool (verify.contentauthenticity.org) muss unser Manifest lesen.
- Load-Test C2PA-Stamp bei 50 parallelen Bildern.
- Freigabe durch juristische Kurzprüfung.

---

## 3. Technische Kurzübersicht (für Entwickler)

```
Generation Edge Function
        │
        ▼
   [Bild-Buffer]
        │
        ├── (a) Sichtbares Label einrendern (nur wenn Ausgabekanal = end-user-visible)
        │        via Canvas/Sharp in eigener Utility src/lib/ai-visible-label.ts
        │
        ├── (b) stamp-c2pa Edge Function (c2pa-node)
        │        → Manifest {claim_generator, actions, ingredients, signature}
        │
        ├── (c) DB-Insert in ai_content_registry
        │
        ▼
   Storage Upload → Signed URL → Client
```

Keine Änderung an bestehenden Prompts, keine Änderung an Modellauswahl, keine Latenzverschlechterung > 200 ms/Asset.

---

## 4. Offene Punkte / Klärungsbedarf

1. **Zielmärkte außerhalb EU**: Kennzeichnung global anwenden oder per Region toggeln? (Empfehlung: global, einfacher + Vertrauen).
2. **Bestandsdaten** (vor 2.8.2026 erzeugte Bilder): Nachkennzeichnen? Art. 50 gilt für ab 2.8.26 in Verkehr gebrachte Inhalte – aber wenn wir sie weiter ausspielen (Landingpage lebt weiter), sicherheitshalber **nachträglich taggen**. Migration-Script vorbereiten.
3. **White-Label-Kunden**: dürfen sie das Label entfernen? → **Nein**, technisch verhindern (Label-Layer read-only im Editor).
4. **Auto3-Publish-Endpoint** (`publish-banner-to-auto3`): externes Portal muss unsere Caption-Erweiterung akzeptieren – abklären.

---

## 5. Zeitplan

| KW | Meilenstein |
|---|---|
| KW 29 (jetzt) | Plan-Approval, `ai_content_registry` Migration, `ai-disclosure.ts` |
| KW 30 | Sichtbare Labels in Banner/LP/PDF/Spin/Repair/Musik |
| KW 31 | C2PA Edge Function + Integration in alle Generatoren |
| KW 32 | Admin-Panel, Public-Info-Seite, AGB-Update |
| KW 32 (spätestens 30.7.) | Full-QA, Freigabe |
| **2.8.2026** | **Go-Live Compliance** |

---

## 6. TL;DR

- Ab **2.8.2026**: alle mit AUTO3 erzeugten Fahrzeugbilder/-videos/-audios sind **Deepfakes im Sinne Art. 50** und brauchen **(a) sichtbares Label** + **(b) maschinenlesbares C2PA-Manifest / Wasserzeichen**.
- Umsetzung: neues `ai_content_registry`, zentrale `ai-disclosure.ts`, neue Edge Function `stamp-c2pa`, sichtbare Label-Overlays pro Ausgabekanal, Caption-Suffix beim Social-Publish, öffentliche `/ki-transparenz`-Seite, AGB-Update.
- Aufwand: ~3 Wochen Entwicklung + 1 Woche QA. Keine spürbaren Performance-Einbußen.
- Risiko bei Nichtumsetzung: bis 15 Mio. € Bußgeld, Abmahnungen durch Wettbewerber.
