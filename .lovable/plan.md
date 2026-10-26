# Vehicle Image Fidelity Check – Analyse und Plan (nur Planung)

## A) Ist-Analyse

Vorhandene Schutzmechanismen (im Code bestätigt):
- **Prompt-seitig:** Reference Truth Protocol, NB21 V1/V2/V3-Contracts (`_shared/nb21-v2-contract.ts`, `nb21-v2-wire.ts`, `nb21-v3-contract.ts`, `nb21-v3-prompt.ts`) mit Evidence-Manifest, Seiten-Contracts und Lichtprofil. Serverseitig wird geprüft, ob Referenzen und Manifest zusammenpassen (`validateV2Wire`, `validateV3Wire`), nicht aber das Ergebnis.
- **Seitenregel:** Prompt-Hinweis „SERVER SIDE CHECK … Never mirror" in `remaster-vehicle-image` (ca. Z. 236, 708). Das ist nur eine Anweisung an den Generator, keine echte Prüfung.
- **Retries:** nur technische Wiederholungen (Dateireferenz-Fehler, 429/5xx, Zeitbudget; Z. 1309, 1493, 1612), keine inhaltlichen.
- **Felgen:** `analyze-wheel-reference` + `src/lib/wheel-reference.ts` (eigene Felgenaufnahme oder Ausschnitt aus einem Foto, Analyse mit Konfidenz, blockiert nie).
- **Analyse der Originale:** `reference-v2-analyze-image`, `classify-vehicle-images`, `_shared/auto3-analysis.ts`. Klassifizieren Perspektive und Qualität, liefern aber keinen Merkmalskatalog fürs Fahrzeug.
- **360°:** `spin360-v2.ts` hat QA/Repair pro Frame (`needs_review`, `spin360_frame_reviews`). Das ist das einzige echte Prüfmuster nach der Generierung, beschränkt auf Spins.
- **Telemetrie:** `generation_attempt_logs` (Stufe, Status, Versuch, Engine, Modell, Dauer) über `remaster-vehicle-image` und `src/lib/generation-log.ts`.
- **Speicherung:** `_shared/remaster-gallery.ts` speichert vor der Auslieferung. Danach erscheinen Ergebnisse sofort in der Galerie.

Lücken:
1. Für Remaster, Generate, OneShot/Auto3, Banner-Hero und Grid-Regenerierung gibt es keine inhaltliche Prüfung nach der Generierung.
2. Es gibt keinen dauerhaften Merkmalskatalog pro Fahrzeug, der aus den Originalen abgeleitet ist. Jede Generierung liest die Referenzen erneut nur über den Prompt.
3. Es gibt keinen Retry mit Fehlerliste. Retries sind blind und wiederholen dieselbe Anfrage.
4. Es gibt keinen Freigabestatus pro Bild. Was gespeichert wird, gilt als freigegeben, und Auto3-Hintergrundjobs veröffentlichen ohne Prüfung in die Galerie.
5. Die Felgenanalyse wird nur als Prompt-Eingabe genutzt, nicht als Prüfkriterium.
6. Es gibt keinen Weg für Fehlermeldungen von Nutzern.

## B) Zielarchitektur und Datenfluss

```text
Originale ──► [1] Feature Extraction (einmal pro Fahrzeug, gecacht)
                 └► vehicle_fidelity_profiles (Merkmale + Evidenz-Bild-IDs + Sichtbarkeit)
Generierung ──► Ergebnis gespeichert (status=pending_qa)
           ──► [2] fidelity-check (Validator, anderer Provider)
                 Eingabe: Ergebnisbild + 1–3 perspektivpassende Originale
                          + Merkmalskatalog (Text) + Felgenreferenz falls Rad sichtbar
                 Ausgabe: strukturiertes JSON
           ──► [3] Entscheidung PASS / WARN / FAIL
                 FAIL & retry_count=0 ──► [4] Korrekturlauf mit Abweichungsliste ──► [2]
                 weiterhin FAIL ──► needs_manual_approval
           ──► Galerie-Badge + Vergleichsansicht
Nutzermeldung ──► fidelity_feedback (Grundlage zur Regelverbesserung)
```

