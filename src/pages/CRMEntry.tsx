import { lazy, Suspense, useEffect } from 'react';
import { IntakeProvider } from '@/contexts/IntakeContext';
import { useUserRole } from '@/hooks/useUserRole';
import { registerServiceWorker } from '@/lib/serviceWorker';

// Staff never open the investor portal and the investor never opens the CRM:
// each downloads only its own.
const CRMPortal = lazy(() => import('./CRMPortal'));
const InvestorPortal = lazy(() => import('./investor/InvestorPortal'));

function PortalLoading() {
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

/**
 * The /crm/* fork.
 *
 * CRMPortal calls useCRMData() and usePayments() unconditionally at the top of
 * its body, before any of its ~30 view branches. An investor branch inside it
 * would therefore still fire every staff query. The choice has to be made
 * before either portal mounts, which is what this component is for.
 */
export default function CRMEntry() {
  const { isInvestor, isStaff, loading } = useUserRole();

  // The people who work here get the CRM's files kept on their device; a
  // visitor of the public pages does not (src/lib/serviceWorker.ts).
  const worksHere = !loading && (isStaff || isInvestor);
  useEffect(() => {
    if (worksHere) registerServiceWorker();
  }, [worksHere]);

  if (loading) return <PortalLoading />;

  if (isInvestor) {
    return (
      <Suspense fallback={<PortalLoading />}>
        <InvestorPortal />
      </Suspense>
    );
  }

  return (
    <IntakeProvider>
      <Suspense fallback={<PortalLoading />}>
        <CRMPortal />
      </Suspense>
    </IntakeProvider>
  );
}
