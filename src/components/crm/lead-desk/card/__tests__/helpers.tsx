import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configure, render } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '../../useLeadSettings';
import type { LeadSettings, LeadV2, OfferSetting, TemplateSetting } from '../../types';

// findBy* / waitFor wait longer than the 1 s default: settings and side tables arrive through react-query
configure({ asyncUtilTimeout: 20_000 });

/** A complete `leads` row with nothing filled in. */
export function makeLead(over: Partial<LeadV2> = {}): LeadV2 {
  return {
    id: 'lead-1',
    full_name: 'Dilnoza Abdullayeva',
    phone: '+998 94 196 69 89',
    email: null,
    source: 'instagram',
    source_id: 'ig-1',
    status: 'new',
    stage: 'new',
    crm_generation: 'new',
    owner_id: null,
    created_at: '2026-10-05T09:00:00Z',
    updated_at: '2026-10-05T09:00:00Z',
    first_contact_at: '2026-10-05T09:00:00Z',
    timer_kind: null,
    timer_start_at: null,
    due_at: null,
    last_client_msg_at: null,
    last_operator_msg_at: null,
    last_contacted_at: null,
    last_attempt_at: null,
    call_result: null,
    answered_at: null,
    answered_by: null,
    answer_kind: null,
    attempt_no: 0,
    next_attempt_at: null,
    ladder_state: 'idle',
    next_action_at: null,
    next_action_kind: null,
    next_action_note: null,
    wait_until: null,
    wait_reason: null,
    lost_reason: null,
    lost_competitor: null,
    lost_at: null,
    education_level: null,
    cert_level: null,
    age: null,
    study_year: null,
    city: null,
    decider: null,
    objection: null,
    competitor: null,
    exam_date: null,
    target_intake: null,
    budget_range: null,
    language: null,
    preferred_channel: null,
    preferred_time_text: null,
    campaign_name: null,
    adset_name: null,
    ad_name: null,
    form_name: null,
    utm: null,
    referral_type: null,
    referral_name: null,
    referred_by_student_id: null,
    product_fit: null,
    contact_channel: null,
    how_heard: null,
    ai_summary: null,
    ai_brief_at: null,
    priority_score: null,
    pinned_at: null,
    merged_into_id: null,
    matched_student_id: null,
    converted_to_student_id: null,
    instagram_handle: null,
    telegram_handle: null,
    notes: null,
    asked_price: false,
    reactivation_queue: null,
    contract_date: null,
    ...over,
  };
}

/** The five fields of the 5 mandatory ones, all filled. */
export const COMPLETE_FIVE: Partial<LeadV2> = {
  education_level: 'Bakalavr',
  cert_level: 'TOPIK 3',
  age: 19,
  city: "Farg'ona",
  decider: 'parent',
};

/** What the migration seeds in lead_settings (offers, templates). */
export const SEED_OFFERS: Record<string, OfferSetting> = {
  standart: { title: 'Standart', text: '2 mln + 5 mln vizadan keyin', needs_boss: false },
  premium: { title: 'Premium', text: '3 mln + 10 mln vizadan keyin', needs_boss: false },
  no_risk: { title: 'NO RISK', text: "$5 000; viza rad etilsa to'liq qaytariladi", needs_boss: true },
  hanbox: { title: 'Hanbox', text: '$2 000 yoki $400 + 10×$200', needs_boss: false },
  kasbiy: { title: 'Kasbiy ta’lim', text: 'Narx — rahbardan', needs_boss: true },
  gks: { title: 'GKS', text: 'GKS shartlari (TOPIK 3 / IELTS 5.5)', needs_boss: true },
};

export const SEED_TEMPLATES: TemplateSetting[] = [
  {
    key: 'greeting',
    group: 'salom',
    uz: "Assalomu alaykum, {ism}! HANGUK Consulting. Koreyada qaysi yo'nalish qiziqtiradi?",
    ru: 'Здравствуйте, {ism}! HANGUK Consulting. Какое направление вас интересует?',
  },
  {
    key: 'called',
    group: 'qongiroq',
    uz: "{ism}, siz bilan bog'lanmoqchi bo'ldik, lekin ko'tarmadingiz. Qachon qo'ng'iroq qilsak qulay?",
    ru: '{ism}, мы пытались вам дозвониться, но вы не ответили.',
  },
  {
    key: 'followup_d7',
    group: 'kuzatuv',
    uz: '{ism}, {sana} gacha hujjat topshirish muddati.',
    ru: '{ism}, срок подачи документов — до {sana}.',
  },
];

export const SETTINGS: LeadSettings = { ...DEFAULT_SETTINGS, offers: SEED_OFFERS, templates: SEED_TEMPLATES };

export function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const utils = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return { qc, ...utils };
}
