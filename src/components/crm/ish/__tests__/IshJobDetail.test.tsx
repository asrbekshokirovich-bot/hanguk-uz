import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import samples from '../../../../../hanguk_ish/test/fixtures/backend_samples.json';
import type { IshApi } from '@/lib/ish/api';
import type { IshApplication, IshJobPage, IshMessage, IshWorker } from '@/lib/ish/types';
import { IshApiProvider } from '../context';
import { IshJobDetail } from '../IshJobDetail';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const { offer_status: _o, application_status: _a, distance_km: _d, available: _v, busy: _b, ...card } =
  samples.staff_candidates[0] as unknown as Record<string, unknown>;
const worker = card as unknown as IshWorker;

const application: IshApplication = {
  id: 'app-1',
  status: 'pending',
  created_at: '2026-11-11T05:00:00+00:00',
  decided_at: null,
  check_in_at: null,
  check_out_at: null,
  worked_minutes: null,
  pay_amount: null,
  paid_at: null,
  worker,
};

const job = { ...(samples.staff_shift as unknown as IshJobPage), applications: [application] };

const fromWorker: IshMessage = {
  id: 1,
  application_id: 'app-1',
  sender_id: worker.id,
  body: 'Salom, ertaga boraman',
  lang: 'uz',
  translations: {},
  created_at: '2026-11-11T05:10:00+00:00',
};

function renderJob(api: Partial<IshApi>) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nextProvider i18n={i18n}>
        <IshApiProvider api={api as IshApi}>
          <IshJobDetail jobId={job.id} onBack={() => {}} />
        </IshApiProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('IshJobDetail — the worker\'s messages', () => {
  it('unread ones show as a number on the chat button; opening the chat reads them', async () => {
    let unread: Record<string, number> = { 'app-1': 2 };
    const api: Partial<IshApi> = {
      job: vi.fn(async () => job),
      candidates: vi.fn(async () => []),
      unread: vi.fn(async () => unread),
      messages: vi.fn(async () => [fromWorker]),
      markRead: vi.fn(async () => {
        unread = {};
      }),
    };
    renderJob(api);

    const badge = await screen.findByTestId('ish-unread-app-1');
    expect(badge).toHaveTextContent('2');
    expect(api.unread).toHaveBeenCalledWith([{ id: 'app-1', workerId: worker.id }]);
    const chat = screen.getByRole('button', { name: "Chat: 2 ta o'qilmagan" });

    fireEvent.click(chat);
    expect(await screen.findByText('Salom, ertaga boraman')).toBeInTheDocument();
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith('app-1', worker.id));
    await waitFor(() => expect(screen.queryByTestId('ish-unread-app-1')).not.toBeInTheDocument());
  });

  it('nothing unread: no number, and the chat does not mark anything without the worker\'s messages', async () => {
    const api: Partial<IshApi> = {
      job: vi.fn(async () => job),
      candidates: vi.fn(async () => []),
      unread: vi.fn(async () => ({})),
      messages: vi.fn(async () => []),
      markRead: vi.fn(async () => {}),
    };
    renderJob(api);
    const chat = await screen.findByRole('button', { name: 'Chat' });
    expect(screen.queryByTestId('ish-unread-app-1')).not.toBeInTheDocument();
    fireEvent.click(chat);
    expect(await screen.findByText("Hali xabar yo'q.")).toBeInTheDocument();
    expect(api.markRead).not.toHaveBeenCalled();
  });
});
