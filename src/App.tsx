import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const Landing = lazy(() => import("./pages/Landing"));
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const ProjectView = lazy(() => import("./pages/ProjectView"));
const LeasingCalculator = lazy(() => import("./pages/LeasingCalculator"));
const FinancingCalculator = lazy(() => import("./pages/FinancingCalculator"));
const KfzSteuerRechner = lazy(() => import("./pages/KfzSteuerRechner"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Integrations = lazy(() => import("./pages/Integrations"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ArchitectureDoc = lazy(() => import("./pages/ArchitectureDoc"));
const SalesAssistant = lazy(() => import("./pages/SalesAssistant"));

// Admin pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminTransactions = lazy(() => import("./pages/admin/AdminTransactions"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminPdfGallery = lazy(() => import("./pages/admin/AdminPdfGallery"));
const AdminPrompts = lazy(() => import("./pages/admin/AdminPrompts"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminLogos = lazy(() => import("./pages/admin/AdminLogos"));
const AdminSalesAssistant = lazy(() => import("./pages/admin/AdminSalesAssistant"));
const AdminRoute = lazy(() => import("./components/AdminRoute"));

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/generator" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/project/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
              <Route path="/leasing-rechner" element={<ProtectedRoute><LeasingCalculator /></ProtectedRoute>} />
              <Route path="/finanzierungsrechner" element={<ProtectedRoute><FinancingCalculator /></ProtectedRoute>} />
              <Route path="/kfz-steuer-rechner" element={<ProtectedRoute><KfzSteuerRechner /></ProtectedRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/docs" element={<ApiDocs />} />
              <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/sales-assistant" element={<ProtectedRoute><SalesAssistant /></ProtectedRoute>} />
              <Route path="/sales-assistant/:id" element={<ProtectedRoute><SalesAssistant /></ProtectedRoute>} />
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
              </Route>
              <Route path="/architecture" element={<ProtectedRoute><AdminRoute><ArchitectureDoc /></AdminRoute></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
