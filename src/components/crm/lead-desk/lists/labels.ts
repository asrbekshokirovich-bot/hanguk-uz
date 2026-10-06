/**
 * Uzbek copy and constant lists for the secondary lead pages (Barcha lidlar,
 * Yo'qotilgan, Hisobot, Baza, Sozlamalar) and the comments panel.
 *
 * Shared labels (stages, channels, queues, ...) stay in ../copy; this file only
 * adds what those pages need on top, so the shared file is not touched.
 */
import { explainError, QUEUE_LABEL } from '../copy';
import type { LeadPromise, Stage } from '../types';

export const PAGE_SIZE = 50;

/** Stages an "active" lead can be in (students and lost leads have their own pages). */
export const ACTIVE_STAGES: Stage[] = ['new', 'contacted', 'interested', 'offer', 'contract', 'waiting'];

/** Old-CRM leads can sit in any stage. */
export const BAZA_STAGES: Stage[] = ['new', 'contacted', 'interested', 'offer', 'contract', 'student', 'waiting', 'lost'];

/** `leads.source` values worth a filter option. */
export const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'meta_form', label: 'Meta forma' },
  { value: 'call', label: "Qo'ng'iroq" },
  { value: 'app', label: 'Ilova' },
  { value: 'Public Registration', label: 'Sayt' },
  { value: 'manual', label: "Qo'lda" },
  { value: 'learning_center', label: "O'quv markaz" },
  { value: 'ai_detected', label: 'AI topgan' },
];

const SOURCE_NAME: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS.map((o) => [o.value, o.label]));

/** "meta_form" -> "Meta forma"; unknown values are shown as they are. */
export const sourceLabel = (s: string | null | undefined): string => (s ? (SOURCE_NAME[s] ?? s) : '—');

export const GENERATION_LABEL: Record<'old' | 'new', string> = { old: 'Eski', new: 'Yangi' };

export const PROMISE_KIND_LABEL: Record<LeadPromise['kind'], string> = {
  discount: 'Chegirma',
  installment: "Bo'lib to'lash",
  other: 'Boshqa shart',
};

// ---- reactivation queues (spec §8 table) --------------------------------------

/** The order the queue cards appear in. */
export const QUEUE_ORDER = ['hanbox', 'no_risk', 'next_intake', 'other_center', 'no_contact', 'price', 'parents'];

export const QUEUE_RULES: Record<string, { when: string; offer: string }> = {
  hanbox: {
    when: "Keyingi guruh e'lon qilinganda (Sozlamalardagi sana) va har 45 kunda",
    offer: 'Hanbox: 1 yil onlayn, maqsad TOPIK 2; $2 000 yoki $400 + 10×$200; birinchi dars bepul',
  },
  no_risk: {
    when: "NO RISK sharti kartada e'lon qilingach; har 60 kunda",
    offer: "Rahbar tasdig'i bilan",
  },
  next_intake: {
    when: '10 yanvar va 1 avgust to\'lqinlari',
    offer: 'Yangi qabul muddatlari',
  },
  other_center: {
    when: '+30 kun tekshiruv',
    offer: '«Qanday ketyapti?» — savol, taklif emas',
  },
  no_contact: {
    when: "+14 kun DM, +45 kun qo'ng'iroq",
    offer: 'Qisqa savol',
  },
  price: {
    when: "Real universitet muddati e'lon qilinganda",
    offer: 'Chegirmasiz, muddat bilan',
  },
  parents: {
    when: 'Tadbir sanasida (ota-ona kechasi / natija xatlari)',
    offer: 'Ota-onaga alohida',
  },
};

/** "Sertifikat yo'q → Hanbox" -> "Hanbox". */
export const queueShortLabel = (key: string): string => {
  const full = QUEUE_LABEL[key] ?? key;
  return full.split('→').pop()?.trim() || full;
};

export const queueLabel = (key: string): string => QUEUE_LABEL[key] ?? key;

/** Cards in the spec's order, then any queue key the database has that we do not know. */
export function queueKeys(summary: { queue_key: string }[]): string[] {
  const known = new Set(QUEUE_ORDER);
  return [...QUEUE_ORDER, ...summary.map((s) => s.queue_key).filter((k) => !known.has(k))];
}

/** How many days a queue of `n` leads takes to flow into BUGUN at `limit` a day. */
export const daysToDrain = (n: number, limit: number): number => (limit > 0 ? Math.ceil(n / limit) : 0);

// ---- templates ---------------------------------------------------------------

export const TEMPLATE_VARIABLES: { name: string; text: string }[] = [
  { name: '{ism}', text: 'mijozning ismi' },
  { name: '{tarif}', text: 'tarif / taklif nomi' },
  { name: '{narx}', text: 'ruxsat etilgan narx' },
  { name: '{sana}', text: 'sana (guruh boshlanishi, kutish sanasi, muddat)' },
  { name: '{operator}', text: 'operatorning ismi' },
];

export const TEMPLATE_GROUP_LABEL: Record<string, string> = {
  salom: 'Salom',
  narx: 'Narx / tariflar',
  hujjat: 'Hujjatlar',
  hanbox: 'Hanbox',
  no_risk: 'NO RISK',
  qongiroq: "«Qo'ng'iroq qildik»",
  raqam: '«Raqamni tasdiqlang»',
  kutish: 'Kutish eslatmasi',
  kuzatuv: 'Kuzatuv (1 / 3 / 7-kun)',
  qayta: 'Qayta faollashtirish',
  izoh: 'Izohga ochiq javob',
};

export const templateGroupLabel = (g: string): string => TEMPLATE_GROUP_LABEL[g] ?? g;

/** Templates the system itself looks up by key: their text is editable, the key and the template are not removable. */
export const PROTECTED_TEMPLATE_KEYS = [
  'greeting',
  'price',
  'called',
  'confirm_phone',
  'wait_reminder',
  'hanbox',
  'followup_d1',
  'followup_d3',
  'followup_d7',
  'reactivation_check',
  'comment_reply',
];

/** Offer keys the card / product-fit rule knows about. */
export const PROTECTED_OFFER_KEYS = ['standart', 'premium', 'no_risk', 'hanbox', 'kasbiy', 'gks'];

// ---- errors ------------------------------------------------------------------

const EXTRA_ERRORS: [RegExp, string][] = [
  [/not_lost/, "Bu lid yo'qotilgan emas"],
  [/comment_not_found/, 'Izoh topilmadi'],
  [/suggestion_not_pending/, "Bu taklif allaqachon ko'rib chiqilgan"],
];

/** A person-readable sentence for anything the api layer or an edge function threw. */
export function explainLeadError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  for (const [re, text] of EXTRA_ERRORS) if (re.test(msg)) return text;
  return explainError(msg);
}
