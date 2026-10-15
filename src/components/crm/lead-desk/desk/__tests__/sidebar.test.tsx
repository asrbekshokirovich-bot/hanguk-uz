import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import type { DeskCounts } from '../../types';

const fetchDeskCounts = vi.fn<() => Promise<DeskCounts>>();
vi.mock('@/components/crm/lead-desk/api', () => ({
  fetchDesk: vi.fn(),
  fetchDeskCounts: () => fetchDeskCounts(),
}));
vi.mock('@/integrations/supabase/client', () => {
  const channel = () => {
    const ch: { on: () => typeof ch; subscribe: () => typeof ch } = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return { supabase: { channel, removeChannel: vi.fn() } };
});

import { CRMSidebar, useSidebarGroups } from '@/components/crm/CRMSidebar';
import { isNavItemActive } from '@/components/crm/navActive';
import { SidebarProvider } from '@/components/ui/sidebar';

// importing the sidebar pulls in the whole UI kit; be patient rather than flaky on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

const t = (key: string) => key;
const counts: DeskCounts = { hozir: 3, breached: 1, barcha: 41, yoqotilgan: 7, baza: 554, comments: 2 };

const groupsFor = (flags: { admin?: boolean; operator?: boolean; senior?: boolean }, c?: DeskCounts) =>
  renderHook(() =>
    useSidebarGroups(false, Boolean(flags.admin), Boolean(flags.operator || flags.admin), false, t, 'uz', false, {
      canWorkLeads: Boolean(flags.operator || flags.senior || flags.admin),
      isLeadSenior: Boolean(flags.senior || flags.admin),
      counts: c,
    }),
  ).result.current;

describe('the "Lidlar" group', () => {
  it('comes right after "home" and before "communication"', () => {
    const ids = groupsFor({ operator: true }, counts).map((g) => g.id);
    expect(ids.slice(0, 3)).toEqual(['home', 'leads', 'communication']);
  });

  it('replaces the three old items in the communication group', () => {
    const groups = groupsFor({ admin: true }, counts);
    const urls = groups.find((g) => g.id === 'communication')!.items.map((i) => i.url);
    expect(urls).not.toContain('/crm/new-leads');
    expect(urls).not.toContain('/crm/today-leads');
    expect(urls).not.toContain('/crm/leads');
  });

  it('lists Ish stoli first and bold, then the rest in order', () => {
    const leads = groupsFor({ admin: true }, counts).find((g) => g.id === 'leads')!;
    expect(leads.title).toBe('Lidlar');
    expect(leads.items.map((i) => [i.title, i.url])).toEqual([
      ['Ish stoli', '/crm/desk'],
      ['Barcha lidlar', '/crm/leads'],
      ["Yo'qotilgan", '/crm/leads/lost'],
      ['Hisobot', '/crm/leads/report'],
      ['Baza', '/crm/leads/baza'],
      ['Sozlamalar', '/crm/leads/settings'],
    ]);
    expect(leads.items[0].primary).toBe(true);
  });

  it('shows the group to operators, seniors and admins, and to nobody else', () => {
    expect(groupsFor({ operator: true }).find((g) => g.id === 'leads')!.visible).toBe(true);
    expect(groupsFor({ senior: true }).find((g) => g.id === 'leads')!.visible).toBe(true);
    expect(groupsFor({ admin: true }).find((g) => g.id === 'leads')!.visible).toBe(true);
    expect(groupsFor({}).find((g) => g.id === 'leads')!.visible).toBe(false);
  });

  it('shows Hisobot only to seniors and bosses, and Sozlamalar only to admins', () => {
    const visible = (flags: Parameters<typeof groupsFor>[0]) =>
      groupsFor(flags, counts)
        .find((g) => g.id === 'leads')!
        .items.filter((i) => i.visible)
        .map((i) => i.title);
    expect(visible({ operator: true })).toEqual(['Ish stoli', 'Barcha lidlar', "Yo'qotilgan", 'Baza']);
    expect(visible({ senior: true })).toEqual(['Ish stoli', 'Barcha lidlar', "Yo'qotilgan", 'Hisobot', 'Baza']);
    expect(visible({ admin: true })).toContain('Hisobot');
    expect(visible({ admin: true })).toContain('Sozlamalar');
  });

  it('carries the counters: HOZIR (red, blinking while one is breached), Barcha, Yoqotilgan, Baza', () => {
    const items = groupsFor({ admin: true }, counts).find((g) => g.id === 'leads')!.items;
    expect(items[0].badge).toEqual({ count: 3, tone: 'red', pulse: true, keepZero: true });
    expect(items[1].badge).toMatchObject({ count: 41, tone: 'muted' });
    expect(items[2].badge).toMatchObject({ count: 7, tone: 'muted' });
    expect(items[3].badge).toBeUndefined();
    expect(items[4].badge).toMatchObject({ count: 554, tone: 'muted' });
  });

  it('does not blink, and goes muted, when nothing is due', () => {
    const quiet = groupsFor({ admin: true }, { ...counts, hozir: 0, breached: 0 }).find((g) => g.id === 'leads')!.items[0];
    expect(quiet.badge).toEqual({ count: 0, tone: 'muted', pulse: false, keepZero: true });
    const noBreach = groupsFor({ admin: true }, { ...counts, breached: 0 }).find((g) => g.id === 'leads')!.items[0];
    expect(noBreach.badge).toMatchObject({ tone: 'red', pulse: false });
  });
});

describe('which nav item is active', () => {
  it('does not highlight "Barcha lidlar" on its sibling pages', () => {
    expect(isNavItemActive('/crm/leads', '/crm/leads')).toBe(true);
    for (const sub of ['lost', 'report', 'baza', 'settings']) {
      expect(isNavItemActive(`/crm/leads/${sub}`, '/crm/leads')).toBe(false);
      expect(isNavItemActive(`/crm/leads/${sub}`, `/crm/leads/${sub}`)).toBe(true);
    }
  });

  it('still lights the list for one lead\'s profile URL', () => {
    expect(isNavItemActive('/crm/leads/0b7f3a52-1c0e-4d6a-9d3b-5f1c2e8a9b10', '/crm/leads')).toBe(true);
  });

  it('matches the desk on its own URL and the dashboard only exactly', () => {
    expect(isNavItemActive('/crm/desk', '/crm/desk')).toBe(true);
    expect(isNavItemActive('/crm/desk', '/crm')).toBe(false);
    expect(isNavItemActive('/crm', '/crm')).toBe(true);
    expect(isNavItemActive('/crm/students/abc', '/crm/students')).toBe(true);
  });
});

describe('<CRMSidebar />', () => {
  beforeEach(() => {
    fetchDeskCounts.mockReset().mockResolvedValue(counts);
  });

  const renderSidebar = (props: Partial<React.ComponentProps<typeof CRMSidebar>> = {}, path = '/crm/desk') => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <SidebarProvider>
            <CRMSidebar
              isOwner={false}
              canSeeFinance={false}
              isAdmin={false}
              isCallOperator
              isDocumentHandler={false}
              canWorkLeads
              isLeadSenior={false}
              user={{ id: 'u1', email: 'op@hanguk.uz', user_metadata: { full_name: 'Omina Operator' } } as unknown as User}
              onSignOut={() => undefined}
              {...props}
            />
          </SidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  // Role queries walk the whole accessibility tree; this page is big, so find items by their text.
  const item = async (label: string) => (await screen.findByText(label)).closest('button') as HTMLElement;

  it('renders the group with the red HOZIR badge and the other counts', async () => {
    renderSidebar();
    const desk = await item('Ish stoli');
    const badge = await within(desk).findByText('3');
    expect(badge.className).toMatch(/bg-destructive/);
    expect(badge.className).toMatch(/animate-pulse/); // breached = 1

    expect(within(await item('Barcha lidlar')).getByText('41')).toBeInTheDocument();
    expect(within(await item("Yo'qotilgan")).getByText('7')).toBeInTheDocument();
    expect(within(await item('Baza')).getByText('554')).toBeInTheDocument();
    expect(screen.queryByText('Hisobot')).not.toBeInTheDocument();
    expect(screen.queryByText('Sozlamalar')).not.toBeInTheDocument();
    // the three old items are gone
    expect(screen.queryByText('navigation.newLeads')).not.toBeInTheDocument();
    expect(screen.queryByText('navigation.todayLeads')).not.toBeInTheDocument();
  });

  it('marks only Ish stoli active on the desk URL', async () => {
    renderSidebar();
    expect(await item('Ish stoli')).toHaveAttribute('data-active', 'true');
    expect(await item('Barcha lidlar')).toHaveAttribute('data-active', 'false');
  });

  it('marks only "Yo\'qotilgan" active on /crm/leads/lost', async () => {
    renderSidebar({}, '/crm/leads/lost');
    expect(await item("Yo'qotilgan")).toHaveAttribute('data-active', 'true');
    expect(await item('Barcha lidlar')).toHaveAttribute('data-active', 'false');
  });

  it('labels a senior operator "Senior operator" in the footer and shows Hisobot', async () => {
    renderSidebar({ isCallOperator: false, isLeadSenior: true });
    expect(await screen.findByText('Senior operator')).toBeInTheDocument();
    expect(await item('Hisobot')).toBeInTheDocument();
  });

  it('has no Lidlar group, and never asks for the counters, for a role that cannot work leads', () => {
    renderSidebar({ canWorkLeads: false, isCallOperator: false, isDocumentHandler: true });
    expect(screen.queryByText('Ish stoli')).not.toBeInTheDocument();
    expect(fetchDeskCounts).not.toHaveBeenCalled();
  });
});
