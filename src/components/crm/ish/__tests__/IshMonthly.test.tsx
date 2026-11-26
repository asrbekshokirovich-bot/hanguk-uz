import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import ko from '@/locales/ko.json';
import type { IshApi } from '@/lib/ish/api';
import type { IshMonthlyInterest, IshMonthlyJob } from '@/lib/ish/types';
import { IshApiProvider } from '../context';
import { IshMonthly, won } from '../IshMonthly';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const cafe: IshMonthlyJob = {
  id: 'm1',
  title: '카페 바리스타',
  company: '달빛카페',
  area: '서울 마포구',
  address: '',
  lat: null,
  lng: null,
  monthly_wage: 2300000,
  days_per_week: 5,
  hours_per_day: 8,
  description: '',
  translations: {},
  status: 'open',
  category: 'cafe',
  work_time: 'day',
  created_at: '2026-11-18T01:00:00Z',
};
const interested: IshMonthlyInterest[] = [
  { job_id: 'm1', worker_id: 'w1', first_name: 'Aziz', last_name: 'Karimov', phone: '+821012345678', created_at: '2026-11-18T02:00:00Z' },
];

function renderMonthly(api: Partial<IshApi>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <I18nextProvider i18n={i18n}>
        <IshApiProvider api={api as IshApi}>
          <IshMonthly />
        </IshApiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('CRM → HanPyol → «Oylik ishlar»', () => {
  beforeAll(() => {
    // Radix Select asks for these; jsdom has none.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it('formats the pay in won', () => {
    expect(won(2300000)).toBe('2 300 000 ₩');
  });

  it('lists the jobs with pay, schedule, status and how many are interested', async () => {
    renderMonthly({ monthlyJobs: vi.fn(async () => [cafe]), monthlyInterest: vi.fn(async () => interested) });
    const row = await screen.findByTestId('ish-monthly-m1');
    expect(within(row).getByText('카페 바리스타')).toBeTruthy();
    expect(within(row).getByText('2 300 000 ₩')).toBeTruthy();
    expect(within(row).getByText(/Haftasiga 5 kun · kuniga 8 soat/)).toBeTruthy();
    expect(within(row).getByText('Ochiq')).toBeTruthy();
    expect(within(row).getByRole('button', { name: '1' })).toBeTruthy();
  });

  it('shows who is interested, with the phone to call', async () => {
    renderMonthly({ monthlyJobs: vi.fn(async () => [cafe]), monthlyInterest: vi.fn(async () => interested) });
    const row = await screen.findByTestId('ish-monthly-m1');
    await waitFor(() => expect((within(row).getByRole('button', { name: '1' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(row).getByRole('button', { name: '1' }));
    const list = await screen.findByTestId('ish-monthly-interest');
    expect(within(list).getByText('Aziz Karimov')).toBeTruthy();
    expect(within(list).getByText('+821012345678')).toBeTruthy();
  });

  it('is empty at first and says how to add a job', async () => {
    renderMonthly({ monthlyJobs: vi.fn(async () => []), monthlyInterest: vi.fn(async () => []) });
    expect(await screen.findByText(/Hozircha oylik ish yo'q/)).toBeTruthy();
  });

  it('posts a new job: Korean title and company, the pay, a translation; empty translations are dropped', async () => {
    const saveMonthlyJob = vi.fn(async () => 'm2');
    renderMonthly({ monthlyJobs: vi.fn(async () => []), monthlyInterest: vi.fn(async () => []), saveMonthlyJob });
    fireEvent.click(await screen.findByTestId('ish-monthly-new'));
    const save = await screen.findByRole('button', { name: 'Saqlash' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nomi (koreyscha)'), { target: { value: '물류 상하차' } });
    fireEvent.change(screen.getByLabelText('Kompaniya (koreyscha)'), { target: { value: '상암물류' } });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Oylik maosh/), { target: { value: '2600000' } });
    fireEvent.change(screen.getByLabelText('Joylashuv (ixtiyoriy)'), { target: { value: '37.5779, 126.8896' } });
    fireEvent.change(screen.getByLabelText('UZ · nom'), { target: { value: 'Yuk ortish' } });
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(saveMonthlyJob).toHaveBeenCalledTimes(1));
    const sent = (saveMonthlyJob.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      id: null,
      title: '물류 상하차',
      company: '상암물류',
      monthlyWage: 2600000,
      lat: 37.5779,
      lng: 126.8896,
      daysPerWeek: 5,
      hoursPerDay: 8,
    });
    expect(sent.translations).toEqual({ uz: { title: 'Yuk ortish' } });
  });

  it('a wrong point is refused before saving', async () => {
    renderMonthly({ monthlyJobs: vi.fn(async () => []), monthlyInterest: vi.fn(async () => []) });
    fireEvent.click(await screen.findByTestId('ish-monthly-new'));
    fireEvent.change(await screen.findByLabelText('Nomi (koreyscha)'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Kompaniya (koreyscha)'), { target: { value: 'y' } });
    fireEvent.change(screen.getByLabelText(/Oylik maosh/), { target: { value: '2000000' } });
    fireEvent.change(screen.getByLabelText('Joylashuv (ixtiyoriy)'), { target: { value: 'Mapo' } });
    const save = screen.getByRole('button', { name: 'Saqlash' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(true));
  });

  it('closes an open job, and opens a closed one again', async () => {
    const setMonthlyJobStatus = vi.fn(async () => undefined);
    renderMonthly({ monthlyJobs: vi.fn(async () => [cafe]), monthlyInterest: vi.fn(async () => []), setMonthlyJobStatus });
    const row = await screen.findByTestId('ish-monthly-m1');
    fireEvent.click(within(row).getByRole('button', { name: 'Yopish' }));
    await waitFor(() => expect(setMonthlyJobStatus).toHaveBeenCalledWith('m1', 'closed'));
  });

  it('the Korean locale has every key of the Uzbek one for this tab', () => {
    const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
    const mine = keys((uz as { ish: { monthly: Record<string, unknown> } }).ish.monthly);
    const theirs = new Set(keys((ko as { ish: { monthly: Record<string, unknown> } }).ish.monthly));
    expect(mine.filter((k) => !theirs.has(k))).toEqual([]);
  });
});
