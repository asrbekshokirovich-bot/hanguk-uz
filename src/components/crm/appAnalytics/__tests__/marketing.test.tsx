import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import type { Marketing } from '../marketing';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: true }) }));

const sample: Marketing = {
  from: '2026-10-20',
  to: '2026-10-26',
  include_test: false,
  kpi: { new_devices: 63, new_active: 49, requests: 0, requests_form: 0, requests_telegram: 0, new_leads: 120, contracts: 4, app_contracts: 0, test_devices: 6 },
  channels: [
    { key: 'instagram', new_devices: 0, active: 0, requests: 0, contracts: 0, spend: {} },
    { key: 'telegram', new_devices: 2, active: 2, requests: 1, contracts: 0, spend: { UZS: 500000 } },
    { key: 'unknown', new_devices: 61, active: 47, requests: 0, contracts: 0, spend: {} },
  ],
  funnel: { all: [63, 49, 35, 20, 14, 4, 2, 0], telegram: [2, 2, 1, 1, 1, 1, 0, 0], unknown: [61, 47, 34, 19, 13, 3, 2, 0] },
  demand: {
    filters: [{ field: 'field', value: 'IT', devices: 10 }, { field: 'regions', value: 'Seul', devices: 11 }],
    answers: [{ form: 'visa', q: 'topik', band: '2', devices: 4 }],
    universities: [{ institution_id: 'a', name_en: 'Catholic University of Pusan', name_ko: null, devices: 13, opens: 20, avg_position: 1.4, seen: 30 }],
  },
  stops: {
    exit_screens: [{ screen: '/language', sessions: 8 }],
    language_exits: 8,
    client_code_seen: 28,
    client_code_left: 18,
    locked_tabs: [{ tab: 'prepare', devices: 5 }],
    lead_form: { opened: 4, field_error: 1, submitted: 0 },
  },
  returning: { active: 61, new: 46, returning: 15 },
  spend: [{ week: '2026-10-19', channel: 'telegram', amount: 500000, currency: 'UZS', note: 'post' }],
};
vi.mock('../marketing', async (orig) => {
  const real = await orig<typeof import('../marketing')>();
  return {
    ...real,
    useMarketing: () => ({ data: sample, prev: { ...sample, kpi: { ...sample.kpi, new_devices: 40 } }, loading: false, error: null, reload: () => {} }),
    useChannelNames: () => ({ instagram: 'Instagram', telegram: 'Telegram' }),
    useRetention: () => [{ week: '2026-10-12', devices: 20, d1: 5, d7: 8, d30: null }],
  };
});

import MarketingTab from '../MarketingTab';
import { addDays, bandLabel, money, perOne, periodLabel, periodOf } from '../marketing';
import { buildCsv } from '../marketingExport';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;

describe('Marketing panel (the plan\'s mock-up)', () => {
  it('shows the three numbers, the channel table and the blocks in the plan\'s order', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MarketingTab />
      </I18nextProvider>,
    );
    for (const s of ['Yangi faol qurilmalar', 'Ilovadan murojaat', 'Ilova ishtirokidagi shartnoma', 'Kanal (o\'zi aytgan)', 'Yangi qurilma', 'Faol', '1 murojaat', 'Noma\'lum (javobsiz)']) {
      expect(screen.getAllByText(s).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('63').length).toBeGreaterThan(0);
    expect(screen.getByText('oldingi davr: 40')).toBeTruthy();
    expect(screen.getByText(/forma 0 · kodli Telegram 0 · ulushi 0%/)).toBeTruthy();
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Voronka', 'Talab', "To'xtash joylari", 'Qaytish', 'Xarajat', 'Test filtri']);
    expect(screen.getByText(/Mijoz kodi ekranini ochib, kodsiz chiqqan qurilmalar: 18 \/ 28/)).toBeTruthy();
    expect(screen.getAllByText("500 000 so'm").length).toBeGreaterThan(0);
  });

  it('periods, labels and money', () => {
    expect(periodOf('7', { from: '', to: '' }, '2026-10-26')).toEqual({ from: '2026-10-20', to: '2026-10-26', prevFrom: '2026-10-13', prevTo: '2026-10-19' });
    expect(periodOf('today', { from: '', to: '' }, '2026-10-26').prevFrom).toBe('2026-10-25');
    expect(periodOf('range', { from: '2026-10-22', to: '2026-10-15' }, '2026-10-26')).toMatchObject({ from: '2026-10-15', to: '2026-10-22' });
    expect(periodLabel('2026-10-15', '2026-10-22')).toBe('15–22-okt');
    expect(periodLabel('2026-09-28', '2026-10-04')).toBe('28-sen – 4-okt');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(money({ USD: 120, UZS: 500000 })).toBe("$120 + 500 000 so'm");
    expect(money({})).toBeNull();
    expect(perOne({ USD: 120 }, 4)).toBe('$30');
    expect(perOne({ USD: 120 }, 0)).toBeNull();
    expect(bandLabel('topik', '0', t)).toBe("yo'q");
    expect(bandLabel('bank', '10', t)).toBe('10–15 mln won');
    expect(bandLabel('income', '1', t)).toBe('$5–10 ming');
    expect(bandLabel('route', 'languageCourse', t)).toBe('Til kursi');
  });

  it('CSV: the numbers and the channel table, readable by Excel', () => {
    const csv = buildCsv(sample, { instagram: 'Instagram', telegram: 'Telegram' }, t);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Yangi faol qurilmalar,63');
    expect(csv).toContain("Noma'lum (javobsiz),61,47,0,0,,");
    expect(csv).toContain("Telegram,2,2,1,0,500 000 so'm,500 000 so'm");
  });
});
