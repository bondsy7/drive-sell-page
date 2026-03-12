# Autohaus.AI – System- & Softwarearchitektur

> **Version:** 1.1 · **Stand:** 12. März 2026  
> **Zielgruppe:** Entwickler-Onboarding, technische Stakeholder, Kunden-Dokumentation

---

## Inhaltsverzeichnis

1. [Systemübersicht](#1-systemübersicht)
2. [Tech-Stack](#2-tech-stack)
3. [Frontend-Architektur](#3-frontend-architektur)
4. [Backend-Architektur (Edge Functions)](#4-backend-architektur-edge-functions)
5. [Datenbank-Architektur](#5-datenbank-architektur)
6. [Authentifizierung & Autorisierung](#6-authentifizierung--autorisierung)
7. [KI-Services & Modelle](#7-ki-services--modelle)
8. [Monetarisierung & Credit-System](#8-monetarisierung--credit-system)
9. [Stripe-Integration](#9-stripe-integration)
10. [Modul-Übersicht: Funktionsbereiche](#10-modul-übersicht-funktionsbereiche)
11. [Externe APIs & Abhängigkeiten](#11-externe-apis--abhängigkeiten)
12. [Storage & Asset-Management](#12-storage--asset-management)
13. [Distributions- & Integrations-Schnittstellen](#13-distributions---integrations-schnittstellen)
14. [Admin-System](#14-admin-system)
15. [Sicherheitsarchitektur](#15-sicherheitsarchitektur)
16. [Datenfluss-Diagramme](#16-datenfluss-diagramme)
17. [Sales Assistant & CRM](#17-sales-assistant--crm)
18. [Deployment & Infrastruktur](#18-deployment--infrastruktur)

---

## 1. Systemübersicht

Autohaus.AI ist eine SaaS-Plattform für Automobilhändler, die mithilfe von KI automatisiert:

- **Fahrzeugangebots-Seiten** aus PDF-Angeboten generiert
- **Showroom-Bilder** aus Handyfotos per KI-Remastering erstellt
- **SEO-optimierte Landing Pages** für Fahrzeugmarketing erzeugt
- **Werbebanner** für Social Media rendert
- **Showroom-Videos** per KI generiert
- **VIN-Erkennung** per OCR und Fahrzeugdaten-Lookup bereitstellt
- **Sales Assistant** KI-gestütztes CRM mit Lead-Management, Konversationen, Aufgaben und Wissensbasis

Das System folgt einer **modularen Workflow-Architektur** mit einem zentralen ActionHub, der unabhängige Prozesse orchestriert.

### High-Level-Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (SPA)                        │
│   React + TypeScript + Vite + Tailwind CSS + shadcn/ui  │
│                                                         │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ActionHub│ │Dashboard │ │ Profile  │ │Admin Panel │  │
│  │ (5 Tiles)│ │(4 Tabs) │ │ (Dealer) │ │ (9 Seiten) │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
└───────┼──────────┼──────────┼─────────────┼─────────┘
        │          │          │             │
        ▼          ▼          ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (Backend-as-a-Service)             │
│                                                         │
│  ┌────────────┐ ┌─────────┐ ┌────────┐ ┌────────────┐  │
│  │Edge Funcs  │ │Database │ │Storage │ │   Auth     │  │
│  │(21 Funcs)  │ │(27 Tab) │ │(6 Buck)│ │Email+OAuth│  │
│  └─────┬──────┘ └────┬────┘ └───┬────┘ └────────────┘  │
└────────┼────────────┼────────┼──────────────────────┘
         │            │        │
         ▼            │        │
┌────────────────┐    │        │
│  Externe APIs  │    │        │
│                │    │        │
│ • Lovable AI   │    │        │
│   Gateway      │    │        │
│ • Google Gemini│    │        │
│ • OpenAI       │    │        │
│ • Stripe       │    │        │
│ • OutVin       │    │        │
└────────────────┘    │        │
                      ▼        ▼
              PostgreSQL   Supabase Storage
              (RLS-gesichert)  (CDN-backed)
```

---

## 2. Tech-Stack

### Frontend
| Technologie | Version | Zweck |
|---|---|---|
| **React** | ^18.3.1 | UI-Framework (SPA) |
| **TypeScript** | ^5.8.3 | Typsicherheit |
| **Vite** | ^5.4.19 | Build-Tool & Dev-Server |
| **Tailwind CSS** | ^3.4.17 | Utility-First CSS |
| **shadcn/ui** | (Radix-basiert) | Design-System-Komponenten |
| **React Router** | ^6.30.1 | Client-seitiges Routing |
| **TanStack Query** | ^5.83.0 | Server-State-Management |
| **Recharts** | ^2.15.4 | Diagramme (Admin Dashboard) |
| **Lucide React** | ^0.462.0 | Icon-Bibliothek |
| **Sonner** | ^1.7.4 | Toast-Benachrichtigungen |
| **Zod** | ^3.25.76 | Schema-Validierung |
| **React Hook Form** | ^7.61.1 | Formular-Management |

### Backend
| Technologie | Zweck |
|---|---|
| **Supabase** | Datenbank, Auth, Storage, Edge Functions |
| **Deno** | Runtime für Edge Functions |
| **PostgreSQL** | Relationale Datenbank mit RLS |
| **Stripe** | Zahlungsabwicklung |

### KI-Modelle (via Lovable AI Gateway & direkte APIs)
| Modell | Einsatz |
|---|---|
| `google/gemini-2.5-flash` | PDF-Analyse, VIN-OCR, Text-Generierung |
| `google/gemini-2.5-flash-image` | Bildgenerierung (Schnell-Tier) |
| `google/gemini-3-pro-image-preview` | Bildgenerierung (Premium-Tier), Remastering |
| `google/gemini-3.1-flash-image-preview` | Bildgenerierung (Turbo-Tier) |
| `openai/gpt-image-1` | Bildgenerierung (Ultra-Tier) |
| `Google Veo 3.1` | Video-Generierung (direkte Google API) |

---

## 3. Frontend-Architektur

### 3.1 Routing-Struktur

```
/                       → Landing Page (öffentlich)
/auth                   → Login/Registrierung (öffentlich)
/pricing                → Preisübersicht (öffentlich)
/docs                   → API-Dokumentation (öffentlich)
/generator              → ActionHub + Workflows (geschützt)
/dashboard              → Projekt-Übersicht (geschützt)
/profile                → Händler-Profil (geschützt)
/project/:id            → Projekt-Editor (geschützt)
/leasing-rechner        → Leasing-Kalkulator (geschützt)
/finanzierungsrechner   → Finanzierungsrechner (geschützt)
/kfz-steuer-rechner     → Kfz-Steuer-Rechner (geschützt)
/integrations           → API/FTP/Embed (geschützt)
/sales-assistant        → Sales Assistant CRM (geschützt)
/sales-assistant/:id    → Konversation/Lead-Detail (geschützt)
/admin/*                → Admin-Panel (Admin-Rolle)
```

### 3.2 Schutz-Mechanismen

```tsx
// ProtectedRoute: Prüft Auth + E-Mail-Verifizierung
<ProtectedRoute>
  <Component />
</ProtectedRoute>

// AdminRoute: Zusätzlich server-seitige Rollenprüfung
<AdminRoute>
  <AdminLayout />  // Nested Routes für Admin-Unterseiten
</AdminRoute>
```

- `ProtectedRoute` → Prüft `useAuth()` User + `email_confirmed_at`
- `AdminRoute` → Ruft `supabase.rpc('has_role', { _user_id, _role: 'admin' })` auf

### 3.3 State-Management

| Ebene | Lösung |
|---|---|
| Server-State | TanStack Query (React Query) |
| Auth-State | React Context (`AuthProvider`) |
| Credit-State | Custom Hook `useCredits()` mit Realtime-Subscription |
| Formular-State | React Hook Form + lokaler useState |
| URL-State | React Router (Search Params für Dashboard-Tabs) |

### 3.4 Lazy Loading

Alle Seiten werden per `React.lazy()` + `Suspense` geladen:

```tsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
```

### 3.5 Komponenten-Hierarchie (Kernmodule)

```
src/
├── components/
│   ├── ActionHub.tsx              # Zentrale Workflow-Auswahl (5 Tiles)
│   ├── AppHeader.tsx              # Navigation + Credit-Badge
│   ├── CreditBadge.tsx            # Credit-Anzeige in Echtzeit
│   ├── CreditConfirmDialog.tsx    # Credit-Kosten-Bestätigung vor KI-Aktion
│   ├── ModelSelector.tsx          # KI-Modell-Tier-Auswahl
│   │
│   ├── # PDF → Angebotsseite
│   ├── PDFUpload.tsx              # PDF-Upload mit Drag & Drop
│   ├── ProcessingStatus.tsx       # Fortschrittsanzeige
│   ├── SamplePdfGallery.tsx       # Beispiel-PDFs zum Testen
│   │
│   ├── # Foto & Remastering
│   ├── ImageCaptureGrid.tsx       # Perspektiven-Raster für Fahrzeugfotos
│   ├── ImageUploadRemaster.tsx    # Upload → Remaster Workflow
│   ├── RemasterOptions.tsx        # Master-Prompt-UI (Szene, Kennzeichen, Logo)
│   ├── PipelineRunner.tsx         # Batch-Bildgenerierung (Worker-Pool)
│   │
│   ├── # Landing Page
│   ├── ManualLandingGenerator.tsx  # Formular: Marke+Modell+Typ → KI-Generierung
│   ├── LandingPageEditor.tsx       # Split-Pane Editor mit Live-Vorschau
│   ├── LandingPagePreview.tsx      # Vorschau-Rendering
│   │
│   ├── # Banner & Video
│   ├── BannerGenerator.tsx         # Banner-Erstellung mit Prompt-Builder
│   ├── VideoGenerator.tsx          # Video-Erstellung via Veo API
│   │
│   ├── # Template-System (PDF-Seiten)
│   ├── TemplateSidebar.tsx         # Template-Auswahl
│   ├── template-editors/
│   │   ├── AutohausEditor.tsx      # Editor für Autohaus-Template
│   │   ├── ModernEditor.tsx        # Editor für Modern-Template
│   │   ├── KlassischEditor.tsx     # Editor für Klassisch-Template
│   │   └── MinimalistEditor.tsx    # Editor für Minimalist-Template
│   │
│   ├── # Rechner
│   ├── LeasingCalculatorPanel.tsx   # Leasing-Berechnung
│   ├── FinancingCalculatorPanel.tsx # Finanzierungsberechnung
│   ├── KfzSteuerPanel.tsx          # Kfz-Steuer-Berechnung
│   │
│   ├── # Utilities
│   ├── CO2Label.tsx               # CO₂-Effizienzklassen-Anzeige (A-G)
│   ├── CO2LabelSelector.tsx       # CO₂-Klassen-Editor
│   ├── EditableField.tsx          # Inline-Editierfeld
│   ├── ExportChoiceDialog.tsx     # Export-Format-Wahl (URL/Base64)
│   ├── GalleryLightbox.tsx        # Bild-Lightbox
│   ├── VinDataDialog.tsx          # VIN-Daten-Übernahme-Dialog
│   ├── CategoryDropdown.tsx       # Kategorie-Auswahl (Leasing/Kauf/etc.)
│   ├── FuelTypeDropdown.tsx       # Kraftstoff-Auswahl
│   ├── ImageSourceChoice.tsx      # Wahl: KI-Generierung vs. Upload
│   │
│   └── ui/                        # shadcn/ui Basis-Komponenten (40+)
│
├── hooks/
│   ├── useAuth.tsx                # Auth Context Provider + Hook
│   ├── useCredits.ts              # Credit-Balance mit Realtime
│   ├── useCreditCheck.ts          # Credit-Prüfung vor Aktion
│   ├── useSubscription.ts         # Abo-Status
│   ├── useVinLookup.ts            # VIN → Fahrzeugdaten
│   └── use-mobile.tsx             # Responsive Breakpoint Detection
│
├── lib/
│   ├── templates/                 # HTML-Template-Generatoren
│   │   ├── index.ts               # Router: templateId → Generator
│   │   ├── autohaus.ts            # Autohaus-Template (822px + 395px Sidebar)
│   │   ├── modern.ts              # Modern-Template
│   │   ├── klassisch.ts           # Klassisch-Template
│   │   ├── minimalist.ts          # Minimalist-Template
│   │   ├── shared.ts              # Gemeinsame Bausteine (Consumption, Finance, Dealer, Contact-CTA)
│   │   └── download.ts            # HTML-Export-Utilities
│   │
│   ├── landing-page-builder.ts    # Landing-Page HTML-Renderer aus JSON
│   ├── html-generator.ts          # HTML-Assembly-Utilities
│   ├── co2-utils.ts               # CO₂-Klassen-Berechnung (Pkw-EnVKV)
│   ├── cost-utils.ts              # Betriebskosten-Kalkulation
│   ├── finance-utils.ts           # Leasing/Finanzierungs-Berechnungen
│   ├── kfz-steuer.ts              # Kfz-Steuer-Berechnung (BMF-Logik)
│   ├── pdf-utils.ts               # PDF-Verarbeitungs-Utilities
│   ├── remaster-prompt.ts         # Master-Prompt-Builder für Bild-KI
│   ├── storage-utils.ts           # Supabase Storage Helpers
│   ├── stripe-plans.ts            # Stripe Price/Product IDs
│   ├── wordpress-plugin.ts        # WP-Plugin PHP-Generator
│   └── utils.ts                   # Tailwind Merge (cn helper)
│
├── pages/
│   ├── Landing.tsx                # Marketing-Startseite
│   ├── Auth.tsx                   # Login + Registrierung
│   ├── Index.tsx                  # Generator-Hauptseite (ActionHub)
│   ├── Dashboard.tsx              # Projekte (Tabs: Alle, Galerie, Landing Pages, Banner)
│   ├── Profile.tsx                # Händler-Profil + Bankdaten + Socials
│   ├── ProjectView.tsx            # Projekt-Editor (Template oder Landing Page)
│   ├── Pricing.tsx                # Abo-Pläne + Credit-Pakete
│   ├── Integrations.tsx           # API, FTP, Embed, WordPress
│   ├── ApiDocs.tsx                # API-Dokumentation
│   ├── LeasingCalculator.tsx      # Leasing-Rechner
│   ├── FinancingCalculator.tsx    # Finanzierungsrechner
│   ├── KfzSteuerRechner.tsx       # Kfz-Steuer-Rechner
│   └── NotFound.tsx               # 404
│
├── pages/admin/
│   ├── AdminLayout.tsx            # Admin-Shell mit Sidebar
│   ├── AdminDashboard.tsx         # KPIs, Charts
│   ├── AdminUsers.tsx             # Nutzerverwaltung
│   ├── AdminTransactions.tsx      # Credit-Transaktionen
│   ├── AdminLeads.tsx             # Kontaktanfragen
│   ├── AdminPdfGallery.tsx        # Beispiel-PDFs verwalten
│   ├── AdminPrompts.tsx           # KI-Prompts anpassen
│   ├── AdminPricing.tsx           # Abo-Pläne bearbeiten
│   ├── AdminSettings.tsx          # System-Einstellungen
│   └── AdminLogos.tsx             # Hersteller-Logos verwalten
│
├── types/
│   ├── vehicle.ts                 # VehicleData, ConsumptionData, DealerData
│   └── template.ts                # TemplateId type
│
└── integrations/
    ├── supabase/
    │   ├── client.ts              # Auto-generiert: Supabase Client
    │   └── types.ts               # Auto-generiert: DB-Typen
    └── lovable/
        └── index.ts               # Lovable AI Integration
```

---

## 4. Backend-Architektur (Edge Functions)

Alle Backend-Logik läuft in **21 Supabase Edge Functions** (Deno-Runtime):

### 4.1 KI-Verarbeitungs-Functions

| Function | Input | Output | Credits | KI-Modell |
|---|---|---|---|---|
| `analyze-pdf` | `{ pdfBase64 }` | Strukturiertes JSON (VehicleData) | 1 | Gemini 2.5 Flash |
| `generate-vehicle-image` | `{ imagePrompt(s), modelTier }` | Base64 Bild(er) | 3-10 | Gemini Flash/Pro, OpenAI |
| `remaster-vehicle-image` | `{ imageBase64, vehicleDescription, ... }` | Base64 remastertes Bild | 3-10 | Gemini 3 Pro/Flash Image |
| `generate-banner` | `{ prompt, imageBase64?, modelTier, width, height }` | Base64 Banner | 5-10 | Gemini/OpenAI |
| `generate-video` | `{ imageBase64, prompt }` (start/poll) | Storage-URL Video | 10 | Google Veo 3.1 |
| `generate-landing-page` | `{ brand, model, pageType, dealer }` | HTML + JSON + Bilder | 3 | Gemini 2.5 Flash + Image |
| `ocr-vin` | `{ imageBase64 }` | `{ vin: "WBA..." }` | 1 | Gemini 2.5 Flash |
| `lookup-vin` | `{ vin }` | Fahrzeugdaten JSON | 0 | OutVin API |

### 4.2 Zahlungs-Functions

| Function | Zweck |
|---|---|
| `create-checkout` | Stripe Checkout Session für Abo-Abschluss |
| `buy-credits` | Stripe Checkout für Credit-Pakete (Einmalkauf) |
| `customer-portal` | Stripe Customer Portal URL generieren |
| `stripe-webhook` | Webhook-Handler für Stripe Events |
| `check-credits` | Credit-Balance-Prüfung |

### 4.3 Sales-Assistant-Functions

| Function | Zweck |
|---|---|
| `generate-sales-response` | KI-Antwort auf Kundenanfragen generieren (E-Mail, WhatsApp, Chat) |
| `sales-chat` | Interner Chat-Assistent für Verkäufer |
| `ingest-sales-knowledge` | Dokumente chunken + embedden für RAG-Wissensbasis |
| `auto-process-lead` | Automatische Lead-Verarbeitung (Autopilot-Modus) |
| `process-sales-email` | Eingehende E-Mails verarbeiten und zuordnen |
| `seed-crm-demo` | Demo-Daten für CRM generieren |

### 4.4 Integrations-Functions

| Function | Zweck |
|---|---|
| `api-vehicles` | REST API für externe Systeme (x-api-key Auth) |
| `submit-lead` | Kontaktformular-Eingang (öffentlich, ohne Auth) |
| `ftp-upload` | HTML/Bilder auf Kunden-FTP/SFTP hochladen |
| `admin-stripe` | Admin-Only: Stripe Payments/Refunds verwalten |
| `admin-delete-user` | Admin-Only: Nutzer löschen |

### 4.5 Gemeinsame Patterns

Alle KI-Functions folgen einem einheitlichen Pattern:

```typescript
// 1. CORS Handling
if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

// 2. Auth + Credit-Deduction (atomar via RPC)
const authResult = await authenticateAndDeductCredits(req, actionType, cost);
if (authResult instanceof Response) return authResult;

// 3. Custom Prompt laden (admin_settings.ai_prompts override)
const prompt = await getCustomPrompt("key", DEFAULT_PROMPT);

// 4. KI-API aufrufen (Google Gemini direkt)
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { ... });

// 5. Ergebnis verarbeiten + zurückgeben
return new Response(JSON.stringify(result), { headers: corsHeaders });
```

### 4.6 JWT-Konfiguration

```toml
# supabase/config.toml
# Functions OHNE JWT-Verifizierung (eigene Auth-Logik):
[functions.analyze-pdf]
verify_jwt = false

[functions.submit-lead]         # Öffentliches Kontaktformular
verify_jwt = false

[functions.stripe-webhook]      # Stripe Signature statt JWT
verify_jwt = false

[functions.api-vehicles]        # x-api-key statt JWT
verify_jwt = false
```

---

## 5. Datenbank-Architektur

### 5.1 Entity-Relationship-Diagramm

```
auth.users (Supabase-managed)
    │
    ├──1:1── profiles
    │         (company_name, contact_name, phone, email, website,
    │          address, postal_code, city, tax_id, logo_url,
    │          custom_showroom_url, social_urls, banking_data,
    │          legal_texts, api_key)
    │
    ├──1:N── projects
    │         (title, template_id, vehicle_data [JSONB],
    │          html_content, main_image_url, main_image_base64)
    │         │
    │         ├──1:N── project_images
    │         │         (image_base64, image_url, perspective, sort_order)
    │         │
    │         └──1:N── leads
    │                   (name, email, phone, message, vehicle_title)
    │
    ├──1:1── credit_balances
    │         (balance [default:10], lifetime_used, last_reset_at)
    │
    ├──1:N── credit_transactions
    │         (amount, action_type [ENUM], model_used, description)
    │
    ├──1:N── user_subscriptions
    │         (plan_id → subscription_plans, status, billing_cycle,
    │          stripe_subscription_id, period_start/end)
    │
    ├──1:N── user_roles
    │         (role [ENUM: admin|moderator|user])
    │
    ├──1:1── ftp_configs
    │         (host, port, username, password, directory, is_sftp)
    │
    ├── Sales Assistant:
    │   ├──1:1── sales_assistant_profiles (Ton, Autopilot, Signatur)
    │   ├──1:N── sales_assistant_conversations (Lead, Stage, Kontext)
    │   │         ├──1:N── sales_assistant_messages (Input/Output, Kanal)
    │   │         ├──1:N── sales_assistant_tasks (Aufgaben, Priorität)
    │   │         ├──1:N── conversation_stage_log (Stage-Wechsel)
    │   │         ├──1:N── crm_manual_notes (Manuelle Notizen)
    │   │         ├──1:N── sales_quotes (Angebote, Preise)
    │   │         └──1:N── test_drive_bookings (Probefahrt-Termine)
    │   ├──1:N── sales_knowledge_documents (Wissensbasis)
    │   │         └──1:N── sales_knowledge_chunks (Embeddings, pgvector)
    │   ├──1:N── sales_email_outbox (E-Mail-Versand)
    │   ├──1:N── sales_notifications (Benachrichtigungen)
    │   ├──1:N── sales_chat_messages (Interner Chat)
    │   ├──1:N── dealer_availability (Verfügbarkeiten Mo-So)
    │   ├──1:N── dealer_blocked_dates (Gesperrte Tage)
    │   ├──1:N── trade_in_valuations (Inzahlungnahme-Bewertungen)
    │   └──1:N── calendar_sync_configs (Kalender-Sync)
    │
    └── customer_journey_templates (Journey-Phasen, global + pro User)

subscription_plans (global)
    (name, slug, monthly_credits, price_monthly_cents,
     price_yearly_cents, extra_credit_price_cents, features [JSONB])

admin_settings (global)
    (key, value [JSONB])
    Keys: "credit_costs", "ai_prompts"

sample_pdfs (global)
    (title, description, brand, model, category,
     pdf_url, thumbnail_url, active, sort_order)
```

### 5.2 Wichtige Enums

```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE credit_action_type AS ENUM (
  'pdf_analysis', 'image_generate', 'image_remaster',
  'vin_ocr', 'credit_purchase', 'subscription_reset',
  'admin_adjustment', 'landing_page_export'
);
```

### 5.3 Datenbank-Functions (PL/pgSQL)

| Function | Typ | Zweck |
|---|---|---|
| `deduct_credits(_user_id, _amount, _action_type, _model, _description)` | SECURITY DEFINER | Atomarer Credit-Abzug mit Row-Lock. Auto-Create für neue Nutzer (10 Credits). Gibt `{success, balance, cost}` zurück. |
| `add_credits(_user_id, _amount, _action_type, _description)` | SECURITY DEFINER | Credits gutschreiben (Kauf, Abo-Reset, Admin). |
| `has_role(_user_id, _role)` | SECURITY DEFINER | Rollenprüfung ohne RLS-Rekursion. |
| `generate_api_key()` | STABLE | Generiert `ak_` + 48 hex chars. |
| `handle_new_user()` | TRIGGER | Auto-Insert in `profiles` + `credit_balances` bei Registrierung. |
| `set_api_key_on_insert()` | TRIGGER | Auto-API-Key für neue Profile. |

### 5.4 JSONB-Strukturen

**`projects.vehicle_data`** (VehicleData):
```json
{
  "category": "Leasing",
  "vehicle": {
    "brand": "BMW", "model": "320i", "variant": "M Sport",
    "year": 2025, "color": "Alpinweiß", "fuelType": "Benzin",
    "transmission": "Automatik", "power": "135 kW (184 PS)",
    "features": ["LED Scheinwerfer", "Navigationssystem", ...],
    "vin": "WBA..."
  },
  "finance": {
    "monthlyRate": "399 €", "downPayment": "0 €", "duration": "48 Monate",
    "totalPrice": "45.900 €", "annualMileage": "10.000 km",
    "specialPayment": "0 €", "residualValue": "", "interestRate": "3,99 %"
  },
  "dealer": {
    "name": "Autohaus Müller", "address": "Hauptstr. 1",
    "postalCode": "80331", "city": "München",
    "phone": "+49 89 123456", "email": "info@autohaus-mueller.de",
    "website": "https://autohaus-mueller.de", "taxId": "DE123456789",
    "logoUrl": "https://...", "facebookUrl": "", "instagramUrl": "",
    "leasingBank": "BMW Bank", "leasingLegalText": "..."
  },
  "consumption": {
    "fuelType": "Benzin", "consumptionCombined": "6,8 l/100 km",
    "co2Emissions": "155 g/km", "co2Class": "E",
    "consumptionCity": "", "consumptionSuburban": "",
    "consumptionRural": "", "consumptionHighway": "",
    "energyCostPerYear": "2.204 €", "fuelPrice": "1,80 €/l",
    "co2CostMedium": "470 €", "co2CostLow": "352 €", "co2CostHigh": "587 €",
    "vehicleTax": "208 €",
    "isPluginHybrid": false, "electricRange": "", ...
  }
}
```

**`admin_settings` Keys:**
- `credit_costs`: `{ "pdf_analysis": { "standard": 1 }, "image_generate": { "schnell": 3, "qualitaet": 5, ... } }`
- `ai_prompts`: `{ "pdf_analysis": "custom prompt...", "vin_ocr": "...", "remaster": "..." }`

---

## 6. Authentifizierung & Autorisierung

### 6.1 Auth-Methoden

| Methode | Konfiguration |
|---|---|
| **E-Mail/Passwort** | E-Mail-Verifizierung erforderlich (kein Auto-Confirm) |
| **Google OAuth** | Konfiguriert für Custom Domains (Redirect URI: `auth/v1/callback`) |

### 6.2 Registrierungsfluss

```
1. Nutzer füllt Registrierungsformular aus
2. Supabase Auth erstellt User in auth.users
3. Trigger handle_new_user() →
   a. Erstellt profiles-Eintrag (id, email, contact_name)
   b. Erstellt credit_balances-Eintrag (balance: 10)
   c. Trigger set_api_key_on_insert() → Generiert API-Key
4. Bestätigungs-E-Mail wird gesendet
5. Nutzer bestätigt E-Mail → email_confirmed_at gesetzt
6. ProtectedRoute erlaubt Zugang
```

### 6.3 Rollenmodell

```
user_roles Tabelle (separat von profiles!)
├── admin     → Voller Zugriff auf Admin-Panel + alle Daten
├── moderator → (vorbereitet, aktuell nicht genutzt)
└── user      → Standard-Nutzer (implizit, kein Eintrag nötig)
```

**Prüfung:** Immer server-seitig via `has_role(auth.uid(), 'admin')` – niemals client-seitig!

### 6.4 RLS-Policy-Strategie

Jede Tabelle hat **RESTRICTIVE** Policies (nicht PERMISSIVE):

```sql
-- Nutzer sieht eigene Daten
CREATE POLICY "Users can view own..." ON table
  FOR SELECT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins sehen alles
CREATE POLICY "Admins can manage..." ON table
  FOR ALL TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

---

## 7. KI-Services & Modelle

### 7.1 Google Gemini API (direkt)

Alle KI-Aufrufe nutzen die **Google Gemini REST API** direkt:

```
Endpoint:  https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Auth:      x-goog-api-key: GEMINI_API_KEY
Modelle:   gemini-2.5-flash, gemini-3-pro-image-preview, gemini-3.1-flash-image-preview
```

### 7.2 Modell-Tiers (Bildgenerierung)

| Tier | Modell | Engine | Credits | Einsatz |
|---|---|---|---|---|
| `schnell` | `gemini-2.5-flash-image` | Gemini | 3 | Schnelle Vorschau |
| `qualitaet` | `gemini-3-pro-image-preview` | Gemini | 5 | Standard-Qualität |
| `turbo` | `gemini-3.1-flash-image-preview` | Gemini | 6 | Schnell + hochwertig |
| `premium` | `gpt-image-1` | OpenAI | 8 | Premium-Qualität |
| `ultra` | `gpt-image-1` (HD) | OpenAI | 10 | Höchste Qualität |

### 7.3 Master-Prompt-System (Bild-Remastering)

Das Remastering folgt einem dynamischen Prompt-System:

```
Nutzerkonfiguration (UI)
├── Szene (15 Presets): Modern Showroom, Wald, Stadt, Strand, ...
├── Custom Showroom: Eigenes Hintergrundbild hochladen
├── Kennzeichen: Original | Blur | Entfernen | Custom Text | Custom Bild
├── Fahrzeugfarbe: Hex-Code (optional)
├── Hersteller-Logo: Aus Supabase Storage
└── Autohaus-Logo: Aus Profil

       ↓ buildMasterPrompt()

Zusammengesetzter Prompt-String → Edge Function → KI-API
```

**Besonderheiten Remastering:**
- Interieur-Aufnahmen: Strikte Perspektive-Beibehaltung (kein Drehen/Spiegeln)
- Originale Roh-Uploads als primäre Referenz
- Logo-Rendering: Fotorealistisches 3D auf dunkelgrauer, matter Wand mit LED-Halo

### 7.4 Video-Generierung

```
Ablauf (asynchron, Polling-basiert):
1. Client → POST generate-video { action: "start", imageBase64, prompt }
2. Server → Google Veo 3.1 predictLongRunning → operationName
3. Client → POST generate-video { action: "poll", operationName }
4. Server → Prüft Operation → Downloads Video → Upload Storage
5. Response: { videoUrl: "https://...supabase.co/storage/..." }
```

### 7.5 PDF-Analyse-Pipeline

```
PDF Base64 → Gemini 2.5 Flash (System-Prompt mit striktem JSON-Schema)
    │
    ▼
Strukturierte Extraktion:
├── Fahrzeugdaten (Marke, Modell, Variante, Farbe, ...)
├── Finanzdaten (Rate, Laufzeit, Anzahlung, ...)
├── Verbrauchsdaten (WLTP, CO₂, ...)
├── Ausstattungsmerkmale (max. 20, gefiltert)
└── Händlerinformationen

    │
    ▼
Post-Processing (Server-seitig):
├── CO₂-Klasse aus Emissionswert ableiten (A-G)
├── PHEV-Erkennung (Plugin-Hybrid)
├── Feature-Bereinigung (ohne/kein-Filter, Duplikate, max 20)
└── Fehlende Felder mit Defaults füllen
```

---

## 8. Monetarisierung & Credit-System

### 8.1 Credit-Kosten pro Aktion

| Aktion | Credits (Standard) | Credits (Pro/Premium) |
|---|---|---|
| PDF-Analyse | 1 | 1 |
| VIN-OCR | 1 | 1 |
| Bildgenerierung (Schnell) | 3 | – |
| Bildgenerierung (Qualität) | 5 | – |
| Bildgenerierung (Turbo) | 6 | – |
| Bildgenerierung (Premium) | 8 | – |
| Bildgenerierung (Ultra) | 10 | – |
| Bild-Remastering | 3-10 | (nach Tier) |
| Video-Generierung | 10 | 10 |
| Landing Page | 3 | 3 |

### 8.2 Ablauf einer Credit-Deduktion

```
Client                          Server (Edge Function)
  │                                │
  │ CreditConfirmDialog öffnen     │
  │ (zeigt Kosten + Balance)       │
  │                                │
  │ User bestätigt ─────────────►  │
  │                                │ authenticateAndDeductCredits()
  │                                │   ├── Auth-Token validieren
  │                                │   ├── rpc('deduct_credits') ◄── Atomar mit Row-Lock!
  │                                │   │   ├── SELECT balance FOR UPDATE
  │                                │   │   ├── Prüfe balance >= cost
  │                                │   │   ├── UPDATE balance, lifetime_used
  │                                │   │   └── INSERT credit_transactions
  │                                │   └── Return {success, balance}
  │                                │
  │                                │ KI-API aufrufen
  │                                │
  │ ◄───────────────────────────── │ Ergebnis zurückgeben
  │                                │
  │ Realtime: Balance-Update ◄──── │ (Supabase Realtime Channel)
```

### 8.3 Realtime Credit-Updates

```typescript
// useCredits.ts
const channel = supabase
  .channel('credit-balance')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'credit_balances',
    filter: `user_id=eq.${user.id}`,
  }, (payload) => {
    setBalance({ balance: payload.new.balance, ... });
  })
  .subscribe();
```

---

## 9. Stripe-Integration

### 9.1 Produkt-Mapping

| Plan | Stripe Product ID | Monthly Price ID | Yearly Price ID |
|---|---|---|---|
| Starter | `prod_U6vMgZiKJOuEph` | `price_1T8hVQ...` | `price_1T8jl2...` |
| Pro | `prod_U6vMFLF7W8nh43` | `price_1T8hW0...` | `price_1T8kGP...` |
| Enterprise | `prod_U6vQHQJucwwipk` | `price_1T8hZF...` | `price_1T8kH6...` |

### 9.2 Credit-Pakete (Einmalkauf)

| Paket | Credits | Preis | Price ID |
|---|---|---|---|
| 10 Credits | 10 | 5,00 € | `price_1T8kL9...` |
| 50 Credits (-40%) | 50 | 15,00 € | `price_1T8kLA...` |
| 200 Credits (-55%) | 200 | 45,00 € | `price_1T8kLB...` |

### 9.3 Webhook-Events

| Stripe Event | Aktion |
|---|---|
| `checkout.session.completed` | Abo erstellen oder Credits gutschreiben |
| `customer.subscription.updated` | Abo-Status synchronisieren |
| `customer.subscription.deleted` | Abo als cancelled markieren |
| `invoice.paid` | Credits für neue Periode gutschreiben |
| `invoice.payment_failed` | Status → `past_due` |
| `charge.refunded` | Nur geloggt |

### 9.4 Checkout-Flow

```
Pricing Page → create-checkout (priceId, email)
    │
    ▼
Stripe Checkout Session (mode: "subscription" oder "payment")
    │
    ▼
stripe-webhook empfängt Event
    │
    ├── Abo: INSERT/UPDATE user_subscriptions + add_credits()
    └── Credits: add_credits() direkt
```

---

## 10. Modul-Übersicht: Funktionsbereiche

### 10.1 ActionHub (5 Workflows)

| # | Tile | Workflow | Output |
|---|---|---|---|
| 1 | **Fotos & Remastering** | Fotos aufnehmen/hochladen → Perspektiven-Grid → KI-Remastering → Pipeline | Showroom-Bilder (Storage) |
| 2 | **PDF → Angebotsseite** | PDF hochladen → KI-Analyse → Daten-Editor → Template wählen → Export | HTML-Angebotsseite |
| 3 | **Landing Page manuell** | Marke+Modell+Typ → KI generiert Text+Bilder → Editor → Export | SEO-Landing-Page |
| 4 | **Banner Generator** | Projekt wählen/Bild hochladen → Prompt bauen → KI rendert Banner | Social-Media-Banner |
| 5 | **Video Erstellung** | Bild hochladen → KI-Video generieren (Veo 3.1) | Showroom-Video |

### 10.2 Template-System (PDF-Seiten)

4 verfügbare Templates für Angebotsseiten:

| Template | Beschreibung | Layout |
|---|---|---|
| `autohaus` | **Standard.** Professionelles Autohaus-Design | 2-spaltig: 822px Haupt + 395px Sidebar (fixiert) |
| `modern` | Modernes, clean Design | Responsive Single-Column |
| `klassisch` | Traditionelles Autohaus-Layout | Klassisch strukturiert |
| `minimalist` | Reduziertes, elegantes Design | Fokus auf Bilder + Kernfakten |

Jedes Template enthält:
- Fahrzeug-Hero mit Galerie
- Fahrzeugdetails + Ausstattungsliste
- Finanzierungsübersicht (kontextabhängig: Leasing/Kauf/Finanzierung)
- CO₂-Effizienzlabel (Pkw-EnVKV-konform, inkl. PHEV-Doppellabel)
- Verbrauchs- und Kostentabellen
- Händler-Informationen + Kontakt-CTA
- Rechtliche Pflichtangaben (PAngV)

### 10.3 Landing-Page-Seitentypen

7 spezialisierte KI-Seitentypen:

| Typ | Fokus | Abschnitte | Bilder |
|---|---|---|---|
| `leasing` | Rate, Flexibilität, Vorteile | ~5 | Dynamisch (KI) |
| `finanzierung` | Eigentum, Zinsen, Ratenkauf | ~5 | Dynamisch |
| `barkauf` | Preisvorteil, Ausstattung | ~4 | Dynamisch |
| `massenangebot` | Urgency, Limitierung, FOMO | ~6 | Dynamisch |
| `autoabo` | Flexibilität, All-inclusive | ~5 | Dynamisch |
| `event` | Event-Details, Highlights | ~6 | Dynamisch |
| `release` | Innovation, Technologie | ~5 | Dynamisch |

### 10.4 Rechner-Module

| Rechner | Datei | Funktionsweise |
|---|---|---|
| **Leasing** | `LeasingCalculatorPanel.tsx` | Rate, Laufzeit, Sonderzahlung, Restwert |
| **Finanzierung** | `FinancingCalculatorPanel.tsx` | Rate, Anzahlung, Zinssatz, Laufzeit |
| **Kfz-Steuer** | `KfzSteuerPanel.tsx` + `kfz-steuer.ts` | BMF-Logik mit Steuersatz-Datenbank (`kfz-steuersaetze.json`) |
| **Betriebskosten** | `cost-utils.ts` | Energiekosten/Jahr, CO₂-Kosten (10J), Kraftstoffpreise |

### 10.5 CO₂-Effizienzlabel-System

Vollständige Implementierung der **Pkw-EnVKV** (Energieverbrauchskennzeichnung):

```
Klasse A: 0 g/km
Klasse B: 1-95 g/km
Klasse C: 96-115 g/km
Klasse D: 116-135 g/km
Klasse E: 136-155 g/km
Klasse F: 156-175 g/km
Klasse G: >175 g/km
```

**PHEV-Doppellabel:** Plugin-Hybride zeigen zwei CO₂-Klassen (gewichtet/entladen) mit separaten Bildern (`/images/co2/phev/AB.jpg` etc.)

---

## 11. Externe APIs & Abhängigkeiten

### 11.1 Google Gemini API

```
URL:     https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Auth:    x-goog-api-key: GEMINI_API_KEY
Modelle: gemini-2.5-flash (Text/PDF/OCR), gemini-3-pro-image-preview (Bild), gemini-3.1-flash-image-preview (Bild), veo-3.1-generate-preview (Video)
```

**Bild-Response:** Enthält `inlineData` in den `candidates.content.parts`:
```json
{
  "candidates": [{
    "content": {
      "parts": [{ "inlineData": { "mimeType": "image/png", "data": "base64..." } }]
    }
  }]
}
```

### 11.3 OpenAI

```
URL:     https://api.openai.com/v1/images/generations | /v1/images/edits
Auth:    Bearer OPENAI_API_KEY
Modelle: gpt-image-1
```

### 11.4 OutVin (VIN-Lookup)

```
URL:     https://www.outvin.com/api/v1/vehicle/{vin}
Auth:    Basic OUTVIN_API_KEY
Output:  Fahrzeugdaten (Marke, Modell, Variante, Antrieb, Farbe, ...)
```

### 11.5 Stripe

```
URL:     https://api.stripe.com/v1/...
Auth:    STRIPE_SECRET_KEY
API:     2025-08-27.basil
Webhook: STRIPE_WEBHOOK_SECRET (whsec_...)
```

### 11.6 Secrets-Übersicht

| Secret | Verwendung |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API (Text, Bild, Video, OCR) |
| `OPENAI_API_KEY` | OpenAI Image API |
| `STRIPE_SECRET_KEY` | Stripe Payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Verifizierung |
| `OUTVIN_API_KEY` | VIN-Datenbank |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-DB-Zugriff (RLS bypass) |
| `SUPABASE_ANON_KEY` | Standard-DB-Zugriff |
| `SUPABASE_URL` | Supabase Projekt-URL |

---

## 12. Storage & Asset-Management

### 12.1 Storage Buckets

| Bucket | Öffentlich | Inhalt |
|---|---|---|
| `vehicle-images` | ✅ | Generierte/Remasterte Fahrzeugbilder, Video-Output |
| `logos` | ✅ | Nutzer-Firmenlogos |
| `manufacturer-logos` | ✅ | Hersteller-Logos (SVGs in `svg/`, Raster im Root) |
| `banners` | ✅ | Generierte Werbebanner |
| `sample-pdfs` | ✅ | Beispiel-PDFs für Demo/Testing |
| `sales-knowledge` | ❌ | Sales-Wissensbasis-Dokumente (RAG, privat) |

### 12.2 Bild-Storage-Strategie

```
Generierung/Upload:
  Edge Function → Base64-Ergebnis
    → Upload zu Storage Bucket
    → Öffentliche URL zurückgeben
    → URL in DB speichern (project_images.image_url / projects.main_image_url)

Fallback:
  Ältere Projekte haben base64 in DB (project_images.image_base64)
  → Wird bei Export on-the-fly verarbeitet
```

### 12.3 Statische Assets

```
public/
├── images/
│   ├── co2/           # CO₂-Effizienzlabel-Bilder (A-G)
│   │   └── phev/      # PHEV-Doppellabel (49 Kombinationen)
│   ├── logos/          # Statische Hersteller-Logos (Legacy)
│   ├── perspectives/   # Perspektiven-Vorschau-Icons
│   └── showrooms/      # Showroom-Hintergrund-Vorschauen
├── data/
│   └── kfz-steuersaetze.json  # BMF-Steuersatz-Datenbank
├── embed.js           # Embed-Script für externe Websites
└── favicon.ico

src/assets/
├── hero-bg.png        # Landing Page Hero-Hintergrund
├── logo-dark.png      # App-Logo (dunkel)
└── logo-light.png     # App-Logo (hell)
```

---

## 13. Distributions- & Integrations-Schnittstellen

### 13.1 REST API

```
Base URL: https://{SUPABASE_URL}/functions/v1/api-vehicles
Auth:     Header x-api-key: ak_...
```

| Endpoint | Method | Response |
|---|---|---|
| `/api-vehicles` | GET | JSON-Array aller Fahrzeuge des Nutzers |
| `/api-vehicles/:id` | GET | JSON mit Fahrzeugdaten + Bildern |
| `/api-vehicles/:id/html` | GET | HTML-Fragment (body-Inhalt) |

**Response-Beispiel (Liste):**
```json
{
  "vehicles": [
    {
      "id": "uuid",
      "title": "BMW 320i M Sport",
      "template_id": "autohaus",
      "vehicle_data": { ... },
      "main_image_url": "https://...",
      "created_at": "2026-03-10T12:00:00Z",
      "updated_at": "2026-03-10T12:00:00Z"
    }
  ]
}
```

**Response-Beispiel (Detail):**
```json
{
  "vehicle": {
    "id": "uuid",
    "title": "BMW 320i M Sport",
    "vehicle_data": { "category": "Leasing", "vehicle": {...}, "finance": {...}, "consumption": {...}, "dealer": {...} },
    "main_image_url": "https://...",
    "images": [
      { "id": "uuid", "url": "https://...", "perspective": "34_Vorne", "sort_order": 0 }
    ]
  }
}
```

### 13.2 FTP/SFTP-Upload

```
Konfiguration: /integrations → FTP-Sektion
Speicherung:   ftp_configs Tabelle (verschlüsselt pro User)
Edge Function: ftp-upload
Actions:       "test" (Verbindungstest) | "upload" (HTML + Bilder hochladen)
```

### 13.3 Embed-Script

```html
<!-- Fahrzeugliste -->
<div id="autohaus-ai-vehicles"></div>
<script src="https://autohaus.ai/embed.js"
        data-api-key="ak_..."
        data-supabase-url="https://rauzclzphdnhzflovrya.supabase.co"
        data-theme="light"
        data-columns="3">
</script>

<!-- Einzelfahrzeug -->
<div id="autohaus-ai-vehicle" data-vehicle-id="UUID"></div>
<script src="https://autohaus.ai/embed.js"
        data-api-key="ak_..."
        data-supabase-url="https://...">
</script>
```

**Funktionsweise:**
1. Script lädt Fahrzeugdaten via REST API
2. Rendert responsive CSS-Grid mit Karten
3. Einzelfahrzeug: Versucht zuerst HTML-Fragment, Fallback auf JSON-Rendering
4. Unterstützt Light/Dark Theme + konfigurierbare Spaltenanzahl

### 13.4 WordPress-Plugin

```
Plugin Name:  Autohaus AI – Fahrzeugangebote
Datei:        Generiert via wordpress-plugin.ts → PHP-Download
```

**Features:**
- Settings Page im WP-Admin (API-Key, URL, Sync-Intervall)
- Custom Post Type: `fahrzeug_angebot`
- WP-Cron-basierte Synchronisierung
- Media Sideloading (Bilder → WP Media Library)
- Schema.org Markup (Vehicle)
- Zwei Anzeige-Modi: PHP-Templates oder HTML-Injektion
- Shortcode: `[autohaus_ai_fahrzeuge]`

### 13.5 Kontaktformular (Lead-Generierung)

In generierten HTML-Seiten eingebettetes Kontaktformular:

```
Nutzer füllt Formular auf Landing Page
    │
    ▼
JavaScript fetch() → submit-lead Edge Function
    │
    ▼
INSERT INTO leads (dealer_user_id, project_id, name, email, phone, message, vehicle_title)
    │
    ▼
Sichtbar im Dashboard + Admin-Panel
```

**Sicherheit:** Öffentlich ohne Auth (anon-Rolle), Input-Sanitization, E-Mail-Validierung, Feld-Längenbegrenzung.

---

## 14. Admin-System

### 14.1 Admin-Routen & Zugang

```
/admin              → Dashboard (KPIs, Charts)
/admin/users        → Nutzerverwaltung (Rollen, Credits, Löschen)
/admin/transactions → Credit-Transaktionshistorie
/admin/leads        → Alle Kontaktanfragen
/admin/pdf-gallery  → Beispiel-PDFs verwalten
/admin/prompts      → KI-System-Prompts anpassen
/admin/pricing      → Abo-Pläne + Credit-Kosten bearbeiten
/admin/settings     → System-Einstellungen
/admin/logos        → Hersteller-Logos (Massen-Upload)
```

### 14.2 Admin-spezifische Edge Functions

| Function | Zweck |
|---|---|
| `admin-stripe` | Stripe Payments/Invoices/Subscriptions verwalten, Refunds |
| `admin-delete-user` | Nutzer-Account vollständig löschen |

Beide prüfen `has_role(auth.uid(), 'admin')` serverseitig.

### 14.3 Admin-Settings (admin_settings)

Konfigurierbare Einstellungen ohne Code-Änderung:

```json
// Key: "credit_costs"
{
  "pdf_analysis": { "standard": 1, "pro": 1 },
  "image_generate": { "schnell": 3, "qualitaet": 5, "turbo": 6, "premium": 8, "ultra": 10 },
  "image_remaster": { "schnell": 3, "qualitaet": 5, "turbo": 6, "premium": 8, "ultra": 10 },
  "vin_ocr": { "standard": 1 }
}

// Key: "ai_prompts"
{
  "pdf_analysis": "Custom system prompt for PDF analysis...",
  "vin_ocr": "Custom OCR prompt...",
  "remaster": "Custom remaster prompt..."
}
```

---

## 15. Sicherheitsarchitektur

### 15.1 Schichten

```
┌──────────────────────────────────┐
│  1. Frontend: Auth-Guards        │  ProtectedRoute, AdminRoute
├──────────────────────────────────┤
│  2. Edge Functions: Token-Check  │  supabase.auth.getUser()
├──────────────────────────────────┤
│  3. DB: Row Level Security       │  RESTRICTIVE Policies
├──────────────────────────────────┤
│  4. DB: SECURITY DEFINER Funcs   │  has_role(), deduct_credits()
├──────────────────────────────────┤
│  5. API: Key-basierte Auth       │  x-api-key Header (api-vehicles)
├──────────────────────────────────┤
│  6. Stripe: Webhook Signatures   │  constructEventAsync()
└──────────────────────────────────┘
```

### 15.2 Kritische Sicherheitsregeln

1. **Rollen IMMER in separater Tabelle** (`user_roles`), nie in `profiles`
2. **Keine client-seitige Admin-Prüfung** (kein localStorage)
3. **Credit-Deduction atomar** mit `FOR UPDATE` Row-Lock
4. **SECURITY DEFINER** für role-check (verhindert RLS-Rekursion)
5. **Service Role Key** nur in Edge Functions, nie im Frontend
6. **API-Keys** mit Prefix `ak_` + 48 hex chars (gen_random_bytes)
7. **Input-Sanitization** in submit-lead (Längen-Limits, E-Mail-Regex)

---

## 16. Datenfluss-Diagramme

### 16.1 PDF → Angebotsseite (Hauptworkflow)

```
  [PDF-Upload]
       │
       ▼
  analyze-pdf (Edge Function)
  ├── Gemini 2.5 Flash analysiert PDF
  ├── Extrahiert: Fahrzeug, Finanz, Verbrauch, Dealer, Features
  ├── Post-Processing: CO₂-Klasse, PHEV, Feature-Filter
  └── Return: VehicleData JSON
       │
       ▼
  [Daten-Editor] ← Profile-Daten als Fallback für Dealer-Felder
  ├── Template wählen (autohaus|modern|klassisch|minimalist)
  ├── Alle Felder editierbar
  ├── CO₂-Label automatisch berechnet
  └── Betriebskosten berechnen
       │
       ▼
  [Bildquelle wählen]
  ├── KI-Generierung → generate-vehicle-image (bis 18 Perspektiven)
  ├── Foto-Upload → Remastering → remaster-vehicle-image
  └── Ohne Bilder
       │
       ▼
  [Speichern]
  ├── INSERT projects (vehicle_data, html_content, template_id)
  ├── Upload Bilder → vehicle-images Bucket
  ├── INSERT project_images (image_url, perspective, sort_order)
  └── Redirect → /project/:id
       │
       ▼
  [Export]
  ├── HTML-Download (Base64 oder URL-basiert)
  ├── FTP-Upload
  └── API-Zugriff (api-vehicles)
```

### 16.2 Landing Page Generator

```
  [Formular]
  ├── Marke + Modell
  ├── Seitentyp (7 Optionen)
  └── Zusätzliche Infos (optional)
       │
       ▼
  generate-landing-page (Edge Function)
  ├── 1. Dealer-Profil laden (profiles)
  ├── 2. Hersteller-Logo suchen (manufacturer-logos Bucket)
  ├── 3. Gemini: JSON generieren (SEO-Meta, Sections, CTAs)
  ├── 4. Gemini Image: Bilder pro Section generieren
  ├── 5. Bilder → vehicle-images Bucket uploaden
  ├── 6. HTML aus JSON + Bildern + Dealer-Daten assemblieren
  └── Return: { html, pageContent, imageMap, brandLogoUrl }
       │
       ▼
  [Projekt speichern]
  ├── INSERT projects (template_id: 'landing-page', html_content, vehicle_data)
  └── Redirect → /project/:id
       │
       ▼
  [Landing Page Editor]
  ├── Accordion: Sections bearbeiten (Titel, Text, Hintergrund)
  ├── Bild ersetzen: Upload / Regenerate / Remaster
  ├── SEO-Meta bearbeiten
  ├── Live-Vorschau (iframe)
  └── Auto-Save bei Änderungen
```

### 16.3 Billing-Flow

```
  /pricing → Nutzer wählt Plan
       │
       ├── Abo: create-checkout (priceId) → Stripe Checkout
       └── Credits: buy-credits (priceId) → Stripe Checkout
                    │
                    ▼
            Stripe Payment
                    │
                    ▼
            stripe-webhook
                    │
                    ├── checkout.session.completed
                    │   ├── Abo → INSERT user_subscriptions + add_credits()
                    │   └── Credits → add_credits()
                    │
                    ├── invoice.paid (Renewal)
                    │   └── add_credits() für neue Periode
                    │
                    ├── customer.subscription.updated
                    │   └── Status synchronisieren
                    │
                    └── invoice.payment_failed
                        └── Status → past_due
```

---

## 17. Deployment & Infrastruktur

### 17.1 Frontend

- **Build:** `vite build` → statisches Bundle
- **Hosting:** Lovable Preview/Published URLs
- **CDN:** Automatisch via Lovable-Infrastruktur
- **Custom Domain:** Konfigurierbar (z.B. `pdf.autohaus.ai`)

### 17.2 Backend

- **Edge Functions:** Automatisches Deployment bei Code-Änderung
- **Datenbank:** Managed PostgreSQL (Supabase)
- **Storage:** S3-kompatibel mit CDN (Supabase Storage)
- **Auth:** Managed Auth Service (Supabase Auth)

### 17.3 URLs

| Typ | URL |
|---|---|
| Preview | `https://id-preview--{project-id}.lovable.app` |
| Published | `https://drive-sell-page.lovable.app` |
| Custom Domain | konfigurierbar |
| Supabase API | `https://rauzclzphdnhzflovrya.supabase.co` |
| Edge Functions | `https://rauzclzphdnhzflovrya.supabase.co/functions/v1/{name}` |
| Storage (public) | `https://rauzclzphdnhzflovrya.supabase.co/storage/v1/object/public/{bucket}/{path}` |

### 17.4 Umgebungsvariablen (Frontend)

```env
VITE_SUPABASE_URL=https://rauzclzphdnhzflovrya.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=rauzclzphdnhzflovrya
```

---

## Anhang: Datei-Referenz (Edge Functions)

| Datei | Zeilen | Kernlogik |
|---|---|---|
| `analyze-pdf/index.ts` | ~417 | PDF-Analyse, JSON-Extraktion, CO₂-Post-Processing |
| `generate-vehicle-image/index.ts` | ~230 | Multi-Engine Bildgenerierung (Gemini/OpenAI) |
| `remaster-vehicle-image/index.ts` | ~204 | Master-Prompt Remastering mit bis zu 4 Referenzbildern |
| `generate-banner/index.ts` | ~243 | Banner-Rendering (Gemini/OpenAI, beliebige Formate) |
| `generate-video/index.ts` | ~231 | Async Video (Veo 3.1, Start/Poll-Pattern) |
| `generate-landing-page/index.ts` | ~626 | Dual-Prompt Landing Page (Text-JSON → Bilder → HTML) |
| `ocr-vin/index.ts` | ~129 | VIN-Erkennung aus Foto (Gemini Flash) |
| `lookup-vin/index.ts` | ~79 | VIN → Fahrzeugdaten (OutVin API) |
| `create-checkout/index.ts` | ~75 | Stripe Abo-Checkout |
| `buy-credits/index.ts` | ~66 | Stripe Credit-Kauf |
| `customer-portal/index.ts` | ~50 | Stripe Portal URL |
| `stripe-webhook/index.ts` | ~351 | Webhook-Handler (6 Event-Typen) |
| `check-credits/index.ts` | ~60 | Balance-Prüfung |
| `api-vehicles/index.ts` | ~136 | REST API (x-api-key Auth) |
| `submit-lead/index.ts` | ~65 | Kontaktformular (öffentlich) |
| `ftp-upload/index.ts` | ~265 | FTP/SFTP-Upload von HTML + Assets |
| `admin-stripe/index.ts` | ~235 | Admin Stripe-Management |
| `admin-delete-user/index.ts` | ~100 | Admin User-Löschung |
