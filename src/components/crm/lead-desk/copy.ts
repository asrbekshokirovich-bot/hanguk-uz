/**
 * Lead module v2 — Uzbek copy and stored-value lists.
 *
 * The spec ("HANGUK Lid bo'limi TT") and the office both work in Uzbek, and the
 * module is desktop-only, so the chrome lives here rather than in the four
 * i18n bundles. The lists below are STORED VALUES (they are written to `leads`
 * verbatim and reported on) — never translate them.
 */
import type { CallResult, Decider, ReferralType, Stage, TimerKind, WaitReason } from './types';

export const STAGE_LABEL: Record<Stage, string> = {
  new: 'Yangi',
  contacted: 'Aloqada',
  interested: 'Qiziqdi',
  offer: 'Taklif',
  contract: 'Shartnoma',
  student: 'Talaba',
  waiting: 'Kutish',
  lost: "Yo'qotildi",
};

/** Stages an operator can move a lead to by hand. */
export const MANUAL_STAGES: Stage[] = ['contacted', 'interested', 'offer', 'contract'];

export const TIMER_LABEL: Record<TimerKind, string> = {
  first: 'Yangi lid',
  reply: 'Mijoz yozdi',
  ladder: 'Zinapoya',
  callback: "Qayta qo'ng'iroq",
};

export const CHANNEL_LABEL: Record<string, string> = {
  instagram: 'IG',
  telegram: 'TG',
  facebook: 'FB',
  phone: 'Tel',
  meta_form: 'Forma',
  app: 'Ilova',
  manual: "Qo'lda",
  call: "Qo'ng'iroq",
  'Public Registration': 'Sayt',
  learning_center: "O'quv markaz",
};

export const channelLabel = (c: string | null | undefined) => (c ? (CHANNEL_LABEL[c] ?? c) : '—');

export const CALL_RESULT_LABEL: Record<CallResult, string> = {
  talked: 'Gaplashildi',
  no_answer: "Ko'tarmadi",
  busy: "Band / keyin qo'ng'iroq",
  wrong_number: 'Nomer xato',
};

export const DECIDER_LABEL: Record<Decider, string> = {
  self: "O'zi",
  parent: 'Ota-ona',
  relative: 'Qarindosh',
};

export const REFERRAL_TYPE_LABEL: Record<ReferralType, string> = {
  student: 'Talaba',
  alumni: 'Bitiruvchi',
  parent: 'Ota-ona',
  partner: 'Hamkor',
  other: 'Boshqa',
};

export const WAIT_REASON_LABEL: Record<WaitReason, string> = {
  exam_result: 'Imtihon natijasi',
  family_decision: 'Oila qarori',
  money: 'Pul',
  next_intake: 'Keyingi qabul',
  other: 'Boshqa',
};

/** The mandatory-field keys returned by `missing_fields:` and `lead_desk().missing`. */
export const MISSING_FIELD_LABEL: Record<string, string> = {
  goal: 'Maqsad',
  certificate: 'Sertifikat / daraja',
  age_grade: 'Yosh / sinf',
  region: 'Viloyat',
  decider: 'Kim qaror qiladi / to‘laydi',
  objection: "Nima to'xtatyapti?",
  competitor: 'Boshqa markaz?',
  product_fit: 'Taklif turi',
};

export const QUEUE_LABEL: Record<string, string> = {
  hanbox: "Sertifikat yo'q → Hanbox",
  no_risk: 'Hujjat / moliya → NO RISK',
  next_intake: 'Keyingi yil → yanvar / avgust',
  other_center: 'Boshqa markaz → 30 kundan keyin',
  no_contact: "Aloqa yo'q → 14 kundan keyin DM",
  price: 'Narx → muddat / aksiya',
  parents: "Ota-ona qarshi → ota-ona kechasi",
};

export const NEXT_ACTION_LABEL: Record<string, string> = {
  callback: "Qo'ng'iroq",
  followup: 'Kuzatuv',
  wait_end: 'Kutish tugadi',
  reactivation: 'Qayta faollashtirish',
  task: 'Vazifa',
};

