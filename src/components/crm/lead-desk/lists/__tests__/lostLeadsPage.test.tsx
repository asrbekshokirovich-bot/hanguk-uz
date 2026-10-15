import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import LostLeadsContent from '@/components/crm/pages/LostLeadsContent';
import { button, dialogGone, findDialog, listRow, noDialog, openTab, renderWithProviders } from './testUtils';

const api = vi.hoisted(() => ({
  fetchLostLeads: vi.fn(),
  reopenLead: vi.fn(),
  fetchQueueSummary: vi.fn(),
  startQueue: vi.fn(),
  fetchSettings: vi.fn(),
}));
vi.mock('../../api', () => api);

const lostApi = vi.hoisted(() => ({ fetchLostReasonCounts: vi.fn() }));
vi.mock('../lostApi', () => lostApi);

const role = vi.hoisted(() => ({ value: { isLeadSenior: false } }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role.value }));

vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [{ id: 'p1', user_id: 'u-omina', full_name: 'Omina', username: null, avatar_url: null }],
    loading: false,
    searchStaff: () => [],
  }),
}));

vi.mock('../LeadCardSheet', () => ({
  default: ({ leadId }: { leadId: string | null }) => (leadId ? <div data-testid="card-sheet">{leadId}</div> : null),
}));

const price = listRow({
  id: 'lead-price',
  full_name: 'Aziz Narxchi',
  stage: 'lost',
  lost_reason: 'price',
  lost_competitor: 'Bright Future',
  lost_at: '2026-10-04T09:00:00Z',
  lost_by: 'u-omina',
  crm_generation: 'new',
});
const oldOne = listRow({ id: 'lead-old', full_name: 'Eski Lid', stage: 'lost', lost_reason: 'no_contact', lost_at: '2026-09-01T09:00:00Z', crm_generation: 'old' });

beforeEach(() => {
  vi.clearAllMocks();
  role.value = { isLeadSenior: false };
  api.fetchSettings.mockResolvedValue({ queue_daily_limit: 15, no_risk_announced: false });
  api.fetchLostLeads.mockResolvedValue({ rows: [price, oldOne], total: 2 });
  api.reopenLead.mockResolvedValue(undefined);
  api.fetchQueueSummary.mockResolvedValue([
    { queue_key: 'hanbox', waiting: 30, ready: 7, due: 5 },
    { queue_key: 'no_risk', waiting: 12, ready: 0, due: 0 },
    { queue_key: 'no_contact', waiting: 0, ready: 44, due: 44 },
  ]);
  api.startQueue.mockResolvedValue(30);
  lostApi.fetchLostReasonCounts.mockResolvedValue([
    { reason: 'price', n: 6 },
    { reason: 'no_contact', n: 3 },
    { reason: null, n: 1 },
  ]);
});

const lastLostCall = () => api.fetchLostLeads.mock.calls[api.fetchLostLeads.mock.calls.length - 1][0];

describe("Yo'qotilganlar tab", () => {
  it('shows reason, competitor, date, who closed it and the generation', async () => {
    renderWithProviders(<LostLeadsContent />);
    const row = (await screen.findByText('Aziz Narxchi')).closest('tr')!;
    expect(within(row).getByText('Narx')).toBeInTheDocument(); // key -> the label from the settings
    expect(within(row).getByText('Bright Future')).toBeInTheDocument();
    expect(within(row).getByText('Omina')).toBeInTheDocument();
    expect(within(row).getByText('Yangi')).toBeInTheDocument();
    const old = screen.getByText('Eski Lid').closest('tr')!;
    expect(within(old).getByText("Aloqa yo'q")).toBeInTheDocument();
    expect(within(old).getByText('Eski CRM')).toBeInTheDocument(); // nobody closed it: it came with the migration
    expect(within(old).getByText('Eski')).toBeInTheDocument();
  });

  it('groups by reason with counts and filters when a reason is picked', async () => {
    renderWithProviders(<LostLeadsContent />);
    await screen.findByText('Aziz Narxchi');
    const group = screen.getByLabelText("Sabab bo'yicha");
    const chip = (label: string) => button(label, group);
    await waitFor(() => expect(chip('Narx')).toHaveTextContent('6'));
    expect(chip('Hammasi')).toHaveTextContent('10');
    expect(screen.getByText('Sababsiz: 1')).toBeInTheDocument();

    fireEvent.click(chip('Narx'));
    await waitFor(() => expect(lastLostCall()).toMatchObject({ lostReason: 'price', offset: 0, limit: 50 }));
    expect(chip('Narx')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip('Narx')); // again: off
    await waitFor(() => expect(lastLostCall()).toMatchObject({ lostReason: null }));
  });

  it('reopens a lead only after the confirmation', async () => {
    renderWithProviders(<LostLeadsContent />);
    await screen.findByText('Aziz Narxchi');

    fireEvent.click(screen.getByLabelText('Qayta ochish: Aziz Narxchi'));
    expect(api.reopenLead).not.toHaveBeenCalled();
    expect(screen.queryByTestId('card-sheet')).not.toBeInTheDocument(); // the button did not open the row
    const dialog = await findDialog();
    fireEvent.click(button('Qayta ochish', dialog));

    await waitFor(() => expect(api.reopenLead).toHaveBeenCalledWith('lead-price'));
    await dialogGone();
  });

  it('explains a server refusal inside the dialog', async () => {
    api.reopenLead.mockRejectedValue(new Error('not_lost'));
    renderWithProviders(<LostLeadsContent />);
    await screen.findByText('Aziz Narxchi');
    fireEvent.click(screen.getByLabelText('Qayta ochish: Aziz Narxchi'));
    const dialog = await findDialog();
    fireEvent.click(button('Qayta ochish', dialog));
    expect(await within(dialog).findByText("Bu lid yo'qotilgan emas")).toBeInTheDocument();
  });

  it('opens the card on a row click', async () => {
    renderWithProviders(<LostLeadsContent />);
    fireEvent.click(await screen.findByText('Aziz Narxchi'));
    expect(screen.getByTestId('card-sheet')).toHaveTextContent('lead-price');
  });

  it('has an empty state for an empty database', async () => {
    api.fetchLostLeads.mockResolvedValue({ rows: [], total: 0 });
    lostApi.fetchLostReasonCounts.mockResolvedValue([]);
    renderWithProviders(<LostLeadsContent />);
    expect(await screen.findByText("Yo'qotilgan lid yo'q")).toBeInTheDocument();
  });
});

