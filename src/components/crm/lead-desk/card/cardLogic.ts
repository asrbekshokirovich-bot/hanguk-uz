/**
 * Lead card — the pure rules.
 *
 * Everything the card decides without touching React or the network lives here
 * so it can be tested on its own: which of the 5 mandatory fields are empty
 * (spec §5.1), what the call popup may save and the payload it sends (§7), which
 * offers the card shows (§11), and what the composer refuses to send (§6, §10).
 */
import {
  CERTIFICATES,
  DECIDER_LABEL,
  GOALS,
  MISSING_FIELD_LABEL,
  QUEUE_LABEL,
  REFERRAL_TYPE_LABEL,
  REGIONS,
  STAGE_LABEL,
  STUDY_YEARS,
  channelLabel,
} from '../copy';
import { findForbidden } from '../forbidden';
import { semesterOptions } from '../../leads/intake/options';
import { dayKey, fromLocalInput, shortDate } from '../time';
import type {
  CallResult,
  Decider,
  LeadPromise,
  LeadV2,
  OfferSetting,
  RecordCallPayload,
  ReferralType,
  Stage,
  TemplateSetting,
  WaitReason,
} from '../types';

// ---- stages ----------------------------------------------------------------

/** Mirrors fn_lead_stage_rank in the engine: a call never lowers a stage. */
export const STAGE_RANK: Record<Stage, number> = {
  new: 0,
  contacted: 1,
  waiting: 1,
  interested: 2,
  offer: 3,
  contract: 4,
  student: 5,
  lost: -1,
};

export type CallStage = Exclude<Stage, 'new' | 'student'>;

export const CALL_STAGE_OPTIONS: { value: CallStage; label: string }[] = (
  ['contacted', 'interested', 'offer', 'contract', 'waiting', 'lost'] as CallStage[]
).map((value) => ({ value, label: STAGE_LABEL[value] }));

/** The stage the popup starts on: the lead's own, or Aloqada. */
export function defaultCallStage(stage: Stage): CallStage {
  return stage === 'contacted' || stage === 'interested' || stage === 'offer' || stage === 'contract' ? stage : 'contacted';
}

/** Lower stages are off: the database keeps the higher one anyway. */
export function stageOptionDisabled(option: CallStage, leadStage: Stage): boolean {
  if (option === 'waiting' || option === 'lost') return false;
  if (leadStage === 'lost' || leadStage === 'waiting' || leadStage === 'new') return false;
  return STAGE_RANK[option] < STAGE_RANK[leadStage];
}

/** The part of a QUEUE_LABEL after the arrow: "Hanbox", "NO RISK"… */
export function queueName(queue: string | null | undefined): string | null {
  if (!queue) return null;
  const label = QUEUE_LABEL[queue];
  if (!label) return queue;
  const parts = label.split('→');
  return parts[parts.length - 1].trim();
}

// ---- the 5 mandatory fields ------------------------------------------------------

export type MandatoryKey = 'goal' | 'certificate' | 'age_grade' | 'region' | 'decider';

export const MANDATORY_KEYS: MandatoryKey[] = ['goal', 'certificate', 'age_grade', 'region', 'decider'];

export interface MandatoryValue {
  education_level: string | null;
  cert_level: string | null;
  age: number | null;
  study_year: string | null;
  city: string | null;
  decider: Decider | null;
}

const blank = (s: string | null | undefined): boolean => s == null || String(s).trim() === '';

export function mandatoryOf(l: Partial<LeadV2>): MandatoryValue {
  return {
    education_level: l.education_level ?? null,
    cert_level: l.cert_level ?? null,
    age: l.age ?? null,
    study_year: l.study_year ?? null,
    city: l.city ?? null,
    decider: l.decider ?? null,
  };
}

