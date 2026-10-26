import { isBlockedAccount } from "@/lib/blocked-accounts";
import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PipelineProvider } from "@/contexts/PipelineContext";
import { BackgroundTasksProvider } from "@/contexts/BackgroundTasksContext";
import { MusicJobsProvider } from "@/contexts/MusicJobsContext";
import BackgroundPipelineIndicator from "@/components/BackgroundPipelineIndicator";
import BackgroundTasksIndicator from "@/components/BackgroundTasksIndicator";
import BackgroundMusicIndicator from "@/components/BackgroundMusicIndicator";
import { DownloadLimitProvider } from "@/hooks/useDownloadLimit";
import DownloadGuardBridge from "@/components/DownloadGuardBridge";

/**
 * Lazy-Import mit Selbstheilung: Schlägt das Nachladen eines Moduls fehl
 * (z. B. "Importing a module script failed" nach einem Server-Neustart,
 * wenn der Tab noch alte Chunk-URLs kennt), wird die Seite genau einmal
 * hart neu geladen. Danach greift die normale ErrorBoundary.
 */
const RELOAD_FLAG = "lazy-chunk-reloaded";
function lazyWithRetry<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory().catch((err) => {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Nie auflösen – der Reload übernimmt.
        return new Promise<T>(() => {});
      }
      throw err;
    }),
  );
}
// Reload-Flag nach erfolgreichem App-Start zurücksetzen.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_FLAG), { once: true });
}

