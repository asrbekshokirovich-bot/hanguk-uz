import type { CSSProperties } from 'react';
import { Bell } from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { useAuth } from '@/contexts/AuthContext';
import { InvestorSeasonProvider, useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import { InvestorSidebar } from '@/components/investor/InvestorSidebar';
import { InvestorSeasonSwitcher } from '@/components/investor/InvestorSeasonSwitcher';
import { useInvestorIdentity, useInvestorUnreadCount } from '@/hooks/useInvestor';
import { relativeTime } from '@/lib/investorFormat';
import InvestorOverview from './screens/InvestorOverview';
import InvestorFinance from './screens/InvestorFinance';
import InvestorApplications from './screens/InvestorApplications';
import InvestorMessages from './screens/InvestorMessages';

const HOME = '/crm/investor/overview';

function InvestorShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { updatedAt } = useInvestorSeason();
  const { data: identity } = useInvestorIdentity();
  const { data: unreadCount = 0 } = useInvestorUnreadCount();

  if (!user) return <Navigate to="/auth" replace />;

  const displayName =
    identity?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Investor';

  return (
    <SidebarProvider
      style={
        { '--sidebar-width': '248px', '--sidebar-width-icon': '72px' } as CSSProperties
      }
    >
      <div className="flex min-h-screen w-full">
        <InvestorSidebar
          displayName={displayName}
          equityPercent={identity?.equity_percent ?? null}
          unreadCount={unreadCount}
          onSignOut={signOut}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 sm:px-6">
            <SidebarTrigger className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] font-bold leading-tight text-foreground">
                Hanguk Consulting
              </div>
              <div className="truncate text-[12px] text-muted-foreground">
                Investor view · updated {relativeTime(updatedAt || Date.now())}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <InvestorSeasonSwitcher className="hidden sm:inline-flex" />
              <ThemeToggleButton />
              <button
                type="button"
                onClick={() => navigate('/crm/investor/messages')}
                aria-label={
                  unreadCount > 0 ? `${unreadCount} unread messages` : 'No unread messages'
                }
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full bg-destructive ring-2 ring-card" />
                )}
              </button>
            </div>
          </header>

          {/* TOKENS.md: page padding 26px 24px 40px, content max-width 1400px. */}
          <main className="flex-1 overflow-auto bg-background px-4 pb-10 pt-5 pb-safe sm:px-6 sm:pt-[26px]">
            <div
              key={location.pathname}
              className="mx-auto max-w-[1400px] animate-fade-up-investor"
            >
              <Routes>
                <Route path="investor/overview" element={<InvestorOverview />} />
                <Route path="investor/finance" element={<InvestorFinance />} />
                <Route path="investor/applications" element={<InvestorApplications />} />
                <Route path="investor/messages" element={<InvestorMessages />} />
                {/* Anywhere else under /crm/* - including /crm itself and every
                    staff route - lands back on Overview. */}
                <Route path="*" element={<Navigate to={HOME} replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

/**
 * The investor half of /crm/*. Mounted by CRMEntry, never by App directly, so
 * that no staff query fires before the role is known.
 *
 * Two things are deliberately absent compared with the staff shell: the
 * intercom (VoiceChannelHeader / SidebarStaffPanel) and HangukAIChat. Both are
 * staff tools, and the AI assistant in particular answers questions off tables
 * she is denied.
 */
export default function InvestorPortal() {
  return (
    <InvestorSeasonProvider>
      <InvestorShell />
    </InvestorSeasonProvider>
  );
}
