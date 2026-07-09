## Ziel

Aus dem Banner-Dashboard heraus ein Banner-Bild per Klick an Auto3 pushen (Website-Listing-Banner + Instagram + Facebook). Der Nutzer hinterlegt einmalig seine Auto3-Zugangsdaten im Usermenü; ohne diese Daten ist der Push-Button inaktiv (nur Hinweis, Daten zu hinterlegen).

## 1. Usermenü – Auto3-Konfiguration (Profile)

Neuer Abschnitt „Auto3-Integration" in `src/pages/Profile.tsx` (bzw. `UserMenuSheet` verlinkt dorthin):

Felder pro User (in `profiles`):

- `auto3_account_email` (TEXT) – Login-Mail des Auto3-Accounts (Pflicht)
- `auto3_channels_default` (TEXT[]) – Default-Kanäle `{website,instagram,facebook}` mit Checkboxen
- `auto3_default_caption` (TEXT, optional) – Standard-Caption-Vorlage
- `auto3_default_cta_url` (TEXT, optional)

Kein API-Key beim User – der ist server-side als Secret gespeichert (`PDF_ANZEIGE_AUTO3_API_KEY`) und wird nur in der Edge Function verwendet.

„Verbindung testen"-Button → ruft die Edge Function im Test-Modus auf (siehe unten) und zeigt grünes/rotes Feedback.

## 2. Backend

**Secret:** `PDF_ANZEIGE_AUTO3_API_KEY` (initial `dev-pdf-anzeige-integration-key`, wird via `add_secret` gespeichert; getrennt für Prod, sobald Pravin den Prod-Key liefert). Optional zusätzlich `AUTO3_API_BASE_URL` (default `https://dev-api.autoversus.de`).

**Migration:**

- Spalten in `profiles` ergänzen: `auto3_account_email`, `auto3_channels_default`, `auto3_default_caption`, `auto3_default_cta_url`.
- Neue Tabelle `banner_publications` (id, user_id, banner_id, target_email, client_reference_id UNIQUE, channels TEXT[], status, response JSONB, error TEXT, created_at) inkl. GRANTs + RLS (owner-only).

**Edge Function `publish-banner-to-auto3`:**

- Auth via `sb.auth.getClaims(token)` (Projekt-Regel).
- Input: `{ bannerId, imageUrl (Storage-URL/Base64), caption?, channels?, title?, position?, ctaUrl?, active? }`.
- Lädt `profiles.auto3_account_email` des Users – fehlt sie → 400 „Auto3 nicht konfiguriert".
- `client_reference_id = pdf-<userId>-<bannerId>-<timestamp>` (idempotent, wird in `banner_publications` gespeichert).
- Multipart-POST an `${AUTO3_API_BASE_URL}/v1/vehicle/social/post` mit `X-Auto3-Api-Key`. Bilddatei-Bytes bevorzugt (aus Storage geladen). Fallback JSON+`image_url`, wenn Bild bereits öffentlich signierbar ist.
- Persistiert Ergebnis (inkl. per-channel Status) in `banner_publications`.
- Gibt strukturierte Response an das Frontend zurück (`success | partial_success | failed | duplicate`).

## 3. Frontend – Banner-Karte im Dashboard

In `src/components/dashboard/BannersTab.tsx` (Karte mit Datum · leeres Feld · Share · Download · Löschen):

- Das leere Icon-Feld links neben Share wird zum **„An Auto3 pushen"-Button** (Icon: Upload/Cloud, z. B. `<Send />`).
- **Aktivierungslogik:** Button nur enabled, wenn `profile.auto3_account_email` gesetzt ist. Sonst disabled + Tooltip: „Auto3-Zugang im Profil hinterlegen" mit Link zu Profile → Auto3.
- Klick öffnet einen kleinen Dialog `Auto3PublishDialog`:
  - Vorschau des Banner-Bilds
  - Ziel-E-Mail (vorbelegt aus Profil, editierbar für den Notfall)
  - Kanäle als Checkboxen (Website / Instagram / Facebook), vorbelegt aus `auto3_channels_default`
  - Caption-Feld (vorbelegt aus Default oder aus Banner-Pflichttext via `formatMandatoryDisclosure`)
  - CTA-URL (optional, vorbelegt)
  - Button „Jetzt an Auto3 senden"
- Nach Erfolg: grünes Badge „Auto3 · gepostet" auf der Kachel + Zeitstempel; bei `partial_success` gelbes Badge mit Details pro Kanal; bei Fehler roter Toast.
- Nach erneutem Klick auf bereits gepushtes Banner: Dialog zeigt vorherigen Status (aus `banner_publications`) und bietet „Erneut versuchen mit neuem Bild-Job" (neuer `client_reference_id`) an.

## 4. Sicherheit & Robustheit

- API-Key ausschließlich server-side (Edge Function, `Deno.env.get` bzw. `getSecret`), nie im Client.
- Owner-Check: nur der Banner-Eigentümer darf pushen.
- Idempotenz über `client_reference_id`; Doppelklicks erzeugen keinen Doppel-Post (HTTP 409 wird als „bereits gepostet" behandelt).
- 1× automatischer Retry bei 5xx, danach Fehler im UI.
- Audit-Trail: jeder Versuch (Erfolg/Fehler) in `banner_publications`.

## 5. Offene Fragen an dich

1. Sollen die Kanäle **pro Push wählbar** sein (Dialog) oder immer die im Profil hinterlegten Defaults nutzen ohne Rückfrage? ja die defauls nutzen
2. Als **Caption** default: (a) leer, (b) `formatMandatoryDisclosure(...)` aus dem Banner, (c) freie Vorlage aus dem Profil – was ist dein Wunsch? fangen wir mit a an.
3. Prod-API-Key von Pravin schon da, oder starten wir zunächst nur auf dem **Dev-Endpoint** (`dev-api.autoversus.de` + `dev-pdf-anzeige-integration-key`) für den Showcase? erst auf dev

Sag mir kurz Bescheid, dann setze ich es in genau dieser Form um.

## Technische Zusammenfassung (Dateien)

- Migration: `profiles` erweitern, `banner_publications` neu (inkl. GRANT + RLS)
- Secret: `PDF_ANZEIGE_AUTO3_API_KEY` (+ optional `AUTO3_API_BASE_URL`)
- Edge Function: `supabase/functions/publish-banner-to-auto3/index.ts`
- Frontend:
  - `src/pages/Profile.tsx` – neuer Auto3-Abschnitt
  - `src/components/dashboard/BannersTab.tsx` – Push-Button + Status-Badge
  - `src/components/dashboard/Auto3PublishDialog.tsx` (neu) – Push-Dialog
  - `src/hooks/useAuto3Publish.ts` (neu) – Aufruf der Edge Function + State