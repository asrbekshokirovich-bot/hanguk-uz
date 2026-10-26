import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import type { Person } from '@/components/crm/appAnalytics/person';
import type { LeadRecord } from '../useLeadProfile';

// The block's reads are mocked: the person below, a fresh AI text.
const person: Person = {
  person_key: 'lead:lead-1',
  lead_id: 'lead-1',
  user_id: null,
  platform: 'android',
  first_seen_at: '2026-10-20T09:00:00Z',
  last_seen_at: new Date().toISOString(),
  visits: 3,
  active_days: 2,
  milestones: ['open', 'heart', 'report'],
  lead_source: 'instagram',
  contact_channel: 'Instagram',
  how_heard: 'Instagram reklama',
  how_heard_key: 'instagram',
  for_whom: 'self',
  picks: [
    { institution_id: 'a', name_en: 'Catholic University of Pusan', name_ko: null },
    { institution_id: 'b', name_en: 'Jeonbuk National', name_ko: null },
    { institution_id: 'c', name_en: 'Daegu Haany', name_ko: null },
  ],
  visa: { band: 'mid', bucket: 50, low: 'language', topik: 2, income: 'yes' },
  tariff: 'premium',
  report_views: 2,
  report_at: null,
  request_at: null,
  score: 60,
  is_test: false,
  ai_summary: 'Xulosa',
  ai_starter: 'Tanlagan 3 universiteti va TOPIK 2 bilan qaysi biriga topshirish mumkinligi',
  ai_at: null,
  ai_fresh: true,
  ties: [{ via: 'link', at: '2026-10-20T09:00:00Z' }],
  devices: [],
};
let current: Person | null = person;

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('@/components/crm/appAnalytics/person', async (orig) => {
  const real = await orig<typeof import('@/components/crm/appAnalytics/person')>();
  return {
    ...real,
    usePerson: () => ({ data: current, loading: false, error: null }),
  };
});

import { LeadAppBlock } from '../LeadAppBlock';

const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const lead = { id: 'lead-1', full_name: 'Aziz', link_code: 'abc1234567' } as LeadRecord;

const show = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <LeadAppBlock lead={lead} />
    </I18nextProvider>,
  );

describe('«Ilovada» on the lead card (the plan\'s mock-up)', () => {
  it('shows the eight rows with the plan\'s wording', () => {
    current = person;
    show();
    expect(screen.getByText('Ilovada')).toBeTruthy();
    for (const label of ['Faollik', 'Manba', 'Kim uchun', 'Tanlovlari ♥', 'Viza testi', 'Hisobot', 'Mos tarif', 'Gapni boshlash']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/· 3 tashrif · Android$/)).toBeTruthy();
    expect(screen.getByText('1-manba: Instagram reklama')).toBeTruthy();
    expect(screen.getByText('2: operator havolasi')).toBeTruthy();
    expect(screen.getByText("O'zi uchun")).toBeTruthy();
    expect(screen.getByText('Catholic University of Pusan')).toBeTruthy();
    expect(screen.getByText("O'rta")).toBeTruthy();
    expect(screen.getByText(/past omil: til darajasi \(TOPIK 2\) · moliya: rasmiy daromad bor/)).toBeTruthy();
    expect(screen.getByText("Ko'rdi, 2 marta")).toBeTruthy();
    expect(screen.getByText('Premium')).toBeTruthy();
    expect(screen.getByText(/qoida bo'yicha, operator tasdiqlaydi/)).toBeTruthy();
    expect(screen.getByText(person.ai_starter!)).toBeTruthy();
    expect(screen.getByText('Ilova havolasini yuborish')).toBeTruthy();
    expect(screen.getByText("To'liq yo'lni ochish")).toBeTruthy();
  });

  it('with no phone tied: says so, and the link can still be sent', () => {
    current = null;
    show();
    expect(screen.getByText("Bog'langan qurilma yo'q")).toBeTruthy();
    expect(screen.getByText('Ilova havolasini yuborish')).toBeTruthy();
    expect(screen.queryByText("To'liq yo'lni ochish")).toBeNull();
  });
});