Die Prüfung läuft serverseitig und asynchron, nach dem bestehenden Muster aus Schritten, die sich selbst aufrufen (wie bei `auto3-processing-job`). Dadurch hängt sie nicht vom offenen Browser ab und blockiert die Auslieferung im Shadow Mode nicht.

## C) Betroffene Dateien, Funktionen und DB

Neu:
- `supabase/functions/fidelity-check/index.ts`: Validator plus Entscheidung, ein Schritt pro Aufruf.
- `supabase/functions/fidelity-extract-profile/index.ts`: Merkmalskatalog aus den Originalen. Bindet `analyze-wheel-reference` ein, statt die Felgenanalyse ein zweites Mal zu bauen.
- `_shared/fidelity-schema.ts`: reiner Vertrag für Attribute, Gewichte, Schwellen, JSON-Validierung und Scoring.
- `_shared/fidelity-reference-select.ts`: Auswahl der Originale nach Perspektive, wiederverwendet aus der Logik zur Referenzzuordnung und dem V2/V3-Resolver.
- `_shared/fidelity-correction-prompt.ts`: Abweichungsblock für den Korrekturlauf als Anhang. V1/V2-Builder bleiben eingefroren, der Block wird nur als Zusatz-Sektion angehängt.
- UI: `src/components/gallery/FidelityBadge.tsx`, `FidelityCompareDialog.tsx`, `FidelityReportButton.tsx`.

Anzupassen (nur Hooks, keine Änderung der Prompt-Logik):
- `remaster-vehicle-image`, `generate-vehicle-image`, `reference-v2-generate-image`, `auto3-processing-job`, `generate-master-banner-image`: nach dem Speichern einen Prüfauftrag anlegen.
- `_shared/remaster-gallery.ts`: liefert die Bild-ID für den Prüfauftrag.
- `src/contexts/PipelineContext.tsx` und `src/lib/pipeline-jobs.ts`: Prüfstatus per Abfrage oder Realtime anzeigen.
- Galerie-Komponenten und Lightbox: Badge und Vergleichsansicht.
- Freigabe-Gates: Website-Publishing, Auto3-Publish und Landingpage-Bildauswahl lassen Bilder mit `needs_manual_approval` erst nach manueller Freigabe durch.
- Admin: `AdminGenerationLogs` bekommt eine Fidelity-Spalte.

Neue Tabellen (RLS: Besitzer liest, Schreiben nur mit Service-Rolle):
- `vehicle_fidelity_profiles`: vehicle_id, source_set_hash, features jsonb, extractor_model, version, created_at.
- `image_fidelity_checks`: id, generation_job_id, vehicle_id, generated_image_id, generated_image_sha256, source_image_ids[], source_hashes[], profile_version, validator_provider/model/prompt_version, attempt (0/1), overall_score, status, critical_mismatches jsonb, warnings jsonb, unverifiable_items jsonb, per_attribute_scores jsonb, retry_reason, final_status, duration_ms, cost_estimate, created_at.
- `project_images` bekommt zusätzlich: fidelity_status (unchecked | pending | passed | warned | failed | needs_manual_approval | manually_approved), fidelity_check_id, approved_by, approved_at.
- `fidelity_feedback`: image_id, check_id, user_id, attribute, description, kind (false_positive | missed_error), created_at.

In Logs landen keine Bilddaten, nur IDs, SHA-256-Hashes und Scores.

## D) Bewertungsschema

Jedes Attribut bekommt `visibility` (verifiable | partially | unverifiable) und, falls prüfbar, `match` (match | minor | mismatch), eine Konfidenz von 0 bis 1, `evidence_source_ids` und `reason` (höchstens 140 Zeichen).

