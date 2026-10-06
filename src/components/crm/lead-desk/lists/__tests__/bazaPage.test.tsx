import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import LeadBazaContent from '@/components/crm/pages/LeadBazaContent';
import { listRow, renderWithProviders } from './testUtils';

const api = vi.hoisted(() => ({ fetchBazaLeads: vi.fn() }));
vi.mock('../../api', () => api);

// the reactivation_queues read: `from(table).select(..).in(col, ids).in(..)` awaited
const sb = vi.hoisted(() => ({
  result: { data: [] as unknown[], error: null as { message: string } | null },
  reads: [] as [string, string, unknown][],
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        in: (col: string, values: unknown) => {
          sb.reads.push([table, col, values]);
          return q;
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(sb.result).then(resolve, reject),
      };
      return q;
    },
  },
}));

vi.mock('../LeadCardSheet', () => ({
  default: ({ leadId }: { leadId: string | null }) => (leadId ? <div data-testid="card-sheet">{leadId}</div> : null),
}));

const LONG = 'Talaba 19 yosh, Farg\'onadan. TOPIK 3 sertifikati bor, Bakalavrga topshirmoqchi. Narxni so\'ragan, ota-onasi bilan maslahatlashmoqchi. ' +
  'Ikki marta qo\'ng\'iroq qilingan, ikkinchisida javob bergan. Keyingi qadam: ota-onasi bilan birga qo\'ng\'iroq va sertifikat nusxasi.';

const talaba = listRow({
  id: 'old-1',
  full_name: 'Dilnoza Eski',
  crm_generation: 'old',
  stage: 'contacted',
  call_result: 'Gaplashildi',
  ai_summary: LONG,
  source: 'telegram',
  telegram_handle: 'dilnoza',
});
const short = listRow({ id: 'old-2', full_name: 'Qisqa Tahlil', crm_generation: 'old', stage: 'contract', ai_summary: 'Shartnoma yuborilgan.', call_result: null });
const lostQueued = listRow({ id: 'old-3', full_name: 'Navbatdagi', crm_generation: 'old', stage: 'lost', lost_reason: 'no_certificate' });
const lostPlain = listRow({ id: 'old-4', full_name: 'Navbatsiz', crm_generation: 'old', stage: 'lost', lost_reason: 'not_fit' });

const lastCall = () => api.fetchBazaLeads.mock.calls[api.fetchBazaLeads.mock.calls.length - 1][0];

beforeEach(() => {
  vi.clearAllMocks();
  sb.reads.length = 0;
  sb.result = {
    data: [
      { lead_id: 'old-3', queue_key: 'hanbox', status: 'waiting', due_at: null, channel: 'call' },
      { lead_id: 'old-3', queue_key: 'hanbox', status: 'waiting', due_at: null, channel: 'dm' },
    ],
    error: null,
  };
  api.fetchBazaLeads.mockResolvedValue({ rows: [talaba, short, lostQueued, lostPlain], total: 4 });
});

