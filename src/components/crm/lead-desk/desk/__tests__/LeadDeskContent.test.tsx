import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { DeskCounts, DeskRow } from '../../types';
import { deskRow, NOW } from './fixtures';

// jsdom renders a dense page slowly, and the machine may be busy: be patient rather than flaky.
vi.setConfig({ testTimeout: 30_000 });

// ---- mocks: everything that would reach Supabase, plus the other engineers' screens ----------

const fetchDesk = vi.fn<() => Promise<DeskRow[]>>();
const fetchDeskCounts = vi.fn<() => Promise<DeskCounts>>();
const claimLead = vi.fn<(id: string) => Promise<void>>();

vi.mock('@/components/crm/lead-desk/api', () => ({
  fetchDesk: () => fetchDesk(),
  fetchDeskCounts: () => fetchDeskCounts(),
  claimLead: (id: string) => claimLead(id),
}));

vi.mock('@/integrations/supabase/client', () => {
  const channel = () => {
    const ch: { on: () => typeof ch; subscribe: () => typeof ch } = { on: () => ch, subscribe: () => ch };
    return ch;
  };
  return { supabase: { channel, removeChannel: vi.fn() } };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    warning: vi.fn(),
    info: vi.fn(),
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  }),
}));

let role = { isLeadSenior: false };
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [
      { id: 'p1', user_id: 'op-2', full_name: 'Sardor Operator', username: null, avatar_url: null },
      { id: 'p2', user_id: 'me', full_name: 'Men Operator', username: null, avatar_url: null },
    ],
    loading: false,
    searchStaff: () => [],
  }),
}));

vi.mock('@/components/crm/lead-desk/card/LeadCard', () => ({
  default: (p: { leadId: string; startCall?: boolean; onClose?: () => void }) => (
    <div data-testid="lead-card" data-lead={p.leadId} data-start-call={String(Boolean(p.startCall))}>
      <button onClick={p.onClose}>card-close</button>
    </div>
  ),
}));
vi.mock('@/components/crm/lead-desk/card/ManualLeadDialog', () => ({
  default: (p: { open: boolean; onCreated?: (id: string) => void }) =>
    p.open ? (
      <div data-testid="manual-dialog">
        <button onClick={() => p.onCreated?.('new-lead')}>create-lead</button>
      </div>
    ) : null,
}));
vi.mock('@/components/crm/lead-desk/comments/CommentsPanel', () => ({
  default: (p: { open: boolean }) => (p.open ? <div data-testid="comments-panel" /> : null),
}));

import LeadDeskContent from '../../../pages/LeadDeskContent';

// ---- helpers -------------------------------------------------------------------------------

const COUNTS: DeskCounts = { hozir: 1, breached: 0, barcha: 10, yoqotilgan: 2, baza: 5, comments: 3 };

function Probe() {
  const l = useLocation();
  return <div data-testid="loc">{`${l.pathname}${l.search}`}</div>;
}

function renderDesk(entry = '/crm/desk') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <LeadDeskContent />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const iso = (offsetSeconds: number) => new Date(NOW.getTime() + offsetSeconds * 1000).toISOString();

const hozirRow = (over: Partial<DeskRow> = {}) =>
  deskRow({ id: 'h1', full_name: 'Dilnoza', bucket: 'hozir', timer_kind: 'first', due_at: iso(252), timer_start_at: iso(-348), ...over });
const bugunRow = (over: Partial<DeskRow> = {}) =>
  deskRow({ id: 'b1', full_name: 'Malika', bucket: 'bugun', next_action_kind: 'wait_end', next_action_at: iso(3600), ...over });
const keyinRow = (over: Partial<DeskRow> = {}) =>
  deskRow({ id: 'k1', full_name: 'Bekzod', bucket: 'keyin', timer_kind: 'ladder', ladder_state: 'running', attempt_no: 3, due_at: iso(86_400), timer_start_at: iso(86_400 - 600), ...over });