/** Which of the 5 are empty. Same rule as fn_lead_missing_fields. */
export function missingMandatory(v: Partial<MandatoryValue>): MandatoryKey[] {
  const out: MandatoryKey[] = [];
  if (blank(v.education_level)) out.push('goal');
  if (blank(v.cert_level)) out.push('certificate');
  if (v.age == null && blank(v.study_year)) out.push('age_grade');
  if (blank(v.city)) out.push('region');
  if (v.decider == null) out.push('decider');
  return out;
}

const EXTRA_PROBLEM_LABEL: Record<string, string> = {
  next_action: 'Keyingi harakat vaqti',
  next_action_past: "Keyingi harakat vaqti o'tib ketgan",
  wait_until: 'Kutish sanasi (ertadan boshlab)',
  wait_reason: 'Kutish sababi',
  lost_reason: "Yo'qotish sababi",
  lost_competitor: 'Qaysi markaz?',
  callback_time: 'Qayta qo‘ng‘iroq vaqti',
};

export const problemLabel = (key: string): string => MISSING_FIELD_LABEL[key] ?? EXTRA_PROBLEM_LABEL[key] ?? key;

/** "To‘ldirilmagan: Maqsad, Viloyat" — the same sentence `explainError` builds for `missing_fields:`. */
export const problemSentence = (keys: string[]): string => `To‘ldirilmagan: ${keys.map(problemLabel).join(', ')}`;

// ---- the call popup (spec §7) ------------------------------------------------------

/** "Boshqa markaz?" answer meaning "no other centre". Stored text: reports and the priority score read it. */
export const NO_COMPETITOR = "Yo'q";

export type NextActionMode = 'time' | 'followup';

export interface TalkedForm extends MandatoryValue {
  objection: string | null;
  competitor: string | null;
  referral_type: ReferralType | null;
  referral_name: string | null;
  product_fit: string | null;
  stage: CallStage;
  nextMode: NextActionMode;
  /** `datetime-local` value, Tashkent wall clock */
  nextLocal: string;
  /** yyyy-mm-dd */
  waitUntil: string;
  waitReason: WaitReason | null;
  lostReason: string | null;
  lostCompetitor: string;
  note: string;
}

/** Tomorrow 10:00 Tashkent as a `datetime-local` value. */
export function defaultNextLocal(now: Date = new Date()): string {
  return `${dayKey(new Date(now.getTime() + 86_400_000))}T10:00`;
}

/** Tomorrow's date (yyyy-mm-dd, Tashkent): the earliest date Kutish accepts. */
export function tomorrowKey(now: Date = new Date()): string {
  return dayKey(new Date(now.getTime() + 86_400_000));
}

export function addDaysKey(days: number, now: Date = new Date()): string {
  return dayKey(new Date(now.getTime() + days * 86_400_000));
}

/**
 * The form starts with the lead's own 5 fields (only the empty ones are asked)
 * but objection and competitor start empty: they are asked on every result.
 */
export function initialTalkedForm(lead: LeadV2, now: Date = new Date()): TalkedForm {
  return {
    ...mandatoryOf(lead),
    objection: null,
    competitor: null,
    referral_type: lead.referral_type ?? null,
    referral_name: lead.referral_name ?? null,
    product_fit: lead.product_fit ?? null,
    stage: defaultCallStage(lead.stage),
    nextMode: 'time',
    nextLocal: defaultNextLocal(now),
    waitUntil: '',
    waitReason: null,
    lostReason: null,
    lostCompetitor: '',
    note: '',
  };
}

/** What still blocks "Saqlash" for a talked call: problem keys, see `problemLabel`. */
export function talkedProblems(f: TalkedForm, now: Date = new Date()): string[] {
  const keys: string[] = [...missingMandatory(f)];
  if (blank(f.objection)) keys.push('objection');
  if (blank(f.competitor)) keys.push('competitor');
  if (f.stage === 'offer' && blank(f.product_fit)) keys.push('product_fit');

  if (f.stage === 'waiting') {
    if (!f.waitUntil || f.waitUntil < tomorrowKey(now)) keys.push('wait_until');
    if (!f.waitReason) keys.push('wait_reason');
  } else if (f.stage === 'lost') {
    if (!f.lostReason) keys.push('lost_reason');
    else if (f.lostReason === 'other_center' && blank(f.lostCompetitor)) keys.push('lost_competitor');
  } else if (f.nextMode === 'time') {
    const iso = fromLocalInput(f.nextLocal);
    if (!iso) keys.push('next_action');
    else if (Date.parse(iso) < now.getTime() - 60_000) keys.push('next_action_past');
  }
  return keys;
}

