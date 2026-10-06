/**
 * Sozlamalar (spec §3.7): the form-state <-> `lead_settings` value mapping and
 * the validation of every section, as plain functions. A form keeps what the
 * person typed (strings for numbers); `build*` turns it into exactly the JSON
 * the database functions read (`fn_lead_ladder_next`, `fn_lead_work_start`, ...),
 * and `validate*` says what is wrong before anything is sent.
 */
import type { AlertRecipient, LeadSettings, LostReasonSetting, OfferSetting, TemplateSetting } from '../types';
import { TEMPLATE_VARIABLES } from './labels';

export const sig = (v: unknown): string => JSON.stringify(v);

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SLUG_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** "12" -> 12; "", "1.5", "-3", "abc" -> null. */
export function parseInteger(text: string): number | null {
  const t = text.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

function inRange(text: string, label: string, min: number, max: number): string | null {
  const n = parseInteger(text);
  if (n == null || n < min || n > max) return `${label}: ${min} dan ${max} gacha butun son kiriting`;
  return null;
}

// ---- tags (forbidden words, boss words) ---------------------------------------

/** Trim, drop empties, drop repeats (any case); the first spelling stays. */
export function normalizeTags(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** "kafolat, 100%" typed or pasted -> added one by one. */
export function addTags(list: string[], raw: string): string[] {
  return normalizeTags([...list, ...raw.split(/[,\n;]/)]);
}

// ---- work hours -------------------------------------------------------------------

export interface HoursForm {
  start: string;
  end: string;
  days: number[];
}

export const hoursToForm = (w: LeadSettings['work_hours']): HoursForm => ({ start: w.start, end: w.end, days: [...w.days].sort((a, b) => a - b) });

export function validateHours(f: HoursForm): string | null {
  if (!TIME_RE.test(f.start) || !TIME_RE.test(f.end)) return 'Boshlanish va tugash vaqtini kiriting (SS:DD)';
  if (f.start >= f.end) return "Tugash vaqti boshlanishdan keyin bo'lishi kerak";
  if (f.days.length === 0) return 'Kamida bitta ish kunini tanlang';
  return null;
}

export const buildHours = (f: HoursForm): LeadSettings['work_hours'] => ({
  start: f.start,
  end: f.end,
  days: [...new Set(f.days)].sort((a, b) => a - b),
});

export const WEEKDAYS: { n: number; label: string }[] = [
  { n: 1, label: 'Du' },
  { n: 2, label: 'Se' },
  { n: 3, label: 'Ch' },
  { n: 4, label: 'Pa' },
  { n: 5, label: 'Ju' },
  { n: 6, label: 'Sh' },
  { n: 7, label: 'Ya' },
];

// ---- timer -------------------------------------------------------------------------

export interface TimerForm {
  timer: string;
  repeat: string;
}

export const timerToForm = (s: Pick<LeadSettings, 'timer_minutes' | 'escalation_repeat_minutes'>): TimerForm => ({
  timer: String(s.timer_minutes),
  repeat: String(s.escalation_repeat_minutes),
});

export const validateTimer = (f: TimerForm): string | null =>
  inRange(f.timer, 'Taymer (daqiqa)', 1, 120) ?? inRange(f.repeat, 'Takror (daqiqa)', 1, 120);

export const buildTimer = (f: TimerForm) => ({
  timer_minutes: Number(f.timer),
  escalation_repeat_minutes: Number(f.repeat),
});

// ---- ladder -------------------------------------------------------------------------

export type LadderKind = 'minutes' | 'next_day' | 'days';

export interface LadderStepForm {
  kind: LadderKind;
  value: string;
  at: string;
}

export interface LadderForm {
  steps: LadderStepForm[];
  windowDays: string;
  dmAfter: string;
}

export const LADDER_KIND_LABEL: Record<LadderKind, string> = {
  minutes: 'Daqiqadan keyin',
  next_day: 'Ertasi kuni',
  days: 'Kundan keyin',
};

export function ladderToForm(l: LeadSettings['ladder']): LadderForm {
  return {
    steps: l.steps.map((s) => ({ kind: s.kind, value: s.value != null ? String(s.value) : '', at: s.at ?? '10:00' })),
    windowDays: String(l.window_days),
    dmAfter: String(l.dm_after_attempt),
  };
}

export function validateLadder(f: LadderForm): string | null {
  for (let i = 0; i < f.steps.length; i += 1) {
    const s = f.steps[i];
    const n = i + 2; // attempt 1 is the first call; step 1 schedules attempt 2
    if (s.kind === 'minutes') {
      const bad = inRange(s.value, `${n}-urinish (daqiqa)`, 1, 1440);
      if (bad) return bad;
    }
    if (s.kind === 'days') {
      const bad = inRange(s.value, `${n}-urinish (kun)`, 1, 30);
      if (bad) return bad;
    }
    if ((s.kind === 'next_day' || s.kind === 'days') && !TIME_RE.test(s.at)) return `${n}-urinish: vaqtni SS:DD ko'rinishida kiriting`;
  }
  return (
    inRange(f.windowDays, 'Oyna (kun)', 1, 60) ??
    inRange(f.dmAfter, "DM qoralamasi (urinish raqami)", 1, f.steps.length + 1)
  );
}

/** Exactly the shape the database seed has: `minutes` has no `at`, `next_day` has no `value`. */
export function buildLadder(f: LadderForm): LeadSettings['ladder'] {
  return {
    steps: f.steps.map((s) => {
      if (s.kind === 'minutes') return { kind: 'minutes' as const, value: Number(s.value) };
      if (s.kind === 'next_day') return { kind: 'next_day' as const, at: s.at };
      return { kind: 'days' as const, value: Number(s.value), at: s.at };
    }),
    window_days: Number(f.windowDays),
    dm_after_attempt: Number(f.dmAfter),
  };
}

/** "+15 daqiqa", "+2 soat", "ertasi kuni 10:00", "+2 kun, 10:00". */
export function describeStep(s: LadderStepForm): string {
  const v = parseInteger(s.value);
  if (s.kind === 'minutes') {
    if (v == null) return '—';
    return v % 60 === 0 && v >= 60 ? `+${v / 60} soat` : `+${v} daqiqa`;
  }
  if (s.kind === 'next_day') return `ertasi kuni ${s.at}`;
  return v == null ? '—' : `+${v} kun, ${s.at}`;
}

// ---- auto reply ----------------------------------------------------------------------

export const validateAutoReply = (v: { uz: string; ru: string }): string | null =>
  !v.uz.trim() || !v.ru.trim() ? "Avtojavob matni uz va ru tilida bo'sh bo'lmasin" : null;

// ---- templates ---------------------------------------------------------------------------

const KNOWN_VARIABLES = new Set(TEMPLATE_VARIABLES.map((v) => v.name));

/** Every {...} token in the text. */
export const variablesIn = (text: string): string[] => text.match(/\{[^{}\s]*\}/g) ?? [];

/** {ismi}, {name}: tokens that would go to a client as they are. */
export const unknownVariables = (text: string): string[] => [...new Set(variablesIn(text).filter((v) => !KNOWN_VARIABLES.has(v)))];

export function validateTemplate(t: TemplateSetting, others: TemplateSetting[]): string | null {
  if (!SLUG_RE.test(t.key)) return "Kalit: kichik lotin harflari, raqam va _ (harf bilan boshlanadi)";
  if (others.some((o) => o.key === t.key)) return `«${t.key}» kalitli shablon allaqachon bor`;
  if (!t.group.trim()) return 'Guruhni kiriting';
  if (!t.uz.trim()) return "O'zbekcha matn bo'sh bo'lmasin";
  if (!t.ru.trim()) return "Ruscha matn bo'sh bo'lmasin";
  const unknown = [...unknownVariables(t.uz), ...unknownVariables(t.ru)];
  if (unknown.length) return `Noma'lum o'zgaruvchi: ${[...new Set(unknown)].join(' ')}. Ruxsat etilgan: ${TEMPLATE_VARIABLES.map((v) => v.name).join(' ')}`;
  return null;
}

export function validateTemplates(list: TemplateSetting[]): string | null {
  for (let i = 0; i < list.length; i += 1) {
    const bad = validateTemplate(list[i], [...list.slice(0, i), ...list.slice(i + 1)]);
    if (bad) return `«${list[i].key || 'yangi'}»: ${bad}`;
  }
  return null;
}

/** Templates by group, groups in first-seen order. */
export function groupTemplates<T extends { group: string }>(list: T[]): { group: string; items: T[] }[] {
  const out: { group: string; items: T[] }[] = [];
  for (const t of list) {
    let g = out.find((x) => x.group === t.group);
    if (!g) {
      g = { group: t.group, items: [] };
      out.push(g);
    }
    g.items.push(t);
  }
  return out;
}

/** `needs_boss` is only written when true, so a plain template stays `{key, group, uz, ru}`. */
export const buildTemplates = (list: TemplateSetting[]): TemplateSetting[] =>
  list.map((t) => {
    const base: TemplateSetting = { key: t.key.trim(), group: t.group.trim(), uz: t.uz.trim(), ru: t.ru.trim() };
    return t.needs_boss ? { ...base, needs_boss: true } : base;
  });

// ---- offers ---------------------------------------------------------------------------------

export interface OfferForm extends OfferSetting {
  key: string;
}

export const offersToForm = (o: Record<string, OfferSetting>): OfferForm[] => Object.entries(o).map(([key, v]) => ({ key, ...v }));

export function validateOffers(list: OfferForm[]): string | null {
  const seen = new Set<string>();
  for (const o of list) {
    if (!SLUG_RE.test(o.key)) return `«${o.key || 'yangi'}»: kalit kichik lotin harflari, raqam va _ bo'lsin`;
    if (seen.has(o.key)) return `«${o.key}» kaliti takrorlangan`;
    seen.add(o.key);
    if (!o.title.trim()) return `«${o.key}»: nomini kiriting`;
    if (!o.text.trim()) return `«${o.key}»: matnini kiriting`;
  }
  return null;
}

export const buildOffers = (list: OfferForm[]): Record<string, OfferSetting> =>
  Object.fromEntries(list.map((o) => [o.key, { title: o.title.trim(), text: o.text.trim(), needs_boss: o.needs_boss }]));

// ---- lost reasons -----------------------------------------------------------------------------

export function validateLostReasons(list: LostReasonSetting[]): string | null {
  if (list.length === 0) return "Kamida bitta yo'qotish sababi bo'lsin";
  const seen = new Set<string>();
  for (const r of list) {
    if (!SLUG_RE.test(r.key)) return `«${r.key || 'yangi'}»: kalit kichik lotin harflari, raqam va _ bo'lsin`;
    if (seen.has(r.key)) return `«${r.key}» kaliti takrorlangan`;
    seen.add(r.key);
    if (!r.label.trim()) return `«${r.key}»: nomini kiriting`;
  }
  return null;
}

export const buildLostReasons = (list: LostReasonSetting[]): LostReasonSetting[] =>
  list.map((r) => ({ key: r.key, label: r.label.trim(), queue: r.queue || null }));

// ---- queue limit / announcements -------------------------------------------------------------------

export const validateQueueLimit = (text: string): string | null => inRange(text, 'Kunlik limit', 1, 500);

export interface AnnounceForm {
  hanbox_group_date: string;
  hanbox_announced: boolean;
  no_risk_announced: boolean;
}

export function validateAnnounce(f: AnnounceForm): string | null {
  if (f.hanbox_group_date && !/^\d{4}-\d{2}-\d{2}$/.test(f.hanbox_group_date)) return 'Hanbox guruh sanasini to\'liq kiriting';
  if (f.hanbox_announced && !f.hanbox_group_date) return "Hanbox e'lon qilingan bo'lsa, guruh sanasini kiriting";
  return null;
}

// ---- Telegram recipients --------------------------------------------------------------------------------

export interface RecipientForm {
  chat_id: string;
  label: string;
  staff_user_id: string;
  escalate: boolean;
  boss_alerts: boolean;
  reports_daily: boolean;
  reports_weekly: boolean;
  enabled: boolean;
}

export const emptyRecipient: RecipientForm = {
  chat_id: '',
  label: '',
  staff_user_id: '',
  escalate: true,
  boss_alerts: false,
  reports_daily: false,
  reports_weekly: false,
  enabled: true,
};

export const recipientToForm = (r: AlertRecipient): RecipientForm => ({
  chat_id: r.chat_id,
  label: r.label ?? '',
  staff_user_id: r.staff_user_id ?? '',
  escalate: r.escalate,
  boss_alerts: r.boss_alerts,
  reports_daily: r.reports_daily,
  reports_weekly: r.reports_weekly,
  enabled: r.enabled,
});

/** Telegram chat ids are whole numbers; a group's is negative. */
export function validateRecipient(f: RecipientForm, existingIds: string[], isNew: boolean): string | null {
  const id = f.chat_id.trim();
  if (!/^-?\d{4,}$/.test(id)) return "Chat ID raqamlardan iborat bo'lsin (masalan 123456789)";
  if (isNew && existingIds.includes(id)) return 'Bu chat ID allaqachon qo\'shilgan';
  if (!f.label.trim()) return 'Nomini kiriting (kim ekanini bilish uchun)';
  return null;
}

/** What `saveRecipient` upserts. Columns the form does not own (watchdog) are left out, so an edit never resets them. */
export const buildRecipientPayload = (f: RecipientForm): Partial<AlertRecipient> & { chat_id: string } => ({
  chat_id: f.chat_id.trim(),
  label: f.label.trim(),
  staff_user_id: f.staff_user_id || null,
  escalate: f.escalate,
  boss_alerts: f.boss_alerts,
  reports_daily: f.reports_daily,
  reports_weekly: f.reports_weekly,
  enabled: f.enabled,
});