const rowOf = (name: string) => screen.getByText(name).closest('[role="listitem"]') as HTMLElement;
const findRow = async (name: string) => (await screen.findByText(name)).closest('[role="listitem"]') as HTMLElement;
const items = (root: ParentNode) => Array.from(root.querySelectorAll('[role="listitem"]'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  role = { isLeadSenior: false };
  fetchDesk.mockReset();
  fetchDeskCounts.mockReset().mockResolvedValue(COUNTS);
  claimLead.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LeadDeskContent: the three blocks', () => {
  it('shows HOZIR, BUGUN and KEYIN with their rows', async () => {
    fetchDesk.mockResolvedValue([hozirRow(), bugunRow(), keyinRow()]);
    renderDesk();

    expect(await screen.findByRole('heading', { name: 'HOZIR — 10 daqiqa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'BUGUN — qayta aloqa va javob kutayotgan chatlar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'KEYIN' })).toBeInTheDocument();

    const hozir = within(document.getElementById('desk-block-hozir') as HTMLElement);
    const bugun = within(document.getElementById('desk-block-bugun') as HTMLElement);
    const keyin = within(document.getElementById('desk-block-keyin') as HTMLElement);
    expect(hozir.getByText('Dilnoza')).toBeInTheDocument();
    expect(bugun.getByText('Malika')).toBeInTheDocument();
    expect(keyin.getByText('Bekzod')).toBeInTheDocument();
    expect(hozir.queryByText('Malika')).not.toBeInTheDocument();
  });

  it('shows a calm green line, and keeps the block, when HOZIR is empty', async () => {
    fetchDesk.mockResolvedValue([bugunRow(), keyinRow()]);
    renderDesk();

    const line = await screen.findByText("Hozir navbat yo'q");
    expect(line.closest('[role="status"]')).toHaveClass('text-success');
    expect(screen.getByRole('heading', { name: 'HOZIR — 10 daqiqa' })).toBeInTheDocument();
    expect(screen.getByText('Malika')).toBeInTheDocument();
  });

  it('works with an empty database', async () => {
    fetchDesk.mockResolvedValue([]);
    fetchDeskCounts.mockResolvedValue({ hozir: 0, breached: 0, barcha: 0, yoqotilgan: 0, baza: 0, comments: 0 });
    renderDesk();

    expect(await screen.findByText("Hozir navbat yo'q")).toBeInTheDocument();
    expect(screen.getByText("Bugun uchun ish yo'q")).toBeInTheDocument();
    expect(screen.getByText("Keyingi ishlar yo'q")).toBeInTheDocument();
    expect(items(document.body)).toHaveLength(0);
  });

  it('shows the block counts in the top bar and the comments badge', async () => {
    fetchDesk.mockResolvedValue([hozirRow(), bugunRow({ id: 'b1' }), bugunRow({ id: 'b2', full_name: 'Jasur' }), keyinRow()]);
    renderDesk();

    await screen.findByText('Dilnoza');
    expect(screen.getByRole('heading', { name: 'Ish stoli' })).toBeInTheDocument();
    expect(screen.getByTitle('Hozir blokiga o‘tish')).toHaveTextContent('Hozir1');
    expect(screen.getByTitle('Bugun blokiga o‘tish')).toHaveTextContent('Bugun2');
    expect(screen.getByTitle('Keyin blokiga o‘tish')).toHaveTextContent('Keyin1');
    expect(await screen.findByText('Izohlar · 3')).toBeInTheDocument();
  });

  it('shows the first 40 of KEYIN and the rest on "Hammasini ko\'rsatish"', async () => {
    const many = Array.from({ length: 55 }, (_, i) => keyinRow({ id: `k${i}`, full_name: `Keyin ${String(i).padStart(2, '0')}` }));
    fetchDesk.mockResolvedValue(many);
    renderDesk();

    await screen.findByText('Keyin 00');
    const block = () => document.getElementById('desk-block-keyin') as HTMLElement;
    expect(items(block())).toHaveLength(40);

    fireEvent.click(within(block()).getByText(/Hammasini ko'rsatish/));
    expect(items(block())).toHaveLength(55);

    fireEvent.click(within(block()).getByText(/Kamroq/));
    expect(items(block())).toHaveLength(40);
  });
});

describe('LeadDeskContent: a row', () => {
  it('shows a green countdown, then yellow, with the lead facts', async () => {
    fetchDesk.mockResolvedValue([
      hozirRow({ id: 'g', full_name: 'Yashil', due_at: iso(8 * 60), handle: 'yashil_u', channels: ['instagram', 'telegram'], form_name: 'Hanbox 10-sent', phone: null, referral: true, pinned: true, missing: 2, pending_drafts: 1, owner_id: null }),
      hozirRow({ id: 'y', full_name: 'Sariq', due_at: iso(252) }),
    ]);
    renderDesk();

    const green = await findRow('Yashil');
    expect(within(green).getByText('08:00').className).toMatch(/text-success/);
    expect(within(green).getByText('@yashil_u')).toBeInTheDocument();
    expect(within(green).getByText('IG')).toBeInTheDocument();
    expect(within(green).getByText('TG')).toBeInTheDocument();
    expect(within(green).getAllByText('Hanbox 10-sent').length).toBeGreaterThan(0);
    expect(within(green).getAllByText("telefon yo'q").length).toBeGreaterThan(0);
    expect(within(green).getAllByText('Hovuz').length).toBeGreaterThan(0);
    expect(within(green).getByLabelText('Tavsiya bilan kelgan')).toBeInTheDocument();
    expect(within(green).getByLabelText('Senior belgilagan')).toBeInTheDocument();
    expect(within(green).getByLabelText('Majburiy maydonlar to‘ldirilmagan: 2 ta')).toBeInTheDocument();
    expect(within(green).getByText('● qoralama')).toBeInTheDocument();

    const yellow = rowOf('Sariq');
    expect(within(yellow).getByText('04:12').className).toMatch(/text-warning/);
  });

  it('shows "−02:40 KECHIKDI" in red and bold for an overdue lead', async () => {
    fetchDesk.mockResolvedValue([hozirRow({ full_name: 'Kech', due_at: iso(-160) })]);
    renderDesk();

    const row = await findRow('Kech');
    const chip = within(row).getByText('−02:40');
    expect(chip.className).toMatch(/bg-destructive/);
    expect(within(row).getByText('KECHIKDI')).toBeInTheDocument();
    expect(row.className).toMatch(/bg-destructive\/10/);
    expect(row.className).toMatch(/font-semibold/);
  });

  it('names a ladder row "N-urinish" with "zinapoya N/5"', async () => {
    fetchDesk.mockResolvedValue([keyinRow({ full_name: 'Zina', attempt_no: 3 })]);
    renderDesk();

    const row = await findRow('Zina');
    expect(within(row).getAllByText('4-urinish').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('zinapoya 4/5').length).toBeGreaterThan(0);
  });

  it('shows "Mijoz yozdi HH:MM" with a small countdown for a reply in BUGUN', async () => {
    fetchDesk.mockResolvedValue([
      bugunRow({
        full_name: 'Jasur',
        next_action_at: null,
        next_action_kind: null,
        timer_kind: 'reply',
        due_at: iso(190),
        timer_start_at: iso(190),
        last_client_msg_at: '2026-10-06T04:41:00Z',
      }),
    ]);
    renderDesk();

    const row = await findRow('Jasur');
    expect(within(row).getByText('Mijoz yozdi 09:41')).toBeInTheDocument();
    expect(within(row).getByText('03:10')).toBeInTheDocument();
  });
});

describe('LeadDeskContent: search', () => {
  it('filters the loaded rows by name, phone and @username', async () => {
    fetchDesk.mockResolvedValue([
      hozirRow({ id: 'a', full_name: 'Aziz', phone: '+998 90 111 22 33' }),
      bugunRow({ id: 'b', full_name: 'Malika', handle: 'malika_r', phone: '+998 91 444 55 66' }),
      keyinRow({ id: 'c', full_name: 'Bekzod', phone: null }),
    ]);
    renderDesk();
    await screen.findByText('Aziz');
    const box = screen.getByLabelText('Lidlarni qidirish');

    fireEvent.change(box, { target: { value: 'malika' } });
    expect(screen.queryByText('Aziz')).not.toBeInTheDocument();
    expect(screen.getByText('Malika')).toBeInTheDocument();
    // HOZIR keeps its block; with a search on, an empty block says nothing matched
    expect(screen.getByRole('heading', { name: 'HOZIR — 10 daqiqa' })).toBeInTheDocument();
    expect(screen.getAllByText('Hech narsa topilmadi').length).toBeGreaterThan(0);

    fireEvent.change(box, { target: { value: '@malika_r' } });
    expect(screen.getByText('Malika')).toBeInTheDocument();
    expect(screen.queryByText('Bekzod')).not.toBeInTheDocument();

    fireEvent.change(box, { target: { value: '90 111' } });
    expect(screen.getByText('Aziz')).toBeInTheDocument();
    expect(screen.queryByText('Malika')).not.toBeInTheDocument();

    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getAllByText('Hech narsa topilmadi').length).toBeGreaterThan(0);
  });
});

describe('LeadDeskContent: the card beside the list', () => {
  it('opens a lead on click, keeps the list, and puts the id in the URL', async () => {
    fetchDesk.mockResolvedValue([hozirRow(), bugunRow()]);
    renderDesk();
    fireEvent.click(await screen.findByText('Malika'));

    const card = await screen.findByTestId('lead-card');
    expect(card).toHaveAttribute('data-lead', 'b1');
    expect(card).toHaveAttribute('data-start-call', 'false');
    expect(screen.getByTestId('loc')).toHaveTextContent('/crm/desk?lead=b1');
    expect(screen.getByText('Dilnoza')).toBeInTheDocument(); // the list is still there
  });

  it('opens the lead from the URL, so a link works', async () => {
    fetchDesk.mockResolvedValue([hozirRow()]);
    renderDesk('/crm/desk?lead=somebody-else');
    expect(await screen.findByTestId('lead-card')).toHaveAttribute('data-lead', 'somebody-else');
  });

  it('"Chat" only selects; "Qo\'ng\'iroq" selects and starts the call', async () => {
    fetchDesk.mockResolvedValue([hozirRow(), bugunRow()]);
    renderDesk();
    await screen.findByText('Malika');

    fireEvent.click(within(rowOf('Malika')).getByRole('button', { name: 'Chat' }));
    expect(await screen.findByTestId('lead-card')).toHaveAttribute('data-start-call', 'false');

    fireEvent.click(within(rowOf('Dilnoza')).getByRole('button', { name: /Qo'ng'iroq/ }));
    await waitFor(() => expect(screen.getByTestId('lead-card')).toHaveAttribute('data-lead', 'h1'));
    expect(screen.getByTestId('lead-card')).toHaveAttribute('data-start-call', 'true');
    expect(screen.getByTestId('loc')).toHaveTextContent('/crm/desk?lead=h1');
  });

  it('closing the card clears the URL', async () => {
    fetchDesk.mockResolvedValue([bugunRow()]);
    renderDesk('/crm/desk?lead=b1');
    fireEvent.click(await screen.findByText('card-close'));
    await waitFor(() => expect(screen.queryByTestId('lead-card')).not.toBeInTheDocument());
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/crm\/desk$/);
  });

  it('puts the list back where it was after a card is opened and closed (below 1280 px the list is hidden meanwhile)', async () => {
    const LIST = 'Ish stoli ro‘yxati';
    // jsdom has no layout: stand in for "display: none" with a zero height, once
    // (the read inside close(), while the list is still hidden), then visible again
    let hiddenReads = 0;
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      if (this.getAttribute('aria-label') === LIST && hiddenReads > 0) {
        hiddenReads -= 1;
        return 0;
      }
      return 400;
    });
    fetchDesk.mockResolvedValue([hozirRow(), bugunRow()]);
    renderDesk();
    await screen.findByText('Malika');
    const list = screen.getByLabelText(LIST);

    list.scrollTop = 120;
    fireEvent.click(screen.getByText('Malika'));
    await screen.findByTestId('lead-card');
    list.scrollTop = 0; // the browser hid the list and forgot its offset
    hiddenReads = 1;
    fireEvent.click(screen.getByText('card-close')); // closing shows it again
    await waitFor(() => expect(screen.queryByTestId('lead-card')).not.toBeInTheDocument());
    expect(list.scrollTop).toBe(120);
    vi.restoreAllMocks();
  });
});