describe('Navbatlar tab', () => {
  const card = (key: string) => screen.getByTestId(`queue-${key}`);

  it('one card per queue: count (waiting + ready), due, label, rule and offer', async () => {
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');

    const hanbox = await screen.findByTestId('queue-hanbox');
    expect(within(hanbox).getByText("Sertifikat yo'q → Hanbox")).toBeInTheDocument();
    expect(within(hanbox).getByLabelText('Navbatda 37 ta')).toHaveTextContent('37'); // 30 waiting + 7 ready
    expect(within(hanbox).getByText('Muddati kelgan').nextSibling).toHaveTextContent('5');
    expect(within(hanbox).getByText('Kutmoqda').nextSibling).toHaveTextContent('30');
    expect(within(hanbox).getByText('Boshlangan').nextSibling).toHaveTextContent('7');
    expect(within(hanbox).getByText(/Keyingi guruh e'lon qilinganda/)).toBeInTheDocument();
    expect(within(hanbox).getByText(/birinchi dars bepul/)).toBeInTheDocument();

    expect(within(card('no_contact')).getByLabelText('Navbatda 44 ta')).toBeInTheDocument();
    // queues the database has no rows for are still shown, at zero
    expect(within(card('price')).getByLabelText('Navbatda 0 ta')).toBeInTheDocument();
  });

  it('explains how fast a started queue flows into BUGUN (the daily limit)', async () => {
    api.fetchSettings.mockResolvedValue({ queue_daily_limit: 20 });
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');
    const note = await screen.findByText(/BUGUN'ga kuniga/);
    await waitFor(() => expect(note).toHaveTextContent("BUGUN'ga kuniga 20 tadan tushadi"));
  });

  it('an operator sees the numbers but no start button', async () => {
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');
    await screen.findByTestId('queue-hanbox');
    expect(screen.queryByText(/Navbatni boshlash/, { selector: 'button' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Navbatni senior yoki rahbar boshlaydi.').length).toBeGreaterThan(0);
  });

  it('a senior starts a queue only after confirming, and only the waiting ones can be started', async () => {
    role.value = { isLeadSenior: true };
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');
    const hanbox = await screen.findByTestId('queue-hanbox');

    // nothing waiting in no_contact (all 44 already started): the button is off
    expect(button('Navbatni boshlash', card('no_contact'))).toBeDisabled();

    fireEvent.click(button('Navbatni boshlash', hanbox));
    expect(api.startQueue).not.toHaveBeenCalled();
    const dialog = await findDialog();
    expect(within(dialog).getByText(/30 ta kutayotgan lid/)).toBeInTheDocument();
    expect(within(dialog).getByText(/kuniga 15 tadan/)).toBeInTheDocument();
    expect(within(dialog).getByText(/taxminan 2 kun/)).toBeInTheDocument(); // 30 / 15

    fireEvent.click(button('Boshlash', dialog));
    await waitFor(() => expect(api.startQueue).toHaveBeenCalledWith('hanbox'));
    await dialogGone();
    // the cards are read again
    await waitFor(() => expect(api.fetchQueueSummary.mock.calls.length).toBeGreaterThan(1));
  });

  it('cancelling the confirmation starts nothing', async () => {
    role.value = { isLeadSenior: true };
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');
    const hanbox = await screen.findByTestId('queue-hanbox');
    fireEvent.click(button('Navbatni boshlash', hanbox));
    const dialog = await findDialog();
    fireEvent.click(button('Bekor qilish', dialog));
    await dialogGone();
    expect(api.startQueue).not.toHaveBeenCalled();
  });

  it("shows the server's refusal for NO RISK before it is announced, and keeps the dialog open", async () => {
    role.value = { isLeadSenior: true };
    api.startQueue.mockRejectedValue(new Error('queue_not_announced'));
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');
    const noRisk = await screen.findByTestId('queue-no_risk');
    expect(within(noRisk).getByText(/NO RISK sharti hali e'lon qilinmagan/)).toBeInTheDocument();

    fireEvent.click(button('Navbatni boshlash', noRisk));
    const dialog = await findDialog();
    fireEvent.click(button('Boshlash', dialog));

    expect(await within(dialog).findByText("Bu navbat hali e'lon qilinmagan (Sozlamalar)")).toBeInTheDocument();
    expect(api.startQueue).toHaveBeenCalledWith('no_risk');
    expect(noDialog()).toBe(false);
  });

  it('shows an error with a retry when the queues cannot be read', async () => {
    api.fetchQueueSummary.mockRejectedValueOnce(new Error('not_allowed'));
    renderWithProviders(<LostLeadsContent />);
    openTab('Navbatlar');
    expect(await screen.findByText("Navbatlarni yuklab bo'lmadi")).toBeInTheDocument();
    fireEvent.click(button('Qayta urinish'));
    expect(await screen.findByTestId('queue-hanbox')).toBeInTheDocument();
  });
});
