# Auto3 Banner-Publish-Integration

**Ziel:** Aus pdf.anzeige.ai heraus einen fertigen Banner direkt in einen bestimmten Auto3-Account posten. Auto3 verteilt das Banner dann weiter an die angebundenen Kanäle (Instagram, Facebook, Website-Slot etc.).

Nächste Woche gibt es dazu einen Live-Showcase.

---

## 1. Empfehlung: Wer ruft wen?

**Empfehlung: pdf.anzeige.ai → Auto3 (nicht umgekehrt).**

Begründung:

- Das Bild entsteht in pdf.anzeige.ai. Es liegt bereits in Supabase Storage bzw. wir kennen die URL. Wir brauchen also nichts „abholen zu lassen" — wir *pushen* aktiv, sobald der User im Banner-Tab auf **„An Auto3 senden"** klickt.
- Auto3 muss uns dafür keinen Callback in unsere Infrastruktur einbauen. Ein einzelner Endpoint auf Auto3-Seite reicht.
- Trigger bleibt beim Nutzer (bewusstes „Posten"-Aktion), nicht automatisch bei jedem generierten Banner.
- Auth-Fluss ist einfacher: ein Server-zu-Server-Token, den wir als Secret bei uns speichern.

Die Alternative (Auto3 pollt bei uns) ist unnötig komplex und würde Auto3 zwingen, Auth gegen unser Backend zu implementieren.

---

## 2. Datenfluss (Showcase-Version)

```
User im Banner-Grid  ──klickt "An Auto3 posten"──▶  Edge Function `publish-banner-to-auto3`
                                                          │
                                                          │ 1. Banner-Bild aus Supabase Storage laden
                                                          │    (oder öffentliche URL weiterreichen)
                                                          │ 2. Ziel-E-Mail des Auto3-Accounts ermitteln
                                                          │    → aus Profil (dealer_profiles.auto3_email)
                                                          │      Fallback: auth.users.email
                                                          │ 3. POST an Auto3-API
                                                          ▼
                                              Auto3-API (vom Auto3-Entwickler)
                                                          │
                                                          ▼
                                     Auto3 verteilt an Instagram / Facebook / interne Kanäle
```

Auto3 antwortet mit `{ ok: true, post_id: "..." }` (oder Fehler). Wir speichern die `post_id` in einer neuen Tabelle `banner_publications`, damit wir im UI zeigen können: „gepostet am 08.07.2026, 14:32 → Auto3 Post #12345".

---

## 3. Was wir von Auto3 brauchen (an den Entwickler schicken)

Bitte folgendes bereitstellen:

1. **Endpoint-URL** (z. B. `https://api.auto3.de/v1/social/post` — genauer Pfad von euch).
2. **Auth-Verfahren:** API-Key im Header (z. B. `Authorization: Bearer <token>` oder `X-Auto3-Api-Key: <token>`). Ein einzelner Key für unseren Tenant reicht — den speichern wir server-side.
3. **Request-Format:** JSON oder multipart? Bevorzugt JSON mit Bild-URL (wir liefern eine öffentlich abrufbare Supabase-Signed-URL, 24h gültig). Falls multipart nötig, senden wir die Bytes.
4. **Feld-Mapping:** welche Felder sind Pflicht?
   - `account_email` — identifiziert den Ziel-Account bei euch
   - `image_url` (oder `image` bytes)
   - `caption` / `text` — optional, Pflichtangaben-Text
   - `channels` — z. B. `["instagram","facebook"]`, oder default aus Account
   - `client_reference_id` — unsere interne Banner-ID (für Deduplizierung/Idempotenz)
5. **Rate-Limits & Bildgrößen** (max KB, max Kantenlänge, akzeptierte Formate — WebP/PNG/JPG).
6. **Fehler-Format** (welcher HTTP-Status wofür, Struktur des Error-Bodys).
7. **Sandbox/Test-Account** für den Showcase-Probelauf.

---

## 4. Woher kommt die E-Mail des Ziel-Accounts?

Drei Quellen, in dieser Reihenfolge:

1. **Dealer-Profil** — neues Feld `auto3_email` (bzw. wiederverwendet: das existierende `dealer_profiles.email`, falls das schon die Auto3-Kontoadresse ist). Vom User einmalig im Profil einstellbar, damit Sende-Konto und Login-E-Mail nicht gleich sein müssen.
2. **Auth-User-E-Mail** als Fallback (`auth.users.email`) — reicht für den Showcase.
3. **Manuelle Eingabe** im Post-Dialog („An welches Auto3-Konto senden?") — nur als Notausgang.

Für den Showcase nächste Woche: **Feld im Dealer-Profil anlegen**, dort einmalig eintragen. Kein extra Auth-Flow.

---

## 5. Umsetzung bei uns (Backend)

Neue Bausteine, alle innerhalb unserer bestehenden Architektur:

- **Secret:** `AUTO3_PUBLISH_API_KEY` (per add_secret gespeichert, nur server-side lesbar).
- **Migration:** Spalte `dealer_profiles.auto3_email TEXT NULL` + neue Tabelle `banner_publications (id, user_id, banner_id, target_email, auto3_post_id, status, error, created_at)` inkl. RLS + Grants.
- **Edge Function `publish-banner-to-auto3`:**
  - verifiziert Session via `sb.auth.getClaims(token)`
  - lädt Banner-Datensatz (owner-check)
  - erstellt signierte URL (24h) für das Bild
  - baut Caption inkl. Pflichtangaben aus `formatMandatoryDisclosure(...)`
  - POST an Auto3-Endpoint mit Idempotency-Key = `banner_id`
  - persistiert Ergebnis in `banner_publications`
- **UI:** im Banner-Grid ein neuer Button „An Auto3 posten" (das leere Feld links neben Download im Screenshot). Öffnet einen kleinen Dialog:
  - Vorschau des Bildes
  - Ziel-Konto (E-Mail vorbelegt, editierbar)
  - Kanäle-Checkboxen (Instagram/Facebook), falls Auto3 das unterstützt
  - „Jetzt posten"-Button → Edge Function
  - Nach Erfolg: grünes Badge „Auto3 · gepostet" auf der Kachel, mit Zeitstempel und Link zur Post-ID.

---

## 6. Sicherheit & Robustheit

- **Kein Auto3-Key im Client.** Nur in der Edge Function via `Deno.env.get`.
- **Idempotenz:** `client_reference_id = banner_id`. Doppelklicks erzeugen keinen Doppel-Post.
- **Owner-Check:** nur wer den Banner besitzt, darf ihn posten.
- **Signed URL statt Bytes** bevorzugt — spart Bandbreite und ist einfacher zu debuggen. Falls Auto3 multipart will, senden wir Bytes.
- **Retry-Policy:** 1× automatischer Retry bei 5xx, danach Fehler im UI anzeigen.
- **Audit:** jeder Post-Versuch landet in `banner_publications`, egal ob Erfolg oder Fehler.

---

## 7. Zeitplan für den Showcase

| Schritt | Verantwortlich | Voraussetzung |
|---|---|---|
| Endpoint-Spec + API-Key + Testkonto liefern | Auto3-Entwickler | — |
| `AUTO3_PUBLISH_API_KEY` bei uns speichern | wir | Key da |
| Migration + Edge Function + UI-Button | wir | Spec da |
| Testlauf mit einem echten Banner in Sandbox-Konto | beide | Function deployed |
| Live-Demo im Showcase | wir | Testlauf grün |

Realistisch: sobald Spec + Key vorliegen, ist die Umsetzung an einem Arbeitstag machbar.

---

## 8. Kurzantwort für den Auto3-Entwickler

> "Wir senden aus unserem Backend einen POST-Request an euren Endpoint mit:
> `account_email` (identifiziert das Ziel-Konto), `image_url` (signed, 24h gültig), `caption` (Pflichtangaben-Text), `client_reference_id` (unsere Banner-ID zur Deduplizierung).
> Auth per API-Key im Header, den ihr uns einmalig ausstellt. Gib uns bitte URL, Auth-Header-Name, Pflichtfelder, Bildgrößen-Limit, ein Sandbox-Konto und das Error-Format."
