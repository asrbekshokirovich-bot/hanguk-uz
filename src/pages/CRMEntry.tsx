import { IntakeProvider } from '@/contexts/IntakeContext';
import { useUserRole } from '@/hooks/useUserRole';
import CRMPortal from './CRMPortal';
import InvestorPortal from './investor/InvestorPortal';

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

  if (loading) {
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

  if (isInvestor) return <InvestorPortal />;

  return (
    <IntakeProvider>
      <CRMPortal />
    </IntakeProvider>
  );
}