/** What "Band / keyin" still needs. */
export function busyProblems(iso: string | null, now: Date = new Date()): string[] {
  if (!iso) return ['callback_time'];
  if (Date.parse(iso) < now.getTime() - 60_000) return ['next_action_past'];
  return [];
}

type PayloadFields = NonNullable<RecordCallPayload['fields']>;

export interface CallPayloadInput {
  startedAt: string;
  talked?: TalkedForm;
  /** ISO instant chosen for "Band / keyin" */
  busyAt?: string | null;
  note?: string;
}

/** The payload for lead_record_call, exactly as RecordCallPayload describes it. */
export function buildCallPayload(result: CallResult, input: CallPayloadInput): RecordCallPayload {
  const payload: RecordCallPayload = { started_at: input.startedAt };

  if (result === 'talked' && input.talked) {
    const f = input.talked;
    const fields: PayloadFields = {};
    if (!blank(f.education_level)) fields.education_level = f.education_level;
    if (!blank(f.cert_level)) fields.cert_level = f.cert_level;
    if (f.age != null) fields.age = f.age;
    if (!blank(f.study_year)) fields.study_year = f.study_year;
    if (!blank(f.city)) fields.city = f.city;
    if (f.decider) fields.decider = f.decider;
    if (!blank(f.objection)) fields.objection = f.objection;
    if (!blank(f.competitor)) fields.competitor = f.competitor;
    if (f.referral_type) {
      fields.referral_type = f.referral_type;
      if (!blank(f.referral_name)) fields.referral_name = f.referral_name!.trim();
    }
    if (!blank(f.product_fit)) fields.product_fit = f.product_fit;
    payload.fields = fields;
    payload.stage = f.stage;
    if (!blank(f.note)) payload.note = f.note.trim();

    if (f.stage === 'waiting') {
      payload.wait_until = f.waitUntil;
      if (f.waitReason) payload.wait_reason = f.waitReason;
    } else if (f.stage === 'lost') {
      if (f.lostReason) payload.lost_reason = f.lostReason;
      if (!blank(f.lostCompetitor)) payload.lost_competitor = f.lostCompetitor.trim();
    } else if (f.nextMode === 'followup') {
      payload.next_action_kind = 'followup';
    } else {
      payload.next_action_kind = 'callback';
      const iso = fromLocalInput(f.nextLocal);
      if (iso) payload.next_action_at = iso;
    }
    return payload;
  }

  if (result === 'busy') {
    if (input.busyAt) payload.next_action_at = input.busyAt;
    if (!blank(input.note)) payload.note = input.note!.trim();
    return payload;
  }

  // no_answer / wrong_number: nothing to fill
  if (!blank(input.note)) payload.note = input.note!.trim();
  return payload;
}

// ---- allowed offers (spec §11) -----------------------------------------------------

export const OFFER_ORDER = ['standart', 'premium', 'hanbox', 'no_risk', 'kasbiy', 'gks'];

const GOOD_CERT = /^(TOPIK [3-6]|IELTS (5\.5|6\.0|6\.5|7))/i;

/** An objection is stored as its label ("Hujjat / moliya"); find its key ("docs_finance"). */
export function objectionKey(value: string | null | undefined, objections: { key: string; label: string }[]): string | null {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return null;
  const hit = objections.find((o) => o.label.toLowerCase() === v || o.key.toLowerCase() === v);
  return hit?.key ?? null;
}

type OfferState = Pick<LeadV2, 'cert_level' | 'study_year' | 'objection' | 'education_level'>;

