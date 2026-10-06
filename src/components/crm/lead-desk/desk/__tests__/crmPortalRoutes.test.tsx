import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

/**
 * CRMPortal's lead-module routing (spec §3): which URL shows which page, who is
 * let in, and which old URLs redirect where. The page contents are stubs; what
 * is under test is the switch in CRMPortal.
 */

vi.setConfig({ testTimeout: 30_000 });

type Roles = {
  isStaff: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isCallOperator: boolean;
  isDocumentHandler: boolean;
  isLeadSenior: boolean;
  canWorkLeads: boolean;
  canSeeFinance: boolean;
  loading: boolean;
};

const OPERATOR: Roles = {
  isStaff: true,
  isOwner: false,
  isAdmin: false,
  isCallOperator: true,
  isDocumentHandler: false,
  isLeadSenior: false,
  canWorkLeads: true,
  canSeeFinance: false,
  loading: false,
};
const SENIOR: Roles = { ...OPERATOR, isCallOperator: false, isLeadSenior: true };
const ADMIN: Roles = { ...OPERATOR, isAdmin: true, isOwner: true, isLeadSenior: true, isDocumentHandler: true };
const DOC_HANDLER: Roles = { ...OPERATOR, isCallOperator: false, canWorkLeads: false, isDocumentHandler: true };

let roles: Roles = OPERATOR;

vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => roles }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, signOut: vi.fn(), loading: false }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k), i18n: { language: 'uz' } }),
}));
vi.mock('@/hooks/useCanReviewUniDb', () => ({ useCanReviewUniDb: () => ({ canReview: false }) }));
vi.mock('@/hooks/useCRMData', () => ({
  useCRMData: () => ({
    students: [],
    applications: [],
    universities: [],
    loading: false,
    updateApplicationStatus: vi.fn(),
    createApplication: vi.fn(),
    updateDocumentStatus: vi.fn(),
    setDocsReady: vi.fn(),
    refetchStudents: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePayments', () => ({ usePayments: () => ({ payments: [], loading: false, fetchPayments: vi.fn() }) }));

// the shell
const sidebarProps = vi.fn();
vi.mock('@/components/crm/CRMSidebar', () => ({
  CRMSidebar: (p: { canWorkLeads?: boolean; isLeadSenior?: boolean }) => {
    sidebarProps(p);
    return <nav data-testid="sidebar" />;
  },
  useSidebarGroups: () => [],
}));
vi.mock('@/components/crm/CRMCommandMenu', () => ({ CRMCommandMenu: () => null }));
vi.mock('@/components/ThemeToggleButton', () => ({ ThemeToggleButton: () => null }));
vi.mock('@/components/Logo', () => ({ Logo: () => null }));
vi.mock('@/components/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('@/components/crm/SeasonSwitcher', () => ({ SeasonSwitcher: () => null }));
vi.mock('@/components/crm/IntakeBanner', () => ({ IntakeBanner: () => null }));
vi.mock('@/components/crm/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/ai/HangukAIChat', () => ({ HangukAIChat: () => null }));
vi.mock('@/components/intercom/IntercomProvider', () => ({ IntercomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/LeadsContext', () => ({ LeadsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/CallsContext', () => ({ CallsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/MessagesContext', () => ({ MessagesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

// pages that CRMPortal imports directly
vi.mock('@/components/crm/CRMDashboard', () => ({ CRMDashboard: () => <div>PAGE dashboard</div> }));
vi.mock('@/components/crm/StudentList', () => ({ StudentList: () => <div>PAGE students</div> }));
vi.mock('@/components/crm/StudentDetail', () => ({ StudentDetail: () => null }));
vi.mock('@/components/finance/StudentFinanceList', () => ({ StudentFinanceList: () => null }));
vi.mock('@/components/finance/TransactionList', () => ({ TransactionList: () => null }));
vi.mock('@/components/finance/FinanceReports', () => ({ FinanceReports: () => null }));

// the lead module's pages (lazy in CRMPortal)
vi.mock('@/components/crm/pages/LeadDeskContent', () => ({ default: () => <div>PAGE desk</div> }));
vi.mock('@/components/crm/pages/AllLeadsContent', () => ({ default: () => <div>PAGE all-leads</div> }));
vi.mock('@/components/crm/pages/LostLeadsContent', () => ({ default: () => <div>PAGE lost</div> }));
vi.mock('@/components/crm/pages/LeadReportContent', () => ({ default: () => <div>PAGE report</div> }));
vi.mock('@/components/crm/pages/LeadBazaContent', () => ({ default: () => <div>PAGE baza</div> }));
vi.mock('@/components/crm/pages/LeadSettingsContent', () => ({ default: () => <div>PAGE lead-settings</div> }));
vi.mock('@/components/crm/pages/LeadProfileContent', () => ({
  default: ({ leadId }: { leadId: string }) => <div>PAGE old-profile {leadId}</div>,
}));

import CRMPortal from '@/pages/CRMPortal';

const UUID = '0b7f3a52-1c0e-4d6a-9d3b-5f1c2e8a9b10';

function Probe() {
  const l = useLocation();
  return <div data-testid="loc">{`${l.pathname}${l.search}`}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CRMPortal />
      <Probe />
    </MemoryRouter>,
  );
}

const DENIED = 'Access Restricted';

beforeEach(() => {
  roles = OPERATOR;
  sidebarProps.mockClear();
});

describe('CRMPortal: lead module routes', () => {
  it.each([
    ['/crm/desk', 'PAGE desk'],
    ['/crm/leads', 'PAGE all-leads'],
    ['/crm/leads/lost', 'PAGE lost'],
    ['/crm/leads/baza', 'PAGE baza'],
  ])('shows %s to an operator', async (path, page) => {
    renderAt(path);
    expect(await screen.findByText(page)).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(path);
  });

  it('keeps the named sub-pages out of the "Barcha lidlar" list and out of the old profile', async () => {
    roles = ADMIN;
    renderAt('/crm/leads/report');
    expect(await screen.findByText('PAGE report')).toBeInTheDocument();
    expect(screen.queryByText('PAGE all-leads')).not.toBeInTheDocument();
    expect(screen.queryByText(/PAGE old-profile/)).not.toBeInTheDocument();
  });

  it('lets only a senior (or boss) into Hisobot', async () => {
    renderAt('/crm/leads/report');
    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    expect(screen.queryByText('PAGE report')).not.toBeInTheDocument();
  });

  it('shows Hisobot to a senior operator', async () => {
    roles = SENIOR;
    renderAt('/crm/leads/report');
    expect(await screen.findByText('PAGE report')).toBeInTheDocument();
  });

  it('lets only an admin into Sozlamalar', async () => {
    roles = SENIOR;
    const first = renderAt('/crm/leads/settings');
    expect(await screen.findByText(DENIED)).toBeInTheDocument();
    first.unmount();

    roles = ADMIN;
    renderAt('/crm/leads/settings');
    expect(await screen.findByText('PAGE lead-settings')).toBeInTheDocument();
  });

  it('denies the desk and the lead lists to a role that does not work leads', async () => {
    roles = DOC_HANDLER;
    for (const path of ['/crm/desk', '/crm/leads', '/crm/leads/lost', '/crm/leads/baza']) {
      const view = renderAt(path);
      expect(await screen.findByText(DENIED)).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe('CRMPortal: redirects', () => {
  it.each(['/crm/new-leads', '/crm/today-leads'])('sends the old %s to the desk', async (path) => {
    renderAt(path);
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(/^\/crm\/desk$/));
    expect(await screen.findByText('PAGE desk')).toBeInTheDocument();
  });

  it('sends an operator who lands on plain /crm to the desk', async () => {
    renderAt('/crm');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(/^\/crm\/desk$/));
    expect(await screen.findByText('PAGE desk')).toBeInTheDocument();
  });

  it('sends a senior operator who lands on /crm/ to the desk', async () => {
    roles = SENIOR;
    renderAt('/crm/');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(/^\/crm\/desk$/));
  });

  it('keeps the dashboard for an admin', async () => {
    roles = ADMIN;
    renderAt('/crm');
    expect(await screen.findByText('PAGE dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/crm$/);
  });

  it('keeps the dashboard for a role that does not work leads', async () => {
    roles = DOC_HANDLER;
    renderAt('/crm');
    expect(await screen.findByText('PAGE dashboard')).toBeInTheDocument();
  });

  it('opens an old lead-profile link on the desk (?lead=) for an operator', async () => {
    renderAt(`/crm/leads/${UUID}`);
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent(`/crm/desk?lead=${UUID}`));
    expect(await screen.findByText('PAGE desk')).toBeInTheDocument();
  });

  it('still opens the old profile page for a role that cannot work the desk', async () => {
    roles = DOC_HANDLER;
    renderAt(`/crm/leads/${UUID}`);
    expect(await screen.findByText(`PAGE old-profile ${UUID}`)).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent(`/crm/leads/${UUID}`);
  });
});

describe('CRMPortal: the sidebar', () => {
  it('is told whether the user works leads and whether they are a senior', async () => {
    roles = SENIOR;
    renderAt('/crm/desk');
    await screen.findByText('PAGE desk');
    expect(sidebarProps).toHaveBeenLastCalledWith(expect.objectContaining({ canWorkLeads: true, isLeadSenior: true }));
  });
});
