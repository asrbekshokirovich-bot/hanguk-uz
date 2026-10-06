import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings } from './api';
import type { LeadSettings } from './types';

/**
 * What the database seeds (20261005161000_lead_v2_schema.sql). Used until the
 * settings arrive and for any key an admin has not set, so the desk never
 * renders against `undefined`.
 */
export const DEFAULT_SETTINGS: LeadSettings = {
  work_hours: { start: '09:00', end: '22:00', days: [1, 2, 3, 4, 5, 6, 7] },
  timer_minutes: 10,
  escalation_repeat_minutes: 10,
  ladder: {
    steps: [
      { kind: 'minutes', value: 15 },
      { kind: 'minutes', value: 120 },
      { kind: 'next_day', at: '10:00' },
      { kind: 'days', value: 2, at: '10:00' },
    ],
    window_days: 7,
    dm_after_attempt: 2,
  },
  auto_reply: { uz: '', ru: '' },
  forbidden_words: ['kafolat', '100%', 'bepul noutbuk', 'bitta narx', 'sertifikatsiz Koreya'],
  boss_alert_words: ['qaytar', 'pul', 'sud', 'shikoyat', 'direktor', 'rahbar'],
  queue_daily_limit: 15,
  chat_answers_phone_leads: false,
  control_line_10min: true,
  tv_warning: true,
  hanbox_group_date: '2026-10-26',
  hanbox_announced: true,
  no_risk_announced: false,
  lost_reasons: [
    { key: 'no_certificate', label: "Sertifikat yo'q", queue: 'hanbox' },
    { key: 'docs_finance', label: 'Hujjat / moliya', queue: 'no_risk' },
    { key: 'next_year', label: 'Keyingi yil / qabul', queue: 'next_intake' },
    { key: 'other_center', label: 'Boshqa markaz', queue: 'other_center' },
    { key: 'no_contact', label: "Aloqa yo'q", queue: 'no_contact' },
    { key: 'price', label: 'Narx', queue: 'price' },
    { key: 'parents_against', label: 'Ota-ona qarshi', queue: 'parents' },
    { key: 'not_fit', label: "Mos emas (yosh / ta'lim)", queue: null },
    { key: 'spam_duplicate', label: 'Spam / dublikat', queue: null },
    { key: 'not_interested', label: 'Qiziqmaydi', queue: null },
  ],
  objections: [
    { key: 'price', label: 'Narx' },
    { key: 'docs_finance', label: 'Hujjat / moliya' },
    { key: 'certificate', label: 'Sertifikat' },
    { key: 'parents', label: 'Ota-ona' },
    { key: 'trust', label: 'Ishonch' },
    { key: 'time', label: 'Vaqt' },
    { key: 'nothing', label: 'Hech narsa' },
  ],
  competitors: ['Bright Future', 'ON201', 'Global Consult', 'Forward', 'Boshqa'],
  offers: {},
  templates: [],
};

export const LEAD_SETTINGS_KEY = ['lead-v2', 'settings'] as const;

/** Lead module settings, merged over the defaults. Cached for 5 minutes. */
export function useLeadSettings() {
  const query = useQuery({
    queryKey: LEAD_SETTINGS_KEY,
    queryFn: async (): Promise<LeadSettings> => ({ ...DEFAULT_SETTINGS, ...(await fetchSettings()) }),
    staleTime: 5 * 60_000,
  });
  // `error` matters to anything that EDITS settings: on a failed read `settings`
  // is the defaults, and saving "defaults + my change" would overwrite real ones.
  return {
    settings: query.data ?? DEFAULT_SETTINGS,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useInvalidateLeadSettings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: LEAD_SETTINGS_KEY });
}

export { findForbidden } from './forbidden';