| Klasse | Attribute | Gewicht | Mismatch |
|---|---|---|---|
| Kritisch | Karosserie/Modellvariante, Türanzahl, Lackfarbe, Felgen/Raddesign, Lichtsignatur vorn/hinten, Grill/Frontschürze, Interieurfarbe/-material, Seitenrichtung (Spiegelung) | 10 | Critical, löst FAIL aus |
| Hoch | Stoßfänger, Außenspiegel, Dach/Dachreling, Fensterlinie, Sitze, Lenkrad/Cockpit/Displays, markante Sonderausstattung | 6 | Warning, ein Critical bei Konfidenz ≥ 0,8 und deutlicher Abweichung |
| Mittel | Embleme/Schriftzüge, Türgriffe, Sensoren/Kameras, Kennzeichenbereich | 3 | Warning |
| Gering | Glanz, Reflexe, Kleinteile | 1 | Hinweis |

Der Score berücksichtigt nur prüfbare Attribute: `Σ(Gewicht·Teilscore) / Σ(Gewicht prüfbar) · 100`. Teilscores: match 1,0, minor 0,6, mismatch 0. Nicht prüfbare Attribute fließen nicht ein und landen in `unverifiable_items`.

Schwellen (Startwerte, in Shadow Mode kalibrieren):
- **PASS:** Score ≥ 92, kein Critical und prüfbare Abdeckung ≥ 60 % des kritischen Gewichts.
- **WARN:** Score 80–91, oder Abdeckung unter 60 %, oder ein Critical mit Konfidenz unter 0,7.
- **FAIL:** Score unter 80 oder mindestens ein Critical mit Konfidenz ≥ 0,7.

Regeln gegen Halluzinationen im Prompt des Validators:
- Nur Merkmale bewerten, die in mindestens einem Original sichtbar sind, mit Bild-ID als Beleg.
- Nur prüfen, was im Ergebnis aus der Zielperspektive sichtbar sein kann.
- Kein Wissen über Marke oder Modell verwenden.
- Bei Zweifel `unverifiable` setzen.
- Die Ausgabe muss das JSON-Schema einhalten. Ungültige Ausgaben werden einmal repariert, sonst Status `check_error`. Das ist kein FAIL.

## E) Retry- und Freigabelogik

1. Erstes Ergebnis ist FAIL: genau ein Korrekturlauf mit derselben Stufe und Engine (Tier-Bindung, kein Wechsel zu einer anderen Engine) und denselben Originalen. Dazu kommt ein maschinenlesbarer Block `CORRECTIONS: [{attribute, expected_from_source_id, observed, instruction}]`. Das fehlerhafte Ergebnis wird nicht als Referenz mitgeschickt, um Fehlerverstärkung zu vermeiden (entspricht der bestehenden Seed-Regel).
2. Danach erneute Prüfung. PASS/WARN ersetzt das erste Bild (das erste Bild wird archiviert, nicht gelöscht). Weiterhin FAIL ergibt `needs_manual_approval`: Das Bild bleibt sichtbar, ist aber für Website, Auto3-Publish und Landingpage gesperrt, bis jemand freigibt.
3. Credits: Ein Korrekturlauf nach FAIL kostet den Händler nichts, denn es ist ein Systemfehler. Die Prüfkosten trägt die Plattform. Es gibt nie automatische Zusatzkosten (bestehende Regel).
4. Ein Prüfungsfehler (Timeout, Provider) ergibt „Nicht geprüft". Das blockiert nie und löst keinen Retry aus.

## F) Modell- und Provider-Empfehlung

- **Generator:** Gemini (NB 2/Pro) bzw. OpenAI gpt-image, je nach Stufe.
- **Validator:** ein anderer Provider als der Generator des jeweiligen Bildes, das verringert Selbstbestätigung. Vorschlag:
  - Gemini-generiert: Prüfung mit OpenAI GPT-5-mini (Vision). Bei FAIL eine Zweitmeinung mit GPT-5.
  - OpenAI-generiert: Prüfung mit Gemini 2.5 Flash bzw. 3 Flash. Bei FAIL eine Zweitmeinung mit Gemini Pro.
