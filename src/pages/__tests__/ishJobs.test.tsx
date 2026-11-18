import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IshMonthlyJob } from '@/lib/ish/types';

vi.mock('@/components/native/NativeContainer', () => ({
  NativeContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { IshJobsView } from '../IshJobs';

const job = (over: Partial<IshMonthlyJob>): IshMonthlyJob => ({
  id: 'j1',
  title: '카페 바리스타',
  company: '달빛카페',
  area: '서울 마포구',
  address: '',
  lat: null,
  lng: null,
  monthly_wage: 2300000,
  days_per_week: 5,
  hours_per_day: 8,
  description: '주 5일',
  translations: { uz: { title: 'Kafe baristasi', company: 'Dalbit Kafe', description: 'Haftasiga 5 kun' } },
  status: 'open',
  category: 'cafe',
  work_time: 'day',
  created_at: '2026-11-18T01:00:00Z',
  ...over,
});

const jobs = [
  job({}),
  job({ id: 'j2', title: '물류 상하차', company: '상암물류', category: 'logistics', monthly_wage: 2600000, work_time: 'night', translations: {} }),
];

/** A signed-out visitor's client: reads answered from [rows], writes recorded. */
function fakeClient(rows: IshMonthlyJob[], opts: { session?: boolean } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let session: { user: { id: string } } | null = opts.session ? { user: { id: 'w1' } } : null;
  const listeners: ((e: string, s: unknown) => void)[] = [];
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ table, ...row });
        return { error: null };
      },
      update: (row: Record<string, unknown>) => {
        updates.push({ table, ...row });
        return { eq: async () => ({ error: null }) };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: table === 'monthly_jobs' ? rows : [], error: null }),
    };
    return query;
  });
  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithOtp: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => {
      session = { user: { id: 'w1' } };
      return { data: { session }, error: null };
    }),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const schema = vi.fn(() => ({ from }));
  return { client: { schema, auth } as unknown as SupabaseClient, inserts, updates, auth, schema };
}

function open(client: SupabaseClient, lang: 'uz' | 'ru' | 'en' | 'ko' = 'uz') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <IshJobsView client={client} lang={lang} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('hanguk.uz/ish — the public monthly jobs', () => {
  it('lists the open jobs from the ish schema in the visitor\'s language, with the pay', async () => {
    const fake = fakeClient(jobs);
    open(fake.client);
    const card = await screen.findByTestId('ish-job-j1');
    expect(within(card).getByText('Kafe baristasi')).toBeTruthy();
    expect(within(card).getByText('Dalbit Kafe')).toBeTruthy();
    expect(within(card).getByText(/2 300 000 ₩/)).toBeTruthy();
    expect(within(card).getByText(/Haftasiga 5 kun · kuniga 8 soat/)).toBeTruthy();
    expect(fake.schema).toHaveBeenCalledWith('ish');
    // No translation in this language: the Korean text.
    expect(within(screen.getByTestId('ish-job-j2')).getByText('물류 상하차')).toBeTruthy();
  });

  it('is in four languages', async () => {
    const fake = fakeClient(jobs);
    open(fake.client, 'ko');
    expect(await screen.findByText('한국 월급 일자리')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '관심 있어요' }).length).toBe(2);
  });

  it('the search narrows the list', async () => {
    const fake = fakeClient(jobs);
    open(fake.client);
    await screen.findByTestId('ish-job-j1');
    fireEvent.change(screen.getByLabelText(/Qidirish/), { target: { value: '상암' } });
    await waitFor(() => expect(screen.queryByTestId('ish-job-j1')).toBeNull());
    expect(screen.getByTestId('ish-job-j2')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Qidirish/), { target: { value: 'zzz' } });
    expect(await screen.findByText("Hozircha mos oylik ish yo'q")).toBeTruthy();
  });

  it('«Qiziqaman» signed out: a phone and a code, then the interest is sent', async () => {
    const fake = fakeClient(jobs);
    open(fake.client);
    const card = await screen.findByTestId('ish-job-j1');
    fireEvent.click(within(card).getByRole('button', { name: 'Qiziqaman' }));
    fireEvent.change(await screen.findByLabelText('Ism va familiya'), { target: { value: 'Aziz Karimov' } });
    fireEvent.change(screen.getByLabelText(/Telefon raqam/), { target: { value: '010-1234-5678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kod yuborish' }));
    await waitFor(() => expect(fake.auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+821012345678', options: { data: { app: 'hanguk_ish' } } }));
    fireEvent.change(await screen.findByLabelText(/SMS kod/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Tasdiqlash/ }));
    await waitFor(() => expect(fake.inserts).toContainEqual({ table: 'monthly_applications', job_id: 'j1' }));
    expect(fake.updates).toContainEqual({ table: 'profiles', first_name: 'Aziz', last_name: 'Karimov' });
    expect(fake.auth.verifyOtp).toHaveBeenCalledWith({ phone: '+821012345678', token: '123456', type: 'sms' });
  });

  it('a wrong number is refused before any SMS', async () => {
    const fake = fakeClient(jobs);
    open(fake.client);
    fireEvent.click(within(await screen.findByTestId('ish-job-j1')).getByRole('button', { name: 'Qiziqaman' }));
    fireEvent.change(await screen.findByLabelText(/Telefon raqam/), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kod yuborish' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(fake.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('signed in: «Qiziqaman» sends at once, no questions', async () => {
    const fake = fakeClient(jobs, { session: true });
    open(fake.client);
    fireEvent.click(within(await screen.findByTestId('ish-job-j2')).getByRole('button', { name: 'Qiziqaman' }));
    await waitFor(() => expect(fake.inserts).toContainEqual({ table: 'monthly_applications', job_id: 'j2' }));
    expect(fake.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('a failed load says so', async () => {
    const client = {
      schema: () => ({
        from: () => {
          const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: (r: (v: unknown) => void) => r({ data: null, error: { message: 'boom' } }) };
          return q;
        },
      }),
      auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) },
    } as unknown as SupabaseClient;
    open(client);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
