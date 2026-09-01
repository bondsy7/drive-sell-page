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

// Retry lazy chunk loads once after a hard reload (stale chunk after deploy)
const RELOAD_KEY = "chunk-reload-ts";
function lazyWithReload<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>
) {
  return lazy(() =>
    factory().catch((err) => {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return new Promise<T>(() => {});
      }
      throw err;
    })
  );
}

const Landing = lazyWithReload(() => import("./pages/Landing"));
const Index = lazyWithReload(() => import("./pages/Index"));
const Auth = lazyWithReload(() => import("./pages/Auth"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Profile = lazyWithReload(() => import("./pages/Profile"));
const ProjectView = lazyWithReload(() => import("./pages/ProjectView"));
const VehicleView = lazyWithReload(() => import("./pages/VehicleView"));
const DamageReportView = lazyWithReload(() => import("./pages/DamageReportView"));
const LeasingCalculator = lazyWithReload(() => import("./pages/LeasingCalculator"));
const FinancingCalculator = lazyWithReload(() => import("./pages/FinancingCalculator"));
const KfzSteuerRechner = lazyWithReload(() => import("./pages/KfzSteuerRechner"));
const Pricing = lazyWithReload(() => import("./pages/Pricing"));
const CreditRechner = lazyWithReload(() => import("./pages/CreditRechner"));
const Integrations = lazyWithReload(() => import("./pages/Integrations"));
const ApiDocs = lazyWithReload(() => import("./pages/ApiDocs"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const ArchitectureDoc = lazyWithReload(() => import("./pages/ArchitectureDoc"));
const SalesAssistant = lazyWithReload(() => import("./pages/SalesAssistant"));
const QrLogin = lazyWithReload(() => import("./pages/QrLogin"));
const CanvasBannerStudio = lazyWithReload(() => import("./pages/CanvasBannerStudio"));
const MusicStudio = lazyWithReload(() => import("./pages/MusicStudio"));

// Admin pages
const AdminLayout = lazyWithReload(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazyWithReload(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazyWithReload(() => import("./pages/admin/AdminUsers"));
const AdminTransactions = lazyWithReload(() => import("./pages/admin/AdminTransactions"));
const AdminLeads = lazyWithReload(() => import("./pages/admin/AdminLeads"));
const AdminPdfGallery = lazyWithReload(() => import("./pages/admin/AdminPdfGallery"));
const AdminPrompts = lazyWithReload(() => import("./pages/admin/AdminPrompts"));
const AdminPricing = lazyWithReload(() => import("./pages/admin/AdminPricing"));
const AdminSettings = lazyWithReload(() => import("./pages/admin/AdminSettings"));
const AdminLogos = lazyWithReload(() => import("./pages/admin/AdminLogos"));
const AdminSalesAssistant = lazyWithReload(() => import("./pages/admin/AdminSalesAssistant"));
const AdminWmiCodes = lazyWithReload(() => import("./pages/admin/AdminWmiCodes"));
const AdminSecrets = lazyWithReload(() => import("./pages/admin/AdminSecrets"));
const AdminPresets = lazyWithReload(() => import("./pages/admin/AdminPresets"));
const AdminJobMonitor = lazyWithReload(() => import("./pages/admin/AdminJobMonitor"));
const AdminEmailMonitor = lazyWithReload(() => import("./pages/admin/AdminEmailMonitor"));
const AdminRevenue = lazyWithReload(() => import("./pages/admin/AdminRevenue"));
const AdminStorage = lazyWithReload(() => import("./pages/admin/AdminStorage"));
const AdminConversionFunnel = lazyWithReload(() => import("./pages/admin/AdminConversionFunnel"));
const AdminTestDrives = lazyWithReload(() => import("./pages/admin/AdminTestDrives"));
const AdminPipelineStats = lazyWithReload(() => import("./pages/admin/AdminPipelineStats"));
const AdminQrLogin = lazyWithReload(() => import("./pages/admin/AdminQrLogin"));
const AdminBannerTemplates = lazyWithReload(() => import("./pages/admin/AdminBannerTemplates"));
const AdminCreditEconomics = lazyWithReload(() => import("./pages/admin/AdminCreditEconomics"));
const AdminCostCalculator = lazyWithReload(() => import("./pages/admin/AdminCostCalculator"));
const AdminReferenceView = lazyWithReload(() => import("./features/reference-v2/phase1/AdminReferenceView"));
import AdminRoute from "./components/AdminRoute";
import KiTransparenz from "./pages/KiTransparenz";

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
  
  return <>{children}</>;
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/qr-login" element={<QrLogin />} />
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
                <Route path="qr-login" element={<AdminQrLogin />} />
                <Route path="banner-templates" element={<AdminBannerTemplates />} />
                <Route path="credit-economics" element={<AdminCreditEconomics />} />
                <Route path="cost-calculator" element={<AdminCostCalculator />} />
                <Route path="reference-v2" element={<AdminReferenceView />} />
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
