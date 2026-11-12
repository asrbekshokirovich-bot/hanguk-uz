import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import type { SupabaseClient } from '@supabase/supabase-js';
import uz from '@/locales/uz.json';
import samples from '../../../../../hanguk_ish/test/fixtures/backend_samples.json';
import IshContent, { IshSection } from '../IshContent';
import type { IshAppBusiness, IshJobPage } from '@/lib/ish/types';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
// hanguk.uz's own client: the section uses it (P48, one project).
const main = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return main.client;
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

type Handler = (params: Record<string, unknown> | undefined) => unknown;

/** hanguk.uz's client: a staff session (or none); `ish` rpc answered by [handlers]. */
function fakeClient(handlers: Record<string, Handler>, signedIn = true) {
  const session = signedIn ? { user: { id: 'staff-1', email: 'aziza@hanguk.uz' } } : null;
  const rpc = vi.fn(async (fn: string, params?: Record<string, unknown>) => {
    const handler = handlers[fn];
    if (!handler) return { data: null, error: { message: `no handler for ${fn}` } };
    try {
      return { data: await handler(params), error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  });
  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const messages: Record<string, unknown>[] = [];
  const from = vi.fn(() => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      insert: (row: Record<string, unknown>) => {
        messages.push({ id: messages.length + 1, sender_id: 'staff-1', lang: null, translations: {}, created_at: '2026-11-11T04:00:00Z', ...row });
        return query;
      },
      single: async () => ({ data: messages[messages.length - 1], error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: messages, error: null }),
    };
    return query;
  });
  // Hanguk Ish is the schema `ish`: every call goes through schema('ish').
  const schema = vi.fn((_name: string) => ({ rpc, from }));
  return { client: { schema, auth } as unknown as SupabaseClient, rpc, auth, schema, messages };
}

function renderWith(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
    </QueryClientProvider>,
  );
}

const job = samples.staff_shift as unknown as IshJobPage;
// P52: the 사장님 app's businesses — one just opened (no real name), one the staff suspended.
const appBusinesses = samples.staff_app_businesses as unknown as IshAppBusiness[];
const appFresh = appBusinesses.find((b) => b.biz_no === null && b.status === 'verified')!;
const appSuspended = appBusinesses.find((b) => b.status === 'rejected')!;

const staffHandlers = (overrides: Record<string, Handler> = {}): Record<string, Handler> => ({
  is_staff: () => true,
  staff_board: () => samples.staff_board,
  staff_businesses: () => samples.staff_businesses,
  staff_shift: () => job,
  staff_candidates: () => samples.staff_candidates,
  staff_send_offers: (p) => (p?.p_workers as string[]).length,
  staff_app_businesses: () => appBusinesses,
  staff_update_app_business: (p) => p?.p_business,
  staff_set_app_business_blocked: (p) => (p?.p_blocked ? 'rejected' : 'verified'),
  ...overrides,
});

