import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import type { IshApi } from '@/lib/ish/api';
import type { IshCoinWorker } from '@/lib/ish/types';
import { IshApiProvider } from '../context';
import { IshCoins } from '../IshCoins';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const aziz: IshCoinWorker = {
  id: 'w1',
  first_name: 'Aziz',
  last_name: 'Karimov',
  phone: '+821012345678',
  balance: 2,
  history: [{ delta: -1, balance: 2, reason: 'unlock', note: '', created_at: '2026-11-19T02:00:00Z' }],
};

function renderCoins(api: Partial<IshApi>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <I18nextProvider i18n={i18n}>
        <IshApiProvider api={api as IshApi}>
          <IshCoins />
        </IshApiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('CRM → Hanguk Ish → «Coinlar»', () => {
  it('lists the worker with the balance and the last moves', async () => {
    renderCoins({ coinWorkers: vi.fn(async () => [aziz]) });
    const card = await screen.findByTestId('ish-coins-w1');
    expect(within(card).getByText('Aziz Karimov')).toBeTruthy();
    expect(within(card).getByText('+821012345678')).toBeTruthy();
    expect(within(card).getByLabelText('Balans').textContent).toContain('2');
    expect(within(card).getByText(/Ish ochildi/)).toBeTruthy();
  });

  it('searches by what was typed', async () => {
    const coinWorkers = vi.fn(async () => [aziz]);
    renderCoins({ coinWorkers });
    await screen.findByTestId('ish-coins-w1');
    fireEvent.change(screen.getAllByLabelText('Ism yoki telefon')[0], { target: { value: '1234' } });
    fireEvent.submit(screen.getAllByLabelText('Ism yoki telefon')[0].closest('form')!);
    await waitFor(() => expect(coinWorkers).toHaveBeenLastCalledWith('1234'));
  });

  it('adds coins with a note; taking back more than the balance is off', async () => {
    const addCoins = vi.fn(async () => 5);
    renderCoins({ coinWorkers: vi.fn(async () => [aziz]), addCoins });
    const card = await screen.findByTestId('ish-coins-w1');
    fireEvent.change(within(card).getByLabelText('Miqdor'), { target: { value: '3' } });
    fireEvent.change(within(card).getByLabelText(/Izoh/), { target: { value: 'Naqd 30 000 won' } });
    expect((within(card).getByRole('button', { name: 'Olish' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(card).getByRole('button', { name: "Qo'shish" }));
    await waitFor(() => expect(addCoins).toHaveBeenCalledWith('w1', 3, 'Naqd 30 000 won'));
  });
});
