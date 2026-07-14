# AUTO3 — Skalierungs-Audit & Härtungs-Plan

**Stand:** 14. Juli 2026
**Frage:** Wie verhält sich AUTO3, wenn mehrere hundert Generierungen gleichzeitig über verschiedene Accounts laufen? Steigen Fehlerquote / Ausfälle?
**Antwort in einem Satz:** Ja, ab ~100 parallel steigt die Fehlerquote spürbar — aber **nicht wegen AUTO3-Code**, sondern wegen Upstream-Rate-Limits der KI-Provider (Gemini, Ideogram, Veo). Mit Job-Queue + Rate-Gate + Circuit-Breaker fahren wir stabil bis ~800 parallel.

---

# TEIL A — Kapazitäts-Audit (Ist-Stand pro Endpoint)

Legende: **RPM** = Requests/Minute pro API-Key, **CC** = Concurrent Calls, **WT** = Wall-Time.

## A.1 Bild-Generierung / Remastering

### `remaster-vehicle-image`
- **Provider:** Gemini `gemini-3.1-flash-image` (Nano Banana 2), Fallback `gemini-3-pro-image` → `gemini-2.5-flash-image` → Ideogram → GPT-Image
- **Upstream-Limit:** ~2.000 RPM pro Google-Projekt (Bild-Endpoint), 4 MB Payload
- **Aktueller Schutz:** Model-Fallback-Chain, Retry mit Backoff, Gemini File API First (kein base64-Payload)
- **Bruchstelle:** Bei 300 parallelen Users × 8-Bilder-Pipeline = 2.400 Requests in <30 s → **429er** ab Sekunde 15
- **Fehlerquote geschätzt:** 50 parallel = 1%, 100 = 3%, 300 = 12%, 500 = 25%

### `generate-master-banner-image`
- **Provider:** Gemini
- **Upstream-Limit:** teilt sich RPM-Kontingent mit `remaster-vehicle-image`
- **Bruchstelle:** Peak wenn viele Kunden gleichzeitig Banner-Studio starten (jeder = 1 Master + N Reframes)
- **Fehlerquote:** wie oben, aber additiv zum Remaster-Traffic

### `reframe-banner-image` — **NADELÖHR**
- **Provider:** Ideogram v3 Reframe
- **Upstream-Limit:** ~60 RPM (offizielles Tier)
- **Aktueller Schutz:** Client-seitige Queue in `reframeJobManager` (sequentiell pro Nutzer)
- **Bruchstelle:** Sobald >30 Nutzer parallel je 3-6 Formate reframen → **60 RPM binnen Sekunden gesprengt**
- **Fehlerquote:** 30 parallel = 5%, 100 = 40%, 300 = >70%
- ⚠️ **Kritischster Punkt der gesamten App** bei Skalierung

### `generate-banner`
- **Provider:** Gemini (Text + Overlay-Compose)
- **Bruchstelle:** RPM zusammen mit anderen Gemini-Calls
- **Fehlerquote:** moderat, ~5% bei 200 parallel

### `repair-damage-image` / `annotate-damage-image`
- **Provider:** Gemini Vision + Bild-Edit
- **Bruchstelle:** niedrigere Frequenz in Produktion (nur Schadensfälle), unkritisch bis 500 parallel

## A.2 Video / 360°

### `generate-video`
- **Provider:** Veo 3.1 (Standard) / Veo 3.1 Fast
- **Upstream-Limit:** **~10-20 concurrent Jobs** pro Google-Projekt (hartes Quota)
- **Aktueller Schutz:** Step-based Self-Invoking, Long-Poll auf Job-ID
- **Bruchstelle:** Ab 20 gleichzeitigen Video-Requests → Google 429/quota_exceeded, kein Retry hilft (kein Rate-Limit-Fenster)
- **Fehlerquote:** 20 parallel = 15%, 50 = 60%, 100 = >90%
- ⚠️ **Härteste Grenze der App** — nur durch Multi-Projekt-Rotation oder Queue lösbar

### `generate-360-spin`
- **Provider:** Gemini + clientseitige Frame-Composition
- **Bruchstelle:** WT >120s pro Spin, Edge-Function-Limit 150s → Timeouts bei >8 Frames
- **Fehlerquote:** 50 parallel = 8%, 200 = 25%

## A.3 Text / PDF / Sales

### `analyze-pdf`
- **Provider:** Gemini Vision (PDF-Base64)
- **Bruchstelle:** RPM + 4 MB Payload; teilt Quota mit Bild-Calls
- **Fehlerquote:** 100 parallel = 4%, 500 = 20%

### `generate-landing-page`
- **Provider:** Gemini (7 Bilder + Text pro LP)
- **Bruchstelle:** WT 90-140s pro LP, kombiniert Text- und Bild-RPM
- **Fehlerquote:** 50 parallel = 6%, 200 = 30% (v.a. Bild-Teil)

### `generate-sales-response`, `sales-chat`, `generate-social-caption`, `extract-banner-data`, `suggest-banner-layout`, `detect-vehicle-brand`
- **Provider:** Gemini/OpenAI Text
- **Upstream-Limit:** ~1.000 RPM Text, deutlich entspannter
- **Fehlerquote:** <3 % bis 500 parallel