describe('LeadDeskContent: a breached lead somebody else owns', () => {
  const stolen = () => hozirRow({ id: 'x', full_name: 'Kechikkan', due_at: iso(-60), owner_id: 'op-2' });

  it('shows "Olish" instead of the call button, and claims it', async () => {
    fetchDesk.mockResolvedValue([stolen()]);
    // once claimed, the next read of the desk says the lead is mine
    claimLead.mockImplementation(async () => {
      fetchDesk.mockResolvedValue([{ ...stolen(), owner_id: 'me' }]);
    });
    renderDesk();

    const row = await findRow('Kechikkan');
    expect(within(row).queryByRole('button', { name: /Qo'ng'iroq/ })).not.toBeInTheDocument();
    expect(within(row).getAllByText('Sardor Operator').length).toBeGreaterThan(0);

    fireEvent.click(within(row).getByRole('button', { name: 'Olish' }));
    await waitFor(() => expect(claimLead).toHaveBeenCalledWith('x'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(await screen.findByTestId('lead-card')).toHaveAttribute('data-lead', 'x');
  });

  it('explains a failed claim in Uzbek', async () => {
    claimLead.mockRejectedValue(new Error('not_allowed'));
    fetchDesk.mockResolvedValue([stolen()]);
    renderDesk();

    fireEvent.click(within(await findRow('Kechikkan')).getByRole('button', { name: 'Olish' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Bu amalga ruxsat yo'q"));
    expect(screen.queryByTestId('lead-card')).not.toBeInTheDocument();
  });

  it('puts the claim gate in front of the card for an operator, but not for a senior', async () => {
    fetchDesk.mockResolvedValue([stolen()]);
    const first = renderDesk('/crm/desk?lead=x');
    expect(await screen.findByText(/Javob berish uchun lidni o‘zingizga oling/)).toBeInTheDocument();
    expect(screen.queryByTestId('lead-card')).not.toBeInTheDocument();
    first.unmount();

    role = { isLeadSenior: true };
    renderDesk('/crm/desk?lead=x');
    expect(await screen.findByTestId('lead-card')).toBeInTheDocument();
  });

  it('does not offer "Olish" on my own lead', async () => {
    fetchDesk.mockResolvedValue([hozirRow({ full_name: 'Meniki', due_at: iso(-60), owner_id: 'me' })]);
    renderDesk();
    const row = await findRow('Meniki');
    expect(within(row).queryByRole('button', { name: 'Olish' })).not.toBeInTheDocument();
    expect(within(row).getAllByText('Siz').length).toBeGreaterThan(0);
  });
});

describe('LeadDeskContent: the header', () => {
  it('opens the manual-lead dialog and selects the lead it creates', async () => {
    fetchDesk.mockResolvedValue([]);
    renderDesk();
    fireEvent.click(await screen.findByRole('button', { name: '+ Lid' }));
    fireEvent.click(await screen.findByText('create-lead'));
    expect(await screen.findByTestId('lead-card')).toHaveAttribute('data-lead', 'new-lead');
  });

  it('opens the comments panel from "Izohlar · N"', async () => {
    fetchDesk.mockResolvedValue([]);
    renderDesk();
    fireEvent.click(await screen.findByRole('button', { name: /Izohlar/ }));
    expect(await screen.findByTestId('comments-panel')).toBeInTheDocument();
  });

  it('has the two alert switches', async () => {
    fetchDesk.mockResolvedValue([]);
    renderDesk();
    expect(await screen.findByRole('switch', { name: 'Brauzer bildirishnomasi' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Ovozli signal' })).toBeInTheDocument();
  });
});

describe('LeadDeskContent: when lead_desk() fails', () => {
  it('shows an inline error with a Retry, never a blank screen, and recovers', async () => {
    fetchDesk.mockRejectedValueOnce(new Error('not_allowed')).mockRejectedValueOnce(new Error('not_allowed'));
    renderDesk();

    expect(await screen.findByText('Ish stoli yuklanmadi')).toBeInTheDocument();
    expect(screen.getByText("Bu amalga ruxsat yo'q")).toBeInTheDocument();
    // the header is still there
    expect(screen.getByRole('heading', { name: 'Ish stoli' })).toBeInTheDocument();

    fetchDesk.mockResolvedValue([bugunRow()]);
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(await screen.findByText('Malika')).toBeInTheDocument();
    expect(screen.queryByText('Ish stoli yuklanmadi')).not.toBeInTheDocument();
  });
});