describe('CRM → Hanguk Ish', () => {
  beforeEach(() => {
    // The samples' moment: the day before the job.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T04:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('uses hanguk.uz\'s own client and session: every call goes to the ish schema', async () => {
    const fake = fakeClient(staffHandlers());
    main.client = fake.client;
    renderWith(<IshContent />);
    expect(await screen.findByText('aziza@hanguk.uz bilan kirilgan')).toBeInTheDocument();
    expect(await screen.findByTestId(`ish-job-${job.id}`)).toBeInTheDocument();
    expect(fake.schema).toHaveBeenCalledWith('ish');
    expect(fake.schema.mock.calls.every(([name]) => name === 'ish')).toBe(true);
  });

  it('without a hanguk.uz session it asks to sign in again (no separate sign-in)', async () => {
    const { client } = fakeClient({}, false);
    renderWith(<IshSection client={client} />);
    expect(await screen.findByText('Qaytadan kiring.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Telefon raqam')).not.toBeInTheDocument();
  });

  it('someone not on the staff list is told so', async () => {
    const { client } = fakeClient({ is_staff: () => false });
    renderWith(<IshSection client={client} />);
    expect(
      await screen.findByText("aziza@hanguk.uz Hanguk Ish xodimlari ro'yxatida yo'q. Admin sizni xodim qilib qo'shishi kerak."),
    ).toBeInTheDocument();
  });

  it('the week\'s jobs with their offers; a job opens with the employer\'s contact and the answers', async () => {
    const { client } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    const row = await screen.findByTestId(`ish-job-${job.id}`);
    expect(within(row).getByText('이삿짐 운반 보조')).toBeInTheDocument();
    expect(within(row).getByText("Hongdae ko'chish xizmati")).toBeInTheDocument();
    expect(within(row).getByText('14:00–18:00')).toBeInTheDocument();
    expect(within(row).getByText('13 000 ₩')).toBeInTheDocument();
    expect(within(row).getByText('Yuborildi 1')).toBeInTheDocument();
    expect(within(row).getByText('Rad etdi 1')).toBeInTheDocument();

    fireEvent.click(row);
    expect(await screen.findByText('Ish beruvchi bilan aloqa')).toBeInTheDocument();
    expect(screen.getByText('010-5555-1234').closest('a')).toHaveAttribute('href', 'tel:010-5555-1234');
    expect(screen.getByText('@hongdae_move').closest('a')).toHaveAttribute('href', 'https://t.me/hongdae_move');
    expect(screen.getByText('오전 10시까지 도착')).toBeInTheDocument();
    const offers = screen.getByText('Takliflar').closest('.rounded-lg') as HTMLElement;
    expect(within(offers).getByText('Aziz Karimov')).toBeInTheDocument();
    expect(within(offers).getByText('Malika Yusupova')).toBeInTheDocument();
  });

  it('who fits: the answered ones cannot be offered again; the ticked ones get the offer with the note', async () => {
    const { client, rpc } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    fireEvent.click(await screen.findByTestId(`ish-job-${job.id}`));
    const timur = await screen.findByTestId('ish-candidate-00000000-0000-0000-0000-0000000000a3');
    const malika = screen.getByTestId('ish-candidate-00000000-0000-0000-0000-0000000000a2');
    expect(within(malika).getByRole('checkbox')).toBeDisabled();
    expect(within(malika).getByText('Rad etdi')).toBeInTheDocument();
    expect(within(timur).getByText("Bo'sh")).toBeInTheDocument();

    const send = screen.getByRole('button', { name: /Taklif yuborish/ });
    expect(send).toBeDisabled();
    fireEvent.click(within(timur).getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/Ishchiga izoh/), { target: { value: 'Ertalab 9:50 da' } });
    expect(send).toHaveTextContent('Taklif yuborish (1)');
    fireEvent.click(send);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('staff_send_offers', {
        p_shift: job.id,
        p_workers: ['00000000-0000-0000-0000-0000000000a3'],
        p_note: 'Ertalab 9:50 da',
      }),
    );
  });

  it('applications: 확정 after the call, then on the day who came and the pay', async () => {
    const worker = job.offers[0].worker;
    const withApplication = (status: string, extra: Record<string, unknown> = {}) => ({
      ...job,
      applications: [
        {
          id: 'app-1', status, created_at: '2026-11-11T03:30:00Z', decided_at: null, check_in_at: null,
          check_out_at: null, worked_minutes: null, pay_amount: null, paid_at: null, worker, ...extra,
        },
      ],
    });
    let page: unknown = withApplication('pending');
    const { client, rpc } = fakeClient(
      staffHandlers({
        staff_shift: () => page,
        decide_application: () => {
          page = withApplication('confirmed');
          return {};
        },
        staff_mark_attendance: () => {
          page = withApplication('completed', { worked_minutes: 210, pay_amount: 45500 });
          return {};
        },
        set_shift_paid: () => 1,
      }),
    );
    renderWith(<IshSection client={client} />);
    fireEvent.click(await screen.findByTestId(`ish-job-${job.id}`));
    const row = await screen.findByTestId('ish-application-app-1');
    expect(within(row).getByText('Javob kutmoqda')).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Tasdiqlash' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('decide_application', { p_application: 'app-1', p_accept: true }));
    expect(await within(row).findByText('Tasdiqlangan')).toBeInTheDocument();

    // The job's day: it has started.
    vi.setSystemTime(new Date('2026-11-12T06:00:00Z'));
    fireEvent.click(screen.getByRole('button', { name: /Ishlar ro'yxati/ }));
    fireEvent.click(await screen.findByTestId(`ish-job-${job.id}`));
    const onDay = await screen.findByTestId('ish-application-app-1');
    fireEvent.click(within(onDay).getByRole('button', { name: 'Keldi' }));
    const minutes = await screen.findByLabelText('Ishlagan vaqti (daqiqa)');
    expect(minutes).toHaveValue('240');
    expect(screen.getByText("To'lov: 52 000 ₩")).toBeInTheDocument();
    fireEvent.change(minutes, { target: { value: '210' } });
    expect(screen.getByText("To'lov: 45 500 ₩")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('staff_mark_attendance', { p_application: 'app-1', p_came: true, p_worked_minutes: 210 }),
    );
    expect(await screen.findByText(/3 soat 30 daq · 45 500 ₩/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "To'landi deb belgilash" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('set_shift_paid', { p_shift: job.id, p_paid: true }));
  });

  it('the employers the staff keep, with their contact', async () => {
    const { client } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Ish beruvchilar' }));
    expect(await screen.findByText('홍대 이삿짐센터 · Logistika')).toBeInTheDocument();
    expect(screen.getByText('010-5555-1234 · @hongdae_move')).toBeInTheDocument();
    expect(screen.getByText('김사장')).toBeInTheDocument();
  });

  it('the businesses the app opened: one without a real name is pointed out, a suspended one says so', async () => {
    const { client } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Ilovadagi bizneslar' }));
    const fresh = within(await screen.findByTestId(`ish-app-business-${appFresh.id}`));
    expect(fresh.getByText(appFresh.name)).toBeInTheDocument();
    expect(fresh.getByText("Haqiqiy nomi qo'yilmagan")).toBeInTheDocument();
    expect(fresh.getByText('Faol')).toBeInTheDocument();
    expect(fresh.getByRole('button', { name: "To'xtatish" })).toBeInTheDocument();
    const stopped = within(screen.getByTestId(`ish-app-business-${appSuspended.id}`));
    expect(stopped.getByText('Sundaeguk · Sinchon')).toBeInTheDocument();
    expect(stopped.getByText("To'xtatilgan")).toBeInTheDocument();
    expect(stopped.getByRole('button', { name: 'Qayta yoqish' })).toBeInTheDocument();
    expect(stopped.queryByText("Haqiqiy nomi qo'yilmagan")).not.toBeInTheDocument();
    const dalbit = within(screen.getByTestId('ish-app-business-10000000-0000-0000-0000-000000000001'));
    expect(dalbit.getByText('6 ochiq · jami 7')).toBeInTheDocument();
    expect(dalbit.getByText('24 soatda: 7')).toBeInTheDocument();
    expect(within(screen.getByTestId('ish-app-business-10000000-0000-0000-0000-000000000002')).getByText('Tekshiruvda'))
      .toBeInTheDocument();
  });

  it('suspending says first what it means for the workers, then asks the database', async () => {
    const { client, rpc } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Ilovadagi bizneslar' }));
    const row = within(await screen.findByTestId(`ish-app-business-${appFresh.id}`));
    fireEvent.click(row.getByRole('button', { name: "To'xtatish" }));
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(dialog.getByText("Biznesni to'xtatasizmi?")).toBeInTheDocument();
    expect(dialog.getByText(/smenalari ishchilarga ko'rinmaydi/)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith('staff_set_app_business_blocked', expect.anything());
    fireEvent.click(dialog.getByRole('button', { name: "To'xtatish" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('staff_set_app_business_blocked', { p_business: appFresh.id, p_blocked: true }),
    );
  });

  it('a suspended one is let back the same way', async () => {
    const { client, rpc } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Ilovadagi bizneslar' }));
    const row = within(await screen.findByTestId(`ish-app-business-${appSuspended.id}`));
    fireEvent.click(row.getByRole('button', { name: 'Qayta yoqish' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(dialog.getByText(/smenalari yana ishchilarga ko'rinadi/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Qayta yoqish' }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('staff_set_app_business_blocked', { p_business: appSuspended.id, p_blocked: false }),
    );
  });

  it('the real name and place of an app business: trimmed, with the Uzbek name', async () => {
    const { client, rpc } = fakeClient(staffHandlers());
    renderWith(<IshSection client={client} />);
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Ilovadagi bizneslar' }));
    const row = within(await screen.findByTestId(`ish-app-business-${appFresh.id}`));
    fireEvent.click(row.getByRole('button', { name: 'Tahrirlash' }));
    const name = await screen.findByLabelText("Nomi (koreyscha, ishchilar ko'radi)");
    expect(name).toHaveValue(appFresh.name);
    fireEvent.change(name, { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeDisabled();
    fireEvent.change(name, { target: { value: ' 김밥천국 홍대점 ' } });
    fireEvent.change(screen.getByLabelText("Nomi (o'zbekcha)"), { target: { value: ' Kimbap Cheonguk ' } });
    fireEvent.change(screen.getByLabelText('Hudud (masalan, 홍대)'), { target: { value: '홍대' } });
    fireEvent.change(screen.getByLabelText('Manzil (koreyscha)'), { target: { value: '마포구 와우산로 21 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('staff_update_app_business', {
        p_business: appFresh.id,
        p_name: '김밥천국 홍대점',
        p_category: 'other',
        p_area: '홍대',
        p_address: '마포구 와우산로 21',
        p_address_detail: '',
        p_name_i18n: { uz: 'Kimbap Cheonguk' },
      }),
    );
  });

  it('a refusal is told in words', async () => {
    const { client } = fakeClient(
      staffHandlers({
        staff_board: () => {
          throw new Error('FORBIDDEN');
        },
      }),
    );
    renderWith(<IshSection client={client} />);
    expect(await screen.findByText('Bu amal faqat Hanguk Ish xodimlariga ruxsat etilgan.')).toBeInTheDocument();
  });
});
