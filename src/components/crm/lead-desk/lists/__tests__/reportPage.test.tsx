import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import LeadReportContent from '@/components/crm/pages/LeadReportContent';
import type { LeadReport } from '../../types';
import { periodRange } from '../reportMath';
import { button, renderWithProviders } from './testUtils';

const api = vi.hoisted(() => ({
  fetchReport: vi.fn(),
  fetchPendingPromises: vi.fn(),
  decidePromise: vi.fn(),
  fetchSettings: vi.fn(),
}));
vi.mock('../../api', () => api);

const role = vi.hoisted(() => ({ value: { isLeadSenior: true, isAdmin: false, loading: false } }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role.value }));

vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [
      { id: 'p1', user_id: 'op-1', full_name: 'Omina', username: null, avatar_url: null },
      { id: 'p2', user_id: 'op-2', full_name: 'Bekzod', username: null, avatar_url: null },
    ],
    loading: false,
    searchStaff: () => [],
  }),
}));

vi.mock('../LeadCardSheet', () => ({
  default: ({ leadId }: { leadId: string | null }) => (leadId ? <div data-testid="card-sheet">{leadId}</div> : null),
}));

const SPEND_KEY = 'hanguk:lead-report:ad-spend:v1';

const report: LeadReport = {
  from: '2026-09-29',
  to: '2026-10-05',
  totals: { leads: 40, answered: 30, answered_in_10: 24, talked: 18, offers: 9, contracts_sent: 4, students: 3 },
  by_source: [
    { source: 'instagram', leads: 25, answered: 20, talked: 12, offers: 6, students: 2 },
    { source: 'telegram', leads: 10, answered: 6, talked: 4, offers: 2, students: 1 },
    { source: 'meta_form', leads: 5, answered: 4, talked: 2, offers: 1, students: 0 },
  ],
  by_ad: [
    { ad: 'Hanbox 10-sent', leads: 12, students: 2 },
    { ad: 'Toshkent 18–24', leads: 8, students: 0 },
  ],
  by_operator: [
    { operator_id: 'op-1', students: 2 },
    { operator_id: 'op-2', students: 1 },
  ],
  lost: [
    { reason: 'price', n: 6 },
    { reason: 'no_certificate', n: 3 },
    { reason: null, n: 1 },
  ],
  generation: [
    { generation: 'old', leads: 200, answered: 50, students: 2 },
    { generation: 'new', leads: 40, answered: 30, students: 3 },
  ],
};

const emptyReport: LeadReport = {
  from: '2026-10-05',
  to: '2026-10-05',
  totals: { leads: 0, answered: 0, answered_in_10: 0, talked: 0, offers: 0, contracts_sent: 0, students: 0 },
  by_source: [],
  by_ad: [],
  by_operator: [],
  lost: [],
  generation: [],
};

const pending = {
  id: 'promise-1',
  lead_id: 'lead-9',
  operator_id: 'op-1',
  kind: 'discount' as const,
  text: "10% chegirma, 2 oy bo'lib to'lash",
  reason: 'Ota-ona qarshi',
  status: 'pending' as const,
  decided_by: null,
  decided_at: null,
  created_at: '2026-10-05T08:00:00Z',
  leads: { full_name: 'Malika R.' },
};

const tile = (label: string) => screen.getByTestId(`tile-${label}`);
const lastReportCall = () => api.fetchReport.mock.calls[api.fetchReport.mock.calls.length - 1];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  role.value = { isLeadSenior: true, isAdmin: false, loading: false };
  api.fetchSettings.mockResolvedValue({ control_line_10min: true });
  api.fetchReport.mockResolvedValue(report);
  api.fetchPendingPromises.mockResolvedValue([pending]);
  api.decidePromise.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('Hisobot access', () => {
  it('is for the senior and the boss only: an operator gets no report call at all', () => {
    role.value = { isLeadSenior: false, isAdmin: false, loading: false };
    renderWithProviders(<LeadReportContent />);
    expect(screen.getByText('Hisobot faqat senior operator va rahbar uchun.')).toBeInTheDocument();
    expect(api.fetchReport).not.toHaveBeenCalled();
  });
});

