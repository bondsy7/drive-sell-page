import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mb-10 break-inside-avoid-page">
    <h2 className="text-2xl font-bold text-foreground border-b-2 border-primary pb-2 mb-4 print:text-xl">{title}</h2>
    {children}
  </section>
);

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6 break-inside-avoid">
    <h3 className="text-lg font-semibold text-foreground mb-2 print:text-base">{title}</h3>
    {children}
  </div>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto mb-4">
    <table className="w-full text-sm border-collapse border border-border print:text-xs">
      <thead>
        <tr className="bg-muted">
          {headers.map((h, i) => (
            <th key={i} className="border border-border px-3 py-2 text-left font-semibold text-foreground">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
            {row.map((cell, j) => (
              <td key={j} className="border border-border px-3 py-2 text-muted-foreground">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto mb-4 print:text-[10px] print:p-2 break-inside-avoid">
    <code className="text-foreground whitespace-pre">{children}</code>
  </pre>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground mb-3 leading-relaxed print:text-xs">{children}</p>
);

const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="text-sm text-muted-foreground mb-1 print:text-xs">{children}</li>
);

export default function ArchitectureDoc() {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Zurück</span>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Drucken
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" />
              Als PDF speichern
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        {/* Cover */}
        <div className="text-center mb-12 print:mb-8 print:pt-16 break-after-page">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 print:hidden">
            <span className="text-3xl font-bold text-primary">A</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3 print:text-3xl">Autohaus.AI</h1>
          <p className="text-xl text-muted-foreground mb-2 print:text-lg">System- & Softwarearchitektur</p>
          <p className="text-sm text-muted-foreground">Version 2.0 · Stand: März 2026</p>
          <p className="text-sm text-muted-foreground">Für Entwickler-Onboarding & Kunden-Dokumentation</p>
          
          <div className="mt-12 print:mt-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Inhaltsverzeichnis</h3>
            <div className="inline-block text-left">
              {[
                '1. Systemübersicht',
                '2. Tech-Stack',
                '3. Frontend-Architektur',
                '4. Backend-Architektur (Edge Functions)',
                '5. Datenbank-Architektur',
                '6. Authentifizierung & Autorisierung',
                '7. KI-Services & Modelle',
                '8. Monetarisierung & Credit-System',
                '9. Kostenanalyse: EK-Token, VK-Marge & API-Server',
                '10. Stripe-Integration',
                '11. Modul-Übersicht',
                '12. 360° Spin-Modul',
                '13. Externe APIs & Abhängigkeiten',
                '14. Storage & Asset-Management',
                '15. Distributions- & Integrations-Schnittstellen',
                '16. Admin-System',
                '17. Sicherheitsarchitektur',
                '18. Datenfluss-Diagramme',
                '19. Sales Assistant & CRM',
                '20. E-Mail-System (Resend)',
                '21. Deployment & Infrastruktur',
                '22. Entwicklungsbedarf & Verbesserungs-Roadmap',
              ].map((item, i) => (
                <p key={i} className="text-sm text-muted-foreground py-0.5">{item}</p>
              ))}
            </div>
          </div>
        </div>

        {/* 1. Systemübersicht */}
        <Section id="s1" title="1. Systemübersicht">
          <P>
            Autohaus.AI ist eine SaaS-Plattform für Automobilhändler, die mithilfe von KI automatisiert
            professionelle Fahrzeugangebote, Landing Pages, Werbebanner und Videos erstellt.
          </P>
          <SubSection title="Kernfunktionen">
            <ul className="list-disc pl-6 space-y-1">
              <Li><strong>Fahrzeugangebots-Seiten</strong> aus PDF-Angeboten generieren</Li>
              <Li><strong>Showroom-Bilder</strong> aus Handyfotos per KI-Remastering erstellen</Li>
              <Li><strong>SEO-optimierte Landing Pages</strong> für Fahrzeugmarketing erzeugen</Li>
              <Li><strong>Werbebanner</strong> für Social Media rendern</Li>
              <Li><strong>Showroom-Videos</strong> per KI generieren</Li>
              <Li><strong>VIN-Erkennung</strong> per OCR und Fahrzeugdaten-Lookup</Li>
              <Li><strong>Sales Assistant</strong> KI-gestütztes CRM mit Lead-Management, Konversationen, Aufgaben und Wissensbasis</Li>
            </ul>
          </SubSection>
          <SubSection title="High-Level-Architektur">
            <CodeBlock>{`┌─────────────────────────────────────────────────┐
│              FRONTEND (SPA)                     │
│  React + TypeScript + Vite + Tailwind + shadcn  │
│                                                 │
│  ActionHub → 5 Workflows                        │
│  Dashboard → Projektverwaltung                  │
│  Admin Panel → 9 Verwaltungsseiten              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           SUPABASE (Backend-as-a-Service)        │
│                                                 │
│  21 Edge Functions │ 27 DB-Tabellen │ 6 Buckets │
│  Auth (Email+OAuth) │ Realtime Channels          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              EXTERNE SERVICES                    │
│                                                 │
│  Lovable AI Gateway │ Google Gemini │ OpenAI    │
│  Stripe │ OutVin (VIN) │ Google Veo (Video)     │
└─────────────────────────────────────────────────┘`}</CodeBlock>
          </SubSection>
        </Section>

        {/* 2. Tech-Stack */}
        <Section id="s2" title="2. Tech-Stack">
          <SubSection title="Frontend">
            <Table
              headers={['Technologie', 'Version', 'Zweck']}
              rows={[
                ['React', '^18.3.1', 'UI-Framework (SPA)'],
                ['TypeScript', '^5.8.3', 'Typsicherheit'],
                ['Vite', '^5.4.19', 'Build-Tool & Dev-Server'],
                ['Tailwind CSS', '^3.4.17', 'Utility-First CSS'],
                ['shadcn/ui', '(Radix-basiert)', 'Design-System'],
                ['React Router', '^6.30.1', 'Client-seitiges Routing'],
                ['TanStack Query', '^5.83.0', 'Server-State-Management'],
                ['Recharts', '^2.15.4', 'Diagramme (Admin)'],
                ['Zod', '^3.25.76', 'Schema-Validierung'],
              ]}
            />
          </SubSection>
          <SubSection title="Backend">
            <Table
              headers={['Technologie', 'Zweck']}
              rows={[
                ['Supabase', 'Datenbank, Auth, Storage, Edge Functions'],
                ['Deno', 'Runtime für Edge Functions'],
                ['PostgreSQL', 'Relationale Datenbank mit RLS'],
                ['Stripe', 'Zahlungsabwicklung'],
              ]}
            />
          </SubSection>
          <SubSection title="KI-Modelle">
            <Table
              headers={['Modell', 'Einsatz']}
              rows={[
                ['Gemini 2.5 Flash', 'PDF-Analyse, VIN-OCR, Text-Generierung'],
                ['Gemini 2.5 Flash Image', 'Bildgenerierung (Schnell-Tier)'],
                ['Gemini 3 Pro Image', 'Bildgenerierung (Premium), Remastering'],
                ['Gemini 3.1 Flash Image', 'Bildgenerierung (Turbo-Tier)'],
                ['OpenAI gpt-image-1', 'Bildgenerierung (Ultra-Tier)'],
                ['Google Veo 3.1', 'Video-Generierung'],
              ]}
            />
          </SubSection>
        </Section>

        {/* 3. Frontend-Architektur */}
        <Section id="s3" title="3. Frontend-Architektur">
          <SubSection title="Routing-Struktur">
            <Table
              headers={['Route', 'Seite', 'Zugang']}
              rows={[
                ['/', 'Landing Page', 'Öffentlich'],
                ['/auth', 'Login/Registrierung', 'Öffentlich'],
                ['/pricing', 'Preisübersicht', 'Öffentlich'],
                ['/docs', 'API-Dokumentation', 'Öffentlich'],
                ['/generator', 'ActionHub + Workflows', 'Geschützt'],
                ['/dashboard', 'Projekt-Übersicht', 'Geschützt'],
                ['/profile', 'Händler-Profil', 'Geschützt'],
                ['/project/:id', 'Projekt-Editor', 'Geschützt'],
                ['/integrations', 'API/FTP/Embed', 'Geschützt'],
                ['/sales-assistant', 'Sales Assistant CRM', 'Geschützt'],
                ['/sales-assistant/:id', 'Konversation/Lead-Detail', 'Geschützt'],
                ['/admin/*', 'Admin-Panel (10 Seiten)', 'Admin-Rolle'],
              ]}
            />
          </SubSection>
          <SubSection title="State-Management">
            <Table
              headers={['Ebene', 'Lösung']}
              rows={[
                ['Server-State', 'TanStack Query (React Query)'],
                ['Auth-State', 'React Context (AuthProvider)'],
                ['Credit-State', 'useCredits() Hook mit Realtime-Subscription'],
                ['Formular-State', 'React Hook Form + lokaler useState'],
                ['URL-State', 'React Router (Search Params)'],
              ]}
            />
          </SubSection>
          <SubSection title="Schutz-Mechanismen">
            <P>
              <strong>ProtectedRoute:</strong> Prüft Auth-Status via useAuth() und E-Mail-Verifizierung (email_confirmed_at).
              Nicht-verifizierte Nutzer sehen einen Hinweis zur E-Mail-Bestätigung.
            </P>
            <P>
              <strong>AdminRoute:</strong> Zusätzliche server-seitige Rollenprüfung via supabase.rpc('has_role').
              Niemals client-seitig gespeicherte Admin-Flags.
            </P>
          </SubSection>
          <SubSection title="Lazy Loading">
            <P>Alle Seiten werden per React.lazy() + Suspense geladen, um die initiale Bundle-Größe zu minimieren.</P>
          </SubSection>
        </Section>

        {/* 4. Backend-Architektur */}
        <Section id="s4" title="4. Backend-Architektur (Edge Functions)">
          <SubSection title="KI-Verarbeitungs-Functions">
            <Table
              headers={['Function', 'Input', 'Output', 'Credits']}
              rows={[
                ['analyze-pdf', 'pdfBase64', 'VehicleData JSON', '1'],
                ['generate-vehicle-image', 'imagePrompt(s), modelTier', 'Base64 Bild(er)', '3-10'],
                ['remaster-vehicle-image', 'imageBase64, vehicleDesc, ...', 'Remastertes Bild', '3-10'],
                ['generate-banner', 'prompt, imageBase64, size', 'Banner Bild', '5-10'],
                ['generate-video', 'imageBase64 (start/poll)', 'Storage-URL Video', '10'],
                ['generate-landing-page', 'brand, model, pageType', 'HTML + JSON + Bilder', '3'],
                ['ocr-vin', 'imageBase64', 'VIN String', '1'],
                ['lookup-vin', 'vin (17 chars)', 'Fahrzeugdaten JSON', '0'],
              ]}
            />
          </SubSection>
          <SubSection title="Zahlungs-Functions">
            <Table
              headers={['Function', 'Zweck']}
              rows={[
                ['create-checkout', 'Stripe Checkout Session für Abo'],
                ['buy-credits', 'Stripe Checkout für Credit-Pakete'],
                ['customer-portal', 'Stripe Customer Portal URL'],
                ['stripe-webhook', 'Webhook-Handler (6 Event-Typen)'],
                ['check-credits', 'Credit-Balance-Prüfung'],
              ]}
            />
          </SubSection>
          <SubSection title="Sales-Assistant-Functions">
            <Table
              headers={['Function', 'Zweck']}
              rows={[
                ['generate-sales-response', 'KI-Antwort auf Kundenanfragen generieren'],
                ['sales-chat', 'Interner Chat-Assistent für Verkäufer'],
                ['ingest-sales-knowledge', 'Dokumente chunken + embedden (RAG)'],
                ['auto-process-lead', 'Automatische Lead-Verarbeitung (Autopilot)'],
                ['process-sales-email', 'Eingehende E-Mails verarbeiten'],
                ['seed-crm-demo', 'Demo-Daten für CRM generieren'],
              ]}
            />
          </SubSection>
          <SubSection title="Integrations-Functions">
            <Table
              headers={['Function', 'Zweck']}
              rows={[
                ['api-vehicles', 'REST API (x-api-key Auth)'],
                ['submit-lead', 'Kontaktformular (öffentlich)'],
                ['ftp-upload', 'HTML/Bilder auf FTP/SFTP'],
                ['admin-stripe', 'Admin: Stripe verwalten'],
                ['admin-delete-user', 'Admin: Nutzer löschen'],
              ]}
            />
          </SubSection>
          <SubSection title="Gemeinsames Pattern">
            <CodeBlock>{`// Jede KI-Function folgt diesem Schema:
1. CORS Handling (OPTIONS)
2. Auth + Credit-Deduction (atomar via RPC)
3. Custom Prompt laden (admin_settings Override)
4. KI-API aufrufen (Lovable Gateway oder direkt)
5. Ergebnis verarbeiten + zurückgeben`}</CodeBlock>
          </SubSection>
        </Section>

        {/* 5. Datenbank */}
        <Section id="s5" title="5. Datenbank-Architektur">
          <SubSection title="Entity-Relationship">
            <CodeBlock>{`auth.users (Supabase-managed)
  ├──1:1── profiles (Firmendaten, Socials, Banking, API-Key)
  ├──1:N── projects (vehicle_data JSONB, html_content, template_id)
  │         ├──1:N── project_images (image_url, perspective)
  │         └──1:N── leads (name, email, phone, message)
  ├──1:1── credit_balances (balance, lifetime_used)
  ├──1:N── credit_transactions (amount, action_type)
  ├──1:N── user_subscriptions (plan_id, status, stripe_sub_id)
  ├──1:N── user_roles (role: admin|moderator|user)
  ├──1:1── ftp_configs (host, port, credentials)
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
  │   │         └──1:N── sales_knowledge_chunks (Embeddings)
  │   ├──1:N── sales_email_outbox (E-Mail-Versand)
  │   ├──1:N── sales_notifications (Benachrichtigungen)
  │   ├──1:N── sales_chat_messages (Interner Chat)
  │   ├──1:N── dealer_availability (Verfügbarkeiten)
  │   ├──1:N── dealer_blocked_dates (Gesperrte Tage)
  │   ├──1:N── trade_in_valuations (Inzahlungnahme)
  │   └──1:N── calendar_sync_configs (Kalender-Sync)
  │
  └── customer_journey_templates (Journey-Phasen)

Globale Tabellen:
  subscription_plans (name, slug, credits, prices)
  admin_settings (key-value, JSONB)
  sample_pdfs (title, pdf_url, category)`}</CodeBlock>
          </SubSection>
          <SubSection title="Wichtige Enums">
            <Table
              headers={['Enum', 'Werte']}
              rows={[
                ['app_role', 'admin, moderator, user'],
                ['billing_cycle', 'monthly, yearly'],
                ['subscription_status', 'active, cancelled, past_due, trialing'],
                ['credit_action_type', 'pdf_analysis, image_generate, image_remaster, vin_ocr, credit_purchase, subscription_reset, admin_adjustment, landing_page_export'],
              ]}
            />
          </SubSection>
          <SubSection title="Datenbank-Functions (PL/pgSQL)">
            <Table
              headers={['Function', 'Typ', 'Zweck']}
              rows={[
                ['deduct_credits()', 'SECURITY DEFINER', 'Atomarer Credit-Abzug mit Row-Lock'],
                ['add_credits()', 'SECURITY DEFINER', 'Credits gutschreiben (Kauf, Abo-Reset)'],
                ['has_role()', 'SECURITY DEFINER', 'Rollenprüfung ohne RLS-Rekursion'],
                ['generate_api_key()', 'STABLE', 'Generiert ak_ + 48 hex chars'],
                ['handle_new_user()', 'TRIGGER', 'Auto-Insert profiles + credit_balances'],
              ]}
            />
          </SubSection>
          <SubSection title="JSONB: vehicle_data Struktur">
            <CodeBlock>{`{
  "category": "Leasing",
  "vehicle": {
    "brand": "BMW", "model": "320i",
    "variant": "M Sport", "year": 2025,
    "color": "Alpinweiß", "fuelType": "Benzin",
    "transmission": "Automatik",
    "power": "135 kW (184 PS)",
    "features": ["LED Scheinwerfer", ...],
    "vin": "WBA..."
  },
  "finance": {
    "monthlyRate": "399 €",
    "downPayment": "0 €",
    "duration": "48 Monate",
    "totalPrice": "45.900 €", ...
  },
  "dealer": {
    "name": "Autohaus Müller",
    "address": "...", "logoUrl": "...", ...
  },
  "consumption": {
    "consumptionCombined": "6,8 l/100 km",
    "co2Emissions": "155 g/km",
    "co2Class": "E",
    "isPluginHybrid": false, ...
  }
}`}</CodeBlock>
          </SubSection>
        </Section>

        {/* 6. Auth */}
        <Section id="s6" title="6. Authentifizierung & Autorisierung">
          <SubSection title="Auth-Methoden">
            <Table
              headers={['Methode', 'Details']}
              rows={[
                ['E-Mail/Passwort', 'E-Mail-Verifizierung erforderlich (kein Auto-Confirm)'],
                ['Google OAuth', 'Konfiguriert für Custom Domains (Redirect URI: auth/v1/callback)'],
              ]}
            />
          </SubSection>
          <SubSection title="Registrierungsfluss">
            <ol className="list-decimal pl-6 space-y-1">
              <Li>Nutzer füllt Registrierungsformular aus</Li>
              <Li>Supabase Auth erstellt User in auth.users</Li>
              <Li>Trigger handle_new_user() erstellt profiles + credit_balances (10 Start-Credits)</Li>
              <Li>Trigger set_api_key_on_insert() generiert API-Key</Li>
              <Li>Bestätigungs-E-Mail wird gesendet</Li>
              <Li>Nutzer bestätigt → ProtectedRoute erlaubt Zugang</Li>
            </ol>
          </SubSection>
          <SubSection title="Rollenmodell">
            <P>
              Rollen werden <strong>immer in separater Tabelle</strong> (user_roles) gespeichert, nie in profiles.
              Prüfung ausschließlich server-seitig via has_role(auth.uid(), 'admin').
            </P>
          </SubSection>
          <SubSection title="RLS-Policy-Strategie">
            <P>Alle Tabellen verwenden <strong>RESTRICTIVE</strong> Policies. Nutzer sehen nur eigene Daten, Admins sehen alles.</P>
          </SubSection>
        </Section>

        {/* 7. KI-Services */}
        <Section id="s7" title="7. KI-Services & Modelle">
          <SubSection title="Google Gemini API (direkt)">
            <CodeBlock>{`Endpoint:  https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Auth:      x-goog-api-key: GEMINI_API_KEY
Format:    Google Gemini REST API
Modelle:   gemini-2.5-flash, gemini-3-pro-image-preview, gemini-3.1-flash-image-preview`}</CodeBlock>
          </SubSection>
          <SubSection title="Modell-Tiers (Bildgenerierung)">
            <Table
              headers={['Tier', 'Modell', 'Engine', 'Credits']}
              rows={[
                ['schnell', 'gemini-2.5-flash-image', 'Gemini', '3'],
                ['qualitaet', 'gemini-3-pro-image-preview', 'Gemini', '5'],
                ['turbo', 'gemini-3.1-flash-image-preview', 'Gemini', '6'],
                ['premium', 'gpt-image-1', 'OpenAI', '8'],
                ['ultra', 'gpt-image-1 (HD)', 'OpenAI', '10'],
              ]}
            />
          </SubSection>
          <SubSection title="Master-Prompt-System (Remastering)">
            <P>Das dynamische Master-Prompt-System erlaubt individuelles Bild-Remastering:</P>
            <ul className="list-disc pl-6 space-y-1">
              <Li><strong>15 Szenen-Presets:</strong> Modern Showroom, Wald, Stadt, Strand, ...</Li>
              <Li><strong>Custom Showroom:</strong> Eigenes Hintergrundbild hochladen</Li>
              <Li><strong>Kennzeichen:</strong> Original, Blur, Entfernen, Custom Text, Custom Bild</Li>
              <Li><strong>Fahrzeugfarbe:</strong> Per Hex-Code änderbar</Li>
              <Li><strong>Logo-Rendering:</strong> Fotorealistisches 3D mit LED-Halo-Effekt</Li>
            </ul>
          </SubSection>
          <SubSection title="Video-Generierung (Asynchron)">
            <CodeBlock>{`1. Client → POST generate-video { action: "start" }
2. Server → Google Veo 3.1 → operationName
3. Client → POST generate-video { action: "poll" }
4. Server → Download → Upload Storage
5. Response: { videoUrl: "https://..." }`}</CodeBlock>
          </SubSection>
        </Section>

        {/* 8. Credit-System */}
        <Section id="s8" title="8. Monetarisierung & Credit-System">
          <SubSection title="Credit-Kosten pro Aktion">
            <Table
              headers={['Aktion', 'Credits']}
              rows={[
                ['PDF-Analyse', '1'],
                ['VIN-OCR', '1'],
                ['Bildgenerierung (Schnell)', '3'],
                ['Bildgenerierung (Qualität)', '5'],
                ['Bildgenerierung (Turbo)', '6'],
                ['Bildgenerierung (Premium)', '8'],
                ['Bildgenerierung (Ultra)', '10'],
                ['Video-Generierung', '10'],
                ['Landing Page', '3'],
              ]}
            />
          </SubSection>
          <SubSection title="Deduktions-Ablauf">
            <ol className="list-decimal pl-6 space-y-1">
              <Li>CreditConfirmDialog zeigt Kosten + Balance</Li>
              <Li>User bestätigt → Edge Function aufgerufen</Li>
              <Li>authenticateAndDeductCredits() → Auth-Token validieren</Li>
              <Li>rpc('deduct_credits') → Atomar mit FOR UPDATE Row-Lock</Li>
              <Li>Prüfe balance ≥ cost, Update balance + lifetime_used</Li>
              <Li>INSERT credit_transactions (Audit-Trail)</Li>
              <Li>KI-API aufrufen → Ergebnis zurückgeben</Li>
              <Li>Realtime-Channel: UI-Balance sofort aktualisiert</Li>
            </ol>
          </SubSection>
        </Section>

        {/* 9. Stripe */}
        <Section id="s9" title="9. Stripe-Integration">
          <SubSection title="Abo-Pläne">
            <Table
              headers={['Plan', 'Monatlich', 'Jährlich']}
              rows={[
                ['Starter', 'price_1T8hVQ...', 'price_1T8jl2...'],
                ['Pro', 'price_1T8hW0...', 'price_1T8kGP...'],
                ['Enterprise', 'price_1T8hZF...', 'price_1T8kH6...'],
              ]}
            />
          </SubSection>
          <SubSection title="Credit-Pakete (Einmalkauf)">
            <Table
              headers={['Paket', 'Credits', 'Preis']}
              rows={[
                ['Standard', '10', '5,00 €'],
                ['Spar-Paket (-40%)', '50', '15,00 €'],
                ['Pro-Paket (-55%)', '200', '45,00 €'],
              ]}
            />
          </SubSection>
          <SubSection title="Webhook-Events">
            <Table
              headers={['Event', 'Aktion']}
              rows={[
                ['checkout.session.completed', 'Abo erstellen oder Credits gutschreiben'],
                ['customer.subscription.updated', 'Abo-Status synchronisieren'],
                ['customer.subscription.deleted', 'Abo als cancelled markieren'],
                ['invoice.paid', 'Credits für neue Periode gutschreiben'],
                ['invoice.payment_failed', 'Status → past_due'],
                ['charge.refunded', 'Nur geloggt'],
              ]}
            />
          </SubSection>
        </Section>

        {/* 10. Module */}
        <Section id="s10" title="10. Modul-Übersicht">
          <SubSection title="ActionHub – 5 Workflows">
            <Table
              headers={['Workflow', 'Beschreibung', 'Output']}
              rows={[
                ['Fotos & Remastering', 'Fotos aufnehmen/hochladen → KI-Remastering', 'Showroom-Bilder'],
                ['PDF → Angebotsseite', 'PDF → KI-Analyse → Editor → Template → Export', 'HTML-Angebotsseite'],
                ['Landing Page manuell', 'Marke+Modell+Typ → KI-Text+Bilder → Editor', 'SEO-Landing-Page'],
                ['Banner Generator', 'Projekt/Bild → Prompt → KI-Banner', 'Social-Media-Banner'],
                ['Video Erstellung', 'Bild → Veo 3.1 → Video', 'Showroom-Video'],
              ]}
            />
          </SubSection>
          <SubSection title="Template-System (4 Designs)">
            <Table
              headers={['Template', 'Beschreibung']}
              rows={[
                ['autohaus (Standard)', 'Professionell, 2-spaltig: 822px Haupt + 395px Sidebar'],
                ['modern', 'Modernes, responsives Single-Column Design'],
                ['klassisch', 'Traditionelles Autohaus-Layout'],
                ['minimalist', 'Reduziertes, elegantes Design'],
              ]}
            />
            <P>Alle Templates enthalten: Hero-Galerie, Fahrzeugdetails, Finanzierung, CO₂-Label (EnVKV), Verbrauchstabellen, Händler-Info, Kontakt-CTA, PAngV-Pflichtangaben.</P>
          </SubSection>
          <SubSection title="Landing-Page-Seitentypen (7)">
            <Table
              headers={['Typ', 'Fokus']}
              rows={[
                ['Leasing', 'Rate, Flexibilität, Vorteile'],
                ['Finanzierung', 'Eigentum, Zinsen, Ratenkauf'],
                ['Barkauf/Neuwagen', 'Preisvorteil, Ausstattung'],
                ['Massenangebot', 'Urgency, FOMO, limitiertes Angebot'],
                ['Auto-Abo', 'Flexibilität, All-inclusive'],
                ['Event', 'Event-Details, Highlights'],
                ['Fahrzeug-Release', 'Innovation, Technologie'],
              ]}
            />
          </SubSection>
          <SubSection title="Rechner-Module">
            <Table
              headers={['Rechner', 'Funktion']}
              rows={[
                ['Leasing-Rechner', 'Rate, Laufzeit, Sonderzahlung, Restwert'],
                ['Finanzierungsrechner', 'Rate, Anzahlung, Zinssatz, Laufzeit'],
                ['Kfz-Steuer-Rechner', 'BMF-Logik mit Steuersatz-Datenbank'],
                ['Betriebskosten', 'Energiekosten/Jahr, CO₂-Kosten (10 Jahre)'],
              ]}
            />
          </SubSection>
        </Section>

        {/* 11. Externe APIs */}
        <Section id="s11" title="11. Externe APIs & Abhängigkeiten">
          <Table
            headers={['Service', 'Endpoint', 'Auth', 'Zweck']}
            rows={[
              ['Google Gemini (Text)', 'generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', 'x-goog-api-key', 'PDF-Analyse, OCR, Landing Pages'],
              ['Google Gemini (Bild)', 'generativelanguage.googleapis.com/v1beta/models/gemini-3-*:generateContent', 'x-goog-api-key', 'Remastering, Bildgenerierung'],
              ['Google Gemini (Video)', 'generativelanguage.googleapis.com/v1beta/models/veo-*', 'x-goog-api-key', 'Video-Generierung'],
              ['OpenAI', 'api.openai.com/v1/images/...', 'Bearer OPENAI_API_KEY', 'Bild (Premium/Ultra)'],
              ['OutVin', 'outvin.com/api/v1/vehicle/{vin}', 'Basic OUTVIN_API_KEY', 'VIN → Fahrzeugdaten'],
              ['Stripe', 'api.stripe.com/v1/...', 'STRIPE_SECRET_KEY', 'Zahlungen, Abos'],
            ]}
          />
          <SubSection title="Secrets-Übersicht">
            <Table
              headers={['Secret', 'Verwendung']}
              rows={[
                ['GEMINI_API_KEY', 'Google Gemini API (Text, Bild, Video, OCR)'],
                ['OPENAI_API_KEY', 'OpenAI Image API (Banner)'],
                ['STRIPE_SECRET_KEY', 'Stripe Payments'],
                ['STRIPE_WEBHOOK_SECRET', 'Stripe Webhook Verifizierung'],
                ['OUTVIN_API_KEY', 'VIN-Datenbank'],
                ['SUPABASE_SERVICE_ROLE_KEY', 'Admin-DB-Zugriff (RLS bypass)'],
              ]}
            />
          </SubSection>
        </Section>

        {/* 12. Storage */}
        <Section id="s12" title="12. Storage & Asset-Management">
          <SubSection title="Storage Buckets">
            <Table
              headers={['Bucket', 'Öffentlich', 'Inhalt']}
              rows={[
                ['vehicle-images', '✅', 'Generierte/Remasterte Bilder, Videos'],
                ['logos', '✅', 'Nutzer-Firmenlogos'],
                ['manufacturer-logos', '✅', 'Hersteller-Logos (SVGs in svg/, Raster im Root)'],
                ['banners', '✅', 'Generierte Werbebanner'],
                ['sample-pdfs', '✅', 'Beispiel-PDFs für Demo/Testing'],
                ['sales-knowledge', '❌', 'Sales-Wissensbasis-Dokumente (RAG)'],
              ]}
            />
          </SubSection>
          <SubSection title="Bild-Storage-Strategie">
            <P>
              Edge Functions laden Bilder in Storage Buckets hoch und speichern öffentliche URLs in der Datenbank.
              Ältere Projekte mit Base64-Daten werden beim Export on-the-fly verarbeitet.
            </P>
          </SubSection>
          <SubSection title="HTML-Export-Optionen">
            <ul className="list-disc pl-6 space-y-1">
              <Li><strong>Leichtgewicht:</strong> Bilder über Storage-URLs (optimale Dateigröße)</Li>
              <Li><strong>Offline:</strong> WebP-Base64-Konvertierung (70-80% kleiner als PNG)</Li>
              <Li><strong>FTP-Upload:</strong> Direkt auf Kundenserver übertragen</Li>
              <Li>CO₂-Labels werden automatisch als Base64 eingebettet</Li>
            </ul>
          </SubSection>
        </Section>

        {/* 13. Distribution */}
        <Section id="s13" title="13. Distributions- & Integrations-Schnittstellen">
          <SubSection title="REST API">
            <CodeBlock>{`Base URL: {SUPABASE_URL}/functions/v1/api-vehicles
Auth:     Header x-api-key: ak_...

GET /api-vehicles           → JSON-Array aller Fahrzeuge
GET /api-vehicles/:id       → JSON mit Fahrzeugdaten + Bildern
GET /api-vehicles/:id/html  → HTML-Fragment (body-Inhalt)`}</CodeBlock>
          </SubSection>
          <SubSection title="Embed-Script">
            <CodeBlock>{`<!-- Fahrzeugliste -->
<div id="autohaus-ai-vehicles"></div>
<script src="https://autohaus.ai/embed.js"
        data-api-key="ak_..."
        data-supabase-url="https://..."
        data-theme="light"
        data-columns="3">
</script>`}</CodeBlock>
            <P>Unterstützt Light/Dark Theme, konfigurierbare Spalten, automatisches Rendering von Fahrzeugkarten oder HTML-Fragmenten.</P>
          </SubSection>
          <SubSection title="WordPress-Plugin">
            <ul className="list-disc pl-6 space-y-1">
              <Li>Custom Post Type: fahrzeug_angebot</Li>
              <Li>WP-Cron-basierte Synchronisierung</Li>
              <Li>Media Sideloading (Bilder → WP Media Library)</Li>
              <Li>Schema.org Markup (Vehicle)</Li>
              <Li>Shortcode: [autohaus_ai_fahrzeuge]</Li>
            </ul>
          </SubSection>
          <SubSection title="FTP/SFTP-Upload">
            <P>Konfiguration über /integrations. Credentials in ftp_configs Tabelle gespeichert. Edge Function ftp-upload unterstützt Verbindungstest und Upload von HTML + Bildern.</P>
          </SubSection>
          <SubSection title="Kontaktformular (Lead-Generierung)">
            <P>In generierten HTML-Seiten eingebettetes Formular → submit-lead Edge Function → leads Tabelle → sichtbar in Dashboard + Admin.</P>
          </SubSection>
        </Section>

        {/* 14. Admin */}
        <Section id="s14" title="14. Admin-System">
          <Table
            headers={['Route', 'Funktion']}
            rows={[
              ['/admin', 'Dashboard: KPIs, Charts, Übersicht'],
              ['/admin/users', 'Nutzerverwaltung (Rollen, Credits, Löschen)'],
              ['/admin/transactions', 'Credit-Transaktionshistorie'],
              ['/admin/leads', 'Alle Kontaktanfragen'],
              ['/admin/pdf-gallery', 'Beispiel-PDFs verwalten'],
              ['/admin/prompts', 'KI-System-Prompts anpassen'],
              ['/admin/pricing', 'Abo-Pläne + Credit-Kosten bearbeiten'],
              ['/admin/settings', 'System-Einstellungen'],
              ['/admin/logos', 'Hersteller-Logos (Massen-Upload)'],
              ['/admin/sales-assistant', 'Sales-Assistant-Konfiguration'],
            ]}
          />
          <P>
            <strong>Admin-Edge-Functions:</strong> admin-stripe (Payments/Refunds) und admin-delete-user prüfen beide
            server-seitig has_role(auth.uid(), 'admin').
          </P>
        </Section>

        {/* 15. Sicherheit */}
        <Section id="s15" title="15. Sicherheitsarchitektur">
          <SubSection title="Sicherheitsschichten">
            <Table
              headers={['Schicht', 'Mechanismus']}
              rows={[
                ['1. Frontend', 'Auth-Guards (ProtectedRoute, AdminRoute)'],
                ['2. Edge Functions', 'JWT Token-Validierung via supabase.auth.getUser()'],
                ['3. Datenbank', 'Row Level Security (RESTRICTIVE Policies)'],
                ['4. DB Functions', 'SECURITY DEFINER (has_role, deduct_credits)'],
                ['5. REST API', 'Key-basierte Auth (x-api-key Header)'],
                ['6. Stripe', 'Webhook Signature Verifizierung'],
              ]}
            />
          </SubSection>
          <SubSection title="Kritische Sicherheitsregeln">
            <ol className="list-decimal pl-6 space-y-1">
              <Li>Rollen IMMER in separater Tabelle (user_roles), nie in profiles</Li>
              <Li>Keine client-seitige Admin-Prüfung (kein localStorage)</Li>
              <Li>Credit-Deduction atomar mit FOR UPDATE Row-Lock</Li>
              <Li>SECURITY DEFINER für role-check (verhindert RLS-Rekursion)</Li>
              <Li>Service Role Key nur in Edge Functions, nie im Frontend</Li>
              <Li>API-Keys mit Prefix ak_ + 48 hex chars</Li>
              <Li>Input-Sanitization in submit-lead (Längen-Limits, E-Mail-Regex)</Li>
            </ol>
          </SubSection>
        </Section>

        {/* 16. Datenflüsse */}
        <Section id="s16" title="16. Datenfluss-Diagramme">
          <SubSection title="PDF → Angebotsseite">
            <CodeBlock>{`PDF-Upload → analyze-pdf (Gemini)
  → Strukturiertes JSON (VehicleData)
  → Daten-Editor (+ Profil-Daten als Fallback)
  → Template wählen (4 Designs)
  → Bildquelle wählen:
    ├── KI-Generierung (bis 18 Perspektiven)
    ├── Foto-Upload → Remastering
    └── Ohne Bilder
  → Speichern (projects + project_images)
  → Export (HTML-Download / FTP / API)`}</CodeBlock>
          </SubSection>
          <SubSection title="Landing Page Generator">
            <CodeBlock>{`Formular (Marke, Modell, Seitentyp)
  → generate-landing-page:
    1. Dealer-Profil laden
    2. Hersteller-Logo suchen
    3. Gemini: JSON (SEO-Meta, Sections)
    4. Gemini Image: Bilder pro Section
    5. Upload Bilder → Storage
    6. HTML assemblieren
  → Projekt speichern
  → Landing Page Editor (Live-Vorschau)`}</CodeBlock>
          </SubSection>
          <SubSection title="Billing-Flow">
            <CodeBlock>{`/pricing → create-checkout oder buy-credits
  → Stripe Checkout Session
  → Stripe Payment
  → stripe-webhook:
    ├── Abo: INSERT user_subscriptions + add_credits()
    └── Credits: add_credits()
  → Realtime: UI-Balance aktualisiert`}</CodeBlock>
          </SubSection>
        </Section>

        {/* 17. Sales Assistant & CRM */}
        <Section id="s17" title="17. Sales Assistant & CRM">
          <P>
            Vollintegriertes KI-Verkaufsassistenten-System für Automobilhändler mit CRM, Lead-Management,
            Wissensbasis und automatisierten Workflows.
          </P>
          <SubSection title="Module (Tabs)">
            <Table
              headers={['Tab', 'Funktion']}
              rows={[
                ['Generator', 'KI-Antworten auf Kundenanfragen generieren (E-Mail, WhatsApp, Chat)'],
                ['CRM', 'Kunden-Timeline mit Lead-Gruppierung, Bot-Antworten, manuelle Notizen'],
                ['Aufgaben', 'Aufgabenverwaltung mit Prioritäten und Status'],
                ['Buchungen', 'Probefahrt-Termine + Verfügbarkeitskalender'],
                ['Angebote', 'Angebotserstellung (Barkauf, Leasing, Finanzierung)'],
                ['Inzahlungnahme', 'Bewertung von Gebrauchtfahrzeugen'],
                ['Wissensbasis', 'Dokumente hochladen → Chunking → Embeddings (RAG)'],
                ['Postfach', 'E-Mail-Outbox mit Status-Tracking'],
                ['Verlauf', 'Konversationshistorie mit allen Nachrichten'],
                ['Journey', 'Customer-Journey-Templates (Phasen, CTAs, Signale)'],
              ]}
            />
          </SubSection>
          <SubSection title="Autopilot-Modi">
            <Table
              headers={['Modus', 'Beschreibung']}
              rows={[
                ['Manuell', 'Alle Antworten werden vom Verkäufer geprüft und gesendet'],
                ['Vorschlag', 'KI erstellt Entwürfe, Verkäufer genehmigt vor Versand'],
                ['Autopilot', 'KI antwortet automatisch auf bestimmte Journey-Phasen'],
              ]}
            />
          </SubSection>
          <SubSection title="Wissensbasis (RAG)">
            <CodeBlock>{`Dokument-Upload → ingest-sales-knowledge (Edge Function)
  → Text-Extraktion (PDF/TXT/Markdown)
  → Chunking (500-1000 Tokens)
  → Embedding-Generierung (Gemini)
  → Speicherung in sales_knowledge_chunks (pgvector)
  → Abruf bei Antwort-Generierung via Similarity-Search`}</CodeBlock>
          </SubSection>
          <SubSection title="CRM-Kundengruppierung">
            <P>
              Leads werden automatisch nach E-Mail/Telefon zu Kunden-Threads gruppiert.
              Jeder Thread zeigt: alle Anfragen, Bot-Antworten, Stage-Wechsel, manuelle Notizen,
              Intenttags (Probefahrt, Leasing, Kauf, etc.) und verknüpfte Fahrzeuge.
            </P>
          </SubSection>
        </Section>

        {/* 18. Deployment */}
        <Section id="s18" title="18. Deployment & Infrastruktur">
          <SubSection title="Deployment-Modell">
            <Table
              headers={['Komponente', 'Deployment']}
              rows={[
                ['Frontend', 'Vite Build → Lovable CDN (auto)'],
                ['Edge Functions', 'Automatisch bei Code-Änderung'],
                ['Datenbank', 'Managed PostgreSQL (Supabase)'],
                ['Storage', 'S3-kompatibel mit CDN'],
                ['Auth', 'Managed Auth Service'],
              ]}
            />
          </SubSection>
          <SubSection title="Wichtiger Hinweis">
            <P>
              <strong>Frontend-Änderungen</strong> erfordern "Update" im Publish-Dialog.
              <strong> Backend-Änderungen</strong> (Edge Functions, Migrationen) werden sofort automatisch deployed.
            </P>
          </SubSection>
          <SubSection title="Umgebungsvariablen (Frontend)">
            <CodeBlock>{`VITE_SUPABASE_URL=https://rauzclzphdnhzflovrya.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=rauzclzphdnhzflovrya`}</CodeBlock>
          </SubSection>
        </Section>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center print:mt-8">
          <p className="text-xs text-muted-foreground">
            © 2026 Autohaus.AI – Dieses Dokument ist vertraulich und nur für autorisierte Empfänger bestimmt.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Version 1.0 · Generiert am {new Date().toLocaleDateString('de-DE')}
          </p>
        </div>
      </div>
    </div>
  );
}
