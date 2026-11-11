import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import type { SupabaseClient } from '@supabase/supabase-js';
import uz from '@/locales/uz.json';
import samples from '../../../../../hanguk_ish/test/fixtures/backend_samples.json';
import IshContent, { IshSection } from '../IshContent';
import type { IshJobPage } from '@/lib/ish/types';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

type Handler = (params: Record<string, unknown> | undefined) => unknown;

/** A Hanguk Ish client: a staff session (or none) and rpc answered by [handlers]. */
function fakeClient(handlers: Record<string, Handler>, signedIn = true) {
  const session = signedIn ? { user: { id: 'staff-1', phone: '998901234567' } } : null;
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
  return { client: { rpc, auth, from } as unknown as SupabaseClient, rpc, auth, messages };
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

const staffHandlers = (overrides: Record<string, Handler> = {}): Record<string, Handler> => ({
  is_staff: () => true,
  staff_board: () => samples.staff_board,
  staff_businesses: () => samples.staff_businesses,
  staff_shift: () => job,
  staff_candidates: () => samples.staff_candidates,
  staff_send_offers: (p) => (p?.p_workers as string[]).length,
  ...overrides,
});

describe('CRM → Hanguk Ish', () => {
  beforeEach(() => {
    // The samples' moment: the day before the job.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T04:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('says the database is not connected while its address is not set', () => {
    renderWith(<IshContent />);
    expect(screen.getByText('Hanguk Ish bazasi hali ulanmagan')).toBeInTheDocument();
  });

  it('signs in with the phone and the SMS code', async () => {
    const { client, auth } = fakeClient({}, false);
    renderWith(<IshSection client={client} />);
    const phone = await screen.findByLabelText('Telefon raqam');
    fireEvent.change(phone, { target: { value: '+998 90 123 45 67' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kod yuborish' }));
    await waitFor(() => expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+998901234567' }));
    fireEvent.change(await screen.findByLabelText('SMS kod'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    await waitFor(() =>
      expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: '+998901234567', token: '123456', type: 'sms' }),
    );
  });

  it('someone not on the staff list is told so and can sign out', async () => {
    const { client, auth } = fakeClient({ is_staff: () => false });
    renderWith(<IshSection client={client} />);
    expect(await screen.findByText(/Hanguk Ish xodimlari ro'yxatida yo'q/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chiqish' }));
    expect(auth.signOut).toHaveBeenCalled();
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
