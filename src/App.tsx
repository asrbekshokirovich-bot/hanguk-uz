import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { ThemeProvider } from "next-themes";
import { NativeRouterHandler } from "@/components/native/NativeRouterHandler";
import { lazy, Suspense, useEffect } from "react";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { reportClientError } from "@/lib/errorReporter";

import Index from "./pages/Index";
import { StudentDataProvider } from "./contexts/StudentDataContext";

// Every page but the landing is loaded when its route is opened. They used to
// be imported here, so the first visit to hanguk.uz downloaded the whole CRM,
// the investor portal, the charts and the map — one 3.2 MB script (945 KB
// gzipped; 24 s on the office connection on 2026-11-11) — before the landing
// page could draw.
const Auth = lazy(() => import("./pages/Auth"));
const Install = lazy(() => import("./pages/Install"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const IshPrivacy = lazy(() => import("./pages/IshPrivacy"));
const Support = lazy(() => import("./pages/Support"));
const StudentPortal = lazy(() => import("./pages/StudentPortal"));
const SurveyList = lazy(() => import("./pages/SurveyList"));
const SurveyFill = lazy(() => import("./pages/SurveyFill"));
const CRMEntry = lazy(() => import("./pages/CRMEntry"));
const InterviewPractice = lazy(() => import("./pages/InterviewPractice"));
const StudyPlanTrainer = lazy(() => import("./pages/StudyPlanTrainer"));
const UniversityStaffPortal = lazy(() => import("./pages/UniversityStaffPortal"));
const LearningCenterPortal = lazy(() => import("./pages/LearningCenterPortal"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SystemMap = lazy(() => import("./pages/SystemMap"));
const AppLink = lazy(() => import("./pages/AppLink"));

/** What a route shows while its page is on the way — the spinner CRMEntry already uses. */
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
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

      reportClientError("rejection", event.reason);
      toast.error(i18n.t("errorScreen.toast", "Xatolik yuz berdi. Sahifani yangilang."), { duration: 4000 });
    };
    // Errors thrown outside React's render (event handlers, timers): nothing
    // is shown — the page goes on — but they are written down.
    const handleError = (event: ErrorEvent) => {
      reportClientError("error", event.error ?? event.message);
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
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
                  <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/install" element={<Install />} />
                    {/* The operator's link to the student app (app analytics, stage 2). */}
                    <Route path="/l/:code" element={<AppLink />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/privacy-policy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    {/* Hanguk Ish apps: privacy policy linked from Google Play. */}
                    <Route path="/ish/privacy" element={<IshPrivacy />} />
                    {/* Support URL given to App Store Connect and Play (App
                        Review guideline 1.5, 2026-08-07). Must stay public. */}
                    <Route path="/support" element={<Support />} />
                    <Route path="/portal" element={<StudentDataProvider><StudentPortal /></StudentDataProvider>} />
                    {/* Students fill surveys here rather than in the app: the
                        survey screens shipped in 1.0.27 and the store is still
                        on 1.0.26, so a link is the only route that reaches
                        them today. Not wrapped in ProtectedRoute — the page
                        shows its own sign-in prompt so a shared link survives
                        the round trip through /auth. */}
                    <Route path="/surveys" element={<SurveyList />} />
                    <Route path="/surveys/:id" element={<SurveyFill />} />
                    <Route path="/interview-practice" element={<ProtectedRoute><InterviewPractice /></ProtectedRoute>} />
                    <Route path="/study-plan-trainer" element={<ProtectedRoute><StudyPlanTrainer /></ProtectedRoute>} />
                    <Route path="/university-portal" element={<ProtectedRoute><UniversityStaffPortal /></ProtectedRoute>} />
                    {/* Partner learning centers: enter students, who become leads. */}
                    <Route path="/center" element={<ProtectedRoute><LearningCenterPortal /></ProtectedRoute>} />
                    {/* CRMEntry decides between the staff CRM and the investor
                        portal before either mounts, and owns IntakeProvider for
                        the staff branch — an investor session cannot read
                        public.intakes, so that provider must not wrap her. */}
                    <Route path="/crm/*" element={<CRMEntry />} />
                    {/* The platform drawn from the inside (screens, tables, edge
                        functions). Until 2026-11-12 this route — and the two
                        tables behind it — were open to anyone on the internet. */}
                    <Route path="/system-map" element={<AdminRoute><SystemMap /></AdminRoute>} />
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