const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Produkte = lazyWithRetry(() => import("./pages/Produkte"));
const Referenzen = lazyWithRetry(() => import("./pages/Referenzen"));
const Checkout = lazyWithRetry(() => import("./pages/Checkout"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ProjectView = lazyWithRetry(() => import("./pages/ProjectView"));
const VehicleView = lazyWithRetry(() => import("./pages/VehicleView"));
const DamageReportView = lazyWithRetry(() => import("./pages/DamageReportView"));
const LeasingCalculator = lazyWithRetry(() => import("./pages/LeasingCalculator"));
const FinancingCalculator = lazyWithRetry(() => import("./pages/FinancingCalculator"));
const KfzSteuerRechner = lazyWithRetry(() => import("./pages/KfzSteuerRechner"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const CreditRechner = lazyWithRetry(() => import("./pages/CreditRechner"));
const Integrations = lazyWithRetry(() => import("./pages/Integrations"));
const ApiDocs = lazyWithRetry(() => import("./pages/ApiDocs"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ArchitectureDoc = lazyWithRetry(() => import("./pages/ArchitectureDoc"));
const SalesAssistant = lazyWithRetry(() => import("./pages/SalesAssistant"));
const QrLogin = lazyWithRetry(() => import("./pages/QrLogin"));
const CanvasBannerStudio = lazyWithRetry(() => import("./pages/CanvasBannerStudio"));
const MusicStudio = lazyWithRetry(() => import("./pages/MusicStudio"));

// B2B Paid-Funnel (öffentlich)
const AutohausFahrzeugbilder = lazyWithRetry(() => import("./pages/funnel/AutohausFahrzeugbilder"));
const AutohausMarketing = lazyWithRetry(() => import("./pages/funnel/AutohausMarketing"));
const FahrzeugTesten = lazyWithRetry(() => import("./pages/funnel/FahrzeugTesten"));
const FahrzeugTestenDanke = lazyWithRetry(() => import("./pages/funnel/FahrzeugTestenDanke"));
const StandtageVermeiden = lazyWithRetry(() => import("./pages/funnel/StandtageVermeiden"));
const AutohausWerbemittel = lazyWithRetry(() => import("./pages/funnel/AutohausWerbemittel"));
const AutohausLandingpages = lazyWithRetry(() => import("./pages/funnel/AutohausLandingpages"));
const AutohausVideos = lazyWithRetry(() => import("./pages/funnel/AutohausVideos"));

// Rechtsseiten (öffentlich)
const Impressum = lazyWithRetry(() => import("./pages/legal/Impressum"));
const Datenschutz = lazyWithRetry(() => import("./pages/legal/Datenschutz"));
const Agb = lazyWithRetry(() => import("./pages/legal/Agb"));
const Avv = lazyWithRetry(() => import("./pages/legal/Avv"));
const Toms = lazyWithRetry(() => import("./pages/legal/Toms"));
const Unterauftragsverarbeiter = lazyWithRetry(() => import("./pages/legal/Unterauftragsverarbeiter"));
const Cookies = lazyWithRetry(() => import("./pages/legal/Cookies"));
const Rechtliches = lazyWithRetry(() => import("./pages/legal/Rechtliches"));

// Admin pages
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"));
const AdminTransactions = lazyWithRetry(() => import("./pages/admin/AdminTransactions"));
const AdminLeads = lazyWithRetry(() => import("./pages/admin/AdminLeads"));
const AdminPdfGallery = lazyWithRetry(() => import("./pages/admin/AdminPdfGallery"));
const AdminPrompts = lazyWithRetry(() => import("./pages/admin/AdminPrompts"));
const AdminPricing = lazyWithRetry(() => import("./pages/admin/AdminPricing"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"));
const AdminLogos = lazyWithRetry(() => import("./pages/admin/AdminLogos"));
const AdminSalesAssistant = lazyWithRetry(() => import("./pages/admin/AdminSalesAssistant"));
const AdminWmiCodes = lazyWithRetry(() => import("./pages/admin/AdminWmiCodes"));
const AdminSecrets = lazyWithRetry(() => import("./pages/admin/AdminSecrets"));
const AdminPresets = lazyWithRetry(() => import("./pages/admin/AdminPresets"));
const AdminJobMonitor = lazyWithRetry(() => import("./pages/admin/AdminJobMonitor"));
const AdminEmailMonitor = lazyWithRetry(() => import("./pages/admin/AdminEmailMonitor"));
const AdminRevenue = lazyWithRetry(() => import("./pages/admin/AdminRevenue"));
const AdminStorage = lazyWithRetry(() => import("./pages/admin/AdminStorage"));
const AdminConversionFunnel = lazyWithRetry(() => import("./pages/admin/AdminConversionFunnel"));
const AdminTestDrives = lazyWithRetry(() => import("./pages/admin/AdminTestDrives"));
const AdminPipelineStats = lazyWithRetry(() => import("./pages/admin/AdminPipelineStats"));
const AdminGenerationLogs = lazyWithRetry(() => import("./pages/admin/AdminGenerationLogs"));

const AdminQrLogin = lazyWithRetry(() => import("./pages/admin/AdminQrLogin"));
const AdminBannerTemplates = lazyWithRetry(() => import("./pages/admin/AdminBannerTemplates"));
const AdminCreditEconomics = lazyWithRetry(() => import("./pages/admin/AdminCreditEconomics"));
const AdminB2bLeads = lazyWithRetry(() => import("./pages/admin/AdminB2bLeads"));
const AdminCostCalculator = lazyWithRetry(() => import("./pages/admin/AdminCostCalculator"));
const AdminReferenceView = lazyWithRetry(() => import("./features/reference-v2/phase1/AdminReferenceView"));
const ReferenceWorkspace = lazyWithRetry(() => import("./features/reference-v2/phase4/ReferenceWorkspace"));
import AdminRoute from "./components/AdminRoute";
import KiTransparenz from "./pages/KiTransparenz";
import ConsentManager from "./components/consent/ConsentManager";
import LegalOnboardingGate from "./components/legal/LegalOnboardingGate";
import AccountApprovalGate from "./components/auth/AccountApprovalGate";

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isBlockedAccount(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Zugang gesperrt</h2>
            <p className="text-sm text-muted-foreground">
              Der Zugriff auf dein Konto ist aus Sicherheitsgründen gesperrt. Wenn du einen Zugang benötigst, kontaktiere uns bitte unter{' '}
              <a href="mailto:info@breadcrumb.de" className="text-accent underline">info@breadcrumb.de</a>.
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Access blocked</h2>
            <p className="text-sm text-muted-foreground">
              Access to your account has been blocked for security reasons. If you need access, please contact us at{' '}
              <a href="mailto:info@breadcrumb.de" className="text-accent underline">info@breadcrumb.de</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check email verification
  const emailVerified = user.email_confirmed_at || user.user_metadata?.email_verified;
  if (!emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">E-Mail bestätigen</h2>
          <p className="text-sm text-muted-foreground">
            Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach, um fortzufahren.
          </p>
          <button onClick={() => window.location.reload()} className="text-sm text-accent hover:underline">
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <AccountApprovalGate userId={user.id} email={user.email} fullName={user.user_metadata?.full_name ?? user.user_metadata?.name}>
      <LegalOnboardingGate>{children}</LegalOnboardingGate>
    </AccountApprovalGate>
  );
};


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DownloadLimitProvider>
          <DownloadGuardBridge />
          <PipelineProvider>
          <BackgroundTasksProvider>
          <MusicJobsProvider>
          <BackgroundPipelineIndicator />
          <BackgroundTasksIndicator />
          <BackgroundMusicIndicator />
          <ConsentManager />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary moduleName="Startseite"><Landing /></ErrorBoundary>} />
              <Route path="/produkte" element={<Produkte />} />
              <Route path="/referenzen" element={<Referenzen />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/qr-login" element={<QrLogin />} />
              {/* Öffentlicher B2B-Paid-Funnel */}
              <Route path="/autohaus-fahrzeugbilder" element={<AutohausFahrzeugbilder />} />
              <Route path="/autohaus-marketing" element={<AutohausMarketing />} />
              <Route path="/fahrzeug-testen" element={<FahrzeugTesten />} />
              <Route path="/fahrzeug-testen/danke" element={<FahrzeugTestenDanke />} />
              <Route path="/standtage-vermeiden" element={<StandtageVermeiden />} />
              <Route path="/autohaus-werbemittel" element={<AutohausWerbemittel />} />
              <Route path="/autohaus-landingpages" element={<AutohausLandingpages />} />
              <Route path="/autohaus-videos" element={<AutohausVideos />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/agb" element={<Agb />} />
              <Route path="/avv" element={<Avv />} />
              <Route path="/toms" element={<Toms />} />
              <Route path="/unterauftragsverarbeiter" element={<Unterauftragsverarbeiter />} />
              <Route path="/auftragsverarbeitung" element={<Avv />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/rechtliches" element={<Rechtliches />} />
              <Route path="/generator" element={<ProtectedRoute><ErrorBoundary moduleName="Generator"><Index /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/generator/canvas-banner-studio" element={<ProtectedRoute><ErrorBoundary moduleName="Banner Studio"><CanvasBannerStudio /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/generator/music-studio" element={<ProtectedRoute><ErrorBoundary moduleName="Music Studio"><MusicStudio /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/generator/:tool" element={<ProtectedRoute><ErrorBoundary moduleName="Generator"><Index /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary moduleName="Dashboard"><Dashboard /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/project/:id" element={<ProtectedRoute><ErrorBoundary moduleName="Projekt"><ProjectView /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/vehicle/:id" element={<ProtectedRoute><ErrorBoundary moduleName="Fahrzeug"><VehicleView /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/damage-report/:id" element={<ProtectedRoute><ErrorBoundary moduleName="Schadensbericht"><DamageReportView /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/leasing-rechner" element={<ProtectedRoute><LeasingCalculator /></ProtectedRoute>} />
              <Route path="/finanzierungsrechner" element={<ProtectedRoute><FinancingCalculator /></ProtectedRoute>} />
              <Route path="/kfz-steuer-rechner" element={<ProtectedRoute><KfzSteuerRechner /></ProtectedRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/ki-transparenz" element={<KiTransparenz />} />
              <Route path="/credit-rechner" element={<CreditRechner />} />
              <Route path="/docs" element={<ApiDocs />} />
              <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/sales-assistant" element={<ProtectedRoute><ErrorBoundary moduleName="Sales Assistant"><SalesAssistant /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/sales-assistant/:id" element={<ProtectedRoute><ErrorBoundary moduleName="Sales Assistant"><SalesAssistant /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminLayout /></AdminRoute></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="transactions" element={<AdminTransactions />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="pdf-gallery" element={<AdminPdfGallery />} />
                <Route path="prompts" element={<AdminPrompts />} />
                <Route path="pricing" element={<AdminPricing />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logos" element={<AdminLogos />} />
                <Route path="sales-assistant" element={<AdminSalesAssistant />} />
                <Route path="wmi-codes" element={<AdminWmiCodes />} />
                <Route path="secrets" element={<AdminSecrets />} />
                <Route path="presets" element={<AdminPresets />} />
                <Route path="jobs" element={<AdminJobMonitor />} />
                <Route path="email-monitor" element={<AdminEmailMonitor />} />
                <Route path="revenue" element={<AdminRevenue />} />
                <Route path="storage" element={<AdminStorage />} />
                <Route path="conversion" element={<AdminConversionFunnel />} />
                <Route path="test-drives" element={<AdminTestDrives />} />
                <Route path="pipeline-stats" element={<AdminPipelineStats />} />
                <Route path="generation-logs" element={<AdminGenerationLogs />} />

                <Route path="qr-login" element={<AdminQrLogin />} />
                <Route path="banner-templates" element={<AdminBannerTemplates />} />
                <Route path="credit-economics" element={<AdminCreditEconomics />} />
                <Route path="cost-calculator" element={<AdminCostCalculator />} />
                <Route path="reference-v2" element={<ReferenceWorkspace />} />
                <Route path="reference-v2/technik" element={<AdminReferenceView />} />
                <Route path="b2b-leads" element={<AdminB2bLeads />} />
              </Route>
              <Route path="/architecture" element={<ProtectedRoute><AdminRoute><ArchitectureDoc /></AdminRoute></ProtectedRoute>} />
              <Route path="/sales-assistant/chat" element={<ProtectedRoute><ErrorBoundary moduleName="Sales Assistant"><SalesAssistant /></ErrorBoundary></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </MusicJobsProvider>
          </BackgroundTasksProvider>
          </PipelineProvider>
          </DownloadLimitProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
