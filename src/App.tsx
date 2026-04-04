import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { NativeRouterHandler } from "@/components/native/NativeRouterHandler";
import { useEffect } from "react";
import { toast } from "sonner";
import "@/lib/i18n";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import StudentPortal from "./pages/StudentPortal";
import CRMPortal from "./pages/CRMPortal";
import InterviewPractice from "./pages/InterviewPractice";
import StudyPlanTrainer from "./pages/StudyPlanTrainer";
import UniversityStaffPortal from "./pages/UniversityStaffPortal";
import NotFound from "./pages/NotFound";
import SystemMap from "./pages/SystemMap";

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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/install" element={<Install />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/portal" element={<StudentPortal />} />
                <Route path="/interview-practice" element={<ProtectedRoute><InterviewPractice /></ProtectedRoute>} />
                <Route path="/study-plan-trainer" element={<ProtectedRoute><StudyPlanTrainer /></ProtectedRoute>} />
                <Route path="/university-portal" element={<ProtectedRoute><UniversityStaffPortal /></ProtectedRoute>} />
                <Route path="/crm/*" element={<CRMPortal />} />
                <Route path="/system-map" element={<SystemMap />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
          </ErrorBoundary>
        </GlobalErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