- **Zweistufig:** Das günstige Modell prüft alles. Das starke Modell bestätigt nur FAIL und Critical-Funde, bevor ein Retry ausgelöst wird. Das senkt Fehlalarme und Kosten.
- **Kosten (grob, zu verifizieren):** ca. 3 Bilder à 768–1024 px plus Merkmalstext ergeben etwa 0,002–0,01 $ pro Prüfung bei Flash/mini. Die Zweitmeinung kostet ca. 0,02–0,04 $. Latenz ca. 4–10 s, im Shadow Mode asynchron. Die Extraktion des Profils fällt einmal pro Fahrzeug an (ca. 0,01–0,03 $).
- Der Provider wird pro Lauf protokolliert. Ein Wechsel ist per Admin-Einstellung möglich.

## Referenzstrategie (Kosten)

- Das Merkmalsprofil wird einmal pro Fahrzeug aus allen Originalen extrahiert und erst bei geändertem `source_set_hash` neu berechnet.
- Pro Prüfung: ein Blueprint-Original passend zur Zielperspektive plus höchstens zwei Detailbelege (z. B. Felge oder Leuchte, wenn im Ziel sichtbar). Die Originale werden auf etwa 1024 px verkleinert und als Gemini-File-URI (File API First) oder OpenAI-file_id wiederverwendet.
- Interieur-Grids werden pro Kachel geprüft, gegen die passenden Interieur-Originale.

## G) Stufenplan

1. **Fundament:** Schema-Vertrag, Tabellen, Merkmalsprofil inklusive Felgen-Integration und Tests zum Scoring. Keine Auswirkung für Nutzer.
2. **Shadow Mode:** Prüfung läuft asynchron nach jeder Generierung (zuerst Remaster und OneShot), nur Logging und Admin-Ansicht. Kein Retry, keine Badges. Einige Wochen sammeln, Stichproben manuell labeln und Schwellen sowie Gewichte kalibrieren (Ziel: Fehlalarmrate unter 5 % bei FAIL).
3. **Sichtbar ohne Sperre:** Badges „Geprüft", „Prüfung mit Hinweis" und „Abweichung erkannt", Vergleichsansicht und Fehler-melden-Button. Zuerst nur für Test-Accounts.
4. **Retry aktiv:** Ein Korrekturlauf bei bestätigtem FAIL, zunächst nur für Test-Accounts.
5. **Produktiv:** Freigabesperre für Publish-Wege, Ausweitung auf Banner-Hero, Grid und Auto3-Hintergrundjobs. 360° behält das eigene Frame-QA und wird nur in der Darstellung angeglichen.
6. **Feedback-Schleife:** Auswertung von `fidelity_feedback` pro Attribut und Provider, um Regeln und Gewichte anzupassen.

## H) Risiken und Fehlalarme

- **Perspektive:** Belege müssen zur Perspektive passen. Nicht sichtbare Bereiche gelten als `unverifiable`, nicht als Mismatch. Seitenrichtung wird nur bei einem eindeutigen Beleg für die Flanke geprüft.
- **Verdeckte Details:** Spiegelungen, Schatten oder Sitze, die Teile verdecken, kennzeichnet der Validator als partially. Daraus entsteht nie ein Critical.
- **Schlechte Originale:** Bei geringer Belegqualität ist die Abdeckung niedrig, das Ergebnis WARN und das Profil vermerkt „Belegqualität gering". So entsteht kein FAIL-Spam.
- **Lichtunterschiede:** Die bewusste Serienbelichtung darf nicht als Farbabweichung zählen. Der Validator vergleicht den Farbton, nicht die Helligkeit.
- **Gewollte Änderungen:** Kennzeichen-Ersatz, Branding und Hintergrund werden aus dem Job-Contract als erlaubte Abweichungen übergeben.
- **Validator-Halluzination:** Pflicht zur Bild-ID als Beleg, Zweitmeinung vor FAIL und JSON-Schema-Prüfung.
- **Kosten und Latenz:** Asynchron, gecachtes Profil, kleine Belegauswahl, Begrenzung pro Fahrzeug.
- **Eingefrorene Versionen:** V1/V2-Builder bleiben unverändert. Der Korrekturblock wird nur angehängt und versioniert, damit Ergebnisse reproduzierbar bleiben.

## Offene Entscheidungen

- Sollen Korrekturläufe den Händler wirklich nichts kosten (Vorschlag: ja)?
- Wer darf manuell freigeben: der Händler selbst oder nur Admins?
