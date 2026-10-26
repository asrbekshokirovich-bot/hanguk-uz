import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import type { TodayData } from '../today';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const now = Date.now();
const data: TodayData = {
  now: new Date(now).toISOString(),
  waiting: 1,
  waiting_due_at: new Date(now + (7 * 60 + 12) * 1000).toISOString(),
  came_back: 4,
  offers_waiting: 18,
  rows: [
    { id: 1, rule: 'new_app_request', queue: 'now', target: 'operators', asked_at: new Date(now - 3 * 60_000).toISOString(), due_at: null, day: '', detail: { via: 'form' }, lead_id: 'l1', user_id: null, kind: 'lead', name: 'Aziz', source: 'instagram', contact_channel: 'Instagram', assigned_to: null, assignee: null },
    { id: 2, rule: 'came_back', queue: 'today', target: 'owner', asked_at: new Date(now - 30 * 60 * 60_000).toISOString(), due_at: null, day: '', detail: { days: 4 }, lead_id: 'l2', user_id: null, kind: 'lead', name: 'Bek', source: 'telegram', contact_channel: null, assigned_to: 'a', assignee: 'Operator' },
    { id: 3, rule: 'report_or_picks', queue: 'today', target: 'owner', asked_at: new Date(now - 60 * 60_000).toISOString(), due_at: null, day: '', detail: { report: true, picks: 3 }, lead_id: 'l3', user_id: null, kind: 'lead', name: 'Dilnoza', source: 'instagram', contact_channel: 'Instagram', assigned_to: null, assignee: null },
    { id: 4, rule: 'offer_unanswered', queue: 'today', target: 'documents', asked_at: new Date(now - 2 * 86_400_000).toISOString(), due_at: null, day: '', detail: { offers: 1 }, lead_id: null, user_id: 'u1', kind: 'student', name: 'Student One', source: null, contact_channel: null, assigned_to: null, assignee: null },
  ],
};
vi.mock('../today', async (orig) => {
  const real = await orig<typeof import('../today')>();
  return { ...real, useTodayInApp: () => ({ data, loading: false, error: null }) };
});

import TodayInAppContent from '@/components/crm/pages/TodayInAppContent';
import { signalWhen, timerText } from '../today';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;

describe('«Bugun ilovada» (the plan\'s mock-up)', () => {
  it('shows the three numbers and the five columns in the plan\'s words', () => {
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <TodayInAppContent />
        </I18nextProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Bugun ilovada')).toBeTruthy();
    expect(screen.getByText('Javob kutayotgan ilova murojaati')).toBeTruthy();
    expect(screen.getByText(/· 07:1\d qoldi/)).toBeTruthy();
    expect(screen.getByText('Bugun ilovaga qaytgan lidlar')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    for (const c of ['Kim', 'Signal', 'Qachon', 'Navbat', 'Kimga']) expect(screen.getByText(c)).toBeTruthy();
    expect(screen.getByText('Aziz · Lid · Instagram')).toBeTruthy();
    expect(screen.getByText('Ilovadan murojaat (forma)')).toBeTruthy();
    expect(screen.getByText('3 daqiqa oldin')).toBeTruthy();
    expect(screen.getByText('HOZIR')).toBeTruthy();
    expect(screen.getByText('Hamma operatorlar')).toBeTruthy();
    expect(screen.getByText('Ilovaga qaytdi, 4 kundan keyin')).toBeTruthy();
    expect(screen.getByText("Hisobotni ko'rdi · 3 ta ♥")).toBeTruthy();
    expect(screen.getAllByText('Lid egasi')).toHaveLength(2);
    expect(screen.getByText('Student One · Talaba')).toBeTruthy();
    expect(screen.getByText("Universitet taklifiga 48 soat javob yo'q")).toBeTruthy();
    expect(screen.getByText('2 kun')).toBeTruthy();
    expect(screen.getByText('Hujjatlar xodimi')).toBeTruthy();
    expect(screen.getAllByText('BUGUN')).toHaveLength(3);
  });

  it('the timer: left, then late; hours beyond the hour', () => {
    const at = Date.UTC(2026, 9, 26, 10, 0, 0);
    expect(timerText(new Date(at + 432_000).toISOString(), at, t)).toBe('07:12 qoldi');
    expect(timerText(new Date(at - 200_000).toISOString(), at, t)).toBe('03:20 kechikdi');
    expect(timerText(new Date(at + 2 * 3_600_000 + 15 * 60_000).toISOString(), at, t)).toBe('2 soat 15 daq qoldi');
    expect(signalWhen(new Date(at - 3 * 60_000).toISOString(), at, t)).toBe('3 daqiqa oldin');
  });
});