/**
 * Which offers the card shows (spec §11):
 *   TOPIK 3+ / IELTS 5.5+      -> Standart + Premium
 *   visa / documents worry     -> NO RISK
 *   no certificate / a school class, or HanBox goal -> Hanbox
 *   TOPIK 2, or a vocational goal                   -> Kasbiy
 *   GKS goal                   -> GKS
 */
export function recommendedOfferKeys(lead: OfferState, objections: { key: string; label: string }[]): string[] {
  const keys = new Set<string>();
  const cert = (lead.cert_level ?? '').trim();
  const goal = (lead.education_level ?? '').trim();

  if (GOOD_CERT.test(cert)) {
    keys.add('standart');
    keys.add('premium');
  }
  if (cert === "Yo'q" || /sinf/i.test(lead.study_year ?? '') || /^hanbox$/i.test(goal)) keys.add('hanbox');

  const objKey = objectionKey(lead.objection, objections);
  if (objKey === 'docs_finance' || /viza|visa|виза/i.test(lead.objection ?? '')) keys.add('no_risk');

  if (/^kasbiy/i.test(goal) || /^TOPIK 2$/i.test(cert)) keys.add('kasbiy');
  if (/^gks$/i.test(goal)) keys.add('gks');

  return OFFER_ORDER.filter((k) => keys.has(k));
}

export function recommendedOffers(
  lead: OfferState,
  offers: Record<string, OfferSetting> | undefined,
  objections: { key: string; label: string }[],
): { key: string; offer: OfferSetting }[] {
  const all = offers ?? {};
  return recommendedOfferKeys(lead, objections)
    .filter((k) => all[k])
    .map((k) => ({ key: k, offer: all[k] }));
}

/** Offer keys in display order: the known ones first, then anything an admin added. */
export function offerKeys(offers: Record<string, OfferSetting> | undefined): string[] {
  const all = offers ?? {};
  const known = OFFER_ORDER.filter((k) => all[k]);
  const extra = Object.keys(all).filter((k) => !OFFER_ORDER.includes(k));
  return [...known, ...extra];
}

/** Shown while the settings have not arrived (or an admin emptied the offers). */
export const DEFAULT_OFFER_TITLES: Record<string, string> = {
  standart: 'Standart',
  premium: 'Premium',
  hanbox: 'Hanbox',
  no_risk: 'NO RISK',
  kasbiy: 'Kasbiy ta’lim',
  gks: 'GKS',
};

/** The "Taklif turi" choices: value = offer key (stored in `product_fit`), label = its title. */
export function offerOptions(offers: Record<string, OfferSetting> | undefined): { value: string; label: string }[] {
  const keys = offerKeys(offers);
  if (!keys.length) return OFFER_ORDER.map((k) => ({ value: k, label: DEFAULT_OFFER_TITLES[k] }));
  return keys.map((k) => ({ value: k, label: (offers ?? {})[k].title || DEFAULT_OFFER_TITLES[k] || k }));
}

// ---- AI field suggestions (spec §10 "Maydon takliflari") -------------------------------

/**
 * The fields `lead_apply_suggestion` really writes (the v2 field whitelist),
 * with the label the card shows. A suggestion for any other field (a summary,
 * "open question"...) is not a card field and is not shown here.
 */
export const SUGGESTION_FIELD_LABEL: Record<string, string> = {
  education_level: 'Maqsad',
  cert_level: 'Sertifikat / daraja',
  age: 'Yosh',
  study_year: 'Sinf / kurs',
  city: 'Viloyat',
  decider: 'Kim qaror qiladi / to‘laydi',
  language: 'Til',
  preferred_channel: 'Qulay kanal',
  preferred_time_text: 'Qulay vaqt',
  exam_date: 'Imtihon sanasi',
  exam_type: 'Imtihon turi',
  budget_range: 'Byudjet',
  target_intake: 'Qabul',
  referral_type: 'Tavsiya turi',
  referral_name: 'Tavsiya qilgan odam',
  objection: "Nima to'xtatyapti?",
  competitor: 'Boshqa markaz?',
  product_fit: 'Taklif turi',
  how_heard: 'Qanday eshitgan',
  source_note: 'Manba izohi',
  email: 'Email',
  birth_date: "Tug'ilgan sana",
};