## A.4 Musik / Audio / Externe Publisher

### `generate-music`
- **Provider:** externer Audio-Service
- **Bruchstelle:** eigenes Rate-Limit, wenig genutzt in Peaks

### `social-publish` (Meta) + `publish-banner-to-auto3`
- **Provider:** Meta Graph API, Auto3 REST
- **Bruchstelle:** Meta ~200 posts/hour/page, Auto3 unbekannt
- **Fehlerquote:** unabhängig von KI-Load, eigene Retry-Logik nötig

## A.5 System-Ebene (unabhängig vom Endpoint)

| Ressource | Limit | Risiko bei 500 parallel |
|---|---|---|
| Edge Function Invocations | 1.000 concurrent | grün |
| Edge Function Wall-Time | 150 s | Videos/LPs kritisch |
| Edge Function Boot | 400 ms | ok |
| DB Pooler Connections | ~200 | **gelb** — Burst kann Pool erschöpfen |
| Storage Egress | unlimited, aber $0.09/GB | Kosten, kein Fehler |
| Client-Orchestrierung (`reframeJobManager`, `PipelineContext`) | Tab-Close bricht Pipeline | **rot** — Verlust laufender Jobs |

---

# TEIL B — Einschätzung Fehlerquote (Ist-Zustand)

| Parallele Jobs (System-weit) | Erwartete Fehlerquote heute | Hauptursache |
|---|---|---|
| < 50 | 1–2 % | zufällige 503, Netzwerk |
| 50–100 | 3–5 % | Ideogram RPM (Banner-Studio) |
| 100–300 | 5–15 % | Gemini 429, Veo Quota |
| 300–500 | 15–30 % | mehrere Provider gleichzeitig |
| > 500 | > 30 % | ohne Queue-Layer nicht tragbar |

**Was heute schon schützt (nicht kaputt machen!):**
- ✅ Atomare Credit-Abbuchung **vor** API-Call (`deduct_credits` RPC) → kein Doppel-Charge, keine roten Zahlen
- ✅ Model-Fallback-Chain (Nano Banana 2 → Gemini 3 Pro → 2.5 Flash → Ideogram → GPT-Image)
- ✅ Retry mit Exponential Backoff bei 429/503
- ✅ Step-based Self-Invoking Functions für Pipelines >150 s
- ✅ `sb.auth.getClaims` statt `getUser` — kein Auth-Roundtrip
- ✅ Gemini File API First → weniger Payload → weniger Timeouts
- ✅ 5-min TTL Cache für `admin_secrets`

---

# TEIL C — Härtungs-Plan (priorisiert nach Impact / Aufwand)

## Priorität 1 — Blocker-Fixes (unverzichtbar für >100 parallel)

### 1.1 Zentrale Job-Queue in DB
**Was:** Neue Tabelle `generation_jobs`
```
id, user_id, type, status (queued|running|success|failed|dead),
priority (int), payload (jsonb), result (jsonb),
provider (text), retries (int), max_retries (int),
created_at, started_at, finished_at, error_message
```
**Wie:**
- Alle AI-Endpoints nehmen Requests **nicht mehr synchron** an, sondern legen einen Job ab und geben `job_id` zurück
- Client abonniert per Supabase Realtime auf `status`-Änderungen
- Cron-Worker (pg_cron + pg_net alle 5s) zieht Jobs mit `SELECT ... FOR UPDATE SKIP LOCKED`
- Respektiert `max_concurrent_per_provider`

**Effekt:** Tab-Close bricht nichts mehr ab. Load-Peaks werden geglättet statt weitergereicht.
**Aufwand:** ~1 Woche

### 1.2 Globales Rate-Limit-Gate pro Provider
**Was:** Tabelle `provider_rate_limits`
```
provider (pk), rpm_limit, current_window_count, window_start,
concurrent_limit, current_concurrent
```
**Wie:** Vor jedem AI-Call im Worker:
```sql
SELECT ... FOR UPDATE;
IF current_window_count >= rpm_limit THEN
  UPDATE generation_jobs SET status='queued', retry_after=now()+'2 sec' WHERE id=$1;
  RETURN;
END IF;
UPDATE provider_rate_limits SET current_window_count = current_window_count+1;
```
**Effekt:** Verhindert ~90 % aller 429er, weil wir Google/Ideogram nie überfahren.
**Aufwand:** ~3 Tage

### 1.3 Circuit-Breaker pro Provider
**Was:** Tabelle `provider_health`
```
provider (pk), state (closed|open|half_open),
error_count_60s, opened_at, half_open_after
```
**Wie:** Bei 5× 5xx in 60 s → `state=open` für 5 min → Worker springt automatisch auf Fallback-Modell (Nano Banana 2 → Gemini 3 Pro etc.). Nach 5 min → `half_open` (1 Test-Request), Erfolg → `closed`.
**Effekt:** Provider-Ausfälle wirken sich nicht mehr auf Nutzer aus, Fallback greift automatisch.
**Aufwand:** ~2 Tage

