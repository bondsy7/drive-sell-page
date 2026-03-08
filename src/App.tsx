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
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminTransactions = lazy(() => import("./pages/admin/AdminTransactions"));
const AdminPrompts = lazy(() => import("./pages/admin/AdminPrompts"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
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
              <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminLayout /></AdminRoute></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="transactions" element={<AdminTransactions />} />
                <Route path="prompts" element={<AdminPrompts />} />
                <Route path="pricing" element={<AdminPricing />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
