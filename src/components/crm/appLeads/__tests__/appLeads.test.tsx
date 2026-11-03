import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import ko from '@/locales/ko.json';
import {
  admissionState,
  languageLine,
  moneyLine,
  riskLine,
  waitedLabel,
  type AppBrief,
  type AppLeadRow,
} from '../brief';

// Taken from production (2026-11-03, rollback test) and trimmed: the lead the
// «Ilova lidlari navbati» report calls 7NVU8J.
const brief: AppBrief = {
  lead: { id: 'lead-1', name: 'L A', has_phone: false, channel: 'Telegram', link_code: '5b367b5973', how_heard: null, for_whom: null },
  activity: {
    first_seen_at: '2026-10-31T13:37:01Z',
    last_seen_at: '2026-11-02T14:31:33Z',
    visits: 5,
    active_days: 2,
    active_s: 908,
    platform: 'android',
    app_version: '1.1.2',
    ui_lang: 'uz',
  },
  answers: {
    age: { v: 18, at: '2026-10-31T16:16:59Z', other: null },
    gpa: { v: 4.5, at: '2026-11-02T10:25:54Z', other: 5 },
    ielts: { v: 0, at: '2026-10-31T16:18:21Z', other: null },
    topik: { v: 3, at: '2026-10-31T16:24:19Z', other: null },
    topik_fresh: { v: true, at: '2026-10-31T16:18:11Z', other: null },
    income: { v: 0, at: '2026-10-31T16:18:27Z', other: null },
    income_documented: { v: true, at: '2026-10-31T16:18:32Z', other: null },
    sponsor: { v: 1, at: '2026-10-31T16:18:37Z', other: null },
    property: { v: 1, at: '2026-10-31T16:18:47Z', other: null },
    car: { v: 1, at: '2026-11-02T10:26:38Z', other: null },
    visa_refused: { v: false, at: '2026-11-02T10:26:03Z', other: null },
    legal_relatives: { v: false, at: '2026-11-02T10:26:18Z', other: null },
  },
  route: null,
  visa: { band: 'low', low: 'language', income: 'no', topik: 0 },
  tariff: 'hanbox',
  report_views: 2,
  universities: [
    {
      institution_id: 'yonsei',
      name: 'Yonsei University',
      name_ko: '연세대학교',
      picked: true,
      opens: 2,
      last_opened_at: '2026-10-31T16:19:53Z',
      admission_score: 20,
      study_plan_tests: 0,
      interview_tests: 0,
      next_deadline: null,
      closed_at: '2026-10-14',
      ielts_min: 5.5,
      topik_min: 3,
    },
    {
      institution_id: 'knut',
      name: 'Korea National University of Transportation',
      name_ko: null,
      picked: false,
      opens: 2,
      last_opened_at: '2026-11-02T14:30:47Z',
      admission_score: null,
      study_plan_tests: 0,
      interview_tests: 0,
      next_deadline: null,
      closed_at: null,
      ielts_min: null,
      topik_min: 3,
    },
  ],
  filters: null,
  searches: [],
  friction: { code_not_found: 1, contact_taps: 3, contact_channels: ['telegram'], rage_taps: 1, app_errors: 1 },
  open_now: [
    { institution_id: 'inha', name: 'Inha University', city: 'Incheon', deadline: '2026-11-05', ielts_min: 5.5, topik_min: 3 },
    { institution_id: 'khu', name: 'Kyung Hee University', city: 'Seoul', deadline: '2026-11-06', ielts_min: 6, topik_min: 3 },
  ],
  ai_summary: null,
  ai_starter: 'Assalomu alaykum! Ilovamiz orqali yozgan ekansiz…',
  ai_fresh: true,
};

const rows: AppLeadRow[] = [
  {
    lead_id: 'lead-2', name: 'Afzal', link_code: '4ce960d986', channel: 'Telegram', has_phone: false, lead_status: 'new',
    thread_id: 'th-2', last_incoming_at: new Date(Date.now() - 3 * 3600_000).toISOString(), last_human_out_at: null,
    waiting: true, first_seen_at: null, last_seen_at: null, visits: 1, tier: 'warm', route: null, tariff: 'standart',
    picks: ['Hanbat National University'],
  },
  {
    lead_id: 'lead-3', name: 'Azizbek', link_code: 'b1edecfde1', channel: 'Ilova', has_phone: true, lead_status: 'new',
    thread_id: null, last_incoming_at: null, last_human_out_at: null, waiting: false, first_seen_at: null,
    last_seen_at: null, visits: 1, tier: 'warm', route: null, tariff: 'standart', picks: null,
  },
  {
    lead_id: 'lead-1', name: 'L A', link_code: '5b367b5973', channel: 'Telegram', has_phone: false, lead_status: 'new',
    thread_id: 'th-1', last_incoming_at: '2026-11-02T07:47:27Z', last_human_out_at: '2026-11-02T07:50:33Z',
    waiting: false, first_seen_at: null, last_seen_at: null, visits: 5, tier: 'hot', route: null, tariff: 'hanbox',
    picks: ['Yonsei University'],
  },
];

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn() } }));
vi.mock('../brief', async (orig) => {
  const real = await orig<typeof import('../brief')>();
  return {
    ...real,
    useAppBrief: () => ({ data: brief, loading: false, error: null }),
    useAppLeads: () => ({ rows, loading: false, error: null, reload: vi.fn() }),
  };
});

