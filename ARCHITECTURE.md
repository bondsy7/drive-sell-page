# Autohaus.AI – System- & Softwarearchitektur

> **Version:** 2.2 · **Stand:** 21. März 2026  
> **Zielgruppe:** Anfänger, Entwickler-Onboarding, technische Stakeholder, Kunden-Dokumentation

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
9. [Kostenanalyse: EK-Token, VK-Marge & API-Server](#9-kostenanalyse-ek-token-vk-marge--api-server)
10. [Stripe-Integration](#10-stripe-integration)
11. [Modul-Übersicht: Funktionsbereiche](#11-modul-übersicht-funktionsbereiche)
12. [360° Spin-Modul](#12-360-spin-modul)
13. [Externe APIs & Abhängigkeiten](#13-externe-apis--abhängigkeiten)
14. [Storage & Asset-Management](#14-storage--asset-management)
15. [Distributions- & Integrations-Schnittstellen](#15-distributions---integrations-schnittstellen)
16. [Admin-System](#16-admin-system)
17. [Sicherheitsarchitektur](#17-sicherheitsarchitektur)
18. [Datenfluss-Diagramme](#18-datenfluss-diagramme)
19. [Sales Assistant & CRM](#19-sales-assistant--crm)
20. [E-Mail-System (Resend)](#20-e-mail-system-resend)
21. [Deployment & Infrastruktur](#21-deployment--infrastruktur)
22. [Entwicklungsbedarf & Verbesserungs-Roadmap](#22-entwicklungsbedarf--verbesserungs-roadmap)

---

## 1. Systemübersicht

Autohaus.AI ist eine SaaS-Plattform für Automobilhändler, die mithilfe von KI automatisiert:

- **Fahrzeugangebots-Seiten** aus PDF-Angeboten generiert
- **Showroom-Bilder** aus Handyfotos per KI-Remastering erstellt
- **360°-Spins** aus 4 Perspektiv-Fotos generiert (36 interpolierte Frames)
- **SEO-optimierte Landing Pages** für Fahrzeugmarketing erzeugt
- **Werbebanner** für Social Media rendert
- **Showroom-Videos** per KI generiert
- **VIN-Erkennung** per OCR und Fahrzeugdaten-Lookup bereitstellt
- **Fahrzeugmarke erkennt** per KI-Bildanalyse (detect-vehicle-brand)
- **Sales Assistant** KI-gestütztes CRM mit Lead-Management, Konversationen, Aufgaben und Wissensbasis
- **E-Mail-Versand** transaktional und automatisiert via Resend

Das System folgt einer **modularen Workflow-Architektur** mit einem zentralen ActionHub, der unabhängige Prozesse orchestriert.

### High-Level-Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (SPA)                          │
│     React + TypeScript + Vite + Tailwind CSS + shadcn/ui     │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ ActionHub│ │Dashboard │ │ Profile  │ │  Admin Panel     ││
│  │(6 Tiles) │ │(5 Tabs)  │ │(Dealer)  │ │  (11 Seiten)     ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────────┘│
└───────┼────────────┼────────────┼───────────────┼────────────┘
        │            │            │               │
        ▼            ▼            ▼               ▼
┌──────────────────────────────────────────────────────────────┐
│               SUPABASE (Backend-as-a-Service)                │
│                     via Lovable Cloud                         │
│                                                              │
│  ┌──────────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Edge Funcs   │ │ Database │ │Storage │ │    Auth       │  │
│  │ (28 Funcs)   │ │ (32 Tab) │ │(6 Buck)│ │ Email+OAuth  │  │
│  └──────┬───────┘ └────┬─────┘ └───┬────┘ └──────────────┘  │
└─────────┼──────────────┼───────────┼─────────────────────────┘
          │              │           │
          ▼              │           │
┌──────────────────┐     │           │
│  Externe APIs    │     │           │
│                  │     │           │
│ • Google Gemini  │     │           │
│   (direkte API)  │     │           │
│ • OpenAI         │     │           │
│ • Stripe         │     │           │
│ • OutVin         │     │           │
│ • Resend (E-Mail)│     │           │
└──────────────────┘     │           │
                         ▼           ▼
                 PostgreSQL     Supabase Storage
                 (RLS-gesichert)  (CDN-backed)
```

### Für Anfänger: Was bedeutet das?

- **SPA (Single Page Application):** Die gesamte App läuft im Browser – kein Seiten-Neuladen nötig
- **Edge Functions:** Kleine Server-Programme, die bei Bedarf ausgeführt werden (z.B. PDF analysieren, Bilder generieren)
- **RLS (Row Level Security):** Jeder Nutzer sieht nur seine eigenen Daten in der Datenbank
- **CDN:** Bilder und Dateien werden global schnell ausgeliefert
- **Lovable Cloud:** Managed-Backend, das Supabase unter der Haube nutzt – kein eigener Server nötig

---

## 2. Tech-Stack

### Frontend
| Technologie | Version | Zweck |
|---|---|---|
| **React** | ^18.3.1 | UI-Framework (SPA) |
| **TypeScript** | ^5.8.3 | Typsicherheit |
| **Vite** | ^5.4.19 | Build-Tool & Dev-Server (schneller als Webpack) |
| **Tailwind CSS** | ^3.4.17 | Utility-First CSS (kein CSS selbst schreiben) |
| **shadcn/ui** | (Radix-basiert) | Design-System-Komponenten (Button, Dialog, etc.) |
| **React Router** | ^6.30.1 | Client-seitiges Routing (URL-basierte Navigation) |
| **TanStack Query** | ^5.56.2 | Server-State-Management (Daten cachen & synchronisieren) |
| **Recharts** | ^2.15.4 | Diagramme (Admin Dashboard) |
| **Lucide React** | ^0.462.0 | Icon-Bibliothek |
| **Sonner** | ^1.7.4 | Toast-Benachrichtigungen (Erfolg/Fehler-Meldungen) |
| **Zod** | ^3.25.76 | Schema-Validierung (Eingabedaten prüfen) |
| **React Hook Form** | ^7.61.1 | Formular-Management |
| **Framer Motion** | – | Animationen (optional, über Tailwind Animate) |

### Backend
| Technologie | Zweck |
|---|---|
| **Lovable Cloud (Supabase)** | Datenbank, Auth, Storage, Edge Functions – alles aus einer Hand |
| **Deno** | JavaScript/TypeScript Runtime für Edge Functions (sicher, schnell) |
| **PostgreSQL** | Relationale Datenbank mit RLS + pgvector (Vektor-Suche für RAG) |
| **Stripe** | Zahlungsabwicklung (Abos + Einmalkäufe) |
| **Resend** | Transaktionaler E-Mail-Versand (Lead-Benachrichtigungen, Sales) |

### KI-Modelle (via direkte Google Gemini & OpenAI REST APIs)
| Modell | Einsatz | API |
|---|---|---|
| `gemini-2.5-flash` | PDF-Analyse, VIN-OCR, Text-Generierung, Marken-Erkennung, Sales-Chat, 360° Spin | Gemini REST (direkt) |
| `gemini-2.5-flash-lite` | Equipment-Übersetzung (VIN), Subject-Generierung | Gemini REST (direkt) |
| `gemini-2.5-flash-image` | Bildgenerierung (Schnell-Tier) | Gemini REST (direkt) |
| `openai/gpt-image-1` | Bildgenerierung (Premium/Ultra-Tier), Banner | OpenAI REST (direkt) |
| `Google Veo 3.1` | Video-Generierung (asynchron) | Gemini REST (direkt) |

---

## 3. Frontend-Architektur

### 3.1 Routing-Struktur

```
/                       → Landing Page (öffentlich, SEO)
/auth                   → Login/Registrierung (öffentlich)
/pricing                → Preisübersicht (öffentlich)
/docs                   → API-Dokumentation (öffentlich)
/generator              → ActionHub + Workflows (geschützt)
/dashboard              → Projekt-Übersicht (geschützt, 5 Tabs)
/profile                → Händler-Profil (geschützt)
/project/:id            → Projekt-Editor (geschützt)
/leasing-rechner        → Leasing-Kalkulator (geschützt)
/finanzierungsrechner   → Finanzierungsrechner (geschützt)
/kfz-steuer-rechner     → Kfz-Steuer-Rechner (geschützt)
/integrations           → API/FTP/Embed (geschützt)
/sales-assistant        → Sales Assistant CRM (geschützt)
/sales-assistant/:id    → Konversation/Lead-Detail (geschützt)
/admin/*                → Admin-Panel (Admin-Rolle, 11 Unterseiten)
/architecture           → Architektur-Dokumentation (Admin-Rolle)
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

| Ebene | Lösung | Anfänger-Erklärung |
|---|---|---|
| Server-State | TanStack Query (React Query) | Daten vom Server werden gecacht und automatisch aktualisiert |
| Auth-State | React Context (`AuthProvider`) | Login-Status wird global geteilt |
| Credit-State | Custom Hook `useCredits()` mit Realtime-Subscription | Guthaben aktualisiert sich live |
| Formular-State | React Hook Form + lokaler useState | Formular-Eingaben verwalten |
| URL-State | React Router (Search Params für Dashboard-Tabs) | Tab-Auswahl in der URL gespeichert |

### 3.4 Lazy Loading

Alle Seiten werden per `React.lazy()` + `Suspense` geladen → initiale Bundle-Größe bleibt klein:

```tsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
// Wird erst geladen wenn /dashboard aufgerufen wird
```

### 3.5 Komponenten-Hierarchie (Kernmodule)

```
src/
├── components/
│   ├── ActionHub.tsx              # Zentrale Workflow-Auswahl (6 Tiles)
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
│   ├── PipelineRunner.tsx         # Batch-Bildgenerierung (Worker-Pool, 4 parallel)
│   │
│   ├── # 360° Spin
│   ├── spin360/
│   │   ├── Spin360Workflow.tsx    # Hauptworkflow: Upload → Confirm → Process → Result
│   │   ├── Spin360Upload.tsx      # 4-Slot Upload (vorne, seite-links, hinten, seite-rechts)
│   │   ├── Spin360Progress.tsx    # Fortschrittsanzeige mit Step-Tracking
│   │   ├── Spin360Viewer.tsx      # Interaktiver 360°-Viewer (Drag/Touch + Autoplay)
│   │   ├── PhotoModeSelector.tsx  # Foto-Modus Auswahl
│   │   └── index.ts              # Barrel-Export
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
│   ├── # Sales Assistant
│   ├── sales/
│   │   ├── SalesGeneratorTab.tsx    # KI-Antwort-Generator
│   │   ├── SalesCrmTab.tsx          # CRM-Timeline (größte Datei!)
│   │   ├── SalesTasksTab.tsx        # Aufgabenverwaltung
│   │   ├── SalesBookingsTab.tsx     # Probefahrt-Buchungen
│   │   ├── SalesQuotesTab.tsx       # Angebotserstellung
│   │   ├── SalesTradeInTab.tsx      # Inzahlungnahme
│   │   ├── SalesKnowledgeTab.tsx    # Wissensbasis (RAG)
│   │   ├── SalesMailboxTab.tsx      # E-Mail-Outbox
│   │   ├── SalesHistoryTab.tsx      # Konversationshistorie
│   │   ├── SalesJourneyTab.tsx      # Journey-Templates
│   │   ├── SalesChatPage.tsx        # Interner Chat
│   │   ├── SalesChatWidget.tsx      # Chat-Widget
│   │   ├── SalesAutopilotSettings.tsx # Autopilot-Konfiguration
│   │   └── SalesCalendarSettings.tsx  # Kalender-Settings
│   │
│   ├── # Template-System (PDF-Seiten)
│   ├── TemplateSidebar.tsx         # Template-Auswahl
│   ├── template-editors/
│   │   ├── types.ts                # TemplateEditorProps Interface
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
│   ├── # VIN & Marke
│   ├── VehicleBrandModelPicker.tsx # Marke+Modell Auswahl mit Logo-Vorschau
│   ├── VinDataDialog.tsx           # VIN-Daten-Übernahme-Dialog
│   │
│   ├── # Utilities
│   ├── CO2Label.tsx               # CO₂-Effizienzklassen-Anzeige (A-G)
│   ├── CO2LabelSelector.tsx       # CO₂-Klassen-Editor
│   ├── EditableField.tsx          # Inline-Editierfeld
│   ├── ExportChoiceDialog.tsx     # Export-Format-Wahl (URL/Base64)
│   ├── GalleryLightbox.tsx        # Bild-Lightbox
│   ├── ImagePreviewLightbox.tsx   # Vorschau-Lightbox
│   ├── CategoryDropdown.tsx       # Kategorie-Auswahl (Leasing/Kauf/etc.)
│   ├── FuelTypeDropdown.tsx       # Kraftstoff-Auswahl
│   ├── ImageSourceChoice.tsx      # Wahl: KI-Generierung vs. Upload
│   ├── VehicleSelectBeforeGenerate.tsx # Fahrzeug-Auswahl vor Generierung
│   ├── CancelSubscriptionDialog.tsx # Abo-Kündigung
│   ├── UserMenuSheet.tsx          # Mobile Nutzer-Menü
│   │
│   └── ui/                        # shadcn/ui Basis-Komponenten (40+)
│
├── hooks/
│   ├── useAuth.tsx                # Auth Context Provider + Hook
│   ├── useCredits.ts              # Credit-Balance mit Realtime-Subscription
│   ├── useCreditCheck.ts          # Credit-Prüfung + Confirm-Dialog Logik
│   ├── useSubscription.ts         # Abo-Status + Plan-Features
│   ├── useVinLookup.ts            # VIN → Fahrzeugdaten
│   ├── useVehicleMakes.ts         # Marken/Modell-Datensatz
│   ├── useSalesAssistant.ts       # Sales-Assistant State + Actions
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
│   ├── image-base64-cache.ts      # Bild-Cache für Base64-Konvertierung
│   ├── brand-aliases.ts           # Marken-Alias-Mapping (z.B. VW → Volkswagen)
│   ├── pipeline-jobs.ts           # Pipeline-Job Verwaltung
│   ├── sales-customer-utils.ts    # CRM Kunden-Thread-Gruppierung
│   ├── vin-wmi-lookup.ts          # WMI (World Manufacturer Identifier) Lookup
│   ├── wmi-data/                  # WMI-Datenbank (aufgeteilt in wmi2.ts, wmi3.ts)
│   ├── wordpress-plugin.ts        # WP-Plugin PHP-Generator
│   └── utils.ts                   # Tailwind Merge (cn helper)
│
├── pages/
│   ├── Landing.tsx                # Marketing-Startseite
│   ├── Auth.tsx                   # Login + Registrierung
│   ├── Index.tsx                  # Generator-Hauptseite (ActionHub)
│   ├── Dashboard.tsx              # Projekte (5 Tabs: Alle, Galerie, Landing, Banner, 360° Spin)
│   ├── Profile.tsx                # Händler-Profil + Bankdaten + Socials
│   ├── ProjectView.tsx            # Projekt-Editor (Template oder Landing Page)
│   ├── Pricing.tsx                # Abo-Pläne + Credit-Pakete
│   ├── Integrations.tsx           # API, FTP, Embed, WordPress
│   ├── ApiDocs.tsx                # API-Dokumentation
│   ├── SalesAssistant.tsx         # Sales Assistant CRM (10+ Tabs)
│   ├── LeasingCalculator.tsx      # Leasing-Rechner
│   ├── FinancingCalculator.tsx    # Finanzierungsrechner
│   ├── KfzSteuerRechner.tsx       # Kfz-Steuer-Rechner
│   ├── ArchitectureDoc.tsx        # Diese Architektur-Dokumentation als Seite
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
│   ├── AdminSettings.tsx          # System-Einstellungen (Key-Value JSONB)
│   ├── AdminSecrets.tsx           # API-Keys & Secrets sicher verwalten
│   ├── AdminLogos.tsx             # Hersteller-Logos verwalten
│   ├── AdminSalesAssistant.tsx    # Sales-Assistant-Konfiguration
│   └── AdminWmiCodes.tsx          # WMI-Codes verwalten
│
├── types/
│   ├── vehicle.ts                 # VehicleData, ConsumptionData, DealerData
│   ├── template.ts                # TemplateId type
│   └── sales-assistant.ts         # Sales-spezifische Typen
│
└── integrations/
    ├── supabase/
    │   ├── client.ts              # Auto-generiert: Supabase Client (NICHT EDITIEREN!)
    │   └── types.ts               # Auto-generiert: DB-Typen (NICHT EDITIEREN!)
    └── lovable/
        └── index.ts               # Lovable OAuth Integration (Google/Apple)
```

---

## 4. Backend-Architektur (Edge Functions)

Alle Backend-Logik läuft in **28 Supabase Edge Functions** (Deno-Runtime) + Shared-Module:

### 4.1 KI-Verarbeitungs-Functions

| Function | Input | Output | Credits | KI-Modell |
|---|---|---|---|---|
| `analyze-pdf` | `{ pdfBase64 }` | Strukturiertes JSON (VehicleData) | 1 | Gemini 2.5 Flash |
| `generate-vehicle-image` | `{ imagePrompt(s), modelTier }` | Base64 Bild(er) | 3-10 | Gemini Flash/Pro, OpenAI |
| `remaster-vehicle-image` | `{ imageBase64, vehicleDescription, ... }` | Base64 remastertes Bild | 3-10 | Gemini 3 Pro/Flash Image |
| `generate-banner` | `{ prompt, imageBase64?, modelTier, width, height }` | Base64 Banner | 5-10 | Gemini/OpenAI |
| `generate-video` | `{ imageBase64, prompt }` (start/poll) | Storage-URL Video | 10 | Google Veo 3.1 |
| `generate-landing-page` | `{ brand, model, pageType, dealer }` | HTML + JSON + Bilder | 3 | Gemini 2.5 Flash + Image |
| `generate-360-spin` | `{ jobId, step? }` (step-basiert) | 36 Frames in Storage | 10-20 | Gemini 2.5 Flash |
| `detect-vehicle-brand` | `{ imageBase64 }` | `{ brand, model, confidence }` | 0 | Gemini 2.5 Flash |
| `ocr-vin` | `{ imageBase64 }` | `{ vin: "WBA..." }` | 1 | Gemini 2.5 Flash |
| `lookup-vin` | `{ vin }` | Fahrzeugdaten JSON | 0 | OutVin API |

### 4.2 Zahlungs-Functions

| Function | Zweck |
|---|---|
| `create-checkout` | Stripe Checkout Session für Abo-Abschluss |
| `buy-credits` | Stripe Checkout für Credit-Pakete (Einmalkauf) |
| `customer-portal` | Stripe Customer Portal URL generieren |
| `stripe-webhook` | Webhook-Handler für Stripe Events (6 Event-Typen) |
| `check-credits` | Credit-Balance-Prüfung (ohne Deduktion) |

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
| `admin-delete-user` | Admin-Only: Nutzer löschen (kaskadiert) |

### 4.5 Shared Module (`_shared/`)

| Modul | Datei | Zweck |
|---|---|---|
| `getSecret()` | `_shared/get-secret.ts` | Liest API-Keys aus `admin_secrets` DB-Tabelle, Fallback auf `Deno.env`. 5-Minuten-Cache. |

```typescript
// Verwendung in Edge Functions:
import { getSecret } from "../_shared/get-secret.ts";

const apiKey = await getSecret("GEMINI_API_KEY");
// 1. Prüft admin_secrets Tabelle (via Service Role, RLS bypass)
// 2. Falls leer/Fehler → Fallback auf Deno.env.get("GEMINI_API_KEY")
// 3. Ergebnis wird 5 Minuten gecacht
```

**Vorteil:** Admins können API-Keys über `/admin/secrets` ändern, ohne Edge Functions neu deployen zu müssen.

### 4.6 Gemeinsame Patterns

Alle KI-Functions folgen einem einheitlichen Pattern:

```typescript
// 1. CORS Handling
if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

// 2. Auth + Credit-Deduction (atomar via RPC)
const authResult = await authenticateAndDeductCredits(req, actionType, cost);
if (authResult instanceof Response) return authResult;

// 3. Custom Prompt laden (admin_settings.ai_prompts override)
const prompt = await getCustomPrompt("key", DEFAULT_PROMPT);

// 4. API-Key aus DB laden (mit Env-Fallback)
const apiKey = await getSecret("GEMINI_API_KEY");

// 5. KI-API aufrufen (Google Gemini REST API direkt)
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/...", { ... });

// 6. Ergebnis verarbeiten + zurückgeben
return new Response(JSON.stringify(result), { headers: corsHeaders });
```

### 4.6 Step-basierte Pipeline-Architektur (360° Spin)

Für langlaufende Prozesse wie die 360°-Spin-Generierung wird eine **Step-basierte Architektur** verwendet:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Step 1: Upload   │ ──► │ Step 2: Normalize │ ──► │ Step 3: Generate│
│ (Quellbilder     │     │ (Kanonische       │     │ (36 Frames in   │
│  speichern)      │     │  Perspektiven)    │     │  Batches à 4)   │
└─────────────────┘     └──────────────────┘     └─────┬───────────┘
                                                        │
                                                        ▼ Self-Invocation
                                                  ┌─────────────────┐
                                                  │ Step 3b-3i:     │
                                                  │ Weitere Batches │
                                                  │ (Retry bei 502) │
                                                  └─────┬───────────┘
                                                        │
                                                        ▼
                                                  ┌─────────────────┐
                                                  │ Step 4: Complete│
                                                  │ (Status: done)  │
                                                  └─────────────────┘
```

**Warum Step-basiert?** Edge Functions haben ein Zeitlimit (~25s). Statt alles in einem Request abzuarbeiten, wird der Prozess in Schritte zerlegt. Nach jedem Schritt ruft sich die Function selbst auf (`Self-Invocation`) und macht mit dem nächsten Batch weiter. Status wird in der DB gespeichert, das Frontend pollt via Realtime.

**Heartbeat-Mechanismus:** Während langer Batch-Generierungen wird der `updated_at` Timestamp regelmäßig aktualisiert. Das Frontend erkennt „stale" Jobs (>5 Minuten ohne Update) und zeigt sie als abgebrochen an.

### 4.7 JWT-Konfiguration

```toml
# supabase/config.toml – Functions OHNE JWT-Verifizierung:
[functions.analyze-pdf]       # Eigene Auth-Logik
verify_jwt = false

[functions.submit-lead]       # Öffentliches Kontaktformular
verify_jwt = false

[functions.stripe-webhook]    # Stripe Signature statt JWT
verify_jwt = false

[functions.api-vehicles]      # x-api-key statt JWT
verify_jwt = false

# ... (alle 26 Functions mit verify_jwt = false, da eigene Auth-Logik)
```

**Für Anfänger:** `verify_jwt = false` bedeutet NICHT, dass keine Authentifizierung stattfindet. Die Functions prüfen den Auth-Token selbst (via `supabase.auth.getUser()`), was flexibler ist als die automatische JWT-Prüfung.

---

## 5. Datenbank-Architektur

### 5.1 Entity-Relationship-Diagramm (32 Tabellen)

```
auth.users (Supabase-managed, nicht direkt zugreifbar)
    │
    ├──1:1── profiles
    │         (company_name, contact_name, phone, email, website,
    │          address, postal_code, city, tax_id, logo_url,
    │          custom_showroom_url, social_urls, banking_data,
    │          legal_texts, api_key, whatsapp_number)
    │
    ├──1:N── projects
    │         (title, template_id, vehicle_data [JSONB],
    │          html_content, main_image_url, main_image_base64)
    │         │
    │         ├──1:N── project_images
    │         │         (image_base64, image_url, perspective, sort_order, gallery_folder)
    │         │
    │         └──1:N── leads
    │                   (name, email, phone, message, vehicle_title,
    │                    interested_test_drive, interested_trade_in,
    │                    interested_leasing, interested_financing, interested_purchase)
    │
    ├──1:1── credit_balances
    │         (balance [default:10], lifetime_used, last_reset_at)
    │
    ├──1:N── credit_transactions
    │         (amount, action_type [ENUM], model_used, description, reference_id)
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
    ├──1:N── image_generation_jobs
    │         (job_type, status, config [JSONB], tasks [JSONB],
    │          total_tasks, completed_tasks, failed_tasks,
    │          model_tier, vehicle_description, input_image_urls)
    │
    ├── 360° Spin:
    │   ├──1:N── spin360_jobs
    │   │         (status, target_frame_count [36], identity_profile [JSONB],
    │   │          manifest [JSONB], retry_count, error_message)
    │   │         │
    │   │         ├──1:N── spin360_source_images
    │   │         │         (perspective, image_url, analysis [JSONB], sort_order)
    │   │         │
    │   │         ├──1:N── spin360_canonical_images
    │   │         │         (perspective, image_url, sort_order)
    │   │         │
    │   │         └──1:N── spin360_generated_frames
    │   │                   (frame_index, angle_degrees, image_url, frame_type,
    │   │                    model_used, validation_status, validation_notes)
    │
    ├── Sales Assistant:
    │   ├──1:1── sales_assistant_profiles (Ton, Autopilot, Signatur, Forbidden Phrases)
    │   ├──1:N── sales_assistant_conversations (Lead, Stage, Kontext, Summary)
    │   │         ├──1:N── sales_assistant_messages (Input/Output, Kanal, Approval)
    │   │         ├──1:N── sales_assistant_tasks (Aufgaben, Priorität, Due Date)
    │   │         ├──1:N── conversation_stage_log (Stage-Wechsel, changed_by)
    │   │         ├──1:N── crm_manual_notes (Manuelle Notizen, note_type)
    │   │         ├──1:N── sales_quotes (Angebote, Preise, Leasing/Finanzierung)
    │   │         └──1:N── test_drive_bookings (Probefahrt-Termine, Duration)
    │   ├──1:N── sales_knowledge_documents (Wissensbasis)
    │   │         └──1:N── sales_knowledge_chunks (Embeddings [pgvector], chunk_text)
    │   ├──1:N── sales_email_outbox (E-Mail-Versand, Status-Tracking)
    │   ├──1:N── sales_notifications (Benachrichtigungen, Approval)
    │   ├──1:N── sales_chat_messages (Interner Chat)
    │   ├──1:N── dealer_availability (Verfügbarkeiten Mo-So, Slot-Dauer)
    │   ├──1:N── dealer_blocked_dates (Gesperrte Tage)
    │   ├──1:N── trade_in_valuations (Inzahlungnahme-Bewertungen)
    │   └──1:N── calendar_sync_configs (Kalender-Sync, OAuth Tokens)
    │
    └── customer_journey_templates (Journey-Phasen, global + pro User)

subscription_plans (global, read-only für User)
    (name, slug, monthly_credits, price_monthly_cents,
     price_yearly_cents, extra_credit_price_cents, features [JSONB])

admin_settings (global, nur Admins schreiben)
    (key, value [JSONB])
    Keys: "credit_costs", "ai_prompts"

admin_secrets (global, NUR Admins lesen+schreiben, kein öffentlicher Zugriff!)
    (key, value [TEXT, maskiert in UI], label)
    Keys: "GEMINI_API_KEY", "OPENAI_API_KEY", "STRIPE_SECRET_KEY", etc.
    → Edge Functions lesen via getSecret() Helper mit Fallback auf Deno.env

sample_pdfs (global, read-only für User)
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
| `deduct_credits(_user_id, _amount, _action_type, _model, _description)` | SECURITY DEFINER | Atomarer Credit-Abzug mit `FOR UPDATE` Row-Lock. Auto-Create für neue Nutzer (10 Credits). Gibt `{success, balance, cost}` zurück. |
| `add_credits(_user_id, _amount, _action_type, _description)` | SECURITY DEFINER | Credits gutschreiben (Kauf, Abo-Reset, Admin). Auto-Create bei erstem Eintrag. |
| `has_role(_user_id, _role)` | SECURITY DEFINER | Rollenprüfung ohne RLS-Rekursion. Wird in allen Admin-Policies verwendet. |
| `generate_api_key()` | STABLE | Generiert `ak_` + 48 hex chars (via `gen_random_bytes`). |
| `handle_new_user()` | TRIGGER | Bei User-Registrierung: Auto-Insert in `profiles` + `credit_balances` (10 Start-Credits). |
| `set_api_key_on_insert()` | TRIGGER | Auto-API-Key für neue Profile. |

**Für Anfänger:** `SECURITY DEFINER` bedeutet, dass die Funktion mit den Rechten des Erstellers (Admin) läuft, nicht mit den Rechten des aufrufenden Nutzers. So kann `has_role()` die `user_roles`-Tabelle lesen, ohne dass RLS-Policies sich gegenseitig blockieren.

### 5.4 JSONB-Strukturen

**`projects.vehicle_data`** (VehicleData):
```json
{
  "category": "Leasing",
  "vehicle": {
    "brand": "BMW", "model": "320i", "variant": "M Sport",
    "year": 2025, "color": "Alpinweiß", "fuelType": "Benzin",
    "transmission": "Automatik", "power": "135 kW (184 PS)",
    "features": ["LED Scheinwerfer", "Navigationssystem"],
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
    "logoUrl": "https://...", "leasingBank": "BMW Bank"
  },
  "consumption": {
    "consumptionCombined": "6,8 l/100 km", "co2Emissions": "155 g/km",
    "co2Class": "E", "isPluginHybrid": false,
    "energyCostPerYear": "2.204 €", "vehicleTax": "208 €"
  }
}
```

**`admin_settings` Keys:**
- `credit_costs`: `{ "pdf_analysis": { "standard": 1 }, "image_generate": { "schnell": 3, "qualitaet": 5, "turbo": 6, "premium": 8, "ultra": 10 }, ... }`
- `ai_prompts`: `{ "pdf_analysis": "Custom system prompt...", "vin_ocr": "...", "remaster": "..." }`

---

## 6. Authentifizierung & Autorisierung

### 6.1 Auth-Methoden

| Methode | Konfiguration |
|---|---|
| **E-Mail/Passwort** | E-Mail-Verifizierung erforderlich (kein Auto-Confirm) |
| **Google OAuth** | Via Lovable Cloud Auth (lovable/index.ts) |
| **Apple OAuth** | Via Lovable Cloud Auth (vorbereitet) |

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

Jede Tabelle hat individuell konfigurierte Policies:

```sql
-- Nutzer sieht eigene Daten
CREATE POLICY "Users can view own..." ON table
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins sehen alles
CREATE POLICY "Admins can manage..." ON table
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));
```

**Ausnahmen:** `leads` erlaubt öffentliche INSERTs (Kontaktformular), `admin_settings` und `subscription_plans` sind lesbar für alle.

---

## 7. KI-Services & Modelle

### 7.1 Google Gemini API (direkt)

```
Endpoint:  https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Auth:      x-goog-api-key: GEMINI_API_KEY (eigener Key, kein Gateway)
Modelle:   gemini-2.5-flash (Text + Bild), gemini-2.5-flash-lite (leichte Aufgaben)
Format:    systemInstruction + contents (Gemini-natives Format)
```

**Hinweis:** Alle KI-Aufrufe nutzen ausschließlich die **direkte Google Gemini REST API** mit eigenem `GEMINI_API_KEY`. Das Lovable AI Gateway wird **nicht** verwendet.

### 7.2 Modell-Tiers (Bildgenerierung)

| Tier | Modell | Engine | Credits | EK/Bild (ca.) | Einsatz |
|---|---|---|---|---|---|
| `schnell` | `gemini-2.5-flash-image` | Gemini | 3 | ~$0.039 (~0,036 €) | Schnelle Vorschau, Prototyping |
| `qualitaet` | `gemini-3.1-flash-image-preview` | Gemini | 5 | ~$0.045–0.067 (~0,042–0,062 €) | Standard-Qualität, Remastering |
| `turbo` | `gemini-3.1-flash-image-preview` | Gemini | 6 | ~$0.045–0.067 (~0,042–0,062 €) | Schnell + gute Qualität |
| `premium` | `gemini-3-pro-image-preview` | Gemini | 8 | ~$0.134 (~0,124 €) | Premium-Qualität |
| `ultra` | `gpt-image-1` (HD, quality: high) | OpenAI | 10 | ~$0.08–0.17 (~0,08–0,16 €) | Höchste Qualität |

**Preisquellen (Stand März 2026):**
- gemini-2.5-flash-image: $30/1M Output-Tokens, ~1.290 Tokens/Bild (1024px) → **$0.039/Bild**
- gemini-3.1-flash-image-preview: $60/1M Output-Tokens, ~747–1.120 Tokens/Bild → **$0.045–0.067/Bild**
- gemini-3-pro-image-preview: $120/1M Output-Tokens, ~1.120 Tokens/Bild (1K/2K) → **$0.134/Bild**
- gpt-image-1 (OpenAI): $10/1M Input + $40/1M Output (Image-Tokens) → **~$0.08–0.17/Bild**
- gpt-image-1-mini (OpenAI, aktuell nicht im Einsatz): $2.50/1M Input → **60-75% günstiger**
- gpt-image-1.5 (OpenAI, aktuell nicht im Einsatz): $8/1M Input → Neuestes Modell

### 7.3 Master-Prompt-System (Bild-Remastering)

```
Nutzerkonfiguration (UI)
├── Szene (15 Presets): Modern Showroom, Wald, Stadt, Strand, ...
├── Custom Showroom: Eigenes Hintergrundbild hochladen
├── Kennzeichen: Original | Blur | Entfernen | Custom Text | Custom Bild
├── Fahrzeugfarbe: Hex-Code (optional)
├── Hersteller-Logo: Aus Supabase Storage (manufacturer-logos Bucket)
└── Autohaus-Logo: Aus Profil

       ↓ buildMasterPrompt()

Zusammengesetzter Prompt-String → Edge Function → KI-API
```

**Besonderheiten Remastering:**
- Interieur-Aufnahmen: Strikte Perspektive-Beibehaltung (kein Drehen/Spiegeln)
- Originale Roh-Uploads als primäre Referenz
- Logo-Rendering: Fotorealistisches 3D auf dunkelgrauer, matter Wand mit LED-Halo
- Pipeline-Runner: Worker-Pool mit **4 parallelen Instanzen** (CONCURRENCY = 4)

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
├── CO₂-Klasse aus Emissionswert ableiten (A-G, nach Pkw-EnVKV)
├── PHEV-Erkennung (Plugin-Hybrid → Doppel-Label)
├── Feature-Bereinigung (ohne/kein-Filter, Duplikate, max 20)
└── Fehlende Felder mit Defaults füllen
```

### 7.6 Fahrzeugmarken-Erkennung

```
Bild-Upload → detect-vehicle-brand (Edge Function)
    → Gemini 2.5 Flash analysiert Fahrzeugbild
    → Return: { brand: "BMW", model: "3er", confidence: "high" }
    → Wird für Pipeline ohne PDF verwendet (Standalone-Workflow)
```

---

## 8. Monetarisierung & Credit-System

### 8.1 Credit-Kosten pro Aktion

| Aktion | Credits (Standard) | Anmerkung |
|---|---|---|
| PDF-Analyse | 1 | Pro PDF |
| VIN-OCR | 1 | Pro Bild |
| Marken-Erkennung | 0 | Kostenlos |
| VIN-Lookup | 0 | Kostenlos (OutVin API-Kosten intern) |
| Bildgenerierung (Schnell) | 3 | Pro Bild |
| Bildgenerierung (Qualität) | 5 | Pro Bild |
| Bildgenerierung (Turbo) | 6 | Pro Bild |
| Bildgenerierung (Premium) | 8 | Pro Bild |
| Bildgenerierung (Ultra) | 10 | Pro Bild |
| Bild-Remastering | 3-10 | Abhängig vom gewählten Tier |
| Video-Generierung | 10 | Pro Video |
| Landing Page | 3 | Text + Bilder |
| 360° Spin | 10-20 | 36 Frames (abhängig von Batch-Größe) |
| Sales-Antwort | 1 | Pro KI-generierte Antwort |

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
// useCredits.ts – Balance aktualisiert sich LIVE ohne Seiten-Reload
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

## 9. Kostenanalyse: EK-Token, VK-Marge & API-Server

### 9.1 Einkaufskosten (EK) pro KI-Aktion

Die tatsächlichen API-Kosten, die **pro Aktion anfallen** (Kosten an Google/OpenAI):

| Aktion | EK pro Aufruf (ca.) | API-Anbieter | Berechnung |
|---|---|---|---|
| **PDF-Analyse** (Gemini 2.5 Flash) | ~0,002–0,01 € | Google | ~2.000 Input-Token + 1.000 Output-Token |
| **VIN-OCR** (Gemini 2.5 Flash) | ~0,001–0,005 € | Google | Bild + kurze Antwort |
| **Marken-Erkennung** (Gemini 2.5 Flash) | ~0,001–0,005 € | Google | Bild + JSON (kurz) |
| **Bildgenerierung (schnell)** | ~0,01–0,03 € | Google Gemini | Flash Image, 1 Bild |
| **Bildgenerierung (qualitaet)** | ~0,04–0,08 € | Google Gemini | Pro Image, 1 Bild |
| **Bildgenerierung (turbo)** | ~0,02–0,05 € | Google Gemini | Flash Image 3.1, 1 Bild |
| **Bildgenerierung (premium)** | ~0,04–0,08 € | OpenAI | gpt-image-1, standard quality |
| **Bildgenerierung (ultra)** | ~0,08–0,16 € | OpenAI | gpt-image-1, high quality, HD |
| **Bild-Remastering** | ~0,04–0,16 € | Google/OpenAI | Abhängig vom Tier, wie oben |
| **Video-Generierung** (Veo 3.1) | ~0,10–0,50 € | Google | Stark modellabhängig |
| **Landing Page** | ~0,10–0,25 € | Google | Text-Generierung + 3-6 Bilder |
| **360° Spin** (36 Frames) | ~1,50–3,00 € | Google | 9 Batches × 4 Bilder (Gemini Pro) |
| **Sales-Antwort** | ~0,005–0,02 € | Google | Text-Generierung + RAG Lookup |
| **VIN-Lookup** | ~0,02 € pro Abfrage | OutVin | Fester Preis pro API-Call |

### 9.2 Verkaufspreis (VK) & Marge

| Aktion | Credits | Credit-Wert (VK) | EK (Mitte) | Marge | Marge % |
|---|---|---|---|---|---|
| PDF-Analyse | 1 | 0,50 € | 0,006 € | 0,494 € | **98,8%** |
| Bildgen. (schnell) | 3 | 1,50 € | 0,02 € | 1,48 € | **98,7%** |
| Bildgen. (qualitaet) | 5 | 2,50 € | 0,06 € | 2,44 € | **97,6%** |
| Bildgen. (premium) | 8 | 4,00 € | 0,06 € | 3,94 € | **98,5%** |
| Bildgen. (ultra) | 10 | 5,00 € | 0,12 € | 4,88 € | **97,6%** |
| Video | 10 | 5,00 € | 0,30 € | 4,70 € | **94,0%** |
| Landing Page | 3 | 1,50 € | 0,175 € | 1,325 € | **88,3%** |
| 360° Spin | 15* | 7,50 € | 2,25 € | 5,25 € | **70,0%** |
| Sales-Antwort | 1 | 0,50 € | 0,013 € | 0,487 € | **97,5%** |

*Preise basieren auf 1 Credit ≈ 0,50 € (Mittelwert: 10 Credits = 5,00 €)*

**Wichtig:** Die 360°-Spin-Generierung hat die niedrigste Marge (70%), da 36 Bildgenerierungen nötig sind. Eine Preisanpassung (15→20 Credits) oder Batch-Optimierung wäre sinnvoll.

### 9.3 Credit-Pakete & Umsatzberechnung

| Paket | Credits | Preis | Credit-Wert | Diskont |
|---|---|---|---|---|
| 10 Credits | 10 | 5,00 € | 0,50 €/Credit | Basis |
| 50 Credits | 50 | 15,00 € | 0,30 €/Credit | -40% |
| 200 Credits | 200 | 45,00 € | 0,225 €/Credit | -55% |

**Marge bei Paketverkauf (200er Paket, worst case):**

Wenn ein Nutzer das 200er-Paket kauft und NUR Ultra-Bilder generiert (höchste EK):
- 200 Credits ÷ 10 Credits/Bild = 20 Bilder
- 20 × 0,12 € EK = 2,40 € EK
- 45,00 € VK − 2,40 € EK = **42,60 € Gewinn (94,7% Marge)**

### 9.4 Server- & Infrastrukturkosten (Lovable Cloud)

| Kostenpunkt | Ca. Kosten/Monat | Anmerkung |
|---|---|---|
| **Lovable Cloud** (Supabase) | Usage-basiert (Free Tier verfügbar) | Datenbank, Auth, Storage, Edge Functions |
| **Supabase Storage** | ~0 (Free Tier bis 1GB) | CDN-backed, öffentliche Buckets |
| **Edge Function Invocations** | Usage-basiert | Pro Aufruf, minimal |
| **Lovable Hosting (CDN)** | Inklusive | Frontend-Hosting |
| **Stripe Gebühren** | 1,4% + 0,25 € (EU) | Pro Transaktion |
| **Resend E-Mails** | Free Tier: 100/Tag | Transaktionale E-Mails |
| **Custom Domain** | Inklusive (Lovable Paid Plan) | z.B. pdf.autohaus.ai |

**Fazit:** Die Infrastrukturkosten sind nahezu vernachlässigbar. Die Hauptkosten liegen bei den KI-API-Aufrufen (Google Gemini, OpenAI), die durch das Credit-System mehr als gedeckt werden.

---

## 10. Stripe-Integration

### 10.1 Produkt-Mapping

| Plan | Stripe Product ID | Monthly Price ID | Yearly Price ID |
|---|---|---|---|
| Starter | `prod_U6vMgZiKJOuEph` | `price_1T8hVQ...` | `price_1T8jl2...` |
| Pro | `prod_U6vMFLF7W8nh43` | `price_1T8hW0...` | `price_1T8kGP...` |
| Enterprise | `prod_U6vQHQJucwwipk` | `price_1T8hZF...` | `price_1T8kH6...` |

### 10.2 Credit-Pakete (Einmalkauf)

| Paket | Credits | Preis | Price ID |
|---|---|---|---|
| 10 Credits | 10 | 5,00 € | `price_1T8kL9...` |
| 50 Credits (-40%) | 50 | 15,00 € | `price_1T8kLA...` |
| 200 Credits (-55%) | 200 | 45,00 € | `price_1T8kLB...` |

### 10.3 Webhook-Events

| Stripe Event | Aktion |
|---|---|
| `checkout.session.completed` | Abo erstellen oder Credits gutschreiben |
| `customer.subscription.updated` | Abo-Status synchronisieren |
| `customer.subscription.deleted` | Abo als cancelled markieren |
| `invoice.paid` | Credits für neue Periode gutschreiben |
| `invoice.payment_failed` | Status → `past_due` |
| `charge.refunded` | Nur geloggt (kein Credit-Rückbuchung) |

### 10.4 Checkout-Flow

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

## 11. Modul-Übersicht: Funktionsbereiche

### 11.1 ActionHub (6 Workflows)

| # | Tile | Workflow | Output |
|---|---|---|---|
| 1 | **Fotos & Remastering** | Fotos aufnehmen/hochladen → Perspektiven-Grid → KI-Remastering → Pipeline | Showroom-Bilder (Storage) |
| 2 | **PDF → Angebotsseite** | PDF hochladen → KI-Analyse → Daten-Editor → Template wählen → Export | HTML-Angebotsseite |
| 3 | **Landing Page manuell** | Marke+Modell+Typ → KI generiert Text+Bilder → Editor → Export | SEO-Landing-Page |
| 4 | **Banner Generator** | Projekt wählen/Bild hochladen → Prompt bauen → KI rendert Banner | Social-Media-Banner |
| 5 | **Video Erstellung** | Bild hochladen → KI-Video generieren (Veo 3.1) | Showroom-Video |
| 6 | **KI Verkaufsassistent** | Lead wählen → Kontext eingeben → KI generiert Antwort | E-Mail/WhatsApp-Antwort |

### 11.2 Template-System (PDF-Seiten)

4 verfügbare Templates für Angebotsseiten:

| Template | Beschreibung | Layout |
|---|---|---|
| `autohaus` | **Standard.** Professionelles Autohaus-Design | 2-spaltig: 822px Haupt + 395px Sidebar (fixiert) |
| `modern` | Modernes, clean Design | Responsive Single-Column |
| `klassisch` | Traditionelles Autohaus-Layout | Klassisch strukturiert |
| `minimalist` | Reduziertes, elegantes Design | Fokus auf Bilder + Kernfakten |

Jedes Template enthält:
- Fahrzeug-Hero mit Galerie (Lightbox)
- Fahrzeugdetails + Ausstattungsliste
- Finanzierungsübersicht (kontextabhängig: Leasing/Kauf/Finanzierung)
- CO₂-Effizienzlabel (Pkw-EnVKV-konform, inkl. PHEV-Doppellabel)
- Verbrauchs- und Kostentabellen
- Händler-Informationen + Kontakt-CTA
- Rechtliche Pflichtangaben (PAngV)
- Eingebettetes Kontaktformular (optional, via shared.ts)

### 11.3 Landing-Page-Seitentypen

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

### 11.4 Rechner-Module

| Rechner | Datei | Funktionsweise |
|---|---|---|
| **Leasing** | `LeasingCalculatorPanel.tsx` | Rate, Laufzeit, Sonderzahlung, Restwert |
| **Finanzierung** | `FinancingCalculatorPanel.tsx` | Rate, Anzahlung, Zinssatz, Laufzeit |
| **Kfz-Steuer** | `KfzSteuerPanel.tsx` + `kfz-steuer.ts` | BMF-Logik mit Steuersatz-Datenbank (`kfz-steuersaetze.json`) |
| **Betriebskosten** | `cost-utils.ts` | Energiekosten/Jahr, CO₂-Kosten (10J), Kraftstoffpreise |

### 11.5 CO₂-Effizienzlabel-System

Vollständige Implementierung der **Pkw-EnVKV** (Energieverbrauchskennzeichnung):

```
Klasse A: 0 g/km          (BEV)
Klasse B: 1-95 g/km       (PHEV)
Klasse C: 96-115 g/km
Klasse D: 116-135 g/km
Klasse E: 136-155 g/km
Klasse F: 156-175 g/km
Klasse G: >175 g/km
```

**PHEV-Doppellabel:** Plugin-Hybride zeigen zwei CO₂-Klassen (gewichtet/entladen) mit separaten Bildern.

---

## 12. 360° Spin-Modul

### 12.1 Übersicht

Das 360°-Spin-Modul generiert aus **4 Quellfotos** (Front, Seite-Links, Hinten, Seite-Rechts) einen **36-Frame-Spin** für interaktive 360°-Ansichten.

### 12.2 Technische Architektur

```
[Upload: 4 Perspektiv-Fotos]
     │
     ▼
[spin360_source_images] ← Quellbilder in Storage
     │
     ▼
[generate-360-spin Edge Function]
     │
     ├── Step 1: Bilder normalisieren → spin360_canonical_images
     │
     ├── Step 2-9: Frame-Batches generieren (4 pro Batch)
     │   ├── Prompt: "Drehe Fahrzeug um X° basierend auf Referenzbild"
     │   ├── KI-Modell: Gemini 2.5 Flash (responseModalities: IMAGE+TEXT)
     │   ├── Upload → vehicle-images Bucket
     │   ├── Insert → spin360_generated_frames
     │   └── Self-Invocation für nächsten Batch
     │
     └── Step 10: Validierung + Status → "completed"
```

### 12.3 Datenbank-Tabellen

| Tabelle | Zweck | Felder |
|---|---|---|
| `spin360_jobs` | Job-Tracking | status, target_frame_count, retry_count, error_message |
| `spin360_source_images` | Original-Uploads | perspective, image_url, analysis (KI-Analyse) |
| `spin360_canonical_images` | Normalisierte Bilder | perspective, image_url, sort_order |
| `spin360_generated_frames` | Generierte Frames | frame_index (0-35), angle_degrees, validation_status |

### 12.4 Stale-Job-Erkennung

Das Dashboard erkennt "stale" Jobs automatisch:
- Jobs mit Status `generating_frames` und `updated_at` > 5 Minuten → als "Abgebrochen" angezeigt
- Fehlerhafte Jobs zeigen spezifische Fehlermeldungen
- Retry-Logik: MAX_FRAME_BATCH_RETRIES = 3 bei 502-Fehlern

### 12.5 Interaktiver Viewer

Der `Spin360Viewer` bietet:
- **Autoplay**: Automatische Rotation beim Öffnen
- **Drag-Interaktion**: Maus/Touch zum manuellen Drehen
- **Frame-Interpolation**: 36 Frames für flüssige 360°-Drehung (10° pro Frame)
- **Responsive**: Vollbild-Overlay mit Close-Button

---

## 13. Externe APIs & Abhängigkeiten

### 13.1 Google Gemini API

```
URL:     https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Auth:    x-goog-api-key: GEMINI_API_KEY (eigener Key)
Modelle: gemini-2.5-flash (Text/PDF/OCR/Bild/360°), gemini-2.5-flash-lite (leichte Aufgaben),
         veo-3.1-generate-preview (Video)
```

### 13.2 OpenAI

```
URL:     https://api.openai.com/v1/images/generations | /v1/images/edits
Auth:    Bearer OPENAI_API_KEY
Modelle: gpt-image-1
```

### 13.3 OutVin (VIN-Lookup)

```
URL:     https://www.outvin.com/api/v1/vehicle/{vin}
Auth:    Basic OUTVIN_API_KEY
Output:  Fahrzeugdaten (Marke, Modell, Variante, Antrieb, Farbe, ...)
```

### 13.4 Stripe

```
URL:     https://api.stripe.com/v1/...
Auth:    STRIPE_SECRET_KEY
Webhook: STRIPE_WEBHOOK_SECRET (whsec_...)
```

### 13.5 Resend (E-Mail)

```
URL:     https://api.resend.com/emails
Auth:    Bearer RESEND_API_KEY
Von:     RESEND_FROM_EMAIL (z.B. noreply@autohaus.ai)
Reply-To: RESEND_REPLY_TO
```

### 13.6 Secrets-Übersicht (Vollständig)

| Secret | Verwendung | Wo gesetzt |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API (Text, Bild, Video, OCR) | Edge Functions |
| `OPENAI_API_KEY` | OpenAI Image API | Edge Functions |
| `STRIPE_SECRET_KEY` | Stripe Payments | Edge Functions |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Verifizierung | Edge Functions |
| `OUTVIN_API_KEY` | VIN-Datenbank | Edge Functions |
| `RESEND_API_KEY` | Resend E-Mail-Versand | Edge Functions |
| `RESEND_FROM_EMAIL` | Absender-Adresse | Edge Functions |
| `RESEND_REPLY_TO` | Reply-To-Adresse | Edge Functions |
| `LOVABLE_API_KEY` | Lovable Cloud Auth (OAuth) | Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-DB-Zugriff (RLS bypass) | Edge Functions |
| `SUPABASE_ANON_KEY` | Standard-DB-Zugriff | Edge Functions + Frontend |
| `SUPABASE_URL` | Supabase Projekt-URL | Edge Functions + Frontend |
| `SUPABASE_DB_URL` | PostgreSQL Connection String | Edge Functions (direkt) |
| `SUPABASE_PUBLISHABLE_KEY` | Frontend Supabase Client | Frontend (.env) |

---

## 14. Storage & Asset-Management

### 14.1 Storage Buckets

| Bucket | Öffentlich | Inhalt |
|---|---|---|
| `vehicle-images` | ✅ | Generierte/Remasterte Fahrzeugbilder, 360°-Frames, Video-Output |
| `logos` | ✅ | Nutzer-Firmenlogos |
| `manufacturer-logos` | ✅ | Hersteller-Logos (SVGs in `svg/`, Raster im Root) |
| `banners` | ✅ | Generierte Werbebanner |
| `sample-pdfs` | ✅ | Beispiel-PDFs für Demo/Testing |
| `sales-knowledge` | ❌ | Sales-Wissensbasis-Dokumente (RAG, privat) |

### 14.2 Bild-Storage-Strategie

```
Generierung/Upload:
  Edge Function → Base64-Ergebnis
    → Upload zu Storage Bucket (via uploadImageToStorage())
    → Öffentliche URL zurückgeben
    → URL in DB speichern (project_images.image_url / projects.main_image_url)

Fallback:
  Ältere Projekte haben base64 in DB (project_images.image_base64)
  → Wird bei Export on-the-fly verarbeitet
```

### 14.3 Statische Assets

```
public/
├── images/
│   ├── co2/           # CO₂-Effizienzlabel-Bilder (A-G)
│   │   └── phev/      # PHEV-Doppellabel (49 Kombinationen)
│   ├── logos/          # Statische Hersteller-Logos (Legacy, SVGs)
│   ├── perspectives/   # Perspektiven-Vorschau-Icons
│   └── showrooms/      # Showroom-Hintergrund-Vorschauen
├── data/
│   ├── kfz-steuersaetze.json   # BMF-Steuersatz-Datenbank
│   └── vehicle-makes-models.json # Marken+Modell-Datensatz
├── embed.js           # Embed-Script für externe Websites
└── robots.txt         # SEO Crawling-Regeln
```

---

## 15. Distributions- & Integrations-Schnittstellen

### 15.1 REST API

```
Base URL: https://{SUPABASE_URL}/functions/v1/api-vehicles
Auth:     Header x-api-key: ak_...
```

| Endpoint | Method | Response |
|---|---|---|
| `/api-vehicles` | GET | JSON-Array aller Fahrzeuge des Nutzers |
| `/api-vehicles/:id` | GET | JSON mit Fahrzeugdaten + Bildern |
| `/api-vehicles/:id/html` | GET | HTML-Fragment (body-Inhalt) |

### 15.2 Embed-Script

```html
<!-- Fahrzeugliste -->
<div id="autohaus-ai-vehicles"></div>
<script src="https://autohaus.ai/embed.js"
        data-api-key="ak_..."
        data-supabase-url="https://..."
        data-theme="light"
        data-columns="3">
</script>
```

### 15.3 WordPress-Plugin

```
Plugin Name:  Autohaus AI – Fahrzeugangebote
Datei:        Generiert via wordpress-plugin.ts → PHP-Download
```

Features: Custom Post Type, WP-Cron Sync, Media Sideloading, Schema.org Markup, Shortcode.

### 15.4 FTP/SFTP-Upload

Über `/integrations` konfigurierbar. Edge Function `ftp-upload` unterstützt Test und Upload.

### 15.5 Kontaktformular (Lead-Generierung)

```
Nutzer füllt Formular auf Landing Page
    → fetch() → submit-lead Edge Function
    → INSERT INTO leads (öffentlich, ohne Auth)
    → Optional: auto-process-lead (Autopilot)
    → Sichtbar im Dashboard + Admin-Panel + Sales Assistant CRM
```

### 16.4 Admin-Secrets (admin_secrets)

Sichere Verwaltung von API-Keys ohne Code-Änderung:

```
Tabelle: admin_secrets
├── RLS: NUR Admins können lesen UND schreiben (kein öffentlicher Zugriff!)
├── Unterschied zu admin_settings: KEIN public SELECT
├── UI: Maskierte Eingabefelder mit Sichtbarkeits-Toggle
└── Keys werden von Edge Functions via getSecret() gelesen
```

| Key | Label | Verwendung |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API Key | Text/Bild/Video/OCR |
| `OPENAI_API_KEY` | OpenAI API Key | Bild (Premium/Ultra) |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | Zahlungen |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | Webhook-Verifizierung |
| `RESEND_API_KEY` | Resend API Key | E-Mail-Versand |
| `RESEND_FROM_EMAIL` | Resend Absender E-Mail | Absenderadresse |
| `RESEND_REPLY_TO` | Resend Reply-To E-Mail | Reply-To-Adresse |
| `OUTVIN_API_KEY` | OutVIN API Key | VIN-Datenbank |

**Sicherheits-Architektur:**
```
Admin UI (/admin/secrets)
    │ Maskierte Eingabe + Sichtbarkeits-Toggle
    │ Nur bei has_role(auth.uid(), 'admin')
    ▼
admin_secrets Tabelle (RLS: NUR Admin)
    │ Service Role Key (RLS bypass)
    ▼
getSecret() Helper (_shared/get-secret.ts)
    ├── 1. Liest aus admin_secrets (5-Min-Cache)
    ├── 2. Fallback: Deno.env.get()
    └── Verwendet von Edge Functions
```

---

## 16. Admin-System

### 16.1 Admin-Routen & Zugang (18 Seiten)

```
/admin              → Dashboard (KPIs, Charts)
/admin/users        → Nutzerverwaltung (Rollen, Credits, Löschen)
/admin/transactions → Credit-Transaktionshistorie
/admin/leads        → Alle Kontaktanfragen
/admin/pdf-gallery  → Beispiel-PDFs verwalten
/admin/prompts      → KI-System-Prompts anpassen
/admin/pricing      → Abo-Pläne + Credit-Kosten bearbeiten
/admin/settings     → System-Einstellungen (Key-Value JSONB)
/admin/secrets      → API-Keys & Secrets sicher verwalten (maskierte Eingabe)
/admin/logos        → Hersteller-Logos (Massen-Upload, SVG)
/admin/sales-assistant → Sales-Assistant-Konfiguration
/admin/wmi-codes    → WMI-Codes verwalten (Fahrzeug-Identifikation)
/architecture       → Architektur-Dokumentation (Admin, PDF-Export)
```

### 16.2 Admin-spezifische Edge Functions

| Function | Zweck |
|---|---|
| `admin-stripe` | Stripe Payments/Invoices/Subscriptions verwalten, Refunds |
| `admin-delete-user` | Nutzer-Account vollständig löschen (kaskadierende Löschung) |

Beide prüfen `has_role(auth.uid(), 'admin')` serverseitig.

### 16.3 Admin-Settings (admin_settings)

Konfigurierbare Einstellungen ohne Code-Änderung:

```json
// Key: "credit_costs" – Kreditkosten dynamisch anpassbar
{
  "pdf_analysis": { "standard": 1, "pro": 1 },
  "image_generate": { "schnell": 3, "qualitaet": 5, "turbo": 6, "premium": 8, "ultra": 10 },
  "image_remaster": { "schnell": 3, "qualitaet": 5, "turbo": 6, "premium": 8, "ultra": 10 },
  "vin_ocr": { "standard": 1 }
}

// Key: "ai_prompts" – KI-Prompts ohne Deployment anpassbar
{
  "pdf_analysis": "Custom system prompt for PDF analysis...",
  "vin_ocr": "Custom OCR prompt...",
  "remaster": "Custom remaster prompt..."
}
```

---

## 17. Sicherheitsarchitektur

### 17.1 Schichten

```
┌──────────────────────────────────┐
│  1. Frontend: Auth-Guards        │  ProtectedRoute, AdminRoute
├──────────────────────────────────┤
│  2. Edge Functions: Token-Check  │  supabase.auth.getUser()
├──────────────────────────────────┤
│  3. DB: Row Level Security       │  Policies pro Tabelle
├──────────────────────────────────┤
│  4. DB: SECURITY DEFINER Funcs   │  has_role(), deduct_credits()
├──────────────────────────────────┤
│  5. API: Key-basierte Auth       │  x-api-key Header (api-vehicles)
├──────────────────────────────────┤
│  6. Stripe: Webhook Signatures   │  constructEventAsync()
├──────────────────────────────────┤
│  7. E-Mail: Verifizierung        │  email_confirmed_at Pflicht
└──────────────────────────────────┘
```

### 17.2 Kritische Sicherheitsregeln

1. **Rollen IMMER in separater Tabelle** (`user_roles`), nie in `profiles`
2. **Keine client-seitige Admin-Prüfung** (kein localStorage, kein hardcoded check)
3. **Credit-Deduction atomar** mit `FOR UPDATE` Row-Lock (verhindert Race Conditions)
4. **SECURITY DEFINER** für role-check (verhindert RLS-Rekursion)
5. **Service Role Key** nur in Edge Functions, nie im Frontend
6. **API-Keys** mit Prefix `ak_` + 48 hex chars (gen_random_bytes)
7. **Input-Sanitization** in submit-lead (Längen-Limits, E-Mail-Regex)
8. **Anon Key** nur publishable – kein Service Role Key im Frontend
9. **API-Secrets in DB** – `admin_secrets` Tabelle mit Admin-Only RLS (kein public SELECT), Edge Functions lesen via `getSecret()` mit Env-Fallback

---

## 18. Datenfluss-Diagramme

### 18.1 PDF → Angebotsseite (Hauptworkflow)

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
  ├── Foto-Upload → Remastering → remaster-vehicle-image (Pipeline)
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

### 18.2 360° Spin

```
  [4 Fotos hochladen] (Front, Links, Hinten, Rechts)
       │
       ▼
  [Upload → Storage] → spin360_source_images
       │
       ▼
  generate-360-spin (Edge Function, Step 1)
  ├── Bilder normalisieren → spin360_canonical_images
  └── Self-Invoke → Step 2
       │
       ▼
  generate-360-spin (Step 2-9, Batches)
  ├── 4 Frames pro Batch generieren (Gemini 2.5 Flash)
  ├── Upload → vehicle-images Bucket
  ├── Insert → spin360_generated_frames
  ├── Heartbeat: updated_at aktualisieren
  └── Self-Invoke → nächster Batch
       │
       ▼
  [Status: completed] → Dashboard zeigt "Fertig"
  [Klick] → Spin360Viewer Overlay (Drag/Touch + Autoplay)
```

### 18.3 Billing-Flow

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

## 19. Sales Assistant & CRM

Vollintegriertes KI-Verkaufsassistenten-System für Automobilhändler.

### 19.1 Module (Tabs)

| Tab | Funktion |
|---|---|
| **Generator** | KI-Antworten auf Kundenanfragen generieren (E-Mail, WhatsApp, Chat) |
| **CRM** | Kunden-Timeline mit Lead-Gruppierung, Bot-Antworten, manuelle Notizen |
| **Aufgaben** | Aufgabenverwaltung mit Prioritäten und Status |
| **Buchungen** | Probefahrt-Termine + Verfügbarkeitskalender |
| **Angebote** | Angebotserstellung (Barkauf, Leasing, Finanzierung) |
| **Inzahlungnahme** | Bewertung von Gebrauchtfahrzeugen |
| **Wissensbasis** | Dokumente hochladen → Chunking → Embeddings (RAG) |
| **Postfach** | E-Mail-Outbox mit Status-Tracking |
| **Verlauf** | Konversationshistorie mit allen Nachrichten |
| **Journey** | Customer-Journey-Templates (Phasen, CTAs, Signale) |

### 19.2 Autopilot-Modi

| Modus | Beschreibung |
|---|---|
| **Manuell** (`manual`) | Alle Antworten werden vom Verkäufer geprüft und gesendet |
| **Vorschlag** (`approval`) | KI erstellt Entwürfe, Verkäufer genehmigt vor Versand |
| **Autopilot** (`autopilot`) | KI antwortet automatisch auf bestimmte Journey-Phasen |

### 19.3 Wissensbasis (RAG-Pipeline)

```
Dokument-Upload → ingest-sales-knowledge (Edge Function)
  → Text-Extraktion (PDF/TXT/Markdown)
  → Chunking (500-1000 Tokens)
  → Embedding-Generierung (Gemini)
  → Speicherung in sales_knowledge_chunks (pgvector)
  → Abruf bei Antwort-Generierung via Similarity-Search
```

### 19.4 CRM-Kundengruppierung

Leads werden automatisch nach E-Mail/Telefon zu Kunden-Threads gruppiert (siehe `sales-customer-utils.ts`).
Jeder Thread zeigt: alle Anfragen, Bot-Antworten, Stage-Wechsel, manuelle Notizen,
Intenttags (Probefahrt, Leasing, Kauf, etc.) und verknüpfte Fahrzeuge.

### 19.5 Datenfluss: Lead → Antwort

```
Lead eingehend (submit-lead / E-Mail / manuell)
    │
    ├── auto-process-lead (Autopilot):
    │   ├── Lead-Kontext + Wissensbasis laden
    │   ├── Journey-Phase bestimmen
    │   ├── generate-sales-response aufrufen
    │   └── Entwurf speichern oder direkt senden
    │
    └── Manuell (Generator-Tab):
        ├── Verkäufer wählt Lead + Kanal + Kontext
        ├── generate-sales-response generiert Entwurf
        ├── Verkäufer bearbeitet + genehmigt
        └── Versand via sales_email_outbox → Resend API
```

---

## 20. E-Mail-System (Resend)

### 20.1 Architektur

```
sales_email_outbox (Tabelle)
├── status: queued → sending → sent | failed
├── to_email, to_name, subject, body_html, body_text
├── conversation_id, lead_id (Verknüpfungen)
└── error_message (bei Fehler)

Edge Function (process-sales-email / auto-process-lead)
├── Resend API: POST https://api.resend.com/emails
├── Von: RESEND_FROM_EMAIL (z.B. noreply@autohaus.ai)
├── Reply-To: RESEND_REPLY_TO (z.B. support@autohaus.ai)
└── Status-Update in sales_email_outbox
```

### 20.2 Secrets

| Secret | Zweck |
|---|---|
| `RESEND_API_KEY` | API-Authentifizierung bei Resend |
| `RESEND_FROM_EMAIL` | Absender-Adresse |
| `RESEND_REPLY_TO` | Reply-To-Adresse für Kundenantworten |

---

## 21. Deployment & Infrastruktur

### 21.1 Frontend

- **Build:** `vite build` → statisches Bundle (optimiert, Tree-Shaking, Code-Splitting)
- **Hosting:** Lovable Preview/Published URLs, CDN-backed
- **Custom Domain:** Konfigurierbar (z.B. `pdf.autohaus.ai`)

### 21.2 Backend

- **Edge Functions:** Automatisches Deployment bei Code-Änderung (kein manuelles Deploy nötig)
- **Datenbank:** Managed PostgreSQL via Lovable Cloud
- **Storage:** S3-kompatibel mit CDN
- **Auth:** Managed Auth Service

### 21.3 URLs

| Typ | URL |
|---|---|
| Preview | `https://id-preview--{project-id}.lovable.app` |
| Published | `https://drive-sell-page.lovable.app` |
| Custom Domain | konfigurierbar |
| Edge Functions | `https://{project-id}.supabase.co/functions/v1/{name}` |
| Storage (public) | `https://{project-id}.supabase.co/storage/v1/object/public/{bucket}/{path}` |

### 21.4 Umgebungsvariablen (Frontend)

```env
VITE_SUPABASE_URL=https://rauzclzphdnhzflovrya.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=rauzclzphdnhzflovrya
```

**Wichtig:** Diese Datei wird automatisch generiert und darf **nicht manuell editiert** werden.

---

## 22. Entwicklungsbedarf & Verbesserungs-Roadmap

> **Letztes Audit:** 21. März 2026 – Security-Scan, Performance-Analyse, Code-Review

### 22.1 ✅ Abgeschlossen: TypeScript-Sicherheit

| Problem | Status | Lösung |
|---|---|---|
| `as any` in Kern-Hooks | ✅ Behoben | `useCredits.ts` typensicher, Dashboard-Hooks nutzen strikte Interfaces |
| Untypisierte Dashboard-Daten | ✅ Behoben | `types.ts` mit `Project`, `Lead`, `VideoFile`, `BannerFile`, `Spin360Job` |
| ~1000 `as any` in 43 Dateien | 🟡 Offen | Verbleibend in Admin-Pages, Template-Builder, Pipeline-Runner – Low-Priority |

### 22.2 ✅ Abgeschlossen: Performance-Optimierung

| Problem | Status | Lösung |
|---|---|---|
| N+1 Queries | ✅ Behoben | React Query mit `useQuery`/`useMutation` für Dashboard |
| Kein Pagination | ✅ Behoben | Cursor-basiert für Gallery + Leads (PAGE_SIZE=50) |
| Fehlendes Caching | ✅ Behoben | React Query mit `staleTime: 30s` für Counts |
| Große Bundle-Größe | ✅ Behoben | Lazy loading für alle Routen |
| Base64-Bilder in DB | ✅ Behoben | Alle 572 Bilder migriert, Cron-Job deaktiviert |

**DB-Status:** 39 MB, größte Tabelle: `credit_transactions` (1.171 Zeilen), `project_images` (572 Zeilen)

### 22.3 ✅ Abgeschlossen: Code-Architektur & Refactoring

| Problem | Status | Lösung |
|---|---|---|
| SalesCrmTab.tsx zu groß | ✅ Behoben | 6 Sub-Komponenten in `src/components/sales/crm/` |
| Dashboard.tsx zu komplex | ✅ Behoben | 10 Sub-Komponenten in `src/components/dashboard/` |
| Redundante Edge Functions | ✅ Behoben | `_shared/auth.ts`, `cors.ts`, `credits.ts`; 3 Functions migriert |
| Fehlende Error Boundaries | ✅ Behoben | Pro Modul (Generator, Dashboard, Sales, Projects) |
| Fehlende Tests | ✅ Behoben | 11 Tests (Dashboard-Typen, Utilities) |

### 22.4 🔐 Sicherheits-Audit (21. März 2026)

| Finding | Severity | Status |
|---|---|---|
| admin_settings öffentlich lesbar (AI-Prompts) | 🔴 Critical | ✅ Behoben – nur `authenticated` |
| user_roles Privilege Escalation | 🔴 Critical | ✅ Behoben – explizite Admin-Only INSERT/DELETE |
| Service-Role "true" Policy | 🟡 Warn | ✅ Behoben – Policy entfernt |
| Leaked Password Protection | 🟡 Warn | 🟡 Offen – erfordert Dashboard-Konfiguration |
| FTP-Passwörter im Klartext | 🟡 Warn | 🟡 Offen – pgcrypto-Verschlüsselung empfohlen |
| API-Keys in Profilen sichtbar | 🟡 Warn | 🟡 Info – nur eigener User via RLS |

### 22.5 🟢 Nice-to-Have: Features & UX

| Feature | Beschreibung | Priorität |
|---|---|---|
| **Inbound-E-Mail-Automatisierung** | Eingehende E-Mails automatisch einem Lead/Konversation zuordnen | Hoch |
| **Multi-User-Support** | Mehrere Verkäufer pro Autohaus (Team-Feature) | Mittel |
| **360° Spin Export** | Als HTML-Widget exportierbar (Embed) | Mittel |
| **Batch-PDF-Import** | Mehrere PDFs gleichzeitig verarbeiten | Mittel |
| **Mobile App (PWA)** | Offline-fähig, Push-Benachrichtigungen | Niedrig |

### 22.6 🚀 Top 10 Refactoring-Maßnahmen (nach Impact sortiert)

1. ✅ **`as any` eliminieren** – TypeScript-Typen aus `types.ts` korrekt verwenden, kein Casting
2. ✅ **Shared Edge Function Module** – Auth, CORS, Credit-Logik in `_shared/` auslagern
3. ✅ **SalesCrmTab.tsx splitten** – In 4-5 fokussierte Komponenten aufteilen
4. ✅ **React Query einführen** – Alle `useEffect`+`fetch` durch `useQuery`/`useMutation` ersetzen
5. ✅ **Pagination implementieren** – Dashboard, Admin-Tabellen, Transaktionshistorie
6. ✅ **Base64-Migration** – Edge Function `migrate-base64-images` erstellt (per-User Migration)
7. ✅ **Error Boundaries** – Pro Modul (Sales, Dashboard, Generator) eigene Error Boundaries
8. ✅ **Test-Suite aufbauen** – Tests für Dashboard-Typen, Utilities; 11 Tests bestehen
9. ✅ **Bundle-Splitting optimieren** – Lazy loading für alle Routen aktiv
10. ✅ **Dashboard.tsx refactoren** – Spin-Viewer, Gallery, Tab-Content in eigene Dateien

### 22.6 Performance-Kennzahlen (Zielwerte)

| Metrik | Aktuell (geschätzt) | Ziel |
|---|---|---|
| First Contentful Paint | ~1.5s | <1.0s |
| Largest Contentful Paint | ~2.5s | <1.5s |
| Bundle-Größe (gzipped) | ~450KB | <300KB |
| Edge Function Cold Start | ~500ms | <300ms |
| DB-Query Latenz (Dashboard) | ~200ms | <100ms |
| 360° Spin Generierung | ~5-8min | <3min (Parallelisierung erhöhen) |

---

## Anhang: Datei-Referenz (Edge Functions, vollständig)

| Datei | Zeilen (ca.) | Kernlogik |
|---|---|---|
| `analyze-pdf/index.ts` | ~417 | PDF-Analyse, JSON-Extraktion, CO₂-Post-Processing |
| `generate-vehicle-image/index.ts` | ~230 | Multi-Engine Bildgenerierung (Gemini/OpenAI) |
| `remaster-vehicle-image/index.ts` | ~204 | Master-Prompt Remastering mit bis zu 4 Referenzbildern |
| `generate-banner/index.ts` | ~243 | Banner-Rendering (Gemini/OpenAI, beliebige Formate) |
| `generate-video/index.ts` | ~231 | Async Video (Veo 3.1, Start/Poll-Pattern) |
| `generate-landing-page/index.ts` | ~626 | Dual-Prompt Landing Page (Text-JSON → Bilder → HTML) |
| `generate-360-spin/index.ts` | ~772 | Step-basierte 360°-Generierung (Self-Invocation, Heartbeat) |
| `detect-vehicle-brand/index.ts` | ~162 | KI-Bildanalyse: Marke + Modell erkennen |
| `ocr-vin/index.ts` | ~129 | VIN-Erkennung aus Foto (Gemini Flash) |
| `lookup-vin/index.ts` | ~79 | VIN → Fahrzeugdaten (OutVin API) |
| `create-checkout/index.ts` | ~75 | Stripe Abo-Checkout |
| `buy-credits/index.ts` | ~66 | Stripe Credit-Kauf |
| `customer-portal/index.ts` | ~50 | Stripe Portal URL |
| `stripe-webhook/index.ts` | ~351 | Webhook-Handler (6 Event-Typen) |
| `check-credits/index.ts` | ~60 | Balance-Prüfung |
| `generate-sales-response/index.ts` | ~300+ | KI-Verkaufsantworten (RAG + Journey-Kontext) |
| `sales-chat/index.ts` | ~200+ | Interner Chat-Assistent |
| `ingest-sales-knowledge/index.ts` | ~250+ | Dokument-Chunking + Embedding (pgvector) |
| `auto-process-lead/index.ts` | ~200+ | Autopilot Lead-Verarbeitung |
| `process-sales-email/index.ts` | ~150+ | E-Mail-Zuordnung + Verarbeitung |
| `seed-crm-demo/index.ts` | ~100+ | Demo-Daten-Generierung |
| `api-vehicles/index.ts` | ~136 | REST API (x-api-key Auth) |
| `submit-lead/index.ts` | ~65 | Kontaktformular (öffentlich) |
| `ftp-upload/index.ts` | ~265 | FTP/SFTP-Upload von HTML + Assets |
| `admin-stripe/index.ts` | ~235 | Admin Stripe-Management |
| `admin-delete-user/index.ts` | ~100 | Admin User-Löschung |
| `cleanup-orphaned-storage/index.ts` | ~120 | Automatische Storage-Bereinigung (Dry-Run-Modus) |
| `migrate-base64-images/index.ts` | ~100 | Base64→Storage Migration (abgeschlossen, Cron deaktiviert) |

---

### Changelog v2.2 (21. März 2026)

- **API-Migration**: Alle 4 Edge Functions (sales-chat, auto-process-lead, lookup-vin, generate-360-spin) vom Lovable AI Gateway auf direkte Google Gemini REST API mit eigenem `GEMINI_API_KEY` migriert
- **360° Spin Modell**: Von `gemini-3-pro-image-preview` auf `gemini-2.5-flash` (responseModalities: IMAGE+TEXT) umgestellt
- **Grundsatz**: Alle KI-Aufrufe nutzen bevorzugt eigene API-Keys (GEMINI_API_KEY, OPENAI_API_KEY) statt Gateway-Dienste
- **Secrets bereinigt**: `LOVABLE_API_KEY` wird nur noch für Lovable Cloud Auth verwendet, nicht mehr für KI-Aufrufe

### Changelog v2.1 (21. März 2026)

- **Storage Cleanup**: Neue Edge Function `cleanup-orphaned-storage` für automatische Bereinigung verwaister Dateien (Dry-Run-Modus)
- **Mobile UX**: CRM-Pipeline, Filter und Kundenkarten für mobile Viewports (430px) optimiert
- **Typsicherheit**: ~30 `as any`-Casts in Kern-Dateien eliminiert (Profile, Admin, Sales Chat, CRM)
- **Cron-Job**: Base64-Migration-Cron nach 100% Abschluss (572 Bilder) deaktiviert
- **RLS-Hardening**: Tabellen auf `{authenticated}` migriert, FTP-Passwort-Maskierung via View

---

*© 2026 Autohaus.AI – Version 2.2 – Dieses Dokument ist vertraulich und nur für autorisierte Empfänger bestimmt.*
