import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { NativeRouterHandler } from "@/components/native/NativeRouterHandler";
import { Suspense, lazy, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import "@/lib/i18n";

// Index and NotFound stay eager: Index is the landing route (fastest first paint)
// and NotFound is trivial. Every heavy route below is code-split so visiting the
// landing/login page no longer downloads the CRM, maps, charts and AI modules.
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { StudentDataProvider } from "./contexts/StudentDataContext";
import { IntakeProvider } from "./contexts/IntakeContext";

const Auth = lazy(() => import("./pages/Auth"));
const Install = lazy(() => import("./pages/Install"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const StudentPortal = lazy(() => import("./pages/StudentPortal"));
const CRMPortal = lazy(() => import("./pages/CRMPortal"));
const InterviewPractice = lazy(() => import("./pages/InterviewPractice"));
const StudyPlanTrainer = lazy(() => import("./pages/StudyPlanTrainer"));
const UniversityStaffPortal = lazy(() => import("./pages/UniversityStaffPortal"));
const SystemMap = lazy(() => import("./pages/SystemMap"));

// Full-screen fallback shown while a lazily-loaded route chunk is fetched.
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Global unhandled promise rejection handler to prevent crashes
function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[GlobalErrorBoundary] Unhandled rejection:", event.reason);
      event.preventDefault();

      const message = event.reason?.message || String(event.reason);
      if (message.includes("Should have a queue")) {
        console.warn("[GlobalErrorBoundary] React HMR error detected, refresh may help");
        return;
      }

      toast.error("Xatolik yuz berdi. Sahifani yangilang.", { duration: 4000 });
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return <>{children}</>;
}

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StaffPresenceProvider } from "@/contexts/StaffPresenceContext";
import { MentionNotificationsProvider } from "@/contexts/MentionNotificationsContext";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <GlobalErrorBoundary>
          <ErrorBoundary>
            <Toaster />
            <Sonner position="top-center" />
            <BrowserRouter>
            <NativeRouterHandler />
            <AuthProvider>
              <StaffPresenceProvider>
                <MentionNotificationsProvider>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/portal" element={<StudentDataProvider><StudentPortal /></StudentDataProvider>} />
                      <Route path="/interview-practice" element={<ProtectedRoute><InterviewPractice /></ProtectedRoute>} />
                      <Route path="/study-plan-trainer" element={<ProtectedRoute><StudyPlanTrainer /></ProtectedRoute>} />
                      <Route path="/university-portal" element={<ProtectedRoute><UniversityStaffPortal /></ProtectedRoute>} />
                      <Route path="/crm/*" element={<IntakeProvider><CRMPortal /></IntakeProvider>} />
                      <Route path="/system-map" element={<SystemMap />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </MentionNotificationsProvider>
              </StaffPresenceProvider>
            </AuthProvider>
          </BrowserRouter>
          </ErrorBoundary>
        </GlobalErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
