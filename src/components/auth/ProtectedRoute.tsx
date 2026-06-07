import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Logo } from '@/components/Logo';

// Loading Component
function LoadingScreen() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <Logo className="h-16 w-16" />
        <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
      </div>
    </div>
  );
}

// Redirecting Component
function RedirectingScreen() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo className="h-16 w-16 opacity-50" />
        <p className="text-muted-foreground">{t('auth.redirecting', 'Redirecting to login...')}</p>
      </div>
    </div>
  );
}

// Protected Route Props
interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

// Main Protected Route Component
export function ProtectedRoute({ children, redirectTo = '/auth' }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Show loading screen while checking auth - NEVER return null
  if (loading) {
    return <LoadingScreen />;
  }

  // User not authenticated - show redirect screen briefly then redirect
  if (!user) {
    return (
      <>
        <RedirectingScreen />
        <Navigate to={redirectTo} replace />
      </>
    );
  }

  // User is authenticated - render children with error boundary
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

// Export components for reuse
export { LoadingScreen, RedirectingScreen };