describe('Baza (eski CRM)', () => {
  it('explains that old cards never reach the desk', async () => {
    renderWithProviders(<LeadBazaContent />);
    expect(await screen.findByText("Eski CRM lidlari Ish stoliga tushmaydi; mijoz yana yozsa karta HOZIR'ga chiqadi.")).toBeInTheDocument();
  });

  it('lists the old leads with stage, the old call result and the 05.10 analysis', async () => {
    renderWithProviders(<LeadBazaContent />);
    const row = (await screen.findByText('Dilnoza Eski')).closest('tr')!;
    expect(within(row).getByText('Aloqada')).toBeInTheDocument();
    expect(within(row).getByText('Gaplashildi')).toBeInTheDocument();
    expect(within(row).getByText('@dilnoza')).toBeInTheDocument();
    expect(within(row).getByText('TG')).toBeInTheDocument();
    const other = screen.getByText('Qisqa Tahlil').closest('tr')!;
    expect(within(other).getByText('Shartnoma')).toBeInTheDocument();
    expect(within(other).getByText('Shartnoma yuborilgan.')).toBeInTheDocument();
    expect(screen.getByText('05.10 tahlili', { selector: 'th' })).toBeInTheDocument();
    expect(screen.getByText('1–4 / 4 ta')).toBeInTheDocument();
  });

  it('shows a long analysis cut short and expands it on request', async () => {
    renderWithProviders(<LeadBazaContent />);
    const row = (await screen.findByText('Dilnoza Eski')).closest('tr')!;
    expect(within(row).queryByText(LONG)).not.toBeInTheDocument();
    expect(within(row).getByText(/^Talaba 19 yosh.*…$/)).toBeInTheDocument();
    // a short analysis has nothing to expand
    expect(within(screen.getByText('Qisqa Tahlil').closest('tr')!).queryByLabelText(/Tahlilni/)).not.toBeInTheDocument();

    const more = within(row).getByLabelText("Tahlilni to'liq ko'rsatish: Dilnoza Eski");
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(within(row).getByText(LONG)).toBeInTheDocument();
    expect(screen.queryByTestId('card-sheet')).not.toBeInTheDocument(); // expanding does not open the card

    fireEvent.click(within(row).getByLabelText("Tahlilni yig'ish: Dilnoza Eski"));
    expect(within(row).queryByText(LONG)).not.toBeInTheDocument();
  });

  it('lost leads show where they stand in the reactivation queues, the others a dash', async () => {
    renderWithProviders(<LeadBazaContent />);
    const queued = (await screen.findByText('Navbatdagi')).closest('tr')!;
    expect(await within(queued).findByText('Hanbox · kutmoqda')).toBeInTheDocument(); // two rows (call + dm), one line
    expect(within(screen.getByText('Navbatsiz').closest('tr')!).getByText('Navbatda emas')).toBeInTheDocument();
    // only the lost leads on the page are looked up
    await waitFor(() => expect(sb.reads.length).toBeGreaterThan(0));
    expect(sb.reads[0]).toEqual(['reactivation_queues', 'lead_id', ['old-3', 'old-4']]);
    const cells = screen.getByText('Dilnoza Eski').closest('tr')!.querySelectorAll('td');
    expect(cells[cells.length - 1]).toHaveTextContent('—');
  });

  it('does not look anything up when no lead on the page is lost', async () => {
    api.fetchBazaLeads.mockResolvedValue({ rows: [talaba], total: 1 });
    renderWithProviders(<LeadBazaContent />);
    await screen.findByText('Dilnoza Eski');
    expect(sb.reads).toHaveLength(0);
  });

  it('is read-only: no action beyond opening the card', async () => {
    renderWithProviders(<LeadBazaContent />);
    await screen.findByText('Dilnoza Eski');
    const buttons = [...document.querySelectorAll('button')].map((b) => ` `).join(' | ');
    expect(buttons).not.toMatch(/Qayta ochish|Egasini|Pin|Saqlash|O'chirish|Eksport/);
  });

  it('opens the card on a row click', async () => {
    renderWithProviders(<LeadBazaContent />);
    fireEvent.click(await screen.findByText('Dilnoza Eski'));
    expect(screen.getByTestId('card-sheet')).toHaveTextContent('old-1');
  });

  it('turns the filters into fetchBazaLeads arguments', async () => {
    renderWithProviders(<LeadBazaContent />);
    await screen.findByText('Dilnoza Eski');
    expect(lastCall()).toMatchObject({ q: undefined, stage: null, city: null, cert: null, from: null, to: null, limit: 50, offset: 0 });

    fireEvent.change(screen.getByLabelText('Bosqich'), { target: { value: 'lost' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ stage: 'lost' }));
    fireEvent.change(screen.getByLabelText('Viloyat'), { target: { value: 'Buxoro' } });
    fireEvent.change(screen.getByLabelText('Sertifikat'), { target: { value: 'TOPIK 2' } });
    fireEvent.change(screen.getByLabelText('Yaratilgan: dan'), { target: { value: '2026-09-01' } });
    await waitFor(() =>
      expect(lastCall()).toMatchObject({ stage: 'lost', city: 'Buxoro', cert: 'TOPIK 2', from: '2026-08-31T19:00:00.000Z', to: null, offset: 0 }),
    );

    fireEvent.change(screen.getByLabelText('Lidlarni qidirish'), { target: { value: 'Dilnoza' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ q: 'Dilnoza' }), { timeout: 2500 });
  });

  it('pages 50 at a time', async () => {
    api.fetchBazaLeads.mockResolvedValue({ rows: [talaba], total: 554 });
    renderWithProviders(<LeadBazaContent />);
    expect(await screen.findByText('1–1 / 554 ta')).toBeInTheDocument();
    expect(screen.getByText('1 / 12')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Keyingi sahifa'));
    await waitFor(() => expect(lastCall()).toMatchObject({ offset: 50, limit: 50 }));
  });

  it('has an empty state and an error state', async () => {
    api.fetchBazaLeads.mockResolvedValueOnce({ rows: [], total: 0 });
    const view = renderWithProviders(<LeadBazaContent />);
    expect(await screen.findByText("Bazada lid yo'q")).toBeInTheDocument();
    view.unmount();

    api.fetchBazaLeads.mockRejectedValueOnce(new Error('not_allowed'));
    renderWithProviders(<LeadBazaContent />);
    expect(await screen.findByText("Ro'yxatni yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByText("Bu amalga ruxsat yo'q")).toBeInTheDocument();
  });
});