export interface SuggestionLike {
  field: string;
  status: string;
  suggested_value: string | null;
}

/** Is this card field still empty on the lead? (`leads` carries a few columns LeadV2 does not list, hence the loose read.) */
export function emptyOnLead(lead: object, field: string): boolean {
  const v = (lead as Record<string, unknown>)[field];
  return v == null || (typeof v === 'string' && v.trim() === '');
}

/** Only pending suggestions, for card fields that are empty, that actually propose something. */
export function visibleSuggestions<T extends SuggestionLike>(list: T[], lead: object): T[] {
  return list.filter(
    (s) =>
      s.status === 'pending' &&
      !!SUGGESTION_FIELD_LABEL[s.field] &&
      (s.suggested_value ?? '').trim() !== '' &&
      emptyOnLead(lead, s.field),
  );
}

export interface SuggestionChoices {
  objections: { key: string; label: string }[];
  competitors: string[];
  offers: Record<string, OfferSetting> | undefined;
}

/** The values a suggestion may be corrected to, where the field has a fixed list (null = free text). */
export function suggestionOptions(field: string, choices: SuggestionChoices): { value: string; label: string }[] | null {
  const same = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));
  switch (field) {
    case 'decider':
      return [
        { value: 'self', label: DECIDER_LABEL.self },
        { value: 'parent', label: DECIDER_LABEL.parent },
        { value: 'relative', label: DECIDER_LABEL.relative },
      ];
    case 'language':
      return [
        { value: 'uz', label: "O'zbekcha" },
        { value: 'ru', label: 'Ruscha' },
      ];
    case 'preferred_channel':
      return [
        { value: 'instagram', label: 'Instagram' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'phone', label: 'Telefon' },
      ];
    case 'referral_type':
      return (Object.keys(REFERRAL_TYPE_LABEL) as (keyof typeof REFERRAL_TYPE_LABEL)[]).map((k) => ({
        value: k,
        label: REFERRAL_TYPE_LABEL[k],
      }));
    case 'education_level':
      return same(GOALS);
    case 'cert_level':
      return same(CERTIFICATES);
    case 'city':
      return same(REGIONS);
    case 'study_year':
      return same(STUDY_YEARS);
    case 'target_intake':
      return same(semesterOptions());
    case 'objection':
      return same(choices.objections.map((o) => o.label));
    case 'competitor':
      return same([NO_COMPETITOR, ...choices.competitors]);
    case 'product_fit':
      return offerOptions(choices.offers);
    default:
      return null;
  }
}

/** The editor a suggestion's value gets: a list, a number, a date or plain text. */
export function suggestionInputKind(field: string): 'number' | 'date' | 'text' {
  if (field === 'age') return 'number';
  if (field === 'exam_date' || field === 'birth_date') return 'date';
  return 'text';
}

// ---- the composer's guard (spec §6, §10, §11) -----------------------------------------

export type GuardKind = 'word' | 'discount' | 'variable';

export interface Guard {
  ok: boolean;
  kind: GuardKind | null;
  word: string | null;
  reason: string | null;
}

const DISCOUNT_HIT = '% chegirma';
const DISCOUNT_SOURCE = '\\d+\\s*%\\s*(?:chegirma|skidka)|chegirma\\s*\\d+\\s*(?:%|foiz)';
const VARIABLE_SOURCE = '\\{[A-Za-z_]+\\}';

export const DISCOUNT_HINT = "Avval rahbar tasdig'ini oling";

export const GUARD_OK: Guard = { ok: true, kind: null, word: null, reason: null };

/**
 * May this text go to a client? A forbidden word never; a "% chegirma" phrase
 * only once the lead has an approved promise; a leftover {variable} never.
 */