// ---- stored-value lists (the 5 mandatory fields) ----------------------------

/** Maqsad. Stored in `leads.education_level`. */
export const GOALS = ['Bakalavr', 'Magistr', 'Kasbiy ta’lim', 'Til kursi', 'HanBox', 'GKS'] as const;

/** Sertifikat / daraja. Stored in `leads.cert_level`. "Yo'q" is an answer, not a blank. */
export const CERTIFICATES = [
  "Yo'q",
  'TOPIK 1',
  'TOPIK 2',
  'TOPIK 3',
  'TOPIK 4',
  'TOPIK 5',
  'TOPIK 6',
  'IELTS 5.5',
  'IELTS 6.0',
  'IELTS 6.5',
  'IELTS 7.0+',
  'TOEFL',
] as const;

/** Viloyat. Stored in `leads.city`. */
export const REGIONS = [
  'Toshkent',
  'Samarqand',
  'Buxoro',
  'Andijon',
  "Farg'ona",
  'Namangan',
  'Qarshi',
  'Nukus',
  'Urganch',
  'Jizzax',
  'Navoiy',
  'Termiz',
  'Guliston',
  'Chet el',
] as const;

/** Maktab / kollej / universitet kursi. Stored in `leads.study_year`. */
export const STUDY_YEARS = [
  '9-sinf',
  '10-sinf',
  '11-sinf',
  'Kollej',
  '1-kurs',
  '2-kurs',
  '3-kurs',
  '4-kurs',
  'Bitirgan',
  'Ishlaydi',
] as const;

export const MIN_AGE = 15;
export const MAX_AGE = 45;

// ---- errors ----------------------------------------------------------------

/**
 * The database raises short machine codes ("missing_fields:goal,decider",
 * "next_action_required"...). Turn one into a sentence for the operator.
 */
export function explainError(message: string | null | undefined): string {
  const m = message ?? '';
  const missing = /missing_fields:([a-z_,]+)/.exec(m);
  if (missing) {
    const names = missing[1].split(',').map((k) => MISSING_FIELD_LABEL[k] ?? k);
    return `To‘ldirilmagan: ${names.join(', ')}`;
  }
  const table: [RegExp, string][] = [
    [/next_action_required/, "Keyingi harakat sanasi va vaqtini tanlang"],
    [/next_action_in_past/, "Keyingi harakat vaqti o'tib ketgan"],
    [/wait_date_required/, "Kutish uchun kelajakdagi sanani tanlang"],
    [/wait_reason_required/, "Kutish sababini tanlang"],
    [/not_answered_yet/, "Avval mijoz bilan gaplashing, keyin Kutish"],
    [/bad_lost_reason/, "Yo'qotish sababini tanlang"],
    [/lead_is_student/, "Bu mijoz allaqachon talaba"],
    [/owned_by_other/, "Bu lid boshqa operatorda"],
    [/not_allowed|42501|permission denied|row-level security/i, "Bu amalga ruxsat yo'q"],
    [/lead_not_found/, "Lid topilmadi"],
    [/phone_required/, "Telefon raqamini kiriting"],
    [/phone_invalid/, "Telefon raqami noto'g'ri (kamida 9 raqam)"],
    [/name_required/, "Ismni kiriting"],
    [/referral_required/, "Tavsiya qilgan odamni kiriting"],
    [/text_required/, "Matnni kiriting"],
    [/promise_not_pending/, "Bu so'rov allaqachon ko'rib chiqilgan"],
    [/queue_not_announced/, "Bu navbat hali e'lon qilinmagan (Sozlamalar)"],
    [/leads_age_range|leads_age_check/i, `Yosh ${MIN_AGE}–${MAX_AGE} oralig'ida bo'lishi kerak`],
  ];
  for (const [re, text] of table) if (re.test(m)) return text;
  return m || "Noma'lum xatolik";
}

/** Keys from a "missing_fields:..." error, or [] when it is some other error. */
export function missingFieldsFrom(message: string | null | undefined): string[] {
  const hit = /missing_fields:([a-z_,]+)/.exec(message ?? '');
  return hit ? hit[1].split(',') : [];
}