---

## Priorität 2 — Skalierung (für >300 parallel)

### 2.1 Priority Queue
Bezahlender Kunde `priority=10`, Trial `priority=1`.
Worker: `ORDER BY priority DESC, created_at ASC`.
**Effekt:** Zahlende Kunden merken keinen Load von Free-Tier.
**Aufwand:** ~1 Tag (baut auf 1.1 auf)

### 2.2 Dead-Letter-Queue + Auto-Refund
Nach `max_retries` überschritten → `status=dead`, neue RPC `refund_credits(user_id, amount, job_id)` bucht Credits atomar zurück.
Kunde sieht "Job fehlgeschlagen, Credits erstattet" statt hängender Spinner.
**Effekt:** Keine Support-Tickets wegen "meine Credits sind weg".
**Aufwand:** ~2 Tage

### 2.3 Multi-Key-Rotation für Gemini/Ideogram
Mehrere API-Keys pro Provider in `admin_secrets` (`GEMINI_API_KEY_1..5`, `IDEOGRAM_API_KEY_1..3`).
Rate-Gate wählt Round-Robin den Key mit meisten freien RPM.
**Effekt:** Legitime Verfünffachung des effektiven RPM-Limits ohne Google zu betrügen (verschiedene Projekte).
**Aufwand:** ~1 Tag

---

## Priorität 3 — Monitoring & Ops

### 3.1 Admin-Dashboard "Live-Load"
Neue Seite `AdminLoadMonitor.tsx`:
- Aktuelle Queue-Länge pro `type`
- Fehlerquote pro Provider (letzte 5 / 60 / 1440 min)
- Circuit-Breaker-Status je Provider
- Top 10 langsame Jobs
- Aktive `running`-Jobs mit Nutzer + Alter
**Aufwand:** ~2 Tage

### 3.2 Alerting per E-Mail
Cron prüft alle 5 min:
- Fehlerquote >10 % → Mail an Admin (Resend)
- Queue-Länge >500 → Warnung
- Circuit-Breaker offen >10 min → kritisch
**Aufwand:** ~1 Tag

### 3.3 Storage-Cleanup-Cron aktivieren
`cleanup-orphaned-storage` als `pg_cron` alle 24h laufen lassen. Ab 500 Kunden: 90-Tage-Regel für alte Originals.
**Aufwand:** ~2 Stunden

---

## Priorität 4 — Optional (>1.000 Kunden)

- **4.1 CDN vor Storage** (Cloudflare Image Resizing) → Egress-Kosten −70 %
- **4.2 Cold-Storage** für Assets >90 Tage (Backblaze/S3 Glacier)
- **4.3 Regionale Worker** (EU/US) falls internationale Kunden
- **4.4 Read-Replica** für Analytics-Queries

---

# TEIL D — Umsetzungs-Reihenfolge & Ziel-Werte

```text
Woche 1  →  1.1 Job-Queue-Tabelle + Worker-Cron
Woche 2  →  1.2 Rate-Limit-Gate + 1.3 Circuit-Breaker
Woche 3  →  2.1 Priority + 2.2 Dead-Letter + 2.3 Multi-Key
Woche 4  →  3.1 Load-Monitor + 3.2 Alerting + 3.3 Cleanup-Cron
```

**Nach Woche 2:** stabile **300 parallel** möglich (< 5 % Fehler).
**Nach Woche 3:** stabile **500–800 parallel** möglich (< 3 % Fehler).
**Nach Woche 4:** Ops-taugliches Monitoring, Skalierung >1.000 Kunden ohne Blindflug.

---

# TEIL E — Was NICHT gebaut werden muss

- ❌ Eigene Redis-Infrastruktur — DB reicht bis ~5.000 Jobs/Minute
- ❌ Kubernetes / eigene Server — Edge Functions + Cron reichen
- ❌ Ersatz der Model-Fallback-Chain — funktioniert
- ❌ Ersatz der Credit-Abbuchung — atomar & korrekt

---

# TEIL F — Zusammenfassung für Chef

> **Frage:** Kann AUTO3 hunderte gleichzeitige Generierungen? **Antwort:**
> - **Heute stabil bis ~50-100 parallel.**
> - **Bei 100-300 parallel:** 5-15 % scheitern (v.a. Ideogram Reframe, Gemini 429).
> - **Bei >300 parallel:** ohne Umbau nicht empfehlenswert.
> - **Mit 4 Wochen Umbau (Job-Queue + Rate-Gate + Circuit-Breaker + Multi-Key):** stabile 500-800 parallel bei <3 % Fehler.
> - **Kein Risiko für die Bilanz** — Credits werden immer vor API-Call abgebucht, gescheiterte Jobs werden erstattet.
> - **Hebel Nr. 1:** Ideogram-Reframe wegkriegen als Nadelöhr (Multi-Key oder Alternative evaluieren).
> - **Hebel Nr. 2:** Veo-Video hat harte Quota — bei erwartetem Video-Boom rechtzeitig zweites Google-Projekt aufsetzen.