async function i18n(lang = 'uz') {
  const i = createInstance();
  await i.use(initReactI18next).init({
    lng: lang,
    fallbackLng: 'uz',
    resources: { uz: { translation: uz }, en: { translation: en }, ru: { translation: ru }, ko: { translation: ko } },
  });
  return i;
}

describe('brief helpers', () => {
  it('reads the answers the way the operator needs them', async () => {
    const i = await i18n();
    const t = i.t.bind(i) as never;
    expect(languageLine(brief.answers, t)).toBe("IELTS yo'q · TOPIK 3");
    expect(moneyLine(brief.answers, t)).toBe(
      'Rasmiy daromad hujjati bor · oilaviy daromad $5k gacha · ota-ona to\'laydi · mulk bor · mashina bor',
    );
    expect(riskLine(brief.answers, t)).toBe('');
    expect(
      languageLine({ ielts: { v: 7, at: '', other: 6.5 }, topik: { v: 0, at: '', other: null } }, t),
    ).toBe("IELTS 7 (boshqa testda 6,5) · TOPIK yo'q");
    expect(riskLine({ visa_refused: { v: true, at: '', other: null }, korea_before: { v: 2, at: '', other: null } }, t)).toBe(
      'Ilgari viza rad etilgan · Koreyada viza muddatidan oshib qolgan',
    );
  });

  it('tells open, closed and unknown admissions apart', () => {
    expect(admissionState({ next_deadline: '2026-11-20', closed_at: null })).toEqual({ kind: 'open', date: '2026-11-20' });
    expect(admissionState({ next_deadline: null, closed_at: '2026-10-14' })).toEqual({ kind: 'closed', date: '2026-10-14' });
    expect(admissionState({ next_deadline: null, closed_at: null })).toEqual({ kind: 'unknown' });
  });

  it('says how long someone has waited', async () => {
    const i = await i18n();
    const t = i.t.bind(i) as never;
    const now = Date.parse('2026-11-03T10:00:00Z');
    expect(waitedLabel('2026-11-03T09:48:00Z', now, t)).toBe('12 daqiqa');
    expect(waitedLabel('2026-11-03T05:00:00Z', now, t)).toBe('5 soat');
    expect(waitedLabel('2026-10-31T10:00:00Z', now, t)).toBe('3 kun');
  });

  it('has every string in all four languages', () => {
    const keys = (o: unknown, p = ''): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`.replace(/_(one|few|many|other)$/, '')],
      );
    const base = new Set(keys(uz.appLeads));
    for (const loc of [en, ru, ko]) expect(new Set(keys(loc.appLeads))).toEqual(base);
  });
});

describe('«Ilova lidlari» page and the chat rail block', () => {
  it('lists the waiting and the form leads first and opens the chat', async () => {
    const { default: AppLeadsContent } = await import('@/components/crm/pages/AppLeadsContent');
    render(
      <I18nextProvider i18n={await i18n()}>
        <MemoryRouter>
          <AppLeadsContent />
        </MemoryRouter>
      </I18nextProvider>,
    );
    const cards = screen.getAllByTestId('app-lead');
    // «Kutmoqda»: the one waiting for an answer and the one who left a phone.
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText(/3 soat kutmoqda/)).toBeInTheDocument();
    expect(within(cards[1]).getByText(/forma qoldirgan/)).toBeInTheDocument();
    fireEvent.click(within(cards[0]).getByText('Chatni ochish'));
    expect(navigate).toHaveBeenCalledWith('/crm/messages?thread=th-2');

    fireEvent.click(screen.getByText('Hammasi'));
    expect(screen.getAllByTestId('app-lead')).toHaveLength(3);
  });

  it('shows what the person did in the app, with today\'s admission state', async () => {
    const { AppBriefCard } = await import('../AppBriefCard');
    render(
      <I18nextProvider i18n={await i18n()}>
        <AppBriefCard leadId="lead-1" variant="rail" />
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Ilovada' })).toBeInTheDocument();
    expect(screen.getByText("IELTS yo'q · TOPIK 3")).toBeInTheDocument();
    expect(screen.getByText('Yonsei University')).toBeInTheDocument();
    expect(screen.getByText('yopilgan · 14-okt')).toBeInTheDocument();
    expect(screen.getByText('muddat bazada yo\'q')).toBeInTheDocument();
    expect(screen.getByText(/Inha University/)).toBeInTheDocument();
    expect(screen.getByText(/kod topilmagan \(1 marta\)/)).toBeInTheDocument();
    expect(screen.getByText('Assalomu alaykum! Ilovamiz orqali yozgan ekansiz…')).toBeInTheDocument();
  });
});
