import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import AllLeadsContent from '@/components/crm/pages/AllLeadsContent';
import { button, dialogGone, findDialog, listRow, noDialog, queryButton, renderWithProviders } from './testUtils';

const api = vi.hoisted(() => ({
  fetchAllLeads: vi.fn(),
  reassignLead: vi.fn(),
  pinLead: vi.fn(),
  fetchSettings: vi.fn(),
}));
vi.mock('../../api', () => api);

const role = vi.hoisted(() => ({ value: { isLeadSenior: false, isAdmin: false } }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => role.value }));

vi.mock('@/hooks/useStaffMentions', () => ({
  useStaffMentions: () => ({
    staffList: [
      { id: 'p1', user_id: 'u-omina', full_name: 'Omina', username: null, avatar_url: null },
      { id: 'p2', user_id: 'u-bek', full_name: 'Bekzod', username: null, avatar_url: null },
    ],
    loading: false,
    searchStaff: () => [],
  }),
}));

// the card is another module's job; the sheet is stubbed so the page can be tested alone
vi.mock('../LeadCardSheet', () => ({
  default: ({ leadId, onClose }: { leadId: string | null; onClose: () => void }) =>
    leadId ? (
      <div data-testid="card-sheet">
        {leadId}
        <button onClick={onClose}>Kartani yopish</button>
      </div>
    ) : null,
}));

const download = vi.hoisted(() => vi.fn());
vi.mock('../csv', async (importOriginal) => ({ ...(await importOriginal<typeof import('../csv')>()), downloadCsv: download }));

const dilnoza = listRow({
  id: 'lead-dilnoza',
  full_name: 'Dilnoza Abdullayeva',
  instagram_handle: 'dilnoza_a',
  phone: '+998901234567',
  stage: 'interested',
  owner_id: 'u-omina',
  cert_level: 'TOPIK 3',
  education_level: 'Bakalavr',
  city: "Farg'ona",
  priority_score: 82,
});
const sardor = listRow({ id: 'lead-sardor', full_name: 'Sardor K.', stage: 'new', owner_id: null, pinned_at: '2026-10-05T08:00:00Z' });

beforeEach(() => {
  vi.clearAllMocks();
  role.value = { isLeadSenior: false, isAdmin: false };
  api.fetchSettings.mockResolvedValue({});
  api.fetchAllLeads.mockResolvedValue({ rows: [dilnoza, sardor], total: 2 });
  api.reassignLead.mockResolvedValue(undefined);
  api.pinLead.mockResolvedValue(undefined);
});

const lastCall = () => api.fetchAllLeads.mock.calls[api.fetchAllLeads.mock.calls.length - 1][0];

