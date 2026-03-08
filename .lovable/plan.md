# Monetarisierung & Admin-Panel — Implementierungsplan

## Architektur-Prinzip
**Additive Architektur**: Alle neuen Features werden als NEUE Dateien/Komponenten hinzugefügt. Bestehende Dateien werden nur minimal erweitert (Import + Route + Credit-Check). Keine Refactors an existierendem Code.

---

## Phase 1: Datenbank-Schema (Migration)

### Neue Tabellen:

1. **`subscription_plans`** — Tier-Definitionen (seed data)
   - id, name, slug, monthly_credits, price_monthly_cents, price_yearly_cents, extra_credit_price_cents, features (jsonb), sort_order, active

2. **`user_subscriptions`** — Aktives Abo pro User
   - id, user_id (ref auth.users), plan_id (ref subscription_plans), status (enum: active/cancelled/past_due/trialing), billing_cycle (monthly/yearly), current_period_start, current_period_end, stripe_subscription_id, created_at, updated_at

3. **`credit_balances`** — Credit-Stand pro User
   - id, user_id (unique, ref auth.users), balance (int default 10), lifetime_used (int default 0), last_reset_at (timestamptz), created_at

4. **`credit_transactions`** — Jede Buchung
   - id, user_id, amount (int, negativ=Verbrauch, positiv=Aufladung), action_type (enum: pdf_analysis, image_generate, image_remaster, vin_ocr, credit_purchase, subscription_reset, admin_adjustment, landing_page_export), model_used (text nullable), description (text), reference_id (text nullable), created_at

5. **`admin_settings`** — Key-Value für Prompts, Preise etc.
   - id, key (unique), value (jsonb), updated_at, updated_by

6. **`user_roles`** — Admin-Rollen (Security-Best-Practice)
   - id, user_id (ref auth.users), role (enum: admin, moderator, user), unique(user_id, role)

### DB Functions:
- `has_role(user_id, role)` — SECURITY DEFINER für RLS
- `deduct_credits(user_id, amount, action_type, model, description)` — Atomic credit deduction + transaction log
- `add_credits(user_id, amount, action_type, description)` — Atomic credit addition

### RLS:
- credit_balances: User sieht nur eigene
- credit_transactions: User sieht nur eigene
- user_subscriptions: User sieht nur eigene
- subscription_plans: Alle können lesen (public)
- admin_settings: Nur admin kann schreiben, alle lesen
- user_roles: Nur admin sieht alle, user sieht eigene

### Seed Data (subscription_plans):
- Free: 0€, 10 Credits einmalig
- Starter: 2900 cents/mo, 50 Credits
- Pro: 7900 cents/mo, 200 Credits
- Enterprise: 19900 cents/mo, 600 Credits

### Credit-Kosten (admin_settings, key='credit_costs'):
```json
{
  "pdf_analysis": { "standard": 1, "pro": 1 },
  "image_generate": { "standard": 3, "pro": 8 },
  "image_remaster": { "standard": 2, "pro": 5 },
  "vin_ocr": { "standard": 1, "pro": 1 },
  "landing_page_export": { "standard": 0, "pro": 0 }
}
```

---

## Phase 2: Credit-System (Backend)

### Edge Function: `check-credits`
- Input: { action_type, model_tier }
- Prüft balance >= cost
- Returns: { allowed, balance, cost }

### Bestehende Edge Functions erweitern (minimal):
- `analyze-pdf`: Credit-Check + Deduction am Anfang/Ende
- `generate-vehicle-image`: Credit-Check + Deduction
- `remaster-vehicle-image`: Credit-Check + Deduction
- `ocr-vin`: Credit-Check + Deduction

**Ansatz**: Neues Shared-Modul `_shared/credits.ts` mit `checkAndDeductCredits()` — wird von allen Edge Functions importiert.

---

## Phase 3: UI — Credit-Anzeige & Modell-Switcher

