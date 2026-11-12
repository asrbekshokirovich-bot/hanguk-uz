import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { LoadingScreen, ProtectedRoute } from './ProtectedRoute';

function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useUserRole();
  if (loading) return <LoadingScreen />;
  // Signed in, but not somebody who runs the system: the home page sends
  // each role to its own place.
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * A page for owners and admins only. Nobody signed in goes to the sign-in
 * page (ProtectedRoute); anybody else signed in goes home.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminGate>{children}</AdminGate>
    </ProtectedRoute>
  );
}
