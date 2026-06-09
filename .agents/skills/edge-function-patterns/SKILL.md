---
name: edge-function-patterns
description: Supabase Edge Function Patterns für dieses Projekt — JWT-Auth via getClaims, Service-Role-Guard für interne Functions, CORS, Stripe-Webhook-Signaturen, Direct-API-Calls ohne Gateway. Triggert bei neuen Edge Functions, Auth-Bugs, 401/403-Fehlern, Webhook-Implementierung.
---

# Edge Function Patterns

## Auth-Reliability — IMMER `getClaims`

```ts
const authHeader = req.headers.get('Authorization')!;
const token = authHeader.replace('Bearer ', '');
const { data: claims, error } = await sb.auth.getClaims(token);
if (error || !claims?.claims?.sub) return new Response('Unauthorized', { status: 401 });
const userId = claims.claims.sub;
```

**NIE `sb.auth.getUser()`** — schlägt bei langen AI-Prozessen / abgelaufenen Server-Sessions fehl. `getClaims` validiert JWT lokal → kein Roundtrip, kein Timeout.

Etabliert in: `remaster-vehicle-image`, `generate-landing-page`, `detect-vehicle-brand`, `ocr-vin` etc.

## Service-Role-Guard (interne/system-only Functions)

Für Functions, die NICHT direkt vom Browser/Client aufgerufen werden dürfen
(`auto-process-lead`, `process-sales-email`, `cleanup-orphaned-storage`, `migrate-base64-images`):

```ts
import { requireServiceRole } from '../_shared/service-auth.ts';
const guard = requireServiceRole(req);
if (guard) return guard; // returns 401 if invalid
```

Helper unter `supabase/functions/_shared/service-auth.ts` prüft `Bearer <SERVICE_ROLE_KEY>`.

## Stripe-Webhook — Signatur ist Pflicht

`stripe-webhook` MUSS Signatur strikt verifizieren — kein Fallback ohne Secret. Bei fehlender/ungültiger Signatur: 400 zurückgeben.

**Max 4 Expansion-Level** bei Stripe-Aufrufen aus Edge-Functions (Stripe-API-Limit).

## CORS

Immer aus `_shared/cors.ts`:
```ts
import { corsHeaders } from '../_shared/cors.ts';
if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
```

## Direct API Usage (kein Lovable AI Gateway!)

User-Memory-Regel: **Nur nutzer-hinterlegte API-Keys** via `getSecret('GEMINI_API_KEY')` / `getSecret('OPENAI_API_KEY')` aus `admin_secrets` (5-min TTL Cache).

NIE `LOVABLE_API_KEY` oder Lovable AI Gateway nutzen — der User hat das explizit so eingerichtet wegen Datenhoheit und Kostenkontrolle.

Gemini-Endpoints: `https://generativelanguage.googleapis.com/v1beta/...`
OpenAI-Endpoints: `https://api.openai.com/v1/...`

## Step-based Self-Invoking Functions

Lange Pipelines (>150s) als Step-Functions: erste Invocation startet Step 1, ruft sich selbst mit `?step=2` etc. wieder auf. Nutzt `fetch()` ohne `await` für Fire-and-Forget.

## Error Logging

Immer strukturiert: `console.log('[function-name] event=X user=Y tier=Z')` — vereinfacht Log-Filtering in Admin-Job-Monitor.