### Neue Komponenten:
- `src/components/CreditBadge.tsx` — Permanenter Badge in Nav (⚡ 42)
- `src/components/ModelSelector.tsx` — Toggle Standard/Pro mit Credit-Kosten
- `src/components/CreditConfirmDialog.tsx` — "Kostet X Credits. Fortfahren?"
- `src/components/PricingPage.tsx` — Tier-Vergleich

### Hooks:
- `src/hooks/useCredits.ts` — Credit-Balance laden, realtime subscription
- `src/hooks/useCreditCheck.ts` — Pre-Action Credit-Check + Confirm

### Bestehende Dateien (minimal):
- `Index.tsx`: Import CreditBadge in Header, Credit-Check vor AI-Aktionen
- `Dashboard.tsx`: Import CreditBadge in Header
- `App.tsx`: Route `/pricing` hinzufügen

---

## Phase 4: Admin-Panel

### Neue Seiten:
- `src/pages/admin/AdminLayout.tsx` — Sidebar + Outlet
- `src/pages/admin/AdminDashboard.tsx` — Übersicht/Statistiken
- `src/pages/admin/AdminUsers.tsx` — Nutzerverwaltung (Liste, Credits anpassen, Abo ändern)
- `src/pages/admin/AdminTransactions.tsx` — Alle Credit-Transaktionen
- `src/pages/admin/AdminPrompts.tsx` — Prompt-Verwaltung (alle Edge Function Prompts)
- `src/pages/admin/AdminPricing.tsx` — Credit-Kosten & Tier-Preise anpassen
- `src/pages/admin/AdminSettings.tsx` — Allgemeine Einstellungen

### Admin-Guard:
- `src/components/AdminRoute.tsx` — Prüft `has_role(uid, 'admin')` via RPC

### Statistiken (AdminDashboard):
- Gesamt-Nutzer, aktive Abos pro Tier
- Credits verbraucht (heute/Woche/Monat)
- Top-Aktionen (Chart)
- Revenue (wenn Stripe integriert)
- Neueste Registrierungen

### Edge Functions (Admin):
- `admin-users` — CRUD auf user_subscriptions, credit_balances (admin-only)
- `admin-settings` — CRUD auf admin_settings (admin-only)

---

## Phase 5: Stripe-Integration

- Stripe Products/Prices für Tiers
- Checkout Sessions für Abo-Start
- Customer Portal für Abo-Verwaltung
- Webhooks: subscription.created/updated/deleted → user_subscriptions + credit_balances

---

## Implementierungsreihenfolge (Tasks)

| # | Task | Dateien | Risiko |
|---|------|---------|--------|
| 1 | DB Migration: Alle Tabellen + Functions + RLS + Seed | migration.sql | Kein (additiv) |
| 2 | `_shared/credits.ts` + Edge Function `check-credits` | supabase/functions/ | Kein |
| 3 | Credit-Check in bestehende Edge Functions einbauen | 4 bestehende functions | Niedrig (Guard am Anfang) |
| 4 | `useCredits` Hook + `CreditBadge` Komponente | src/hooks, src/components | Kein |
| 5 | `ModelSelector` + `CreditConfirmDialog` | src/components | Kein |
| 6 | Credit-Badge in Index.tsx + Dashboard.tsx Header | 2 Dateien, je 1-2 Zeilen | Minimal |
| 7 | Pricing-Seite | src/pages/Pricing.tsx + Route | Kein |
| 8 | Admin-Guard + AdminLayout | src/components, src/pages/admin | Kein |
| 9 | AdminDashboard + AdminUsers | src/pages/admin | Kein |
| 10 | AdminTransactions + AdminPrompts + AdminPricing | src/pages/admin | Kein |
| 11 | Admin-Edge-Functions | supabase/functions | Kein |
| 12 | Stripe-Integration | Separat, Phase 5 | Mittel |

---

## Sicherheit
- Admin-Check IMMER serverseitig via `has_role()` DB-Function
- Nie localStorage/Client-Check für Admin
- Credit-Deduction atomar via DB-Function (kein Race Condition)
- RLS auf allen neuen Tabellen
