import { lazy, Suspense } from 'react';
import { IntakeProvider } from '@/contexts/IntakeContext';
import { useUserRole } from '@/hooks/useUserRole';

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
  const { isInvestor, loading } = useUserRole();

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