describe('Barcha lidlar', () => {
  it('shows the columns of the spec for every active lead', async () => {
    renderWithProviders(<AllLeadsContent />);

    expect(await screen.findByText('Dilnoza Abdullayeva')).toBeInTheDocument();
    for (const h of ['Ism', 'Kanallar', 'Bosqich', 'Egasi', 'Sertifikat', 'Maqsad', 'Viloyat', 'Oxirgi harakat', 'Keyingi harakat', 'Ball']) {
      expect(screen.getByText(h, { selector: 'th' })).toBeInTheDocument();
    }
    const row = screen.getByText('Dilnoza Abdullayeva').closest('tr')!;
    expect(within(row).getByText('Qiziqdi')).toBeInTheDocument();
    expect(within(row).getByText('Omina')).toBeInTheDocument();
    expect(within(row).getByText('TOPIK 3')).toBeInTheDocument();
    expect(within(row).getByText('Bakalavr')).toBeInTheDocument();
    expect(within(row).getByText("Farg'ona")).toBeInTheDocument();
    expect(within(row).getByText('82')).toBeInTheDocument();
    expect(within(row).getByText('@dilnoza_a')).toBeInTheDocument();
    expect(within(row).getByText('IG')).toBeInTheDocument();
    // a lead without an owner is in the pool
    expect(within(screen.getByText('Sardor K.').closest('tr')!).getByText('Hovuz')).toBeInTheDocument();
    expect(screen.getByText('1–2 / 2 ta')).toBeInTheDocument();
  });

  it('asks for the first 50 active leads with no filter', async () => {
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');
    expect(lastCall()).toEqual({
      q: undefined,
      stage: null,
      source: null,
      ownerId: null,
      city: null,
      cert: null,
      lostReason: null,
      from: null,
      to: null,
      limit: 50,
      offset: 0,
    });
  });

  it('turns each filter into the matching fetchAllLeads argument and goes back to page 1', async () => {
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');

    fireEvent.change(screen.getByLabelText('Bosqich'), { target: { value: 'offer' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ stage: 'offer' }));
    fireEvent.change(screen.getByLabelText('Manba'), { target: { value: 'telegram' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ stage: 'offer', source: 'telegram' }));
    fireEvent.change(screen.getByLabelText('Egasi'), { target: { value: 'none' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ ownerId: 'none' }));
    fireEvent.change(screen.getByLabelText('Viloyat'), { target: { value: 'Samarqand' } });
    fireEvent.change(screen.getByLabelText('Sertifikat'), { target: { value: 'IELTS 6.0' } });
    fireEvent.change(screen.getByLabelText('Kelgan sana: dan'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('gacha'), { target: { value: '2026-10-05' } });

    await waitFor(() =>
      expect(lastCall()).toEqual({
        q: undefined,
        stage: 'offer',
        source: 'telegram',
        ownerId: 'none',
        city: 'Samarqand',
        cert: 'IELTS 6.0',
        lostReason: null,
        from: '2026-09-30T19:00:00.000Z',
        to: '2026-10-05T19:00:00.000Z',
        limit: 50,
        offset: 0,
      }),
    );

    fireEvent.click(button('Tozalash'));
    await waitFor(() => expect(lastCall()).toMatchObject({ stage: null, source: null, ownerId: null, city: null, cert: null, from: null, to: null }));
  });

  it('searches by name / phone / @username after the typing pauses', async () => {
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');
    const calls = api.fetchAllLeads.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Lidlarni qidirish'), { target: { value: ' @dilnoza ' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ q: '@dilnoza', offset: 0 }), { timeout: 2000 });
    expect(api.fetchAllLeads.mock.calls.length).toBe(calls + 1); // one call for the whole word, not one per letter
  });

  it('pages 50 at a time from the server total', async () => {
    api.fetchAllLeads.mockResolvedValue({ rows: [dilnoza], total: 120 });
    renderWithProviders(<AllLeadsContent />);

    expect(await screen.findByText('1–1 / 120 ta')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Oldingi sahifa')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Keyingi sahifa'));
    await waitFor(() => expect(lastCall()).toMatchObject({ limit: 50, offset: 50 }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
  });

  it('opens the lead card when a row is clicked', async () => {
    renderWithProviders(<AllLeadsContent />);
    fireEvent.click(await screen.findByText('Dilnoza Abdullayeva'));
    expect(screen.getByTestId('card-sheet')).toHaveTextContent('lead-dilnoza');
  });

  it('says so when there are no leads, and when a filter finds none', async () => {
    api.fetchAllLeads.mockResolvedValue({ rows: [], total: 0 });
    renderWithProviders(<AllLeadsContent />);
    expect(await screen.findByText("Faol lid yo'q")).toBeInTheDocument();
    expect(screen.getByText('0 ta')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Bosqich'), { target: { value: 'offer' } });
    expect(await screen.findByText('Filtrga mos lid topilmadi')).toBeInTheDocument();
  });

  it('shows the failure and lets the person retry', async () => {
    api.fetchAllLeads.mockRejectedValueOnce(new Error('not_allowed'));
    renderWithProviders(<AllLeadsContent />);

    expect(await screen.findByText("Bu amalga ruxsat yo'q")).toBeInTheDocument();
    fireEvent.click(button('Qayta urinish'));
    expect(await screen.findByText('Dilnoza Abdullayeva')).toBeInTheDocument();
  });

  it('shows skeleton rows, not a crash, while the first page loads', () => {
    api.fetchAllLeads.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<AllLeadsContent />);
    expect(screen.getByLabelText('Barcha lidlar')).toBeInTheDocument();
    expect(screen.queryByText("Faol lid yo'q")).not.toBeInTheDocument();
  });
});

describe('what only a senior / boss can do', () => {
  it('an operator gets neither Eksport nor the owner and pin actions', async () => {
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');
    expect(queryButton('Eksport')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Egasini o'zgartirish/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pin qilish/)).not.toBeInTheDocument();
  });

  it('a senior (not the boss) reassigns and pins but cannot export (spec 13)', async () => {
    role.value = { isLeadSenior: true, isAdmin: false };
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');
    expect(queryButton('Eksport')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Egasini o'zgartirish/).length).toBeGreaterThan(0);
  });

  it('a senior reassigns a lead from the owner picker', async () => {
    role.value = { isLeadSenior: true, isAdmin: false };
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');

    fireEvent.click(screen.getByLabelText("Egasini o'zgartirish: Sardor K."));
    const dialog = await findDialog();
    fireEvent.change(within(dialog).getByLabelText('Egasi'), { target: { value: 'u-bek' } });
    fireEvent.click(button('Saqlash', dialog));

    await waitFor(() => expect(api.reassignLead).toHaveBeenCalledWith('lead-sardor', 'u-bek'));
    await dialogGone();
    expect(screen.queryByTestId('card-sheet')).not.toBeInTheDocument(); // the action did not open the row
  });

  it('can send a lead back to the pool', async () => {
    role.value = { isLeadSenior: true, isAdmin: false };
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');

    fireEvent.click(screen.getByLabelText("Egasini o'zgartirish: Dilnoza Abdullayeva"));
    const dialog = await findDialog();
    expect(within(dialog).getByLabelText('Egasi')).toHaveValue('u-omina');
    fireEvent.change(within(dialog).getByLabelText('Egasi'), { target: { value: '' } });
    fireEvent.click(button('Saqlash', dialog));

    await waitFor(() => expect(api.reassignLead).toHaveBeenCalledWith('lead-dilnoza', null));
  });

  it("keeps the dialog open and explains the refusal when the server says no", async () => {
    role.value = { isLeadSenior: true, isAdmin: false };
    api.reassignLead.mockRejectedValue(new Error('not_allowed'));
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');

    fireEvent.click(screen.getByLabelText("Egasini o'zgartirish: Sardor K."));
    const dialog = await findDialog();
    fireEvent.change(within(dialog).getByLabelText('Egasi'), { target: { value: 'u-bek' } });
    fireEvent.click(button('Saqlash', dialog));

    expect(await within(dialog).findByText("Bu amalga ruxsat yo'q")).toBeInTheDocument();
    expect(noDialog()).toBe(false);
  });

  it('pins and unpins', async () => {
    role.value = { isLeadSenior: true, isAdmin: false };
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');

    fireEvent.click(screen.getByLabelText('Pin qilish: Dilnoza Abdullayeva'));
    await waitFor(() => expect(api.pinLead).toHaveBeenCalledWith('lead-dilnoza', true));
    fireEvent.click(screen.getByLabelText('Pinni olib tashlash: Sardor K.'));
    await waitFor(() => expect(api.pinLead).toHaveBeenCalledWith('lead-sardor', false));
    expect(screen.queryByTestId('card-sheet')).not.toBeInTheDocument();
  });

  it('exports the whole current filter, not just the visible page', async () => {
    role.value = { isLeadSenior: true, isAdmin: true };
    api.fetchAllLeads.mockResolvedValue({ rows: [dilnoza, sardor], total: 2 });
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText('Dilnoza Abdullayeva');
    fireEvent.change(screen.getByLabelText('Manba'), { target: { value: 'instagram' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ source: 'instagram' }));

    fireEvent.click(button('Eksport'));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    // one big page with the same filter
    expect(lastCall()).toMatchObject({ source: 'instagram', limit: 1000, offset: 0 });
    const [filename, csv] = download.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^barcha-lidlar-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Ism,Telefon');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Dilnoza Abdullayeva');
    expect(lines[1]).toContain('Omina'); // the owner as a name, not an id
    expect(lines[2]).toContain('Hovuz');
  });

  it('cannot export an empty list', async () => {
    role.value = { isLeadSenior: true, isAdmin: true };
    api.fetchAllLeads.mockResolvedValue({ rows: [], total: 0 });
    renderWithProviders(<AllLeadsContent />);
    await screen.findByText("Faol lid yo'q");
    expect(button('Eksport')).toBeDisabled();
  });
});
