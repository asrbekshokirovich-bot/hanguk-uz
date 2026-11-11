import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import type { SupabaseClient } from '@supabase/supabase-js';
import uz from '@/locales/uz.json';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import ko from '@/locales/ko.json';
import samples from '../../../../../hanguk_ish/test/fixtures/backend_samples.json';
import { ishApi } from '@/lib/ish/api';
import type { IshJobPage } from '@/lib/ish/types';
import { parseJobPost } from '@/lib/ish/parseJobPost';
import { IshApiProvider } from '../context';
import { applyPost, IshJobDialog } from '../IshJobDialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const job = samples.staff_shift as unknown as IshJobPage;

describe('IshJobDialog', () => {
  it('changing a job sends it back with its Seoul times, invite-only kept', async () => {
    const rpc = vi.fn(async (fn: string) => ({
      data: fn === 'staff_businesses' ? samples.staff_businesses : job.id,
      error: null,
    }));
    const api = ishApi({ schema: () => ({ rpc }) } as unknown as SupabaseClient);
    const onSaved = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={i18n}>
          <IshApiProvider api={api}>
            <IshJobDialog job={job} open onOpenChange={() => {}} onSaved={onSaved} />
          </IshApiProvider>
        </I18nextProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('Sana')).toHaveValue('2026-11-12');
    expect(screen.getByLabelText('Boshlanishi')).toHaveValue('14:00');
    expect(screen.getByLabelText('Tugashi')).toHaveValue('18:00');
    expect(screen.getByLabelText('Soatlik maosh (₩)')).toHaveValue('13000');
    fireEvent.change(screen.getByLabelText('Soatlik maosh (₩)'), { target: { value: '14 000' } });
    fireEvent.change(screen.getByLabelText('Necha kishi'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(job.id));
    expect(rpc).toHaveBeenCalledWith('staff_save_shift', expect.objectContaining({
      p_shift: job.id,
      p_business: job.business_id,
      p_title: '이삿짐 운반 보조',
      p_starts_at: '2026-11-12T14:00:00+09:00',
      p_ends_at: '2026-11-12T18:00:00+09:00',
      p_hourly_wage: 14000,
      p_slots: 3,
      p_invite_only: true,
      p_source: 'https://t.me/koreajobs_uz/1234',
      p_notes: '오전 10시까지 도착',
    }));
  });

  it('a Telegram post fills what it says; the post joins the notes', () => {
    const draft = {
      businessId: 'b', title: '', date: '2026-11-12', start: '09:00', end: '18:00', wage: '', slots: '1',
      duties: '', dress: '', address: '', autoConfirm: false, inviteOnly: true, source: '', notes: 'Oldingi izoh',
    };
    const post = '13-noyabr 10:00-14:00, soatiga 12 000 won, 2 kishi. https://t.me/ishlar/77';
    const next = applyPost(draft, post, parseJobPost(post, new Date('2026-11-11T01:00:00Z')));
    expect(next).toMatchObject({
      date: '2026-11-13', start: '10:00', end: '14:00', wage: '12000', slots: '2',
      source: 'https://t.me/ishlar/77',
      notes: `Oldingi izoh\n\n${post}`,
    });
  });
});

describe('the section speaks the CRM\'s four languages', () => {
  const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`.replace(/_(one|few|many|other)$/, '')],
    );
  const of = (locale: Record<string, unknown>) => [...new Set(keys(locale.ish as Record<string, unknown>))].sort();

  it('every text is in uz, ru, en and ko', () => {
    const reference = of(uz);
    expect(reference.length).toBeGreaterThan(150);
    for (const locale of [ru, en, ko]) expect(of(locale)).toEqual(reference);
  });
});