describe('period picker', () => {
  it('starts on the last 7 days and sends Tashkent dates to lead_report', async () => {
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');
    const { from, to } = periodRange('7d');
    expect(lastReportCall()).toEqual([from, to]);
    expect(button('7 kun')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Bugun / Kecha / 30 kun / custom each ask for their own range', async () => {
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');

    fireEvent.click(button('Bugun'));
    await waitFor(() => expect(lastReportCall()).toEqual([periodRange('today').from, periodRange('today').to]));
    fireEvent.click(button('Kecha'));
    await waitFor(() => expect(lastReportCall()).toEqual([periodRange('yesterday').from, periodRange('yesterday').to]));
    fireEvent.click(button('30 kun'));
    await waitFor(() => expect(lastReportCall()).toEqual([periodRange('30d').from, periodRange('30d').to]));

    fireEvent.click(button('Boshqa'));
    fireEvent.change(screen.getByLabelText('Boshlanish'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Tugash'), { target: { value: '2026-10-03' } });
    await waitFor(() => expect(lastReportCall()).toEqual(['2026-10-01', '2026-10-03']));
  });
});

describe('results', () => {
  it('headline tiles: Shartnomalar · Taklif · Gaplashildi · Lidlar', async () => {
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');
    expect(tile('Shartnomalar')).toHaveTextContent('3');
    expect(tile('Shartnomalar')).toHaveTextContent('Konversiya: 7.5%');
    expect(tile('Taklif')).toHaveTextContent('9');
    expect(tile('Gaplashildi')).toHaveTextContent('18');
    expect(tile('Lidlar')).toHaveTextContent('40');
  });

  it('never shows a call count as a KPI', async () => {
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');
    expect(screen.queryByText(/qo'ng'iroqlar soni/i)).not.toBeInTheDocument();
    expect(screen.getByText("mijozlar soni (qo'ng'iroqlar emas)")).toBeInTheDocument();
  });

  it('the funnel by source has counts and % of leads, with a Jami row', async () => {
    renderWithProviders(<LeadReportContent />);
    const table = await screen.findByLabelText("Manba bo'yicha voronka");
    const rowOf = (name: string) => within(table).getByText(name, { selector: 'th' }).closest('tr')!;
    const ig = rowOf('Instagram');
    expect(ig).toHaveTextContent('25'); // lid
    expect(ig).toHaveTextContent('80%'); // javob 20/25
    expect(ig).toHaveTextContent('48%'); // gaplashildi 12/25
    expect(ig).toHaveTextContent('24%'); // taklif 6/25
    expect(ig).toHaveTextContent('8.0%'); // konversiya 2/25
    const total = rowOf('Jami');
    expect(total).toHaveTextContent('40');
    expect(total).toHaveTextContent('7.5%');
    expect(rowOf('Meta forma')).toBeInTheDocument();
  });

  it('a source filter narrows the tiles and the funnel to that source', async () => {
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');

    fireEvent.change(screen.getByLabelText('Manba'), { target: { value: 'instagram' } });

    expect(tile('Lidlar')).toHaveTextContent('25');
    expect(tile('Shartnomalar')).toHaveTextContent('2');
    const table = screen.getByLabelText("Manba bo'yicha voronka");
    expect(within(table).queryByText('Telegram', { selector: 'th' })).not.toBeInTheDocument();
    expect(screen.getByText(/manbasi: shu davrda kelgan lidlar/)).toBeInTheDocument();
  });

  it('lost reasons as share bars with their labels', async () => {
    renderWithProviders(<LeadReportContent />);
    const list = await screen.findByLabelText("Yo'qotish sabablari");
    const items = Array.from(list.querySelectorAll('li'));
    expect(items[0]).toHaveTextContent('Narx');
    expect(items[0]).toHaveTextContent('6 · 60%');
    expect(items[1]).toHaveTextContent("Sertifikat yo'q");
    expect(items[1]).toHaveTextContent('3 · 30%');
    expect(items[2]).toHaveTextContent("Sabab ko'rsatilmagan");
  });

  it('operators by name, and the operator filter narrows the list', async () => {
    renderWithProviders(<LeadReportContent />);
    const list = await screen.findByLabelText('Operatorlar');
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(within(list).getByText('Omina')).toBeInTheDocument();
    expect(within(list).getByText('Bekzod')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Operator'), { target: { value: 'op-2' } });
    const narrowed = screen.getByLabelText('Operatorlar');
    expect(narrowed.querySelectorAll('li')).toHaveLength(1);
    expect(within(narrowed).queryByText('Omina')).not.toBeInTheDocument();
    expect(within(narrowed).getByText('Bekzod')).toBeInTheDocument();
  });

  it('Eski vs yangi side by side', async () => {
    renderWithProviders(<LeadReportContent />);
    const table = await screen.findByLabelText('Eski va yangi');
    const rowOf = (name: string) => within(table).getByText(name, { selector: 'th' }).closest('tr')!;
    expect(rowOf('Lidlar')).toHaveTextContent('20040');
    expect(rowOf('Javob %')).toHaveTextContent('25.0%75.0%');
    expect(rowOf('Shartnomalar')).toHaveTextContent('23');
    expect(rowOf('Konversiya %')).toHaveTextContent('1.0%7.5%');
  });

  it('survives a report with nothing in it', async () => {
    api.fetchReport.mockResolvedValue(emptyReport);
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');
    expect(tile('Shartnomalar')).toHaveTextContent('0');
    expect(screen.getAllByText("Bu davrda lid yo'q")).toHaveLength(2); // the funnel and old vs new
    expect(screen.getByText("Bu davrda yo'qotilgan lid yo'q")).toBeInTheDocument();
    expect(screen.getByTestId('control-line')).toHaveTextContent('—');
  });

  it('shows the failure and retries', async () => {
    api.fetchReport.mockRejectedValueOnce(new Error('not_allowed'));
    renderWithProviders(<LeadReportContent />);
    expect(await screen.findByText("Hisobotni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu amalga ruxsat yo'q")).toBeInTheDocument();
    fireEvent.click(button('Qayta urinish'));
    expect(await screen.findByTestId('tile-Shartnomalar')).toBeInTheDocument();
  });
});

describe('ad performance and cost per contract', () => {
  it('a typed spend becomes cost per contract = spend / contracts', async () => {
    renderWithProviders(<LeadReportContent />);
    const table = await screen.findByLabelText('Reklama samarasi');
    const hanbox = within(table).getByText('Hanbox 10-sent', { selector: 'th' }).closest('tr')!;
    expect(hanbox).toHaveTextContent('16.7%'); // 2 / 12

    fireEvent.change(screen.getByLabelText('Sarf: Hanbox 10-sent'), { target: { value: '1 000 000' } });

    expect(screen.getByTestId('cpc-Hanbox 10-sent')).toHaveTextContent('500');
    // 1 000 000 / 2 contracts = 500 000
    expect(screen.getByTestId('cpc-Hanbox 10-sent').textContent?.replace(/\s/g, '')).toBe('500000');
  });

  it('an ad with no contract has no cost per contract, whatever was spent', async () => {
    renderWithProviders(<LeadReportContent />);
    await screen.findByLabelText('Reklama samarasi');
    fireEvent.change(screen.getByLabelText('Sarf: Toshkent 18–24'), { target: { value: '300' } });
    expect(screen.getByTestId('cpc-Toshkent 18–24')).toHaveTextContent('—');
  });

  it('keeps the spend in localStorage for that period and reads it back', async () => {
    const view = renderWithProviders(<LeadReportContent />);
    await screen.findByLabelText('Reklama samarasi');
    fireEvent.change(screen.getByLabelText('Sarf: Hanbox 10-sent'), { target: { value: '400' } });

    const { from, to } = periodRange('7d');
    expect(JSON.parse(window.localStorage.getItem(SPEND_KEY) ?? '{}')).toEqual({ [`${from}..${to}|Hanbox 10-sent`]: 400 });

    view.unmount();
    renderWithProviders(<LeadReportContent />);
    await screen.findByLabelText('Reklama samarasi');
    expect(screen.getByLabelText('Sarf: Hanbox 10-sent')).toHaveValue('400');
    expect(screen.getByTestId('cpc-Hanbox 10-sent')).toHaveTextContent('200');

    // another period does not borrow it
    fireEvent.click(button('Bugun'));
    await waitFor(() => expect(screen.getByLabelText('Sarf: Hanbox 10-sent')).toHaveValue(''));
  });

  it('still works when the browser refuses to store anything', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    renderWithProviders(<LeadReportContent />);
    await screen.findByLabelText('Reklama samarasi');
    fireEvent.change(screen.getByLabelText('Sarf: Hanbox 10-sent'), { target: { value: '600' } });
    expect(screen.getByTestId('cpc-Hanbox 10-sent')).toHaveTextContent('300');
  });
});

describe('Nazorat chizig\'i', () => {
  it('shows 10-minute answered % = answered_in_10 / leads, apart from the KPIs, when it is switched on', async () => {
    renderWithProviders(<LeadReportContent />);
    const line = await screen.findByLabelText("Nazorat chizig'i");
    expect(within(line).getByText("Nazorat chizig'i (KPI emas)")).toBeInTheDocument();
    expect(within(line).getByText('10 daqiqa ichida javob %')).toBeInTheDocument();
    expect(screen.getByTestId('control-line')).toHaveTextContent('60%'); // 24 / 40
    expect(within(line).getByText('24 / 40 lid')).toBeInTheDocument();
  });

  it('is gone when the setting is off', async () => {
    api.fetchSettings.mockResolvedValue({ control_line_10min: false });
    renderWithProviders(<LeadReportContent />);
    await screen.findByTestId('tile-Shartnomalar');
    // the settings may arrive a moment after the report
    await waitFor(() => expect(screen.queryByLabelText("Nazorat chizig'i")).not.toBeInTheDocument());
    expect(screen.queryByText('10 daqiqa ichida javob %')).not.toBeInTheDocument();
  });
});

describe("Tasdiq kutayotgan va'dalar", () => {
  it('is for the boss only', async () => {
    renderWithProviders(<LeadReportContent />); // a senior, not admin
    await screen.findByTestId('tile-Shartnomalar');
    expect(screen.queryByText("Tasdiq kutayotgan va'dalar")).not.toBeInTheDocument();
    expect(api.fetchPendingPromises).not.toHaveBeenCalled();
  });

  it('lists the pending requests and approves one', async () => {
    role.value = { isLeadSenior: true, isAdmin: true, loading: false };
    renderWithProviders(<LeadReportContent />);
    expect(await screen.findByText('Malika R.')).toBeInTheDocument();
    expect(screen.getByText("10% chegirma, 2 oy bo'lib to'lash")).toBeInTheDocument();
    expect(screen.getByText('Chegirma')).toBeInTheDocument();
    expect(screen.getByText('Sabab: Ota-ona qarshi')).toBeInTheDocument();

    fireEvent.click(button('Tasdiqlash'));
    await waitFor(() => expect(api.decidePromise).toHaveBeenCalledWith('promise-1', true));
  });

  it('rejects one', async () => {
    role.value = { isLeadSenior: true, isAdmin: true, loading: false };
    renderWithProviders(<LeadReportContent />);
    await screen.findByText('Malika R.');
    fireEvent.click(button('Rad etish'));
    await waitFor(() => expect(api.decidePromise).toHaveBeenCalledWith('promise-1', false));
  });

  it('says why when the server refuses (already decided)', async () => {
    role.value = { isLeadSenior: true, isAdmin: true, loading: false };
    api.decidePromise.mockRejectedValue(new Error('promise_not_pending'));
    renderWithProviders(<LeadReportContent />);
    await screen.findByText('Malika R.');
    fireEvent.click(button('Tasdiqlash'));
    expect(await screen.findByText("Bu so'rov allaqachon ko'rib chiqilgan")).toBeInTheDocument();
  });

  it('has an empty state', async () => {
    role.value = { isLeadSenior: true, isAdmin: true, loading: false };
    api.fetchPendingPromises.mockResolvedValue([]);
    renderWithProviders(<LeadReportContent />);
    expect(await screen.findByText("Tasdiq kutayotgan so'rov yo'q")).toBeInTheDocument();
  });

  it('opens the lead card from the request', async () => {
    role.value = { isLeadSenior: true, isAdmin: true, loading: false };
    renderWithProviders(<LeadReportContent />);
    await screen.findByText('Malika R.');
    fireEvent.click(button('Malika R.'));
    expect(screen.getByTestId('card-sheet')).toHaveTextContent('lead-9');
  });
});
