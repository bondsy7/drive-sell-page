# Skalierungs-Analyse & Härtungs-Plan AUTO3

**Ziel:** Dokument `.lovable/skalierung-audit-und-plan.md` erstellen (keine Code-Änderung), das (A) den Ist-Zustand jedes AI-Endpoints misst und (B) einen priorisierten Härtungs-Plan enthält.

---

## Teil A – Kapazitäts-Audit (Ist-Stand)

Pro Endpoint dokumentieren: Provider, Upstream-Limit, aktueller Retry, Bruchstelle, gemessene/geschätzte Fehlerquote bei 50/100/300/500 parallel.

**Endpoints, die im Audit-Dokument einzeln analysiert werden:**

| # | Edge Function | Provider | Kritisches Limit |
|---|---|---|---|
| 1 | `remaster-vehicle-image` | Gemini Nano Banana 2 | ~2.000 RPM/Key |
| 2 | `generate-master-banner-image` | Gemini | ~2.000 RPM/Key |
| 3 | `reframe-banner-image` | Ideogram v3 | ~60 RPM |
| 4 | `generate-video` | Veo 3.1 | ~10-20 concurrent |
| 5 | `generate-landing-page` | Gemini (7 Bilder) | RPM + Wall-Time |
| 6 | `analyze-pdf` | Gemini Vision | RPM |
| 7 | `generate-banner` | Gemini | RPM |
| 8 | `generate-360-spin` | Gemini + Frame-Compose | RPM + CPU |
| 9 | `generate-music` | Extern | RPM |
| 10 | `generate-sales-response` / `sales-chat` | Gemini/OpenAI | RPM |
| 11 | `repair-damage-image` / `annotate-damage-image` | Gemini | RPM |
| 12 | `social-publish` + `publish-banner-to-auto3` | Meta/Auto3 | eigenes Rate-Limit |

**Systemebene:**
- Supabase Edge Functions: 1.000 concurrent Invocations, 150s Wall, 400ms Boot
- DB Pooler: ~200 gleichzeitige Connections
- Storage Egress: Kostentreiber, kein Fehler
- Client-seitige Job-Orchestrierung (`reframeJobManager`, `PipelineContext`): bricht bei Tab-Close

---

## Teil B – Einschätzung Fehlerquote

| Parallele Jobs | Erwartete Fehlerquote heute | Hauptursache |
|---|---|---|
| < 50 | 1–2 % | zufällige 503, Netzwerk |
| 50–100 | 3–5 % | Ideogram RPM |
| 100–300 | 5–15 % | Gemini 429, Veo Quota |
| 300–500 | 15–30 % | mehrere Provider gleichzeitig |
| > 500 | > 30 % | ohne Queue-Layer nicht tragbar |

**Was heute schon schützt:**
- Atomare Credit-Abbuchung vor API-Call (kein Doppel-Charge)
- Model-Fallback-Chain (Nano Banana 2 → Gemini 3 Pro → 2.5 Flash → Ideogram → GPT-Image)
- Retry mit Backoff bei 429/503
- Step-based Self-Invoking für lange Pipelines
- `sb.auth.getClaims` statt `getUser` (kein Auth-Roundtrip)
- Gemini File API First (weniger Payload → weniger Timeouts)

---

## Teil C – Härtungs-Plan (priorisiert nach Impact / Aufwand)

### Priorität 1 – Blocker-Fixes (unverzichtbar für >100 parallel)

**1.1 Zentrale Job-Queue in DB**
- Neue Tabelle `generation_jobs` (id, user_id, type, status, priority, payload, result, retries, provider, created_at, started_at, finished_at)
- Ersetzt Client-Orchestrierung → Tab-Close bricht nichts mehr ab
- Cron-Worker (pg_cron + pg_net) zieht Jobs im 5s-Takt, respektiert `max_concurrent_per_provider`
- Aufwand: ~1 Woche

**1.2 Globales Rate-Limit-Gate pro Provider**
- Tabelle `provider_rate_limits` (provider, rpm_limit, current_window_count, window_start)
- Vor jedem AI-Call: `SELECT … FOR UPDATE` + Check → wenn Limit voll: Job zurück in Queue mit `retry_after`
- Verhindert 90 % der 429er
- Aufwand: ~3 Tage

**1.3 Circuit-Breaker pro Provider**
- Tabelle `provider_health` (provider, error_rate_60s, state: closed/open/half-open, opened_at)
- Bei 5× 5xx in 60s → auf Fallback-Modell umschalten für 5 min
- Aufwand: ~2 Tage

### Priorität 2 – Skalierung (für >300 parallel)

**2.1 Priority Queue**
- Bezahlender Kunde `priority=10`, Trial `priority=1`
- Worker zieht nach `ORDER BY priority DESC, created_at ASC`
- Aufwand: ~1 Tag (baut auf 1.1 auf)

**2.2 Dead-Letter-Queue + Auto-Refund**
- Nach N Retries → `status=failed`, atomare Credit-Rückbuchung via neuer RPC `refund_credits`
- Kunde sieht "Job fehlgeschlagen, Credits erstattet" statt hängender Spinner
- Aufwand: ~2 Tage

**2.3 Multi-Key-Rotation für Gemini/Ideogram**
- Mehrere API-Keys pro Provider in `admin_secrets` (z. B. `GEMINI_API_KEY_1..5`)
- Round-Robin im Rate-Gate → verfünffacht effektives RPM-Limit legitim
- Aufwand: ~1 Tag

### Priorität 3 – Monitoring & Ops

**3.1 Admin-Dashboard „Live-Load"**
- Neue Seite `AdminLoadMonitor.tsx`: aktuelle Queue-Länge, Fehlerquote pro Provider (letzte 5/60/1440 min), Circuit-Breaker-Status, aktive Jobs
- Aufwand: ~2 Tage

**3.2 Alerting**
- Cron prüft alle 5 min: Fehlerquote >10 % / Queue >500 → Resend-Mail an Admin
- Aufwand: ~1 Tag

**3.3 Storage-Cleanup-Cron aktivieren**
- `cleanup-orphaned-storage` als pg_cron alle 24h, ab 500 Kunden 90-Tage-Regel
- Aufwand: ~2 Stunden

### Priorität 4 – Optional (>1.000 Kunden)

**4.1 CDN vor Storage** (Cloudflare) → Egress-Kosten −70 %
**4.2 Cold-Storage** für Assets > 90 Tage
**4.3 Regionale Worker** (EU/US) falls internationale Kunden

---

## Teil D – Umsetzungs-Reihenfolge (Empfehlung)

```text
Woche 1 → 1.1 Job-Queue-Tabelle + Worker-Cron
Woche 2 → 1.2 Rate-Limit-Gate + 1.3 Circuit-Breaker
Woche 3 → 2.1 Priority + 2.2 Dead-Letter + 2.3 Multi-Key
Woche 4 → 3.1 Load-Monitor + 3.2 Alerting + 3.3 Cleanup-Cron
```

**Nach Woche 2:** stabile 300 parallel möglich (< 5 % Fehler).
**Nach Woche 3:** stabile 500–800 parallel möglich (< 3 % Fehler).

---

## Deliverable dieses Plans

Ein einziges Dokument: `.lovable/skalierung-audit-und-plan.md` mit den Teilen A–D vollständig ausgeschrieben. Danach zusätzlich in `/mnt/documents/` kopiert für Download.

**Keine Code-Änderungen. Nur Dokument.**
