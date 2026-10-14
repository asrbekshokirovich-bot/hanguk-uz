import type { AppEvent } from './useAppActivity';

type T = (key: string, opts?: Record<string, unknown>) => string;

/** The app's route patterns and screen names → a key under appActivity.screens. */
const SCREENS: Record<string, string> = {
  '/': 'home',
  '/guest': 'universities',
  '/guest/search': 'search',
  '/guest/filter': 'filter',
  '/guest/results': 'results',
  '/guest/duel': 'duel',
  '/guest/chosen': 'chosen',
  '/guest/compare': 'compare',
  '/guest/saved': 'saved',
  '/university/:id': 'university',
  '/assess': 'assessment',
  '/assess/report': 'report',
  '/assess/sent': 'sent',
  '/language': 'language',
  '/login': 'login',
  '/welcome': 'welcome',
  '/account': 'account',
  '/notifications': 'notifications',
  '/surveys': 'surveys',
  study_plan: 'studyPlan',
  interview: 'interview',
  ai_chat: 'aiChat',
  qr_scan: 'qrScan',
};

export function screenLabel(screen: string | null | undefined, t: T): string {
  if (!screen) return '';
  const key = SCREENS[screen];
  return key ? t(`appActivity.screens.${key}`) : screen;
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

/** One line for an event, in the CRM's language. */
export function describeEvent(e: AppEvent, t: T, names: Record<string, string>): string {
  const p = e.props ?? {};
  const uni = (key = 'institution_id') => {
    const id = str(p[key]);
    return id ? names[id] ?? t('appActivity.unknownUniversity') : t('appActivity.unknownUniversity');
  };
  switch (e.event) {
    case 'screen_view':
      return t('appActivity.events.screen_view', { screen: screenLabel(e.screen, t) });
    case 'tab_open':
      return t('appActivity.events.tab_open', {
        tab: t(`appActivity.tabs.${str(p.tab) ?? ''}`, { defaultValue: str(p.tab) ?? '' }),
      });
    case 'university_open':
    case 'university_save':
    case 'university_unsave':
    case 'university_skip':
    case 'slot_remove':
      return t(`appActivity.events.${e.event}`, { name: uni() });
    case 'slot_set':
      return t('appActivity.events.slot_set', { name: uni(), slot: str(p.slot) ?? '?' });
    case 'duel_pick':
      return t('appActivity.events.duel_pick', { name: uni(), other: uni('other_id') });
    case 'filter_apply': {
      const parts = ['field', 'regions', 'degree', 'topik', 'type', 'max_price']
        .map((k) => (str(p[k]) ? `${k}: ${str(p[k])}` : null))
        .filter(Boolean);
      return t('appActivity.events.filter_apply', { filters: parts.join(', ') || '—', results: str(p.results) ?? '?' });
    }
    case 'assessment_start':
    case 'report_view':
      return t(`appActivity.events.${e.event}`, { count: Number(p.universities ?? 0) });
    case 'lead_submit':
    case 'sign_in':
    case 'qr_scan':
      return t(`appActivity.events.${e.event}`, {
        result: t(`appActivity.results.${str(p.status) ?? str(p.result) ?? ''}`, {
          defaultValue: str(p.status) ?? str(p.result) ?? '',
        }),
      });
    case 'interview_start':
      return t('appActivity.events.interview_start', { language: str(p.language) ?? '' });
    case 'interview_end':
    case 'interview_leave':
      return t(`appActivity.events.${e.event}`, { minutes: Math.round(Number(p.seconds ?? 0) / 6) / 10 });
    case 'study_plan_feedback':
    case 'dictation_start':
      return t(`appActivity.events.${e.event}`, { step: str(p.step) ?? '?' });
    case 'document_upload':
      return t('appActivity.events.document_upload', { type: str(p.type) ?? '' });
    case 'contact_tap':
      return t('appActivity.events.contact_tap', {
        channel: t(`appActivity.channels.${str(p.channel) ?? ''}`, { defaultValue: str(p.channel) ?? '' }),
      });
    case 'language_set':
      return t('appActivity.events.language_set', { language: str(p.language) ?? '' });
    case 'search':
      return t('appActivity.events.search');
    case 'app_open':
      return t('appActivity.events.app_open');
    default:
      return t(`appActivity.events.${e.event}`, { defaultValue: e.event });
  }
}

/** Events split into visits: a gap of more than 30 minutes starts a new one. */
export function sessionsOf(events: AppEvent[], gapMinutes = 30): AppEvent[][] {
  const sorted = [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const out: AppEvent[][] = [];
  let current: AppEvent[] = [];
  let last: number | null = null;
  for (const e of sorted) {
    const at = new Date(e.occurred_at).getTime();
    if (last !== null && last - at > gapMinutes * 60_000) {
      out.push(current);
      current = [];
    }
    current.push(e);
    last = at;
  }
  if (current.length) out.push(current);
  return out;
}
