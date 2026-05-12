import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, Printer, Languages } from 'lucide-react';
import { Link } from 'react-router-dom';

type Lang = 'de' | 'en';

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

const SubSub = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-4 break-inside-avoid">
    <h4 className="text-base font-semibold text-foreground/90 mb-1 print:text-sm">{title}</h4>
    {children}
  </div>
);

const Table = ({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) => (
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
              <td key={j} className="border border-border px-3 py-2 text-muted-foreground align-top">{cell}</td>
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

const Ul = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-6 space-y-1 mb-3">{children}</ul>
);

// ============================================================================
// CONTENT — DEUTSCH
// ============================================================================

const DeContent = () => (
  <>
    {/* Cover */}
    <div className="text-center mb-12 print:mb-8 print:pt-16 break-after-page">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 print:hidden">
        <span className="text-3xl font-bold text-primary">A</span>
      </div>
      <h1 className="text-4xl font-bold text-foreground mb-3 print:text-3xl">Autohaus.AI</h1>
      <p className="text-xl text-muted-foreground mb-2 print:text-lg">System- &amp; Softwarearchitektur</p>
      <p className="text-sm text-muted-foreground">Version 2.4 · Stand: 12. Mai 2026</p>
      <p className="text-sm text-muted-foreground">Vollständige Entwickler-Dokumentation für Onboarding, Git-Weiterentwicklung &amp; Capacitor-Migration</p>

      <div className="mt-12 print:mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Inhaltsverzeichnis</h3>
        <div className="inline-block text-left">
          {[
            '1.  Systemübersicht & Produktvision',
            '2.  Tech-Stack & Versionen',
            '3.  Repository-Layout & Konventionen',
            '4.  Lokale Entwicklungsumgebung',
            '5.  Routing & Seitenstruktur',
            '6.  Frontend-Architektur (Komponenten, Hooks, Contexts)',
            '7.  State-Management & Pipeline-System',
            '8.  Backend-Architektur (37 Edge Functions)',
            '9.  Datenbank-Architektur (46 Tabellen)',
            '10. Row-Level-Security & Rollen',
            '11. Authentifizierung (Email, OAuth, QR-Login)',
            '12. KI-Services (Gemini, OpenAI, Veo)',
            '13. File API & Prompt-System',
            '14. Storage-Buckets & Asset-Management',
            '15. Credit-System & Stripe-Integration',
            '16. Modul-Übersicht (Generator-Tools)',
            '17. Remastering-Pipeline',
            '18. 360°-Spin-Modul',
            '19. Banner-Generator',
            '20. Landing-Page-Generator',
            '21. Video-Generator (Veo)',
            '22. PDF-Analyse-Pipeline',
            '23. Sales Assistant & CRM (7-Stufen)',
            '24. E-Mail-System (Resend)',
            '25. Lead-Capture & Auto-Verarbeitung',
            '26. Externe APIs (Stripe, OutVin, Resend)',
            '27. Distribution & Integration (FTP, WordPress, API)',
            '28. Admin-System (22 Seiten)',
            '29. Sicherheitsarchitektur',
            '30. Deployment & Infrastruktur',
            '31. Datenfluss-Diagramme',
            '32. Capacitor-Migration (Native iOS/Android)',
            '33. Bekannte Constraints & Pinnings',
            '34. Roadmap & Verbesserungen',
            '35. Glossar',
          ].map((item, i) => (
            <p key={i} className="text-sm text-muted-foreground py-0.5">{item}</p>
          ))}
        </div>
      </div>
    </div>

    {/* 1. Systemübersicht */}
    <Section id="s1" title="1. Systemübersicht & Produktvision">
      <P>
        <strong>Autohaus.AI</strong> (intern „AUTO3" – Point Of Arrival) ist eine mobile-first SaaS-Plattform für
        Automobilhändler. Sie automatisiert den gesamten Marketing-Prozess vom Moment der Fahrzeug-Ankunft auf dem
        Hof bis zur fertigen Online-Inserate-Veröffentlichung: KI-Remastering von Handyfotos zu Showroom-Bildern,
        360°-Spins, Werbebanner, SEO-Landing-Pages, KI-Videos und ein vollintegriertes Sales-CRM.
      </P>
      <SubSection title="Produktvision (POA-Konzept)">
        <P>Der Workflow folgt drei klaren Phasen:</P>
        <Ul>
          <Li><strong>Arrival</strong> – Fahrzeug kommt an, Handyfotos werden gemacht, VIN erkannt, PDF-Datenblatt hochgeladen.</Li>
          <Li><strong>Refinement</strong> – KI-Pipeline remastert Bilder, extrahiert Daten, generiert 360°-Spin und Marketingtexte.</Li>
          <Li><strong>Marketing</strong> – Banner, Landing-Page, Video, FTP-Upload zu Mobile.de / Autoscout24 / WordPress.</Li>
        </Ul>
      </SubSection>
      <SubSection title="Kernfunktionen">
        <Ul>
          <Li><strong>Fahrzeugangebots-Seiten</strong> aus PDF-Angeboten generieren (Pkw-EnVKV-konform)</Li>
          <Li><strong>Showroom-Remastering</strong> – Handyfotos → professionelle Studio-Bilder</Li>
          <Li><strong>360°-Spins</strong> aus 4–8 Perspektiv-Fotos (36 interpolierte Frames)</Li>
          <Li><strong>SEO-Landing-Pages</strong> mit Tech-Specs, Galerie, Lead-Formular</Li>
          <Li><strong>Werbebanner</strong> für Social Media in verschiedenen Formaten</Li>
          <Li><strong>KI-Videos</strong> via Google Veo (8 Sek., 360°-Identity-Lock)</Li>
          <Li><strong>VIN-Erkennung</strong> per OCR + WMI-Datenbank-Fallback</Li>
          <Li><strong>Schadensanalyse</strong> per KI-Bildvergleich</Li>
          <Li><strong>Sales Assistant</strong> – KI-CRM mit 7-Stufen-Pipeline, Quotes, Trade-In, Test-Drive-Buchung</Li>
          <Li><strong>QR-Login</strong> für passwortlose Authentifizierung via pdf.anzeige.ai</Li>
        </Ul>
      </SubSection>
      <SubSection title="High-Level-Architektur">
        <CodeBlock>{`┌─────────────────────────────────────────────────────────┐
│                 FRONTEND (React SPA)                    │
│  React 18 · Vite 5 · TS 5 · Tailwind v3 · shadcn/ui     │
│  ┌─────────────┬──────────────┬───────────────────────┐ │
│  │ Landing /   │  Generator   │  Dashboard            │ │
│  │ Auth / QR   │  (6 Tools)   │  (Projekte, CRM, …)   │ │
│  └─────────────┴──────────────┴───────────────────────┘ │
│  Admin (22 Seiten) · Sales Assistant · Calculators      │
└──────────────────────┬──────────────────────────────────┘
                       │ Supabase JS Client
                       ▼
┌─────────────────────────────────────────────────────────┐
│        LOVABLE CLOUD (Managed Supabase Backend)         │
│  ┌────────────┬──────────────┬─────────────────────┐    │
│  │ PostgreSQL │ Edge         │ Auth                │    │
│  │ 46 Tables  │ Functions    │ (Email + Google     │    │
│  │ + RLS      │ (37 Deno TS) │  OAuth + QR)        │    │
│  └────────────┴──────────────┴─────────────────────┘    │
│  Storage (6 Buckets) · Realtime · Cron · admin_secrets  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST / Streaming
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   EXTERNE SERVICES                       │
│  Google Gemini 2.5/3 (direkt, kein Gateway)              │
│  Google Veo (Video)                                      │
│  OpenAI GPT-5 (direkt, kein Gateway)                     │
│  Stripe (Payments + Subscriptions)                       │
│  Resend (Transactional Email)                            │
│  OutVin (VIN-Decoder)                                    │
└─────────────────────────────────────────────────────────┘`}</CodeBlock>
      </SubSection>
    </Section>

    {/* 2. Tech-Stack */}
    <Section id="s2" title="2. Tech-Stack & Versionen">
      <SubSection title="Frontend">
        <Table
          headers={['Bereich', 'Technologie', 'Version', 'Zweck']}
          rows={[
            ['Framework', 'React', '18.x', 'UI-Library, Concurrent Mode'],
            ['Build', 'Vite', '5.x', 'Dev-Server (Port 8080!) & Production-Build'],
            ['Sprache', 'TypeScript', '5.x', 'Statische Typisierung, strict mode'],
            ['Styling', 'Tailwind CSS', '3.x', 'Utility-First CSS, semantische HSL-Tokens'],
            ['Komponenten', 'shadcn/ui', '–', 'Radix-basierte UI-Primitive (pinned!)'],
            ['Routing', 'react-router-dom', '6.x', 'SPA-Routing mit Lazy-Loading'],
            ['Data Fetching', '@tanstack/react-query', '5.56.2 (pinned!)', 'Server-State + Cache'],
            ['Forms', 'react-hook-form + zod', 'aktuell', 'Validierung'],
            ['Animation', 'framer-motion / tailwindcss-animate', 'aktuell', 'UI-Motion'],
            ['Icons', 'lucide-react', 'aktuell', 'SVG-Icons'],
            ['Charts', 'recharts', 'aktuell', 'Admin-Dashboards'],
            ['Toast', 'sonner + shadcn/toaster', 'aktuell', 'User-Feedback'],
          ]}
        />
      </SubSection>
      <SubSection title="Backend / Cloud">
        <Table
          headers={['Bereich', 'Technologie', 'Zweck']}
          rows={[
            ['DB', 'PostgreSQL 15 (Supabase)', '46 Tabellen, RLS, Triggers, RPCs'],
            ['Edge Functions', 'Deno + TypeScript', '37 Funktionen, Auto-Deploy via Lovable'],
            ['Auth', 'Supabase Auth (GoTrue)', 'Email/Password, Google OAuth, QR-Token'],
            ['Storage', 'Supabase Storage (S3)', '6 Buckets, RLS auf Object-Level'],
            ['Realtime', 'Supabase Realtime', 'Postgres-Changes für CRM/Jobs'],
            ['Sekrets', 'admin_secrets-Tabelle', 'DB-First mit 5-Min-TTL-Cache, Env-Fallback'],
          ]}
        />
      </SubSection>
      <SubSection title="Externe APIs">
        <Table
          headers={['Service', 'Modell/Produkt', 'Verwendung']}
          rows={[
            ['Google Gemini', '2.5-pro / 2.5-flash / 3-pro-image / 3.1-flash-image', 'Text, Vision, Image-Gen, Editing'],
            ['Google Veo', 'veo-3 / veo-3-fast', '8-Sek-Videos (360°-Lock)'],
            ['OpenAI', 'GPT-5 / 5-mini / 5-nano / 5.2', 'Fallback-Reasoning, Sales-Chat'],
            ['Stripe', 'Subscriptions + Checkout + Webhooks', 'Abos & Credit-Käufe'],
            ['Resend', 'Email API', 'Auth-Mails, Lead-Notifications, Quotes'],
            ['OutVin', 'VIN-Decoder', 'Fahrzeugdaten aus VIN'],
          ]}
        />
        <P>
          <strong>Wichtig:</strong> Gemini und OpenAI werden <em>direkt</em> per REST aufgerufen (kein Lovable AI Gateway),
          weil ungatewayte API-Keys günstiger sind und mehr Kontrolle bieten. Keys liegen in <code>admin_secrets</code>.
        </P>
      </SubSection>
    </Section>

    {/* 3. Repo Layout */}
    <Section id="s3" title="3. Repository-Layout & Konventionen">
      <CodeBlock>{`/
├── public/                       # Statische Assets
│   ├── images/logos/             # 10+ Hersteller-Logos (SVG, immer aktuell!)
│   ├── data/                     # JSON (Steuersätze, Marken/Modelle)
│   ├── embed.js                  # WordPress-/Iframe-Embed-Script
│   └── robots.txt
├── src/
│   ├── pages/                    # Routen (lazy-loaded in App.tsx)
│   │   └── admin/                # 22 Admin-Seiten
│   ├── components/               # ~120 React-Komponenten
│   │   ├── ui/                   # shadcn-Primitive
│   │   ├── dashboard/            # Dashboard-Tabs
│   │   ├── sales/                # Sales/CRM-Komponenten (15)
│   │   ├── vehicle/              # Fahrzeug-Editor
│   │   ├── spin360/              # 360°-Spin-Workflow
│   │   ├── preset/               # Preset-Selection
│   │   └── template-editors/     # Landing-Page-Editors
│   ├── hooks/                    # React-Hooks (Auth, Credits, Vehicles, …)
│   ├── contexts/                 # PipelineContext, BackgroundTasksContext
│   ├── lib/                      # Reine Utilities (kein React)
│   │   ├── templates/            # 4 Landing-Page-Templates (HTML-Generatoren)
│   │   ├── wmi-data/             # VIN-WMI-Lookup-Tabellen
│   │   ├── mandatory-disclosure.ts  # Pkw-EnVKV-Formatter
│   │   ├── remaster-prompt.ts    # Modulare Prompt-Bausteine
│   │   └── gemini-file-upload.ts # File-API-Wrapper
│   ├── integrations/supabase/    # AUTO-GENERIERT, nie editieren!
│   │   ├── client.ts             # Supabase-Client
│   │   └── types.ts              # DB-Typen
│   ├── assets/                   # Importierbare Bilder
│   ├── App.tsx                   # Provider-Tree + Router
│   ├── main.tsx                  # Entry
│   ├── index.css                 # Globale Styles + Design-Tokens
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml               # Edge-Function-Settings (verify_jwt)
│   ├── functions/
│   │   ├── _shared/              # auth.ts, cors.ts, credits.ts, get-secret.ts
│   │   └── <37 Funktionen>/index.ts
│   └── migrations/               # SQL-Migrationen (versioniert)
├── tailwind.config.ts            # Design-System-Tokens
├── vite.config.ts                # Vite-Config (Port 8080!)
├── package.json
└── .env                          # AUTO-GENERIERT (VITE_SUPABASE_*)`}</CodeBlock>
      <SubSection title="Konventionen">
        <Ul>
          <Li><strong>Semantische Tokens</strong>: niemals <code>text-white</code>, immer <code>text-foreground</code> etc. HSL only.</Li>
          <Li><strong>Lazy-Loading</strong>: alle Seiten in <code>App.tsx</code> via <code>React.lazy</code>.</Li>
          <Li><strong>Datei-Größe</strong>: Komponenten klein und fokussiert halten, lieber neue Datei als 500+-Zeilen-Monolith.</Li>
          <Li><strong>Niemals editieren</strong>: <code>src/integrations/supabase/client.ts</code>, <code>types.ts</code>, <code>.env</code>.</Li>
          <Li><strong>Imports</strong>: <code>@/</code> ist Alias für <code>src/</code>.</Li>
        </Ul>
      </SubSection>
    </Section>

    {/* 4. Dev Setup */}
    <Section id="s4" title="4. Lokale Entwicklungsumgebung">
      <SubSection title="Voraussetzungen">
        <Ul>
          <Li>Node.js ≥ 20 (LTS), npm oder bun</Li>
          <Li>Git, ein moderner Browser (Chrome/Firefox)</Li>
          <Li>Optional: VS Code mit Tailwind-IntelliSense &amp; ESLint-Extension</Li>
        </Ul>
      </SubSection>
      <SubSection title="Erstes Setup">
        <CodeBlock>{`# 1. Repo clonen
git clone <repo-url> autohaus-ai
cd autohaus-ai

# 2. Dependencies installieren
npm install      # oder: bun install

# 3. Dev-Server starten (ZWINGEND Port 8080!)
npm run dev      # http://localhost:8080

# 4. Build & Preview
npm run build
npm run preview

# 5. Tests
npm run test     # vitest`}</CodeBlock>
      </SubSection>
      <SubSection title="Wichtige Env-Variablen (automatisch befüllt)">
        <CodeBlock>{`VITE_SUPABASE_URL              # Supabase-Endpunkt
VITE_SUPABASE_PUBLISHABLE_KEY  # Anon-Key (safe in Client)
VITE_SUPABASE_PROJECT_ID       # Projekt-Referenz`}</CodeBlock>
        <P>Alle echten Secrets (Gemini-Key, OpenAI-Key, Stripe-Secret, Resend, OutVin) liegen in der
        <code> admin_secrets</code>-Tabelle und werden nur von Edge Functions via <code>getSecret()</code> gelesen.</P>
      </SubSection>
      <SubSection title="Edge Function lokal testen">
        <CodeBlock>{`# Über Lovable Cloud: Funktionen werden automatisch deployed bei Git-Push.
# Lokal mit Supabase CLI optional:
supabase functions serve <function-name> --no-verify-jwt`}</CodeBlock>
      </SubSection>
    </Section>

    {/* 5. Routing */}
    <Section id="s5" title="5. Routing & Seitenstruktur">
      <P>Alle Routen sind in <code>src/App.tsx</code> definiert, geschützte Routen via <code>&lt;ProtectedRoute&gt;</code>,
      Admin-Routen zusätzlich via <code>&lt;AdminRoute&gt;</code> (prüft <code>has_role(uid, 'admin')</code>).</P>
      <Table
        headers={['Route', 'Komponente', 'Zugriff', 'Zweck']}
        rows={[
          ['/', 'Landing', 'public', 'Marketing-Startseite'],
          ['/auth', 'Auth', 'public', 'Login / Signup / Password-Reset'],
          ['/qr-login', 'QrLogin', 'public', 'Passwortloser Login via QR-Token'],
          ['/generator', 'Index', 'auth', 'ActionHub – Tool-Auswahl'],
          ['/generator/:tool', 'Index', 'auth', 'Generator-Workflow (banner, landing, …)'],
          ['/dashboard', 'Dashboard', 'auth', 'Projekte, Fahrzeuge, CRM, Banner, Landings'],
          ['/profile', 'Profile', 'auth', 'Profil + Dealer-Daten'],
          ['/project/:id', 'ProjectView', 'auth', 'Projektdetails'],
          ['/vehicle/:id', 'VehicleView', 'auth', 'Fahrzeug-Editor mit Tabs'],
          ['/damage-report/:id', 'DamageReportView', 'auth', 'Schadensbericht'],
          ['/leasing-rechner', 'LeasingCalculator', 'auth', '§ 17 PAngV Leasing'],
          ['/finanzierungsrechner', 'FinancingCalculator', 'auth', '§ 17 PAngV Finanzierung'],
          ['/kfz-steuer-rechner', 'KfzSteuerRechner', 'auth', 'KFZ-Steuer-Berechnung'],
          ['/pricing', 'Pricing', 'public', 'Preistabellen + Checkout'],
          ['/docs', 'ApiDocs', 'public', 'Öffentliche API-Doku'],
          ['/integrations', 'Integrations', 'auth', 'FTP, WordPress, API-Keys'],
          ['/sales-assistant', 'SalesAssistant', 'auth', 'KI-CRM (10 Tabs)'],
          ['/admin/*', 'AdminLayout', 'admin', '22 Verwaltungsseiten (s. § 28)'],
          ['/architecture', 'ArchitectureDoc', 'admin', 'Dieses Dokument'],
        ]}
      />
    </Section>

    {/* 6. Frontend Arch */}
    <Section id="s6" title="6. Frontend-Architektur">
      <SubSection title="Provider-Tree (App.tsx)">
        <CodeBlock>{`<QueryClientProvider>
  <TooltipProvider>
    <Toaster /> <Sonner />
    <BrowserRouter>
      <AuthProvider>             ← user, session, login/signup/signOut
        <PipelineProvider>       ← globale Pipeline-Jobs (Background)
          <BackgroundTasksProvider>  ← parallel laufende Tasks
            <BackgroundPipelineIndicator />
            <BackgroundTasksIndicator />
            <Suspense fallback={<PageLoader/>}>
              <Routes>…</Routes>
            </Suspense>`}</CodeBlock>
      </SubSection>
      <SubSection title="Wichtige Hooks">
        <Table
          headers={['Hook', 'Zweck']}
          rows={[
            ['useAuth', 'Aktueller User, Session, Auth-Methoden'],
            ['useCredits', 'Credit-Saldo + Realtime-Updates'],
            ['useCreditCheck', 'Pre-Check ob Credits für Aktion reichen'],
            ['useSubscription', 'Stripe-Abo-Status + Plan-Tier'],
            ['useModuleAccess', 'Modul-Freischaltung (Admin-gesteuert)'],
            ['useVehicles / useVehicleAssets', 'Fahrzeug-Listen + Bilder'],
            ['useDashboardData', 'Aggregierte Stats für Dashboard'],
            ['useVinLookup', 'VIN-Decoder (WMI + OutVin)'],
            ['useDealerBanks', 'Multi-Bank-Auswahl für Finance-Texte'],
            ['useSalesAssistant', 'CRM-State, Konversationen, Tasks'],
            ['useVehicleMakes', 'Marken/Modelle aus JSON + Aliasing'],
            ['usePipelineSafe', 'Pipeline-Context mit Crash-Schutz'],
            ['use-mobile', 'Responsive Breakpoint-Detection'],
            ['use-swipe-navigation', 'Touch-Gesten für Galerien'],
          ]}
        />
      </SubSection>
      <SubSection title="Design-System">
        <P>Definiert in <code>src/index.css</code> + <code>tailwind.config.ts</code>:</P>
        <Ul>
          <Li>Background: <code>hsl(30 15% 95%)</code> (Cream)</Li>
          <Li>Foreground: <code>hsl(0 0% 13%)</code> (Charcoal)</Li>
          <Li>Accent: Petrol-Blau <code>#174f6b</code></Li>
          <Li>Fonts: Space Grotesk (Headings), Manrope/Inter (Body) — niemals Serif</Li>
          <Li>Kein Rot außer für Warnungen</Li>
          <Li>Mobile-first, Sidebar erst ab Desktop-Breakpoint</Li>
          <Li><strong>CSS @import-Regel:</strong> Fonts MÜSSEN vor <code>@tailwind</code> stehen — sonst Whitescreen</Li>
        </Ul>
      </SubSection>
    </Section>

    {/* 7. State / Pipeline */}
    <Section id="s7" title="7. State-Management & Pipeline-System">
      <P>Drei Ebenen:</P>
      <Ul>
        <Li><strong>Server-State</strong>: React Query (Caching, Refetch, Mutations).</Li>
        <Li><strong>UI-State</strong>: lokales <code>useState</code> in Komponenten.</Li>
        <Li><strong>Globaler Background-State</strong>: <code>PipelineContext</code> + <code>BackgroundTasksContext</code>.</Li>
      </Ul>
      <SubSection title="PipelineContext">
        <P>Verwaltet alle lang laufenden KI-Jobs (Remastering, 360°, Banner, Landing, Video) global, damit der User
        durch die App navigieren kann, ohne den Job zu verlieren. Persistiert in <code>image_generation_jobs</code>.</P>
        <P><strong>Wichtig:</strong> immer <code>usePipelineSafe()</code> verwenden — verhindert Crashes wenn der
        Context noch nicht montiert ist.</P>
      </SubSection>
      <SubSection title="Job-Lifecycle">
        <CodeBlock>{`UI → invokeEdgeFunction()
         ↓
    image_generation_jobs (pending)
         ↓
    Edge Function (self-invoking, Step-based)
         ↓ (Realtime Updates)
    PipelineContext / UI
         ↓
    Storage (vehicle-images / banners / landings)
         ↓
    DB-Update (status = 'done', result_url)`}</CodeBlock>
      </SubSection>
    </Section>

    {/* 8. Edge Functions */}
    <Section id="s8" title="8. Backend-Architektur — 37 Edge Functions">
      <P>Alle Edge Functions liegen in <code>supabase/functions/&lt;name&gt;/index.ts</code> und werden bei Git-Push
      automatisch deployed. <strong>JWT-Verifikation:</strong> per <code>supabase/config.toml</code> pro Funktion
      gesteuert (<code>verify_jwt = false</code> für public/webhook).</P>
      <P><strong>Auth-Pflicht:</strong> Für authentifizierte Functions IMMER <code>sb.auth.getClaims(token)</code>,
      NIEMALS <code>getUser()</code> (Race-Conditions).</P>
      <SubSub title="Shared-Module (supabase/functions/_shared/)">
        <Ul>
          <Li><code>auth.ts</code> – Claims-basierte User-Resolution</Li>
          <Li><code>cors.ts</code> – CORS-Header für Browser-Calls</Li>
          <Li><code>credits.ts</code> – Credit-Check + Deduction</Li>
          <Li><code>get-secret.ts</code> – Secret-Lookup mit 5-Min-Cache (admin_secrets → Env-Fallback)</Li>
        </Ul>
      </SubSub>
      <SubSection title="Funktions-Inventar">
        <Table
          headers={['Kategorie', 'Funktion', 'Zweck']}
          rows={[
            ['KI-Bild', 'remaster-vehicle-image', 'Showroom-Remastering (Reference Truth Protocol)'],
            ['KI-Bild', 'generate-vehicle-image', 'Vehicle-Image-Generation (Hero/Pipeline)'],
            ['KI-Bild', 'generate-banner', 'Banner mit Pre-Padding'],
            ['KI-Bild', 'generate-landing-page', 'Landing-Page-Hero-Image + HTML'],
            ['KI-Bild', 'generate-360-spin', '360°-Frame-Interpolation'],
            ['KI-Bild', 'classify-vehicle-images', 'Auto-Tagging (Front/Rear/Side/Interior)'],
            ['KI-Bild', 'annotate-damage-image', 'Schadens-Overlay'],
            ['KI-Bild', 'repair-damage-image', 'Schaden retuschieren'],
            ['KI-Video', 'generate-video', 'Veo 8-Sek-Video, Identity-Lock'],
            ['KI-Analyse', 'analyze-pdf', 'Angebots-PDF parsen (Datenblatt)'],
            ['KI-Analyse', 'analyze-offer-image', 'Screenshot eines Angebots auslesen'],
            ['KI-Analyse', 'analyze-damage', 'Schadensanalyse'],
            ['KI-Analyse', 'detect-vehicle-brand', 'Marke aus Foto erkennen'],
            ['KI-Analyse', 'ocr-vin', 'VIN aus Foto extrahieren'],
            ['KI-Analyse', 'lookup-vin', 'VIN → Fahrzeugdaten (OutVin + WMI-Fallback)'],
            ['Sales', 'sales-chat', 'KI-Chat im Sales Assistant'],
            ['Sales', 'generate-sales-response', '10-Block-Modulare-Antwort'],
            ['Sales', 'ingest-sales-knowledge', 'Knowledge-Base-Ingestion (RAG)'],
            ['Sales', 'process-sales-email', 'Inbound/Outbound-Email-Routing'],
            ['Sales', 'auto-process-lead', 'Lead-Klassifikation + Auto-Reply'],
            ['Sales', 'seed-crm-demo', 'Demo-Daten für CRM'],
            ['Auth', 'verify-qr-token', 'QR-Login-Token-Validierung'],
            ['Auth', 'generate-magic-link', 'Magic-Link-Generation'],
            ['Stripe', 'create-checkout', 'Checkout-Session erstellen'],
            ['Stripe', 'customer-portal', 'Stripe-Customer-Portal-Link'],
            ['Stripe', 'buy-credits', 'Credit-Pack-Kauf'],
            ['Stripe', 'check-credits', 'Saldo-Abfrage'],
            ['Stripe', 'stripe-webhook', 'Webhooks (subscription, payment, refund)'],
            ['Stripe', 'admin-stripe', 'Admin-Operationen (max. 4 Expansion-Level!)'],
            ['Lead', 'submit-lead', 'Public Lead-Submit von Landing'],
            ['Storage', 'upload-pipeline-images', 'Batch-Upload mit Fingerprinting'],
            ['Storage', 'upload-to-gemini-files', 'Gemini File API Upload (File-API-First!)'],
            ['Storage', 'migrate-base64-images', 'Legacy-Base64 → Storage'],
            ['Storage', 'cleanup-orphaned-storage', 'Aufräum-Cron'],
            ['Distribution', 'ftp-upload', 'Upload zu Mobile.de / Autoscout24-FTP'],
            ['Distribution', 'api-vehicles', 'Public REST API für Fahrzeuge'],
            ['Admin', 'admin-delete-user', 'User-Hard-Delete mit Cascading'],
          ]}
        />
      </SubSection>
    </Section>

    {/* 9. DB */}
    <Section id="s9" title="9. Datenbank-Architektur — 46 Tabellen">
      <SubSection title="Kern-Domänen">
        <Table
          headers={['Domäne', 'Tabellen']}
          rows={[
            ['Nutzer & Auth', 'profiles, user_roles, user_module_access, user_subscriptions, qr_login_tokens'],
            ['Fahrzeuge', 'vehicles, projects, project_images, presets, preset_placeholders, placeholder_definitions'],
            ['KI-Jobs', 'image_generation_jobs, pipeline_timing_logs, spin360_jobs, spin360_source_images, spin360_canonical_images, spin360_generated_frames'],
            ['Schäden', 'damage_reports'],
            ['Sales / CRM', 'sales_assistant_conversations, sales_assistant_messages, sales_assistant_profiles, sales_assistant_tasks, sales_chat_messages, sales_email_outbox, sales_knowledge_documents, sales_knowledge_chunks, sales_notifications, sales_quotes, conversation_stage_log, crm_manual_notes, customer_journey_templates'],
            ['Termine', 'test_drive_bookings, dealer_availability, dealer_blocked_dates, calendar_sync_configs'],
            ['Trade-In', 'trade_in_valuations'],
            ['Leads', 'leads'],
            ['Credits & Pricing', 'credit_balances, credit_transactions, subscription_plans'],
            ['Konfiguration', 'admin_secrets, admin_settings, dealer_banks, ftp_configs, ftp_configs_safe, sample_pdfs'],
          ]}
        />
      </SubSection>
      <SubSection title="Wichtige Beziehungen">
        <CodeBlock>{`auth.users (Supabase) ──┬─→ profiles (1:1, FK user_id)
                        ├─→ user_roles  (1:n, app_role enum)
                        ├─→ user_module_access (1:n)
                        ├─→ user_subscriptions (1:1)
                        ├─→ credit_balances    (1:1)
                        ├─→ projects (1:n) ──→ vehicles (1:n)
                        │                           └─→ project_images (1:n)
                        │                           └─→ damage_reports
                        │                           └─→ spin360_jobs
                        ├─→ image_generation_jobs (1:n)
                        ├─→ sales_assistant_conversations
                        └─→ leads (1:n via owner)`}</CodeBlock>
      </SubSection>
      <SubSection title="Wichtige Enums & Triggers">
        <Ul>
          <Li><code>app_role</code> – <code>admin | moderator | user</code></Li>
          <Li><code>has_role(uid, role)</code> – SECURITY DEFINER Function, in RLS verwendet</Li>
          <Li>Trigger <code>handle_new_user</code> erstellt automatisch Profile + Credit-Balance bei Signup</Li>
          <Li>Validierungs-Trigger statt CHECK-Constraints (wegen Immutability)</Li>
        </Ul>
      </SubSection>
    </Section>

    {/* 10. RLS */}
    <Section id="s10" title="10. Row-Level-Security & Rollen">
      <P><strong>Pflicht:</strong> Rollen werden in <code>user_roles</code> gespeichert, NIEMALS auf <code>profiles</code>
      (Privilege-Escalation-Risiko). Geprüft via SECURITY-DEFINER-Function <code>has_role()</code> um RLS-Rekursion zu vermeiden.</P>
      <SubSection title="Standard-RLS-Pattern">
        <CodeBlock>{`-- User-eigene Daten
CREATE POLICY "users own data" ON public.vehicles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin-Override
CREATE POLICY "admins all data" ON public.vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));`}</CodeBlock>
      </SubSection>
      <SubSection title="Security-Invoker-Views">
        <P>Views verwenden <code>security_invoker = true</code> damit RLS des aufrufenden Users greift (nicht des Erstellers).
        Beispiel: <code>ftp_configs_safe</code>.</P>
      </SubSection>
    </Section>

    {/* 11. Auth */}
    <Section id="s11" title="11. Authentifizierung">
      <SubSection title="Methoden">
        <Ul>
          <Li><strong>Email + Passwort</strong> mit Pflicht-Verifikation (kein Auto-Confirm in Production!)</Li>
          <Li><strong>Google OAuth</strong> – Standard-Konnektor</Li>
          <Li><strong>QR-Login</strong> – passwortlos via pdf.anzeige.ai (siehe <code>generate-magic-link</code> + <code>verify-qr-token</code>)</Li>
        </Ul>
      </SubSection>
      <SubSection title="Session-Management">
        <P>Supabase-Client persistiert Session in <code>localStorage</code>, Auto-Refresh-Token aktiv. Bei E-Mail-Bestätigung
        zeigt <code>ProtectedRoute</code> einen Bestätigungs-Hinweis bevor Zugriff gewährt wird.</P>
      </SubSection>
      <SubSection title="QR-Login-Flow">
        <CodeBlock>{`pdf.anzeige.ai (extern)
   → generate-magic-link (Edge Fn)
   → qr_login_tokens Table (kurzlebig)
   → User scannt QR
   → /qr-login?token=…
   → verify-qr-token Edge Fn
   → Session etabliert via supabase.auth.setSession()`}</CodeBlock>
      </SubSection>
    </Section>

    {/* 12. KI Services */}
    <Section id="s12" title="12. KI-Services (Gemini, OpenAI, Veo)">
      <SubSection title="Modell-Routing (strikte Tier-Engine-Bindung)">
        <Table
          headers={['Tier', 'Use-Case', 'Modell']}
          rows={[
            ['Pro', 'Hero-Bilder, komplexes Reasoning', 'gemini-2.5-pro / gemini-3.1-pro-preview'],
            ['Flash', 'Pipeline-Bilder, Banner', 'gemini-2.5-flash / gemini-3-flash-preview'],
            ['Lite', 'Klassifikation, Tagging', 'gemini-2.5-flash-lite'],
            ['Image', 'Bildgenerierung & Editing', 'gemini-3-pro-image-preview / gemini-3.1-flash-image-preview'],
            ['Video', 'Showroom-Videos', 'Google Veo 3 (Pro & Fast)'],
            ['Reasoning (Sales)', 'Chat, Sales-Antworten', 'gpt-5 / gpt-5-mini / gpt-5.2'],
          ]}
        />
        <P><strong>Constraint:</strong> Cross-Engine-Fallback ist verboten — Video bleibt Veo, Pipeline-Bilder bleiben in derselben Familie.</P>
      </SubSection>
      <SubSection title="Resilience-Strategie">
        <Ul>
          <Li>Retry mit exponentiellem Backoff (3 Versuche)</Li>
          <Li>Multi-Stage JSON-Repair (Trunkation, fehlende Klammern, Escaped Strings)</Li>
          <Li>Tier-Downgrade innerhalb derselben Engine (Pro → Flash) als Last-Resort</Li>
        </Ul>
      </SubSection>
      <SubSection title="API-Constraints">
        <Ul>
          <Li>Gemini-Image-API unterstützt <strong>kein</strong> <code>aspectRatio</code> in <code>generationConfig</code></Li>
          <Li>Stripe-Edge-Functions max. <strong>4 Expansion-Level</strong></Li>
          <Li>Modelle &amp; Preise zentral in <code>src/lib/cost-utils.ts</code> &amp; Admin-Pricing</Li>
        </Ul>
      </SubSection>
    </Section>

    {/* 13. File API */}
    <Section id="s13" title="13. File API & Prompt-System">
      <SubSection title="File-API-First (Pflicht)">
        <P>Bilder/PDFs werden NIE als Base64 in Edge-Funktionen geschickt, sondern via Gemini File API hochgeladen:</P>
        <CodeBlock>{`// Frontend
import { uploadToGeminiFiles } from '@/lib/gemini-file-upload';
const { uri, mimeType } = await uploadToGeminiFiles(file);

// Edge Function bekommt nur die URI weitergereicht
{ mainImageFileUri: { uri, mimeType }, additionalFileUris: [...] }`}</CodeBlock>
        <P>Base64 nur als Fallback wenn File API ausfällt.</P>
      </SubSection>
      <SubSection title="Modulares Prompt-System">
        <P>Prompts werden aus DB-Bausteinen (Admin → Prompts) zusammengesetzt. Edge Function liest dynamische Blöcke;
        bei Ausfall greift ein Default-Prompt aus <code>src/lib/remaster-prompt-defaults.ts</code>.</P>
        <P><strong>Master-Prompt-System</strong>: immutable Assets (Showroom-Hintergründe, Hersteller-Logos) sind fest verdrahtet
        und niemals AI-halluziniert (<strong>Reference Truth Protocol</strong>).</P>
      </SubSection>
    </Section>

    {/* 14. Storage */}
    <Section id="s14" title="14. Storage-Buckets & Asset-Management">
      <Table
        headers={['Bucket', 'Public?', 'Inhalt', 'RLS']}
        rows={[
          ['vehicle-images', 'public', 'Originale + Remastered + Galerie', 'INSERT/UPDATE/SELECT für owner; UPDATE-Policy zwingend für upsert'],
          ['banners', 'public', 'Generierte Werbebanner', 'owner'],
          ['landings', 'public', 'Landing-Page-Assets (HTML+Hero)', 'owner'],
          ['videos', 'public', 'Veo-generierte Videos', 'owner'],
          ['pdfs', 'private', 'Hochgeladene Angebots-PDFs', 'owner-only'],
          ['logos', 'public', 'Dealer-Logos', 'owner'],
        ]}
      />
      <P><strong>Logo-Regel:</strong> Hersteller-Logos IMMER aus der Logo-DB / <code>public/images/logos/</code> ziehen (via
      <code>getLogoForMake</code>) — niemals historische Versionen (z.B. VW: nur Flat-Blue ab 2019).</P>
    </Section>

    {/* 15. Credits & Stripe */}
    <Section id="s15" title="15. Credit-System & Stripe-Integration">
      <SubSection title="Credit-Logik">
        <Ul>
          <Li>Jeder KI-Job verbraucht Credits — Pricing in <code>subscription_plans</code> &amp; Admin-Pricing</Li>
          <Li>Dynamische Tier-basierte Preise: Pro &gt; Flash &gt; Lite (Modell-Kosten basiert)</Li>
          <Li>Pre-Check via <code>useCreditCheck</code>, Deduction atomar in <code>check-credits</code>/Edge-Fn</Li>
          <Li>Logged in <code>credit_transactions</code> mit Bezug auf Job-ID</Li>
        </Ul>
      </SubSection>
      <SubSection title="Stripe-Flows">
        <Ul>
          <Li><strong>Abo</strong>: <code>create-checkout</code> → Stripe-Checkout → Webhook → <code>user_subscriptions</code></Li>
          <Li><strong>Credit-Pack</strong>: <code>buy-credits</code> → One-Time-Payment → Webhook → <code>credit_balances</code></Li>
          <Li><strong>Verwaltung</strong>: <code>customer-portal</code> öffnet Stripe-Portal</Li>
          <Li><strong>Webhooks</strong>: <code>stripe-webhook</code> (verify_jwt=false) verarbeitet alle Events</Li>
        </Ul>
      </SubSection>
    </Section>

    {/* 16. Modules */}
    <Section id="s16" title="16. Modul-Übersicht (Generator-Tools)">
      <Table
        headers={['Modul', 'Route', 'Beschreibung']}
        rows={[
          ['Remastering', '/generator/remaster', 'Handyfoto → Showroom-Bild'],
          ['Banner', '/generator/banner', 'Werbebanner mit Pre-Padding'],
          ['Landing Page', '/generator/landing', 'SEO-Landing aus PDF oder manuell'],
          ['360°-Spin', '/generator/spin360', '4–8 Fotos → 36-Frame-Spin'],
          ['Video', '/generator/video', 'Veo-Video mit Identity-Lock'],
          ['Schadensanalyse', '/generator/damage', 'KI-basierte Schadenserkennung'],
        ]}
      />
    </Section>

    {/* 17. Remastering */}
    <Section id="s17" title="17. Remastering-Pipeline">
      <P>Edge-Fn <code>remaster-vehicle-image</code> mit <strong>Reference Truth Protocol</strong>:</P>
      <Ul>
        <Li>Original-Foto = Wahrheit (keine Hallucination von Felgen, Farben, Plaketten)</Li>
        <Li>Logo wird via Canvas-PNG-Preprocessing (Transparenz-Cleanup) eingespielt</Li>
        <Li>Nummernschild: entweder entfernen oder 1:1 reproduzieren (siehe Kennzeichen-Regel)</Li>
        <Li>Interior-Remastering: leeres Auto (keine Passagiere), Strukturintegrität gewahrt</Li>
        <Li>Smart-Routing nach Keywords: <em>rear</em>, <em>side</em>, <em>interior</em> → andere Referenzbild-Sets</Li>
      </Ul>
    </Section>

    {/* 18. 360 */}
    <Section id="s18" title="18. 360°-Spin-Modul">
      <Ul>
        <Li>Upload-Modi: 4/6/8 Perspektiven ODER Video-Frame-Extraction (Canvas + Start-Flicker-Pixel-Scan)</Li>
        <Li><code>generate-360-spin</code> interpoliert auf 36 Frames</Li>
        <Li>Identity-Lock: identisches Fahrzeug in allen Frames</Li>
        <Li>Cascading Delete bei Vehicle-Löschung</Li>
        <Li>Viewer: <code>Spin360Viewer</code> (Touch + Maus + Auto-Spin)</Li>
      </Ul>
    </Section>

    {/* 19. Banner */}
    <Section id="s19" title="19. Banner-Generator">
      <P>Pre-Padding-Logik: Eingabebild wird ZUERST auf Zielformat gepaddet (kein Innen-Blur), dann KI-Erweiterung
      der Ränder. Legal-Text (Pkw-EnVKV) via <code>formatMandatoryDisclosure()</code> automatisch eingefügt.</P>
      <P>Layout-Regeln, Bank-Auswahl (Multi-Bank) und Logo-Platzierung sind feste Komponenten.</P>
    </Section>

    {/* 20. Landing */}
    <Section id="s20" title="20. Landing-Page-Generator">
      <Ul>
        <Li>4 Templates: <code>autohaus</code>, <code>modern</code>, <code>klassisch</code>, <code>minimalist</code></Li>
        <Li>Dual-Prompt-Strategie: Text (Specs/SEO) + Image (Hero)</Li>
        <Li>Live-Preview-Mode: Edit vs. Preview via Real-Time-Iframe-Injection</Li>
        <Li>Helpful-Content-LP v6 mit Layouts &amp; SEO-Constraints</Li>
        <Li>HTML-Export: Lightweight ODER Offline-WebP-Base64</Li>
        <Li>Lead-Capture-Form integriert, self-profilierend</Li>
        <Li>Split-Screen-Design mit Gradient-Overlay</Li>
        <Li>Image-Scale: 30% (kompakt) vs 40-50% (Hero) je Layout</Li>
      </Ul>
    </Section>

    {/* 21. Video */}
    <Section id="s21" title="21. Video-Generator (Veo)">
      <P>Google Veo 3 erzeugt 8-Sekunden-360°-Videos mit Identity-Lock-Logik. Tier-Routing: Veo-Pro (Qualität) vs.
      Veo-Fast (Speed). Polling via <code>generate-video</code> mit Step-based Self-Invocation.</P>
      <P>Mobile-Download via Blob-Trigger (verhindert iOS-In-Tab-Öffnen).</P>
    </Section>

    {/* 22. PDF */}
    <Section id="s22" title="22. PDF-Analyse-Pipeline">
      <P>Keyword-basierte Logik in <code>analyze-pdf</code>:</P>
      <Ul>
        <Li>Priorität: Finanzierungs-Typ &gt; Fahrzeug-Status</Li>
        <Li>Validierungs-AI rejected Nicht-Fahrzeug-Dokumente</Li>
        <Li>Dealer-Daten-Merge: PDF-First, Fallback Dealer-Profile</Li>
        <Li>Pkw-EnVKV-konformer Footer mit PHEV/Verbrenner/Elektro-Varianten, CO₂-Klasse A–G, WLTP/DAT-Filter</Li>
        <Li>Consumption-Data-Logik: Tech-Fallback bei fehlendem Hubraum, PHEV-Support, 49-Stück-CO₂-Label-Matrix</Li>
      </Ul>
    </Section>

    {/* 23. Sales */}
    <Section id="s23" title="23. Sales Assistant & CRM">
      <SubSection title="10 Tabs">
        <P>Generator, Mailbox, History, Knowledge, Quotes, Trade-In, Bookings, Tasks, Journey, CRM.</P>
      </SubSection>
      <SubSection title="CRM-Pipeline (7 Stufen)">
        <CodeBlock>{`Lead → Kontakt → Qualifiziert → Angebot → Probefahrt → Verhandlung → Abschluss`}</CodeBlock>
      </SubSection>
      <Ul>
        <Li>10-Block-Modulare-Prompt-Architektur für <code>generate-sales-response</code></Li>
        <Li>Trade-In-Bewertung via VIN-Lookup</Li>
        <Li>Test-Drive-Buchungen mit Verfügbarkeits- &amp; Blockdaten-Verwaltung</Li>
        <Li>Inbound-Email-Tracking (manuelles CRM)</Li>
        <Li>Sales-Quotes mit § 17 PAngV-Konformität</Li>
        <Li>Realtime-Subscriptions auf <code>sales_assistant_messages</code></Li>
      </Ul>
    </Section>

    {/* 24. Email */}
    <Section id="s24" title="24. E-Mail-System (Resend)">
      <P>Workflow via <code>process-sales-email</code> + Resend-API:</P>
      <Ul>
        <Li>Outbox-Pattern: <code>sales_email_outbox</code> → Worker → Resend → Status-Update</Li>
        <Li>Auth-Mails über Supabase-Default oder Custom-Domain</Li>
        <Li>Admin-Email-Monitor zeigt Delivery-Status &amp; Bounces</Li>
      </Ul>
    </Section>

    {/* 25. Leads */}
    <Section id="s25" title="25. Lead-Capture & Auto-Verarbeitung">
      <Ul>
        <Li><code>submit-lead</code> (public) nimmt Leads von Landing-Pages entgegen</Li>
        <Li><code>auto-process-lead</code> klassifiziert (Hot/Warm/Cold), schickt Auto-Reply, notified Owner</Li>
        <Li>Self-profiling: Lead-Form fragt dynamisch je nach Acquisition-Kanal andere Felder ab</Li>
      </Ul>
    </Section>

    {/* 26. External APIs */}
    <Section id="s26" title="26. Externe APIs">
      <Table
        headers={['Service', 'Auth', 'Endpoint(s)', 'Rate Limits']}
        rows={[
          ['Google Gemini', 'API Key (admin_secrets)', 'generativelanguage.googleapis.com', 'projektabhängig'],
          ['Google Veo', 'API Key', 'gleicher Endpoint, Modell-Selektor', 'Video-Queue'],
          ['OpenAI', 'API Key', 'api.openai.com/v1', 'TPM/RPM nach Tier'],
          ['Stripe', 'Secret Key', 'api.stripe.com', 'sehr hoch'],
          ['Resend', 'API Key', 'api.resend.com', '100/s'],
          ['OutVin', 'API Key', 'OutVin REST', 'Tageslimit'],
        ]}
      />
    </Section>

    {/* 27. Distribution */}
    <Section id="s27" title="27. Distribution & Integration">
      <Ul>
        <Li><strong>FTP-Upload</strong>: <code>ftp-upload</code> Edge-Fn pusht Inserate zu Mobile.de/Autoscout24</Li>
        <Li><strong>WordPress-Plugin</strong>: <code>src/lib/wordpress-plugin.ts</code> + <code>public/embed.js</code></Li>
        <Li><strong>Public API</strong>: <code>api-vehicles</code> (REST, JWT-frei, API-Key-gateway)</Li>
        <Li><strong>HTML-Export</strong>: Lightweight oder Offline-Base64</Li>
      </Ul>
    </Section>

    {/* 28. Admin */}
    <Section id="s28" title="28. Admin-System (22 Seiten)">
      <P>Geschützt via <code>AdminRoute</code> + <code>has_role(uid, 'admin')</code>. Sidebar mit Gruppen:</P>
      <Ul>
        <Li><strong>Übersicht</strong>: Dashboard</Li>
        <Li><strong>Nutzer &amp; Abos</strong>: Users, Transactions, Revenue, Pricing</Li>
        <Li><strong>Inhalte &amp; Daten</strong>: Leads, PDF-Galerie, Logos, WMI-Codes, Sales-Assistant, Prompts, Presets, QR-Login</Li>
        <Li><strong>Monitoring</strong>: Jobs, E-Mail, Storage, Conversion-Funnel, Test-Drives, Pipeline-Stats</Li>
        <Li><strong>System</strong>: Settings, API-Keys (admin_secrets), Architektur (dieses Dokument)</Li>
      </Ul>
    </Section>

    {/* 29. Security */}
    <Section id="s29" title="29. Sicherheitsarchitektur">
      <Ul>
        <Li>RLS auf ALLEN Tabellen aktiviert, geprüft via <code>has_role()</code></Li>
        <Li>Security-Invoker-Views statt SECURITY DEFINER wo möglich</Li>
        <Li>Keine Anonymous-Signups (immer Email-Verify oder OAuth)</Li>
        <Li>API-Keys nur in <code>admin_secrets</code> (mit Audit-Log)</Li>
        <Li>Rate-Limit über Edge-Function-Level (Supabase native)</Li>
        <Li>CORS strict konfiguriert in <code>_shared/cors.ts</code></Li>
        <Li>Storage-Buckets mit RLS auf Object-Path (<code>user_id/...</code>)</Li>
        <Li>Stripe-Webhook verifiziert Signaturen</Li>
        <Li>Kein <code>localStorage</code> für Admin-Status — IMMER Server-Validation</Li>
      </Ul>
    </Section>

    {/* 30. Deployment */}
    <Section id="s30" title="30. Deployment & Infrastruktur">
      <SubSection title="Hosting-Optionen">
        <Ul>
          <Li><strong>Lovable Cloud</strong> (Standard): Auto-Deploy bei jedem Git-Push, eigene Subdomain</Li>
          <Li><strong>Vercel</strong>: Frontend-Hosting (build → static)</Li>
          <Li><strong>Self-Hosting</strong>: Nginx + Self-hosted Supabase möglich (Custom Domain pdf.anzeige.ai)</Li>
          <Li><strong>Custom Domain</strong>: aktuell <code>pdf.anzeige.ai</code></Li>
        </Ul>
      </SubSection>
      <SubSection title="CI/CD">
        <Ul>
          <Li>Git-Push → Lovable Build → Vite Production-Build → CDN</Li>
          <Li>Edge Functions: parallel automatisches Deployment</Li>
          <Li>Migrations: in <code>supabase/migrations/</code> versioniert, auto-applied</Li>
        </Ul>
      </SubSection>
    </Section>

    {/* 31. Diagrams */}
    <Section id="s31" title="31. Datenfluss-Diagramme">
      <SubSection title="Remastering-Flow">
        <CodeBlock>{`User uploadet Foto
  → uploadToGeminiFiles() → File API URI
  → invokeRemasterVehicleImage({ mainImageFileUri, logo, showroom })
  → Edge Fn: remaster-vehicle-image
     → getSecret('GEMINI_API_KEY')
     → Prompt aus DB-Blöcken zusammenbauen
     → Gemini Image API (mit URI-Referenzen)
     → Reference Truth Validation
     → Storage upload (vehicle-images/{user_id}/...)
     → image_generation_jobs.status = 'done'
  → Realtime → PipelineContext → UI Update`}</CodeBlock>
      </SubSection>
      <SubSection title="Stripe-Webhook-Flow">
        <CodeBlock>{`Stripe Event → stripe-webhook (verify_jwt=false)
  → Signature-Verify (STRIPE_WEBHOOK_SECRET)
  → Switch event.type:
      checkout.session.completed → user_subscriptions, credit_balances
      invoice.paid               → renew period
      customer.subscription.deleted → tier=free
      payment_intent.succeeded   → credit_transactions
  → 200 OK`}</CodeBlock>
      </SubSection>
    </Section>

    {/* 32. Capacitor */}
    <Section id="s32" title="32. Capacitor-Migration (Native iOS/Android)">
      <P>Ziel: Aus dem React-SPA eine vollwertige native App für App Store / Play Store machen — mit voller Kamera-,
      Push-, Sensor- und Filesystem-Anbindung.</P>
      <SubSection title="Schritt 1 — Capacitor installieren">
        <CodeBlock>{`npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
# App ID:   app.lovable.d0378f2619eb41aabdb271a61d174614
# App Name: drive-sell-page`}</CodeBlock>
      </SubSection>
      <SubSection title="Schritt 2 — capacitor.config.ts">
        <CodeBlock>{`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d0378f2619eb41aabdb271a61d174614',
  appName: 'drive-sell-page',
  webDir: 'dist',
  server: {
    url: 'https://d0378f26-19eb-41aa-bdb2-71a61d174614.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};
export default config;`}</CodeBlock>
        <P>Der <code>server.url</code> erlaubt Hot-Reload während Entwicklung. Für Production-Build entfernen!</P>
      </SubSection>
      <SubSection title="Schritt 3 — Plattformen hinzufügen (lokal)">
        <CodeBlock>{`# Nach Export zu eigenem GitHub + git pull:
npm install
npx cap add ios       # benötigt Xcode (macOS)
npx cap add android   # benötigt Android Studio
npm run build
npx cap sync
npx cap run ios       # oder: npx cap run android`}</CodeBlock>
      </SubSection>
      <SubSection title="Schritt 4 — Native Plugins empfohlen">
        <Table
          headers={['Plugin', 'Verwendung in Autohaus.AI']}
          rows={[
            ['@capacitor/camera', 'Foto-Upload für Remastering, 360°-Spin, VIN-OCR'],
            ['@capacitor/filesystem', 'Lokales Speichern von Videos/HTML-Exports'],
            ['@capacitor/share', 'Banner/Landing-Page über native Share-Sheet teilen'],
            ['@capacitor/push-notifications', 'Job-Fertig-Notifications, neue Leads, CRM-Updates'],
            ['@capacitor/network', 'Offline-Detection für Pipeline-Resilience'],
            ['@capacitor/app', 'Deep-Linking (QR-Login, /vehicle/:id)'],
            ['@capacitor/preferences', 'Sichere lokale Konfiguration'],
            ['@capacitor/browser', 'In-App-Browser für Stripe-Checkout'],
          ]}
        />
      </SubSection>
      <SubSection title="Schritt 5 — Code-Anpassungen">
        <Ul>
          <Li><strong>Datei-Upload</strong>: <code>ImageCaptureGrid</code> / <code>PDFUpload</code> auf Capacitor-Camera/Filesystem umstellen mit Web-Fallback</Li>
          <Li><strong>Deep-Links</strong>: Universal Links (iOS) + App Links (Android) für <code>/vehicle/:id</code>, <code>/qr-login</code></Li>
          <Li><strong>Stripe</strong>: über In-App-Browser (verboten in iOS Native — Apple verlangt In-App-Purchases für digitale Güter; ggf. Web-only-Checkout via externer Browser)</Li>
          <Li><strong>OAuth</strong>: Custom URL Scheme für Google-OAuth-Redirect konfigurieren</Li>
          <Li><strong>Auth-Persistenz</strong>: <code>@capacitor/preferences</code> statt <code>localStorage</code> erwägen</Li>
          <Li><strong>Video-Download</strong>: Filesystem-API statt Blob-Trigger</Li>
          <Li><strong>Service Worker</strong>: deaktivieren auf Native (Capacitor verwendet eigenes WebView)</Li>
          <Li><strong>Safe Area</strong>: <code>env(safe-area-inset-*)</code> in CSS für Notch/Statusbar</Li>
        </Ul>
      </SubSection>
      <SubSection title="Schritt 6 — Veröffentlichung">
        <Ul>
          <Li>iOS: Apple Developer Account (99 USD/Jahr) + App Store Connect</Li>
          <Li>Android: Google Play Developer (25 USD einmalig) + Play Console</Li>
          <Li>Privacy-Policy &amp; AGB Pflicht (Lead-Capture, KI-Bildverarbeitung deklarieren)</Li>
          <Li>App-Store-Review: digitale Güter (Credits) NUR via Apple-IAP — Stripe nur außerhalb der App</Li>
        </Ul>
      </SubSection>
      <SubSection title="Achtung: Apple-Restriktionen">
        <P>Da Autohaus.AI Credits verkauft, ist die Stripe-Integration im iOS-Build kritisch.
        Variante A: nur B2B-App ohne In-App-Purchase (Käufe rein über Web). Variante B: parallele Apple-IAP-Integration
        mit eigenem SKU-Mapping zu Credit-Packs.</P>
      </SubSection>
    </Section>

    {/* 33. Constraints */}
    <Section id="s33" title="33. Bekannte Constraints & Pinnings">
      <Ul>
        <Li><strong>Vite Dev-Port</strong>: ZWINGEND 8080 (Lovable Preview-Env)</Li>
        <Li><strong>Radix UI gepinnt</strong>: <code>dropdown-menu@2.0.6</code>, <code>select@2.0.0</code></Li>
        <Li><strong>React Query</strong>: <code>@tanstack/react-query@5.56.2</code> (Upgrades brechen Pipeline-Context)</Li>
        <Li><strong>CSS @import</strong> muss VOR <code>@tailwind</code>-Direktiven stehen — sonst Whitescreen</Li>
        <Li><strong>Edge Function Auth</strong>: IMMER <code>sb.auth.getClaims(token)</code>, NIE <code>getUser()</code></Li>
        <Li><strong>Stripe Edge Fns</strong>: max. 4 Expansion-Levels</Li>
        <Li><strong>Gemini Image API</strong>: kein <code>aspectRatio</code></Li>
        <Li><strong>Logos</strong>: nur aktuelle Versionen aus DB</Li>
        <Li><strong>File-API-First</strong>: nie große Base64-Payloads zu Edge Fns</Li>
        <Li><strong>Auto-generierte Dateien</strong>: <code>client.ts</code>, <code>types.ts</code>, <code>.env</code> niemals editieren</Li>
      </Ul>
    </Section>

    {/* 34. Roadmap */}
    <Section id="s34" title="34. Roadmap & Verbesserungen">
      <Ul>
        <Li>Native Apps (Capacitor) für iOS &amp; Android</Li>
        <Li>Push-Notifications für Job-Completion &amp; Leads</Li>
        <Li>Offline-Modus für Foto-Upload (Queue + Sync)</Li>
        <Li>Erweiterte Sales-Analytics (Funnel, Cohort)</Li>
        <Li>Multi-Sprache (DE/EN/PL/FR) für Landing-Pages</Li>
        <Li>AR-Vorschau (USDZ/GLB) für 360°-Modelle</Li>
        <Li>Voice-Commands im Sales Assistant</Li>
        <Li>Erweiterte Prompt-Versionierung (A/B-Tests)</Li>
      </Ul>
    </Section>

    {/* 35. Glossar */}
    <Section id="s35" title="35. Glossar">
      <Table
        headers={['Begriff', 'Bedeutung']}
        rows={[
          ['POA', 'Point Of Arrival — Konzept Arrival/Refinement/Marketing'],
          ['Reference Truth Protocol', 'Regel: KI darf Original-Foto-Inhalte nicht halluzinieren'],
          ['Pkw-EnVKV', 'Deutsche Pflichtangaben-Verordnung für Pkw-Vermarktung'],
          ['WLTP', 'Worldwide harmonised Light vehicles Test Procedure (Verbrauchsmessung)'],
          ['WMI', 'World Manufacturer Identifier (erste 3 Zeichen der VIN)'],
          ['VIN', 'Vehicle Identification Number (17-stellig)'],
          ['RLS', 'Row Level Security (Postgres-Feature)'],
          ['Pre-Padding', 'Bild auf Ziel-Format paddding vor KI-Erweiterung'],
          ['Identity-Lock', 'Gleiches Fahrzeug über alle Frames/Sekunden hinweg'],
          ['Master-Prompt', 'Fest verdrahteter Prompt mit immutable Assets'],
        ]}
      />
    </Section>
  </>
);

// ============================================================================
// CONTENT — ENGLISH
// ============================================================================

const EnContent = () => (
  <>
    <div className="text-center mb-12 print:mb-8 print:pt-16 break-after-page">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 print:hidden">
        <span className="text-3xl font-bold text-primary">A</span>
      </div>
      <h1 className="text-4xl font-bold text-foreground mb-3 print:text-3xl">Autohaus.AI</h1>
      <p className="text-xl text-muted-foreground mb-2 print:text-lg">System &amp; Software Architecture</p>
      <p className="text-sm text-muted-foreground">Version 2.4 · As of May 12, 2026</p>
      <p className="text-sm text-muted-foreground">Full developer documentation for onboarding, Git-based contribution &amp; Capacitor migration</p>

      <div className="mt-12 print:mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Table of Contents</h3>
        <div className="inline-block text-left">
          {[
            '1.  System Overview & Product Vision',
            '2.  Tech Stack & Versions',
            '3.  Repository Layout & Conventions',
            '4.  Local Development Setup',
            '5.  Routing & Page Structure',
            '6.  Frontend Architecture (Components, Hooks, Contexts)',
            '7.  State Management & Pipeline System',
            '8.  Backend Architecture (37 Edge Functions)',
            '9.  Database Architecture (46 Tables)',
            '10. Row-Level Security & Roles',
            '11. Authentication (Email, OAuth, QR-Login)',
            '12. AI Services (Gemini, OpenAI, Veo)',
            '13. File API & Prompt System',
            '14. Storage Buckets & Asset Management',
            '15. Credit System & Stripe Integration',
            '16. Module Overview (Generator Tools)',
            '17. Remastering Pipeline',
            '18. 360° Spin Module',
            '19. Banner Generator',
            '20. Landing Page Generator',
            '21. Video Generator (Veo)',
            '22. PDF Analysis Pipeline',
            '23. Sales Assistant & CRM (7-stage)',
            '24. Email System (Resend)',
            '25. Lead Capture & Auto-Processing',
            '26. External APIs (Stripe, OutVin, Resend)',
            '27. Distribution & Integration (FTP, WordPress, API)',
            '28. Admin System (22 Pages)',
            '29. Security Architecture',
            '30. Deployment & Infrastructure',
            '31. Data Flow Diagrams',
            '32. Capacitor Migration (Native iOS/Android)',
            '33. Known Constraints & Pinnings',
            '34. Roadmap & Improvements',
            '35. Glossary',
          ].map((item, i) => (
            <p key={i} className="text-sm text-muted-foreground py-0.5">{item}</p>
          ))}
        </div>
      </div>
    </div>

    <Section id="e1" title="1. System Overview & Product Vision">
      <P>
        <strong>Autohaus.AI</strong> (internally "AUTO3" – Point Of Arrival) is a mobile-first SaaS platform for
        car dealers. It automates the entire marketing process from the moment a vehicle arrives on the lot until
        the listing goes live: AI-powered showroom remastering of phone photos, 360° spins, ad banners, SEO landing
        pages, AI-generated videos and a fully integrated sales CRM.
      </P>
      <SubSection title="Product Vision (POA concept)">
        <P>The workflow follows three phases:</P>
        <Ul>
          <Li><strong>Arrival</strong> – vehicle arrives, phone photos are taken, VIN recognised, PDF datasheet uploaded.</Li>
          <Li><strong>Refinement</strong> – AI pipeline remasters images, extracts data, generates 360° spin and marketing copy.</Li>
          <Li><strong>Marketing</strong> – banner, landing page, video, FTP upload to Mobile.de / Autoscout24 / WordPress.</Li>
        </Ul>
      </SubSection>
      <SubSection title="Core features">
        <Ul>
          <Li><strong>Vehicle offer pages</strong> generated from PDF offers (Pkw-EnVKV compliant)</Li>
          <Li><strong>Showroom remastering</strong> – phone photo → studio-grade image</Li>
          <Li><strong>360° spins</strong> from 4–8 perspective photos (36 interpolated frames)</Li>
          <Li><strong>SEO landing pages</strong> with tech specs, gallery, lead form</Li>
          <Li><strong>Ad banners</strong> for social media in various formats</Li>
          <Li><strong>AI videos</strong> via Google Veo (8 s, 360° identity-lock)</Li>
          <Li><strong>VIN recognition</strong> via OCR + WMI database fallback</Li>
          <Li><strong>Damage analysis</strong> via AI image comparison</Li>
          <Li><strong>Sales Assistant</strong> – AI CRM with 7-stage pipeline, quotes, trade-in, test-drive booking</Li>
          <Li><strong>QR login</strong> for passwordless authentication via pdf.anzeige.ai</Li>
        </Ul>
      </SubSection>
      <SubSection title="High-level architecture">
        <CodeBlock>{`┌─────────────────────────────────────────────────────────┐
│                 FRONTEND (React SPA)                    │
│  React 18 · Vite 5 · TS 5 · Tailwind v3 · shadcn/ui     │
│  ┌─────────────┬──────────────┬───────────────────────┐ │
│  │ Landing /   │  Generator   │  Dashboard            │ │
│  │ Auth / QR   │  (6 tools)   │  (Projects, CRM, …)   │ │
│  └─────────────┴──────────────┴───────────────────────┘ │
│  Admin (22 pages) · Sales Assistant · Calculators       │
└──────────────────────┬──────────────────────────────────┘
                       │ Supabase JS Client
                       ▼
┌─────────────────────────────────────────────────────────┐
│        LOVABLE CLOUD (Managed Supabase Backend)         │
│  ┌────────────┬──────────────┬─────────────────────┐    │
│  │ PostgreSQL │ Edge         │ Auth                │    │
│  │ 46 tables  │ Functions    │ (Email + Google     │    │
│  │ + RLS      │ (37 Deno TS) │  OAuth + QR)        │    │
│  └────────────┴──────────────┴─────────────────────┘    │
│  Storage (6 buckets) · Realtime · Cron · admin_secrets  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST / streaming
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                       │
│  Google Gemini 2.5/3 (direct, no gateway)                │
│  Google Veo (video)                                      │
│  OpenAI GPT-5 (direct, no gateway)                       │
│  Stripe (payments + subscriptions)                       │
│  Resend (transactional email)                            │
│  OutVin (VIN decoder)                                    │
└─────────────────────────────────────────────────────────┘`}</CodeBlock>
      </SubSection>
    </Section>

    <Section id="e2" title="2. Tech Stack & Versions">
      <SubSection title="Frontend">
        <Table
          headers={['Area', 'Technology', 'Version', 'Purpose']}
          rows={[
            ['Framework', 'React', '18.x', 'UI library, concurrent mode'],
            ['Build', 'Vite', '5.x', 'Dev server (port 8080!) & production build'],
            ['Language', 'TypeScript', '5.x', 'Static typing, strict mode'],
            ['Styling', 'Tailwind CSS', '3.x', 'Utility-first, semantic HSL tokens'],
            ['Components', 'shadcn/ui', '–', 'Radix-based primitives (pinned!)'],
            ['Routing', 'react-router-dom', '6.x', 'SPA routing with lazy loading'],
            ['Data Fetching', '@tanstack/react-query', '5.56.2 (pinned!)', 'Server state + cache'],
            ['Forms', 'react-hook-form + zod', 'current', 'Validation'],
            ['Animation', 'framer-motion / tailwindcss-animate', 'current', 'UI motion'],
            ['Icons', 'lucide-react', 'current', 'SVG icons'],
            ['Charts', 'recharts', 'current', 'Admin dashboards'],
            ['Toast', 'sonner + shadcn/toaster', 'current', 'User feedback'],
          ]}
        />
      </SubSection>
      <SubSection title="Backend / Cloud">
        <Table
          headers={['Area', 'Technology', 'Purpose']}
          rows={[
            ['DB', 'PostgreSQL 15 (Supabase)', '46 tables, RLS, triggers, RPCs'],
            ['Edge Functions', 'Deno + TypeScript', '37 functions, auto-deploy via Lovable'],
            ['Auth', 'Supabase Auth (GoTrue)', 'Email/password, Google OAuth, QR token'],
            ['Storage', 'Supabase Storage (S3)', '6 buckets, object-level RLS'],
            ['Realtime', 'Supabase Realtime', 'Postgres changes for CRM/jobs'],
            ['Secrets', 'admin_secrets table', 'DB-first with 5-min TTL cache, env fallback'],
          ]}
        />
      </SubSection>
      <SubSection title="External APIs">
        <Table
          headers={['Service', 'Model/Product', 'Usage']}
          rows={[
            ['Google Gemini', '2.5-pro / 2.5-flash / 3-pro-image / 3.1-flash-image', 'Text, vision, image gen, editing'],
            ['Google Veo', 'veo-3 / veo-3-fast', '8-second videos (360° lock)'],
            ['OpenAI', 'GPT-5 / 5-mini / 5-nano / 5.2', 'Fallback reasoning, sales chat'],
            ['Stripe', 'Subscriptions + Checkout + Webhooks', 'Subs & credit purchases'],
            ['Resend', 'Email API', 'Auth mails, lead notifications, quotes'],
            ['OutVin', 'VIN decoder', 'Vehicle data from VIN'],
          ]}
        />
        <P>
          <strong>Important:</strong> Gemini and OpenAI are called <em>directly</em> via REST (no Lovable AI Gateway),
          since ungateway-ed API keys are cheaper and offer more control. Keys live in <code>admin_secrets</code>.
        </P>
      </SubSection>
    </Section>

    <Section id="e3" title="3. Repository Layout & Conventions">
      <CodeBlock>{`/
├── public/                       # Static assets
│   ├── images/logos/             # 10+ manufacturer logos (SVG, always current!)
│   ├── data/                     # JSON (tax rates, makes/models)
│   ├── embed.js                  # WordPress/iframe embed script
│   └── robots.txt
├── src/
│   ├── pages/                    # Routes (lazy-loaded in App.tsx)
│   │   └── admin/                # 22 admin pages
│   ├── components/               # ~120 React components
│   │   ├── ui/                   # shadcn primitives
│   │   ├── dashboard/            # Dashboard tabs
│   │   ├── sales/                # Sales/CRM components (15)
│   │   ├── vehicle/              # Vehicle editor
│   │   ├── spin360/              # 360° spin workflow
│   │   ├── preset/               # Preset selection
│   │   └── template-editors/     # Landing-page editors
│   ├── hooks/                    # React hooks (Auth, Credits, Vehicles, …)
│   ├── contexts/                 # PipelineContext, BackgroundTasksContext
│   ├── lib/                      # Pure utilities (no React)
│   │   ├── templates/            # 4 landing-page templates (HTML generators)
│   │   ├── wmi-data/             # VIN WMI lookup tables
│   │   ├── mandatory-disclosure.ts  # Pkw-EnVKV formatter
│   │   ├── remaster-prompt.ts    # Modular prompt blocks
│   │   └── gemini-file-upload.ts # File API wrapper
│   ├── integrations/supabase/    # AUTO-GENERATED, never edit!
│   │   ├── client.ts             # Supabase client
│   │   └── types.ts              # DB types
│   ├── assets/                   # Importable images
│   ├── App.tsx                   # Provider tree + router
│   ├── main.tsx                  # Entry
│   ├── index.css                 # Global styles + design tokens
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml               # Edge-function settings (verify_jwt)
│   ├── functions/
│   │   ├── _shared/              # auth.ts, cors.ts, credits.ts, get-secret.ts
│   │   └── <37 functions>/index.ts
│   └── migrations/               # SQL migrations (versioned)
├── tailwind.config.ts            # Design-system tokens
├── vite.config.ts                # Vite config (port 8080!)
├── package.json
└── .env                          # AUTO-GENERATED (VITE_SUPABASE_*)`}</CodeBlock>
      <SubSection title="Conventions">
        <Ul>
          <Li><strong>Semantic tokens</strong>: never <code>text-white</code>, always <code>text-foreground</code> etc. HSL only.</Li>
          <Li><strong>Lazy loading</strong>: all pages in <code>App.tsx</code> via <code>React.lazy</code>.</Li>
          <Li><strong>File size</strong>: keep components small and focused, prefer new files over 500+-line monoliths.</Li>
          <Li><strong>Never edit</strong>: <code>src/integrations/supabase/client.ts</code>, <code>types.ts</code>, <code>.env</code>.</Li>
          <Li><strong>Imports</strong>: <code>@/</code> aliases <code>src/</code>.</Li>
        </Ul>
      </SubSection>
    </Section>

    <Section id="e4" title="4. Local Development Setup">
      <SubSection title="Prerequisites">
        <Ul>
          <Li>Node.js ≥ 20 (LTS), npm or bun</Li>
          <Li>Git, modern browser (Chrome/Firefox)</Li>
          <Li>Recommended: VS Code with Tailwind IntelliSense &amp; ESLint extension</Li>
        </Ul>
      </SubSection>
      <SubSection title="First-time setup">
        <CodeBlock>{`# 1. Clone the repo
git clone <repo-url> autohaus-ai
cd autohaus-ai

# 2. Install dependencies
npm install     # or: bun install

# 3. Start dev server (MUST be port 8080!)
npm run dev     # http://localhost:8080

# 4. Build & preview
npm run build
npm run preview

# 5. Tests
npm run test    # vitest`}</CodeBlock>
      </SubSection>
      <SubSection title="Key environment variables (auto-populated)">
        <CodeBlock>{`VITE_SUPABASE_URL              # Supabase endpoint
VITE_SUPABASE_PUBLISHABLE_KEY  # Anon key (safe in client)
VITE_SUPABASE_PROJECT_ID       # Project reference`}</CodeBlock>
        <P>All real secrets (Gemini key, OpenAI key, Stripe secret, Resend, OutVin) live in the
        <code> admin_secrets</code> table and are only read by edge functions via <code>getSecret()</code>.</P>
      </SubSection>
    </Section>

    <Section id="e5" title="5. Routing & Page Structure">
      <P>All routes are defined in <code>src/App.tsx</code>, protected routes use <code>&lt;ProtectedRoute&gt;</code>,
      admin routes additionally use <code>&lt;AdminRoute&gt;</code> (checks <code>has_role(uid, 'admin')</code>).</P>
      <Table
        headers={['Route', 'Component', 'Access', 'Purpose']}
        rows={[
          ['/', 'Landing', 'public', 'Marketing home'],
          ['/auth', 'Auth', 'public', 'Login / signup / password reset'],
          ['/qr-login', 'QrLogin', 'public', 'Passwordless login via QR token'],
          ['/generator', 'Index', 'auth', 'ActionHub – tool selection'],
          ['/generator/:tool', 'Index', 'auth', 'Generator workflow (banner, landing, …)'],
          ['/dashboard', 'Dashboard', 'auth', 'Projects, vehicles, CRM, banners, landings'],
          ['/profile', 'Profile', 'auth', 'Profile + dealer data'],
          ['/project/:id', 'ProjectView', 'auth', 'Project details'],
          ['/vehicle/:id', 'VehicleView', 'auth', 'Vehicle editor with tabs'],
          ['/damage-report/:id', 'DamageReportView', 'auth', 'Damage report'],
          ['/leasing-rechner', 'LeasingCalculator', 'auth', '§ 17 PAngV leasing'],
          ['/finanzierungsrechner', 'FinancingCalculator', 'auth', '§ 17 PAngV financing'],
          ['/kfz-steuer-rechner', 'KfzSteuerRechner', 'auth', 'German vehicle tax'],
          ['/pricing', 'Pricing', 'public', 'Plan table + checkout'],
          ['/docs', 'ApiDocs', 'public', 'Public API docs'],
          ['/integrations', 'Integrations', 'auth', 'FTP, WordPress, API keys'],
          ['/sales-assistant', 'SalesAssistant', 'auth', 'AI CRM (10 tabs)'],
          ['/admin/*', 'AdminLayout', 'admin', '22 admin pages (see § 28)'],
          ['/architecture', 'ArchitectureDoc', 'admin', 'This document'],
        ]}
      />
    </Section>

    <Section id="e6" title="6. Frontend Architecture">
      <SubSection title="Provider tree (App.tsx)">
        <CodeBlock>{`<QueryClientProvider>
  <TooltipProvider>
    <Toaster /> <Sonner />
    <BrowserRouter>
      <AuthProvider>             ← user, session, login/signup/signOut
        <PipelineProvider>       ← global pipeline jobs (background)
          <BackgroundTasksProvider>  ← parallel tasks
            <BackgroundPipelineIndicator />
            <BackgroundTasksIndicator />
            <Suspense fallback={<PageLoader/>}>
              <Routes>…</Routes>
            </Suspense>`}</CodeBlock>
      </SubSection>
      <SubSection title="Key hooks">
        <Table
          headers={['Hook', 'Purpose']}
          rows={[
            ['useAuth', 'Current user, session, auth methods'],
            ['useCredits', 'Credit balance + realtime updates'],
            ['useCreditCheck', 'Pre-check if credits are sufficient'],
            ['useSubscription', 'Stripe subscription status + plan tier'],
            ['useModuleAccess', 'Module unlocks (admin-controlled)'],
            ['useVehicles / useVehicleAssets', 'Vehicle lists + images'],
            ['useDashboardData', 'Aggregated stats for dashboard'],
            ['useVinLookup', 'VIN decoder (WMI + OutVin)'],
            ['useDealerBanks', 'Multi-bank selection for finance text'],
            ['useSalesAssistant', 'CRM state, conversations, tasks'],
            ['useVehicleMakes', 'Makes/models from JSON + aliasing'],
            ['usePipelineSafe', 'Pipeline context with crash protection'],
            ['use-mobile', 'Responsive breakpoint detection'],
            ['use-swipe-navigation', 'Touch gestures for galleries'],
          ]}
        />
      </SubSection>
      <SubSection title="Design system">
        <P>Defined in <code>src/index.css</code> + <code>tailwind.config.ts</code>:</P>
        <Ul>
          <Li>Background: <code>hsl(30 15% 95%)</code> (cream)</Li>
          <Li>Foreground: <code>hsl(0 0% 13%)</code> (charcoal)</Li>
          <Li>Accent: petrol blue <code>#174f6b</code></Li>
          <Li>Fonts: Space Grotesk (headings), Manrope/Inter (body) — never serif</Li>
          <Li>No red except warnings</Li>
          <Li>Mobile-first, sidebar only from desktop breakpoint</Li>
          <Li><strong>CSS @import rule:</strong> fonts MUST precede <code>@tailwind</code> — otherwise white screen</Li>
        </Ul>
      </SubSection>
    </Section>

    <Section id="e7" title="7. State Management & Pipeline System">
      <P>Three layers:</P>
      <Ul>
        <Li><strong>Server state</strong>: React Query (caching, refetch, mutations).</Li>
        <Li><strong>UI state</strong>: local <code>useState</code> within components.</Li>
        <Li><strong>Global background state</strong>: <code>PipelineContext</code> + <code>BackgroundTasksContext</code>.</Li>
      </Ul>
      <SubSection title="PipelineContext">
        <P>Manages all long-running AI jobs (remastering, 360°, banner, landing, video) globally so the user can
        navigate the app without losing them. Persisted in <code>image_generation_jobs</code>.</P>
        <P><strong>Important:</strong> always use <code>usePipelineSafe()</code> — prevents crashes when the context
        is not yet mounted.</P>
      </SubSection>
      <SubSection title="Job lifecycle">
        <CodeBlock>{`UI → invokeEdgeFunction()
         ↓
    image_generation_jobs (pending)
         ↓
    Edge function (self-invoking, step-based)
         ↓ (realtime updates)
    PipelineContext / UI
         ↓
    Storage (vehicle-images / banners / landings)
         ↓
    DB update (status = 'done', result_url)`}</CodeBlock>
      </SubSection>
    </Section>

    <Section id="e8" title="8. Backend Architecture — 37 Edge Functions">
      <P>All edge functions reside in <code>supabase/functions/&lt;name&gt;/index.ts</code> and are auto-deployed
      on Git push. <strong>JWT verification:</strong> controlled per function in <code>supabase/config.toml</code>
      (<code>verify_jwt = false</code> for public/webhook).</P>
      <P><strong>Auth requirement:</strong> For authenticated functions ALWAYS use <code>sb.auth.getClaims(token)</code>,
      NEVER <code>getUser()</code> (race conditions).</P>
      <SubSub title="Shared modules (supabase/functions/_shared/)">
        <Ul>
          <Li><code>auth.ts</code> – claims-based user resolution</Li>
          <Li><code>cors.ts</code> – CORS headers for browser calls</Li>
          <Li><code>credits.ts</code> – credit check + deduction</Li>
          <Li><code>get-secret.ts</code> – secret lookup with 5-min cache (admin_secrets → env fallback)</Li>
        </Ul>
      </SubSub>
      <SubSection title="Function inventory">
        <Table
          headers={['Category', 'Function', 'Purpose']}
          rows={[
            ['AI Image', 'remaster-vehicle-image', 'Showroom remastering (Reference Truth Protocol)'],
            ['AI Image', 'generate-vehicle-image', 'Vehicle image generation (hero/pipeline)'],
            ['AI Image', 'generate-banner', 'Banner with pre-padding'],
            ['AI Image', 'generate-landing-page', 'Landing page hero image + HTML'],
            ['AI Image', 'generate-360-spin', '360° frame interpolation'],
            ['AI Image', 'classify-vehicle-images', 'Auto-tagging (front/rear/side/interior)'],
            ['AI Image', 'annotate-damage-image', 'Damage overlay'],
            ['AI Image', 'repair-damage-image', 'Damage retouching'],
            ['AI Video', 'generate-video', 'Veo 8-second video, identity lock'],
            ['AI Analysis', 'analyze-pdf', 'Offer PDF parser (datasheet)'],
            ['AI Analysis', 'analyze-offer-image', 'Screenshot of an offer'],
            ['AI Analysis', 'analyze-damage', 'Damage analysis'],
            ['AI Analysis', 'detect-vehicle-brand', 'Brand detection from photo'],
            ['AI Analysis', 'ocr-vin', 'VIN extraction from photo'],
            ['AI Analysis', 'lookup-vin', 'VIN → vehicle data (OutVin + WMI fallback)'],
            ['Sales', 'sales-chat', 'AI chat in sales assistant'],
            ['Sales', 'generate-sales-response', '10-block modular response'],
            ['Sales', 'ingest-sales-knowledge', 'Knowledge base ingestion (RAG)'],
            ['Sales', 'process-sales-email', 'Inbound/outbound email routing'],
            ['Sales', 'auto-process-lead', 'Lead classification + auto reply'],
            ['Sales', 'seed-crm-demo', 'Demo data for CRM'],
            ['Auth', 'verify-qr-token', 'QR login token validation'],
            ['Auth', 'generate-magic-link', 'Magic-link generation'],
            ['Stripe', 'create-checkout', 'Create checkout session'],
            ['Stripe', 'customer-portal', 'Stripe customer portal link'],
            ['Stripe', 'buy-credits', 'Credit pack purchase'],
            ['Stripe', 'check-credits', 'Balance query'],
            ['Stripe', 'stripe-webhook', 'Webhooks (subscription, payment, refund)'],
            ['Stripe', 'admin-stripe', 'Admin operations (max 4 expansion levels!)'],
            ['Lead', 'submit-lead', 'Public lead submission from landing'],
            ['Storage', 'upload-pipeline-images', 'Batch upload with fingerprinting'],
            ['Storage', 'upload-to-gemini-files', 'Gemini File API upload (File-API-first!)'],
            ['Storage', 'migrate-base64-images', 'Legacy base64 → storage'],
            ['Storage', 'cleanup-orphaned-storage', 'Cleanup cron'],
            ['Distribution', 'ftp-upload', 'Upload to Mobile.de / Autoscout24 FTP'],
            ['Distribution', 'api-vehicles', 'Public REST API for vehicles'],
            ['Admin', 'admin-delete-user', 'User hard-delete with cascading'],
          ]}
        />
      </SubSection>
    </Section>

    <Section id="e9" title="9. Database Architecture — 46 Tables">
      <SubSection title="Core domains">
        <Table
          headers={['Domain', 'Tables']}
          rows={[
            ['Users & Auth', 'profiles, user_roles, user_module_access, user_subscriptions, qr_login_tokens'],
            ['Vehicles', 'vehicles, projects, project_images, presets, preset_placeholders, placeholder_definitions'],
            ['AI Jobs', 'image_generation_jobs, pipeline_timing_logs, spin360_jobs, spin360_source_images, spin360_canonical_images, spin360_generated_frames'],
            ['Damage', 'damage_reports'],
            ['Sales / CRM', 'sales_assistant_conversations, sales_assistant_messages, sales_assistant_profiles, sales_assistant_tasks, sales_chat_messages, sales_email_outbox, sales_knowledge_documents, sales_knowledge_chunks, sales_notifications, sales_quotes, conversation_stage_log, crm_manual_notes, customer_journey_templates'],
            ['Appointments', 'test_drive_bookings, dealer_availability, dealer_blocked_dates, calendar_sync_configs'],
            ['Trade-in', 'trade_in_valuations'],
            ['Leads', 'leads'],
            ['Credits & Pricing', 'credit_balances, credit_transactions, subscription_plans'],
            ['Configuration', 'admin_secrets, admin_settings, dealer_banks, ftp_configs, ftp_configs_safe, sample_pdfs'],
          ]}
        />
      </SubSection>
      <SubSection title="Key relationships">
        <CodeBlock>{`auth.users (Supabase) ──┬─→ profiles (1:1, FK user_id)
                        ├─→ user_roles  (1:n, app_role enum)
                        ├─→ user_module_access (1:n)
                        ├─→ user_subscriptions (1:1)
                        ├─→ credit_balances    (1:1)
                        ├─→ projects (1:n) ──→ vehicles (1:n)
                        │                           └─→ project_images (1:n)
                        │                           └─→ damage_reports
                        │                           └─→ spin360_jobs
                        ├─→ image_generation_jobs (1:n)
                        ├─→ sales_assistant_conversations
                        └─→ leads (1:n via owner)`}</CodeBlock>
      </SubSection>
      <SubSection title="Important enums & triggers">
        <Ul>
          <Li><code>app_role</code> – <code>admin | moderator | user</code></Li>
          <Li><code>has_role(uid, role)</code> – SECURITY DEFINER function used in RLS</Li>
          <Li>Trigger <code>handle_new_user</code> auto-creates profile + credit balance on signup</Li>
          <Li>Validation triggers instead of CHECK constraints (due to immutability)</Li>
        </Ul>
      </SubSection>
    </Section>

    <Section id="e10" title="10. Row-Level Security & Roles">
      <P><strong>Required:</strong> roles stored in <code>user_roles</code>, NEVER on <code>profiles</code>
      (privilege-escalation risk). Checked via SECURITY DEFINER function <code>has_role()</code> to avoid RLS recursion.</P>
      <SubSection title="Standard RLS pattern">
        <CodeBlock>{`-- User-owned data
CREATE POLICY "users own data" ON public.vehicles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin override
CREATE POLICY "admins all data" ON public.vehicles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));`}</CodeBlock>
      </SubSection>
      <SubSection title="Security-invoker views">
        <P>Views use <code>security_invoker = true</code> so caller RLS applies (not creator). Example:
        <code> ftp_configs_safe</code>.</P>
      </SubSection>
    </Section>

    <Section id="e11" title="11. Authentication">
      <SubSection title="Methods">
        <Ul>
          <Li><strong>Email + password</strong> with mandatory verification (no auto-confirm in production!)</Li>
          <Li><strong>Google OAuth</strong> – standard connector</Li>
          <Li><strong>QR login</strong> – passwordless via pdf.anzeige.ai (see <code>generate-magic-link</code> + <code>verify-qr-token</code>)</Li>
        </Ul>
      </SubSection>
      <SubSection title="Session management">
        <P>Supabase client persists session in <code>localStorage</code>, auto-refresh-token enabled. On email
        verification, <code>ProtectedRoute</code> shows a confirmation prompt before granting access.</P>
      </SubSection>
      <SubSection title="QR login flow">
        <CodeBlock>{`pdf.anzeige.ai (external)
   → generate-magic-link (edge fn)
   → qr_login_tokens table (short-lived)
   → user scans QR
   → /qr-login?token=…
   → verify-qr-token edge fn
   → session established via supabase.auth.setSession()`}</CodeBlock>
      </SubSection>
    </Section>

    <Section id="e12" title="12. AI Services (Gemini, OpenAI, Veo)">
      <SubSection title="Model routing (strict tier-engine binding)">
        <Table
          headers={['Tier', 'Use case', 'Model']}
          rows={[
            ['Pro', 'Hero images, complex reasoning', 'gemini-2.5-pro / gemini-3.1-pro-preview'],
            ['Flash', 'Pipeline images, banner', 'gemini-2.5-flash / gemini-3-flash-preview'],
            ['Lite', 'Classification, tagging', 'gemini-2.5-flash-lite'],
            ['Image', 'Image generation & editing', 'gemini-3-pro-image-preview / gemini-3.1-flash-image-preview'],
            ['Video', 'Showroom videos', 'Google Veo 3 (Pro & Fast)'],
            ['Reasoning (Sales)', 'Chat, sales replies', 'gpt-5 / gpt-5-mini / gpt-5.2'],
          ]}
        />
        <P><strong>Constraint:</strong> cross-engine fallback is forbidden — video stays Veo, pipeline images stay within the same family.</P>
      </SubSection>
      <SubSection title="Resilience strategy">
        <Ul>
          <Li>Retry with exponential backoff (3 attempts)</Li>
          <Li>Multi-stage JSON repair (truncation, missing brackets, escaped strings)</Li>
          <Li>Tier downgrade within same engine (Pro → Flash) as last resort</Li>
        </Ul>
      </SubSection>
      <SubSection title="API constraints">
        <Ul>
          <Li>Gemini image API does <strong>not</strong> support <code>aspectRatio</code> in <code>generationConfig</code></Li>
          <Li>Stripe edge functions: max <strong>4 expansion levels</strong></Li>
          <Li>Models &amp; pricing centralised in <code>src/lib/cost-utils.ts</code> &amp; admin pricing</Li>
        </Ul>
      </SubSection>
    </Section>

    <Section id="e13" title="13. File API & Prompt System">
      <SubSection title="File-API-first (required)">
        <P>Images/PDFs are NEVER sent as base64 to edge functions — always uploaded via Gemini File API:</P>
        <CodeBlock>{`// Frontend
import { uploadToGeminiFiles } from '@/lib/gemini-file-upload';
const { uri, mimeType } = await uploadToGeminiFiles(file);

// Edge function only receives the URI
{ mainImageFileUri: { uri, mimeType }, additionalFileUris: [...] }`}</CodeBlock>
        <P>Base64 only as fallback if File API fails.</P>
      </SubSection>
      <SubSection title="Modular prompt system">
        <P>Prompts are assembled from DB blocks (Admin → Prompts). Edge function reads dynamic blocks; on failure, a
        default prompt from <code>src/lib/remaster-prompt-defaults.ts</code> kicks in.</P>
        <P><strong>Master prompt system</strong>: immutable assets (showroom backgrounds, manufacturer logos) are hard-wired
        and never AI-hallucinated (<strong>Reference Truth Protocol</strong>).</P>
      </SubSection>
    </Section>

    <Section id="e14" title="14. Storage Buckets & Asset Management">
      <Table
        headers={['Bucket', 'Public?', 'Content', 'RLS']}
        rows={[
          ['vehicle-images', 'public', 'Originals + remastered + gallery', 'INSERT/UPDATE/SELECT for owner; UPDATE policy required for upsert'],
          ['banners', 'public', 'Generated ad banners', 'owner'],
          ['landings', 'public', 'Landing-page assets (HTML+hero)', 'owner'],
          ['videos', 'public', 'Veo-generated videos', 'owner'],
          ['pdfs', 'private', 'Uploaded offer PDFs', 'owner-only'],
          ['logos', 'public', 'Dealer logos', 'owner'],
        ]}
      />
      <P><strong>Logo rule:</strong> manufacturer logos ALWAYS from the logo DB / <code>public/images/logos/</code>
      (via <code>getLogoForMake</code>) — never historical versions (e.g. VW: only flat-blue post-2019).</P>
    </Section>

    <Section id="e15" title="15. Credit System & Stripe Integration">
      <SubSection title="Credit logic">
        <Ul>
          <Li>Every AI job consumes credits — pricing in <code>subscription_plans</code> &amp; admin pricing</Li>
          <Li>Dynamic tier-based pricing: Pro &gt; Flash &gt; Lite (based on model cost)</Li>
          <Li>Pre-check via <code>useCreditCheck</code>, atomic deduction in <code>check-credits</code>/edge fn</Li>
          <Li>Logged in <code>credit_transactions</code> with job-id reference</Li>
        </Ul>
      </SubSection>
      <SubSection title="Stripe flows">
        <Ul>
          <Li><strong>Subscription</strong>: <code>create-checkout</code> → Stripe Checkout → webhook → <code>user_subscriptions</code></Li>
          <Li><strong>Credit pack</strong>: <code>buy-credits</code> → one-time payment → webhook → <code>credit_balances</code></Li>
          <Li><strong>Management</strong>: <code>customer-portal</code> opens Stripe portal</Li>
          <Li><strong>Webhooks</strong>: <code>stripe-webhook</code> (verify_jwt=false) handles all events</Li>
        </Ul>
      </SubSection>
    </Section>

    <Section id="e16" title="16. Module Overview (Generator Tools)">
      <Table
        headers={['Module', 'Route', 'Description']}
        rows={[
          ['Remastering', '/generator/remaster', 'Phone photo → showroom image'],
          ['Banner', '/generator/banner', 'Ad banner with pre-padding'],
          ['Landing page', '/generator/landing', 'SEO landing from PDF or manual'],
          ['360° spin', '/generator/spin360', '4–8 photos → 36-frame spin'],
          ['Video', '/generator/video', 'Veo video with identity lock'],
          ['Damage analysis', '/generator/damage', 'AI-based damage detection'],
        ]}
      />
    </Section>

    <Section id="e17" title="17. Remastering Pipeline">
      <P>Edge fn <code>remaster-vehicle-image</code> with <strong>Reference Truth Protocol</strong>:</P>
      <Ul>
        <Li>Original photo = ground truth (no hallucination of wheels, colours, badges)</Li>
        <Li>Logo injected via canvas PNG preprocessing (transparency cleanup)</Li>
        <Li>License plate: either remove or reproduce 1:1 (see plate rule)</Li>
        <Li>Interior remastering: empty car (no passengers), structural integrity preserved</Li>
        <Li>Smart routing by keywords: <em>rear</em>, <em>side</em>, <em>interior</em> → different reference image sets</Li>
      </Ul>
    </Section>

    <Section id="e18" title="18. 360° Spin Module">
      <Ul>
        <Li>Upload modes: 4/6/8 perspectives OR video frame extraction (canvas + start-flicker pixel scan)</Li>
        <Li><code>generate-360-spin</code> interpolates to 36 frames</Li>
        <Li>Identity lock: identical vehicle across all frames</Li>
        <Li>Cascading delete when vehicle is removed</Li>
        <Li>Viewer: <code>Spin360Viewer</code> (touch + mouse + auto-spin)</Li>
      </Ul>
    </Section>

    <Section id="e19" title="19. Banner Generator">
      <P>Pre-padding logic: input image is padded to target format FIRST (no inner blur), then AI extends the edges.
      Legal text (Pkw-EnVKV) injected automatically via <code>formatMandatoryDisclosure()</code>.</P>
      <P>Layout rules, bank selection (multi-bank), and logo placement are fixed components.</P>
    </Section>

    <Section id="e20" title="20. Landing Page Generator">
      <Ul>
        <Li>4 templates: <code>autohaus</code>, <code>modern</code>, <code>klassisch</code>, <code>minimalist</code></Li>
        <Li>Dual-prompt strategy: text (specs/SEO) + image (hero)</Li>
        <Li>Live preview mode: edit vs. preview via real-time iframe injection</Li>
        <Li>Helpful-content LP v6 with layouts &amp; SEO constraints</Li>
        <Li>HTML export: lightweight OR offline WebP base64</Li>
        <Li>Lead-capture form integrated, self-profiling</Li>
        <Li>Split-screen design with gradient overlay</Li>
        <Li>Image scale: 30% (compact) vs 40–50% (hero) per layout</Li>
      </Ul>
    </Section>

    <Section id="e21" title="21. Video Generator (Veo)">
      <P>Google Veo 3 generates 8-second 360° videos with identity-lock logic. Tier routing: Veo-Pro (quality) vs.
      Veo-Fast (speed). Polling via <code>generate-video</code> with step-based self-invocation.</P>
      <P>Mobile download via blob trigger (prevents iOS opening in tab).</P>
    </Section>

    <Section id="e22" title="22. PDF Analysis Pipeline">
      <P>Keyword-based logic in <code>analyze-pdf</code>:</P>
      <Ul>
        <Li>Priority: finance type &gt; vehicle status</Li>
        <Li>Validation AI rejects non-vehicle documents</Li>
        <Li>Dealer-data merge: PDF-first, fallback to dealer profile</Li>
        <Li>Pkw-EnVKV-compliant footer with PHEV/combustion/electric variants, CO₂ class A–G, WLTP/DAT filter</Li>
        <Li>Consumption-data logic: tech fallback for missing displacement, PHEV support, 49-piece CO₂ label matrix</Li>
      </Ul>
    </Section>

    <Section id="e23" title="23. Sales Assistant & CRM">
      <SubSection title="10 tabs">
        <P>Generator, Mailbox, History, Knowledge, Quotes, Trade-In, Bookings, Tasks, Journey, CRM.</P>
      </SubSection>
      <SubSection title="CRM pipeline (7 stages)">
        <CodeBlock>{`Lead → Contact → Qualified → Offer → Test Drive → Negotiation → Close`}</CodeBlock>
      </SubSection>
      <Ul>
        <Li>10-block modular prompt architecture for <code>generate-sales-response</code></Li>
        <Li>Trade-in valuation via VIN lookup</Li>
        <Li>Test-drive bookings with availability &amp; blocked-dates management</Li>
        <Li>Inbound email tracking (manual CRM)</Li>
        <Li>Sales quotes with § 17 PAngV compliance</Li>
        <Li>Realtime subscriptions on <code>sales_assistant_messages</code></Li>
      </Ul>
    </Section>

    <Section id="e24" title="24. Email System (Resend)">
      <P>Workflow via <code>process-sales-email</code> + Resend API:</P>
      <Ul>
        <Li>Outbox pattern: <code>sales_email_outbox</code> → worker → Resend → status update</Li>
        <Li>Auth emails via Supabase default or custom domain</Li>
        <Li>Admin email monitor shows delivery status &amp; bounces</Li>
      </Ul>
    </Section>

    <Section id="e25" title="25. Lead Capture & Auto-Processing">
      <Ul>
        <Li><code>submit-lead</code> (public) accepts leads from landing pages</Li>
        <Li><code>auto-process-lead</code> classifies (hot/warm/cold), sends auto-reply, notifies owner</Li>
        <Li>Self-profiling: lead form dynamically asks different fields based on acquisition channel</Li>
      </Ul>
    </Section>

    <Section id="e26" title="26. External APIs">
      <Table
        headers={['Service', 'Auth', 'Endpoint(s)', 'Rate limits']}
        rows={[
          ['Google Gemini', 'API key (admin_secrets)', 'generativelanguage.googleapis.com', 'project-dependent'],
          ['Google Veo', 'API key', 'same endpoint, model selector', 'video queue'],
          ['OpenAI', 'API key', 'api.openai.com/v1', 'TPM/RPM per tier'],
          ['Stripe', 'Secret key', 'api.stripe.com', 'very high'],
          ['Resend', 'API key', 'api.resend.com', '100/s'],
          ['OutVin', 'API key', 'OutVin REST', 'daily limit'],
        ]}
      />
    </Section>

    <Section id="e27" title="27. Distribution & Integration">
      <Ul>
        <Li><strong>FTP upload</strong>: <code>ftp-upload</code> edge fn pushes listings to Mobile.de/Autoscout24</Li>
        <Li><strong>WordPress plugin</strong>: <code>src/lib/wordpress-plugin.ts</code> + <code>public/embed.js</code></Li>
        <Li><strong>Public API</strong>: <code>api-vehicles</code> (REST, JWT-free, API-key gated)</Li>
        <Li><strong>HTML export</strong>: lightweight or offline base64</Li>
      </Ul>
    </Section>

    <Section id="e28" title="28. Admin System (22 Pages)">
      <P>Protected via <code>AdminRoute</code> + <code>has_role(uid, 'admin')</code>. Sidebar groups:</P>
      <Ul>
        <Li><strong>Overview</strong>: Dashboard</Li>
        <Li><strong>Users &amp; Subs</strong>: Users, Transactions, Revenue, Pricing</Li>
        <Li><strong>Content &amp; Data</strong>: Leads, PDF gallery, Logos, WMI codes, Sales Assistant, Prompts, Presets, QR login</Li>
        <Li><strong>Monitoring</strong>: Jobs, Email, Storage, Conversion funnel, Test drives, Pipeline stats</Li>
        <Li><strong>System</strong>: Settings, API keys (admin_secrets), Architecture (this document)</Li>
      </Ul>
    </Section>

    <Section id="e29" title="29. Security Architecture">
      <Ul>
        <Li>RLS enabled on ALL tables, checked via <code>has_role()</code></Li>
        <Li>Security-invoker views over SECURITY DEFINER where possible</Li>
        <Li>No anonymous signups (always email-verify or OAuth)</Li>
        <Li>API keys only in <code>admin_secrets</code> (with audit log)</Li>
        <Li>Rate limiting at edge-function level (Supabase native)</Li>
        <Li>CORS strictly configured in <code>_shared/cors.ts</code></Li>
        <Li>Storage buckets with RLS on object path (<code>user_id/...</code>)</Li>
        <Li>Stripe webhook verifies signatures</Li>
        <Li>No <code>localStorage</code> for admin status — ALWAYS server validation</Li>
      </Ul>
    </Section>

    <Section id="e30" title="30. Deployment & Infrastructure">
      <SubSection title="Hosting options">
        <Ul>
          <Li><strong>Lovable Cloud</strong> (default): auto-deploy on every Git push, own subdomain</Li>
          <Li><strong>Vercel</strong>: frontend hosting (build → static)</Li>
          <Li><strong>Self-hosting</strong>: Nginx + self-hosted Supabase supported (custom domain pdf.anzeige.ai)</Li>
          <Li><strong>Custom domain</strong>: currently <code>pdf.anzeige.ai</code></Li>
        </Ul>
      </SubSection>
      <SubSection title="CI/CD">
        <Ul>
          <Li>Git push → Lovable build → Vite production build → CDN</Li>
          <Li>Edge functions: parallel automatic deployment</Li>
          <Li>Migrations: versioned in <code>supabase/migrations/</code>, auto-applied</Li>
        </Ul>
      </SubSection>
    </Section>

    <Section id="e31" title="31. Data Flow Diagrams">
      <SubSection title="Remastering flow">
        <CodeBlock>{`User uploads photo
  → uploadToGeminiFiles() → File API URI
  → invokeRemasterVehicleImage({ mainImageFileUri, logo, showroom })
  → Edge fn: remaster-vehicle-image
     → getSecret('GEMINI_API_KEY')
     → Assemble prompt from DB blocks
     → Gemini Image API (with URI references)
     → Reference Truth validation
     → Storage upload (vehicle-images/{user_id}/...)
     → image_generation_jobs.status = 'done'
  → Realtime → PipelineContext → UI update`}</CodeBlock>
      </SubSection>
      <SubSection title="Stripe webhook flow">
        <CodeBlock>{`Stripe event → stripe-webhook (verify_jwt=false)
  → signature verify (STRIPE_WEBHOOK_SECRET)
  → switch event.type:
      checkout.session.completed → user_subscriptions, credit_balances
      invoice.paid               → renew period
      customer.subscription.deleted → tier=free
      payment_intent.succeeded   → credit_transactions
  → 200 OK`}</CodeBlock>
      </SubSection>
    </Section>

    <Section id="e32" title="32. Capacitor Migration (Native iOS/Android)">
      <P>Goal: turn the React SPA into a full-fledged native app for the App Store / Play Store — with full camera,
      push, sensor and filesystem access.</P>
      <SubSection title="Step 1 — Install Capacitor">
        <CodeBlock>{`npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
# App ID:   app.lovable.d0378f2619eb41aabdb271a61d174614
# App Name: drive-sell-page`}</CodeBlock>
      </SubSection>
      <SubSection title="Step 2 — capacitor.config.ts">
        <CodeBlock>{`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d0378f2619eb41aabdb271a61d174614',
  appName: 'drive-sell-page',
  webDir: 'dist',
  server: {
    url: 'https://d0378f26-19eb-41aa-bdb2-71a61d174614.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};
export default config;`}</CodeBlock>
        <P>The <code>server.url</code> enables hot reload during development. Remove for production build!</P>
      </SubSection>
      <SubSection title="Step 3 — Add platforms (locally)">
        <CodeBlock>{`# After exporting to your own GitHub and git pulling:
npm install
npx cap add ios       # requires Xcode (macOS)
npx cap add android   # requires Android Studio
npm run build
npx cap sync
npx cap run ios       # or: npx cap run android`}</CodeBlock>
      </SubSection>
      <SubSection title="Step 4 — Recommended native plugins">
        <Table
          headers={['Plugin', 'Usage in Autohaus.AI']}
          rows={[
            ['@capacitor/camera', 'Photo upload for remastering, 360° spin, VIN OCR'],
            ['@capacitor/filesystem', 'Local storage of videos/HTML exports'],
            ['@capacitor/share', 'Share banners/landing pages via native share sheet'],
            ['@capacitor/push-notifications', 'Job-done notifications, new leads, CRM updates'],
            ['@capacitor/network', 'Offline detection for pipeline resilience'],
            ['@capacitor/app', 'Deep linking (QR login, /vehicle/:id)'],
            ['@capacitor/preferences', 'Secure local configuration'],
            ['@capacitor/browser', 'In-app browser for Stripe checkout'],
          ]}
        />
      </SubSection>
      <SubSection title="Step 5 — Code changes">
        <Ul>
          <Li><strong>File upload</strong>: switch <code>ImageCaptureGrid</code> / <code>PDFUpload</code> to Capacitor Camera/Filesystem with a web fallback</Li>
          <Li><strong>Deep links</strong>: universal links (iOS) + app links (Android) for <code>/vehicle/:id</code>, <code>/qr-login</code></Li>
          <Li><strong>Stripe</strong>: through in-app browser (forbidden in iOS native — Apple requires in-app purchases for digital goods; consider web-only checkout via external browser)</Li>
          <Li><strong>OAuth</strong>: configure custom URL scheme for Google OAuth redirect</Li>
          <Li><strong>Auth persistence</strong>: consider <code>@capacitor/preferences</code> over <code>localStorage</code></Li>
          <Li><strong>Video download</strong>: filesystem API instead of blob trigger</Li>
          <Li><strong>Service worker</strong>: disable on native (Capacitor uses its own WebView)</Li>
          <Li><strong>Safe area</strong>: <code>env(safe-area-inset-*)</code> in CSS for notch/status bar</Li>
        </Ul>
      </SubSection>
      <SubSection title="Step 6 — Publishing">
        <Ul>
          <Li>iOS: Apple Developer account (USD 99/year) + App Store Connect</Li>
          <Li>Android: Google Play Developer (USD 25 one-time) + Play Console</Li>
          <Li>Privacy policy &amp; T&amp;C mandatory (declare lead capture, AI image processing)</Li>
          <Li>App-store review: digital goods (credits) ONLY via Apple IAP — Stripe only outside the app</Li>
        </Ul>
      </SubSection>
      <SubSection title="Caution: Apple restrictions">
        <P>Since Autohaus.AI sells credits, Stripe integration in the iOS build is critical.
        Option A: B2B-only app without in-app purchase (buying only via web). Option B: parallel Apple IAP integration
        with its own SKU mapping to credit packs.</P>
      </SubSection>
    </Section>

    <Section id="e33" title="33. Known Constraints & Pinnings">
      <Ul>
        <Li><strong>Vite dev port</strong>: MUST be 8080 (Lovable preview env)</Li>
        <Li><strong>Radix UI pinned</strong>: <code>dropdown-menu@2.0.6</code>, <code>select@2.0.0</code></Li>
        <Li><strong>React Query</strong>: <code>@tanstack/react-query@5.56.2</code> (upgrades break pipeline context)</Li>
        <Li><strong>CSS @import</strong> must precede <code>@tailwind</code> directives — otherwise white screen</Li>
        <Li><strong>Edge function auth</strong>: ALWAYS <code>sb.auth.getClaims(token)</code>, NEVER <code>getUser()</code></Li>
        <Li><strong>Stripe edge fns</strong>: max 4 expansion levels</Li>
        <Li><strong>Gemini image API</strong>: no <code>aspectRatio</code></Li>
        <Li><strong>Logos</strong>: only current versions from DB</Li>
        <Li><strong>File-API-first</strong>: never large base64 payloads to edge fns</Li>
        <Li><strong>Auto-generated files</strong>: <code>client.ts</code>, <code>types.ts</code>, <code>.env</code> never edit</Li>
      </Ul>
    </Section>

    <Section id="e34" title="34. Roadmap & Improvements">
      <Ul>
        <Li>Native apps (Capacitor) for iOS &amp; Android</Li>
        <Li>Push notifications for job completion &amp; leads</Li>
        <Li>Offline mode for photo upload (queue + sync)</Li>
        <Li>Extended sales analytics (funnel, cohort)</Li>
        <Li>Multi-language (DE/EN/PL/FR) for landing pages</Li>
        <Li>AR preview (USDZ/GLB) for 360° models</Li>
        <Li>Voice commands in sales assistant</Li>
        <Li>Extended prompt versioning (A/B tests)</Li>
      </Ul>
    </Section>

    <Section id="e35" title="35. Glossary">
      <Table
        headers={['Term', 'Meaning']}
        rows={[
          ['POA', 'Point Of Arrival — Arrival/Refinement/Marketing concept'],
          ['Reference Truth Protocol', 'Rule: AI may not hallucinate beyond original-photo content'],
          ['Pkw-EnVKV', 'German mandatory disclosure regulation for passenger-car marketing'],
          ['WLTP', 'Worldwide harmonised Light vehicles Test Procedure (consumption)'],
          ['WMI', 'World Manufacturer Identifier (first 3 chars of VIN)'],
          ['VIN', 'Vehicle Identification Number (17 chars)'],
          ['RLS', 'Row Level Security (Postgres feature)'],
          ['Pre-padding', 'Padding image to target format before AI extension'],
          ['Identity lock', 'Same vehicle across all frames/seconds'],
          ['Master prompt', 'Hard-wired prompt with immutable assets'],
        ]}
      />
    </Section>
  </>
);

// ============================================================================
// PAGE
// ============================================================================

export default function ArchitectureDoc() {
  const [lang, setLang] = useState<Lang>('de');
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <div className="print:hidden sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Zurück</span>
          </Link>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 mr-2 bg-muted rounded-md p-1">
              <Languages className="w-4 h-4 ml-1 text-muted-foreground" />
              <Button
                size="sm"
                variant={lang === 'de' ? 'default' : 'ghost'}
                onClick={() => setLang('de')}
                className="h-7 px-3 text-xs"
              >
                Deutsch
              </Button>
              <Button
                size="sm"
                variant={lang === 'en' ? 'default' : 'ghost'}
                onClick={() => setLang('en')}
                className="h-7 px-3 text-xs"
              >
                English
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              {lang === 'de' ? 'Drucken' : 'Print'}
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" />
              {lang === 'de' ? 'Als PDF speichern' : 'Save as PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
        {lang === 'de' ? <DeContent /> : <EnContent />}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-center text-xs text-muted-foreground">
          <p>Autohaus.AI · {lang === 'de' ? 'Vertrauliche Architektur-Dokumentation' : 'Confidential architecture documentation'} · v2.4 · {lang === 'de' ? '12. Mai 2026' : 'May 12, 2026'}</p>
        </div>
      </div>
    </div>
  );
}
