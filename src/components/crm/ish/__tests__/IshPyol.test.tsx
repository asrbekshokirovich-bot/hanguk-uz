import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import en from '@/locales/en.json';
import type { IshApi } from '@/lib/ish/api';
import type { IshTopup } from '@/lib/ish/types';
import { IshApiProvider } from '../context';
import { IshPyol } from '../IshPyol';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});

const request: IshTopup = {
  id: 't1',
  worker_id: 'w1',
  first_name: 'Aziz',
  last_name: 'Karimov',
  phone: '+821012345678',
  pyols: 100,
  amount_won: 9900,
  method: 'bank',
  payer_name: 'AZIZ K',
  status: 'pending',
  note: '',
  created_at: '2026-11-24T02:00:00Z',
  decided_at: null,
};

function base(over: Partial<IshApi>): Partial<IshApi> {
  return {
    freeDays: vi.fn(async () => [{ day: '2026-11-26', district: 'Ansan', part: 'any' as const, workers: 3 }]),
    freeWorkers: vi.fn(async () => []),
    topups: vi.fn(async () => [request]),
    approveTopup: vi.fn(async () => 190),
    rejectTopup: vi.fn(async () => undefined),
    paymentDetails: vi.fn(async () => ({ packs: [{ pyols: 30, won: 3300 }], methods: { bank: 'Shinhan 110-000' } })),
    setPaymentSetting: vi.fn(async () => undefined),
    monthlyHires: vi.fn(async () => []),
    monthlyInterest: vi.fn(async () => []),
    monthlyJobs: vi.fn(async () => []),
    pyolReport: vi.fn(async () => [{ day: '2026-11-24', sold: 100, sold_won: 9900, free: 90, gift: null, refunded: null, spent: 30 }]),
    ...over,
  };
}

function renderPyol(api: Partial<IshApi>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <I18nextProvider i18n={i18n}>
        <IshApiProvider api={api as IshApi}>
          <IshPyol />
        </IshApiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('CRM → Hanguk Ish → «Puyl & free days»', () => {
  it('shows who is free, and the workers of a day on click', async () => {
    const api = base({});
    renderPyol(api);
    fireEvent.click(await screen.findByTestId('ish-free-2026-11-26-Ansan'));
    await waitFor(() => expect(api.freeWorkers).toHaveBeenCalledWith('2026-11-26', 'Ansan'));
    expect(screen.getByText(/3 workers/)).toBeTruthy();
  });

  it('approves a top-up once the money came', async () => {
    const api = base({});
    renderPyol(api);
    await screen.findByTestId('ish-topup-t1');
    fireEvent.click(screen.getByRole('button', { name: 'Money came — approve' }));
    await waitFor(() => expect(api.approveTopup).toHaveBeenCalledWith('t1'));
  });

  it('saves only the payment details that changed', async () => {
    const api = base({});
    renderPyol(api);
    const kakao = await screen.findByLabelText('KakaoPay');
    await waitFor(() => expect((screen.getByLabelText('Bank account') as HTMLInputElement).value).toBe('Shinhan 110-000'));
    fireEvent.change(kakao, { target: { value: 'https://qr.kakaopay.com/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.setPaymentSetting).toHaveBeenCalledTimes(1));
    expect(api.setPaymentSetting).toHaveBeenCalledWith('kakaopay', 'https://qr.kakaopay.com/x');
  });

  it('sums the month', async () => {
    renderPyol(base({}));
    expect((await screen.findByTestId('ish-pyol-total')).textContent).toContain('Sold 100 P');
  });
});