export function evaluateGuard(text: string, forbiddenWords: string[], hasApprovedPromise: boolean): Guard {
  if (!text.trim()) return GUARD_OK;
  const hit = findForbidden(text, forbiddenWords);
  if (hit && hit !== DISCOUNT_HIT) {
    return { ok: false, kind: 'word', word: hit, reason: `'${hit}' so'zi taqiqlangan` };
  }
  if (hit === DISCOUNT_HIT && !hasApprovedPromise) {
    return { ok: false, kind: 'discount', word: DISCOUNT_HIT, reason: `'${DISCOUNT_HIT}' iborasi taqiqlangan. ${DISCOUNT_HINT}` };
  }
  const variable = new RegExp(VARIABLE_SOURCE).exec(text);
  if (variable) {
    return { ok: false, kind: 'variable', word: variable[0], reason: `To'ldirilmagan o'zgaruvchi: ${variable[0]}` };
  }
  return GUARD_OK;
}

export const hasApprovedPromise = (promises: Pick<LeadPromise, 'status'>[] | undefined): boolean =>
  (promises ?? []).some((p) => p.status === 'approved');

export interface TextRange {
  start: number;
  end: number;
}

/** Where the offending words are, so the composer can underline them in red. */
export function forbiddenRanges(text: string, words: string[], includeDiscount: boolean): TextRange[] {
  const low = text.toLowerCase();
  const found: TextRange[] = [];
  for (const w of words) {
    const needle = (w ?? '').toLowerCase();
    if (!needle) continue;
    let i = low.indexOf(needle);
    while (i !== -1) {
      found.push({ start: i, end: i + needle.length });
      i = low.indexOf(needle, i + needle.length);
    }
  }
  const scan = (source: string) => {
    const re = new RegExp(source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      found.push({ start: m.index, end: m.index + m[0].length });
    }
  };
  if (includeDiscount) scan(DISCOUNT_SOURCE);
  scan(VARIABLE_SOURCE);

  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: TextRange[] = [];
  for (const r of found) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

// ---- templates ---------------------------------------------------------------------------

/** Used when the settings do not carry the template (the two the popup refers to). */
export const FALLBACK_TEMPLATES: Record<string, { uz: string; ru: string }> = {
  called: {
    uz: "{ism}, siz bilan bog'lanmoqchi bo'ldik, lekin ko'tarmadingiz. Qachon qo'ng'iroq qilsak qulay?",
    ru: '{ism}, мы пытались вам дозвониться, но вы не ответили. Когда вам удобно, чтобы мы позвонили?',
  },
  confirm_phone: {
    uz: "{ism}, raqamingizni tasdiqlang, iltimos — qo'ng'iroq qilishda xatolik chiqdi.",
    ru: '{ism}, подтвердите, пожалуйста, номер — при звонке возникла ошибка.',
  },
};

export function findTemplate(templates: TemplateSetting[] | undefined, key: string): TemplateSetting | null {
  const hit = (templates ?? []).find((t) => t.key === key);
  if (hit) return hit;
  const fb = FALLBACK_TEMPLATES[key];
  return fb ? { key, group: key, uz: fb.uz, ru: fb.ru } : null;
}

/** First name for "{ism}" — blank for the placeholders an Instagram / app lead starts with. */
export function firstName(fullName: string | null | undefined): string {
  const n = (fullName ?? '').trim();
  if (!n || /^(instagram|telegram|ilova|facebook)(\s|$)/i.test(n)) return '';
  return n.split(/\s+/)[0];
}

export interface TemplateContext {
  lead: Pick<LeadV2, 'full_name' | 'product_fit' | 'wait_until'>;
  offers: Record<string, OfferSetting> | undefined;
  hanboxDate?: string | null;
  operatorName?: string | null;
  templateKey?: string | null;
}

/**
 * {ism} {tarif} {narx} {sana} {operator}. A variable that cannot be resolved is
 * left in place: the composer's guard then refuses to send until it is edited.
 */
export function fillTemplate(text: string, ctx: TemplateContext): string {
  const offer = (ctx.offers ?? {})[ctx.lead.product_fit || 'standart'];
  const name = firstName(ctx.lead.full_name);
  let out = text;

  out = name ? out.split('{ism}').join(name) : out.replace(/\{ism\}[,!]?\s*/g, '');
  out = out.split('{tarif}').join(offer?.title ?? '');
  out = out.split('{narx}').join(offer?.text ?? '');

  const date = ctx.templateKey === 'hanbox' ? ctx.hanboxDate : ctx.lead.wait_until;
  if (date) out = out.split('{sana}').join(shortDate(date));
  if (ctx.operatorName) out = out.split('{operator}').join(ctx.operatorName);

  return out.length > 0 ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

export function templateText(t: TemplateSetting, lang: 'uz' | 'ru'): string {
  return (lang === 'ru' ? t.ru || t.uz : t.uz || t.ru) ?? '';
}

// ---- chat channels (what the composer can address) -------------------------------------------

export type ChatSource = 'telegram' | 'instagram';

export interface ChatChannel {
  source: ChatSource;
  /** the messages.sender_id this conversation is addressed by */
  senderId: string;
  label: string;
}

export interface IdentityRow {
  channel: string;
  identifier: string;
  identifier_label?: string | null;
}

const isChatSource = (c: string | null | undefined): c is ChatSource => c === 'telegram' || c === 'instagram';

/**
 * The (source, sender id) pairs a message can be sent to: the lead's chat
 * identities, plus the conversation that created the lead (`source` + `source_id`).
 * Only Telegram and Instagram have a send path.
 */
export function deriveChatChannels(
  lead: Pick<LeadV2, 'source' | 'source_id' | 'instagram_handle' | 'telegram_handle'>,
  identities: IdentityRow[],
): ChatChannel[] {
  const out: ChatChannel[] = [];
  const seen = new Set<string>();
  const add = (source: string | null | undefined, senderId: string | null | undefined, label?: string | null) => {
    if (!isChatSource(source) || !senderId || !String(senderId).trim()) return;
    const id = String(senderId).trim();
    const k = `${source}:${id}`;
    if (seen.has(k)) return;
    seen.add(k);
    const handle = (label ?? '').trim() || (source === 'instagram' ? lead.instagram_handle : lead.telegram_handle) || '';
    out.push({ source, senderId: id, label: handle && !/^\d+$/.test(handle) ? `@${handle.replace(/^@/, '')}` : '' });
  };
  for (const row of identities) add(row.channel, row.identifier, row.identifier_label);
  add(lead.source, lead.source_id);
  return out;
}

/** The chips under the lead's name: where it talks to us (chat identities, the source, the phone). */
export function channelChips(lead: Pick<LeadV2, 'source' | 'phone'>, chat: ChatChannel[]): string[] {
  const labels: string[] = [];
  const add = (label: string) => {
    if (label && label !== '—' && !labels.includes(label)) labels.push(label);
  };
  for (const c of chat) add(channelLabel(c.source));
  add(channelLabel(lead.source));
  if (lead.phone) add(channelLabel('phone'));
  return labels;
}

/** The ladder step a lead is waiting for: the attempt after the ones already missed ("zinapoya 2/5"). */
export function ladderLabel(lead: Pick<LeadV2, 'timer_kind' | 'ladder_state' | 'attempt_no'>): string | null {
  if (lead.timer_kind !== 'ladder' && lead.ladder_state !== 'running') return null;
  return `zinapoya ${Math.min((lead.attempt_no ?? 0) + 1, 5)}/5`;
}

/** Which channel the composer starts on: the one the client wrote on last, else the lead's preference. */
export function pickDefaultChannel(
  channels: ChatChannel[],
  lastIncomingChannel: string | null,
  preferred: string | null | undefined,
): ChatChannel | null {
  if (!channels.length) return null;
  return (
    channels.find((c) => c.source === lastIncomingChannel) ??
    channels.find((c) => c.source === preferred) ??
    channels[0]
  );
}
