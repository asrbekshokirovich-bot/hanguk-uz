import type { Tables } from '@/integrations/supabase/types';
import { findStudentDoc } from '@/lib/translationDocuments';

type Lang = 'uz' | 'en' | 'ru';
type Localized = Record<Lang, string>;

export interface StudentDocSlot {
  /** The `[id]` tag the student portal writes into `documents.name` on upload. */
  id: string;
  name: Localized;
  note?: Localized;
  /**
   * Counted toward the application-pack gate. An optional slot is still shown
   * and can be verified, but never blocks "advance to the next stage".
   */
  required: boolean;
  /**
   * The slot also carries a translated copy, shown under it as its own row.
   * The translation lives in `documents` under the `[<id>_translation]` tag —
   * the same tag the student portal's translation slots write.
   */
  translation?: Localized;
}

/**
 * The application pack: the documents the student portal asks for at contract
 * signing (`requiredDocuments` in src/components/student/DocumentUpload.tsx).
 * The ids must stay identical to the portal's — they are the only link between
 * an uploaded row and a checklist slot.
 */
export const APPLICATION_PACK_SLOTS: StudentDocSlot[] = [
  {
    id: 'applicant_id_card',
    name: { uz: 'Topshiruvchining ID karta (pasport) nusxasi', en: "Applicant's ID card (passport) copy", ru: 'Копия ID-карты (паспорта) заявителя' },
    required: true,
  },
  {
    id: 'foreign_passport',
    name: { uz: 'Topshiruvchining zagran pasporti nusxasi', en: "Applicant's foreign passport copy", ru: 'Копия загранпаспорта заявителя' },
    required: true,
  },
  {
    id: 'father_id_card',
    name: { uz: 'Otaning ID karta (pasport) nusxasi', en: "Father's ID card (passport) copy", ru: 'Копия ID-карты (паспорта) отца' },
    required: true,
  },
  {
    id: 'mother_id_card',
    name: { uz: 'Onaning ID karta (pasport) nusxasi', en: "Mother's ID card (passport) copy", ru: 'Копия ID-карты (паспорта) матери' },
    required: true,
  },
  {
    id: 'birth_certificate',
    name: { uz: "Tug'ilganlik haqida guvohnoma nusxasi (Metrka)", en: 'Birth certificate copy', ru: 'Копия свидетельства о рождении (Метрика)' },
    required: true,
    translation: { uz: "Tug'ilganlik guvohnomasi tarjimasi", en: 'Birth certificate translation', ru: 'Перевод свидетельства о рождении' },
  },
  // The id stays `language_certificate` so uploads made before the rename keep
  // matching; TOPIK has its own slot below.
  {
    id: 'language_certificate',
    name: { uz: 'IELTS sertifikati nusxasi', en: 'IELTS certificate copy', ru: 'Копия сертификата IELTS' },
    note: { uz: 'Kamida IELTS 5.5', en: 'Min. IELTS 5.5', ru: 'Мин. IELTS 5.5' },
    required: true,
  },
  // TOPIK and the apostille sit in the contract pack and are shown with it, but
  // they do not gate "advance to the next stage": every student already in the
  // system predates these two slots, and gating on them would freeze all of
  // them at once. Same treatment `marriage_certificate` already gets.
  {
    id: 'topik_certificate',
    name: { uz: 'TOPIK sertifikati nusxasi', en: 'TOPIK certificate copy', ru: 'Копия сертификата TOPIK' },
    required: false,
  },
  {
    id: 'photo',
    name: { uz: 'Rasm (3.5x4.5)', en: 'Photo (3.5x4.5 cm)', ru: 'Фото (3.5x4.5 см)' },
    required: true,
  },
  {
    id: 'diploma',
    name: { uz: 'Diplom yoki attestat nusxasi', en: 'Diploma or certificate copy', ru: 'Копия диплома или аттестата' },
    required: true,
    translation: { uz: 'Diplom / attestat tarjimasi', en: 'Diploma / certificate translation', ru: 'Перевод диплома / аттестата' },
  },
  {
    id: 'diploma_apostille',
    name: { uz: 'Diplom / Attestat apostili', en: 'Diploma / certificate apostille', ru: 'Апостиль диплома / аттестата' },
    required: false,
    translation: { uz: 'Apostil tarjimasi', en: 'Apostille translation', ru: 'Перевод апостиля' },
  },
  // The portal asks every student for this, but only married applicants have
  // one, so it is shown without gating the pack.
  {
    id: 'marriage_certificate',
    name: { uz: 'Nikoh guvohnomasi nusxasi', en: 'Marriage certificate copy', ru: 'Копия свидетельства о браке' },
    note: { uz: "Agar mavjud bo'lsa", en: 'If applicable', ru: 'При наличии' },
    required: false,
  },
  // Only applicants with a deceased parent have one, so it never gates the pack.
  {
    id: 'death_certificate',
    name: { uz: "O'lim guvohnomasi nusxasi", en: 'Death certificate copy', ru: 'Копия свидетельства о смерти' },
    note: { uz: "Agar tegishli bo'lsa", en: 'If applicable', ru: 'При необходимости' },
    required: false,
    translation: { uz: "O'lim guvohnomasi tarjimasi", en: 'Death certificate translation', ru: 'Перевод свидетельства о смерти' },
  },
];

/**
 * Documents requested case by case (`conditionalDocuments` in the portal).
 * They appear in the pack checklist only once the student has uploaded one.
 */
export const CONDITIONAL_DOC_SLOTS: StudentDocSlot[] = [
  { id: 'bank_statement', name: { uz: "Bank ma'lumotnomasi asl nusxasi", en: 'Original bank statement', ru: 'Оригинал банковской справки' }, required: false },
  { id: 'recommendation', name: { uz: 'Tavsiyanoma (Magistratura va PhD uchun)', en: "Recommendation letter (for Master's and PhD)", ru: 'Рекомендательное письмо (для магистратуры и PhD)' }, required: false },
  { id: 'autobiography', name: { uz: "Avtobiografiya va o'qish reja (insho)", en: 'Autobiography and study plan (essay)', ru: 'Автобиография и план обучения (эссе)' }, required: false },
  { id: 'father_foreign_passport', name: { uz: 'Otaning zagran pasporti nusxasi', en: "Father's foreign passport copy", ru: 'Копия загранпаспорта отца' }, required: false },
  { id: 'mother_foreign_passport', name: { uz: 'Onaning zagran pasporti nusxasi', en: "Mother's foreign passport copy", ru: 'Копия загранпаспорта матери' }, required: false },
  { id: 'diploma_supplement', name: { uz: 'Diplom ilovasi nusxasi', en: 'Diploma supplement copy', ru: 'Копия приложения к диплому' }, required: false },
];

export function slotLabel(text: Localized, lang: string): string {
  return text[lang as Lang] ?? text.uz;
}

export type SlotState = 'verified' | 'received' | 'missing';

export interface ResolvedSlot {
  slot: StudentDocSlot;
  /** Newest upload matching the slot, if any. */
  doc: Tables<'documents'> | undefined;
  state: SlotState;
  /** The translated copy, for a slot that has one. Never counted toward the gate. */
  translation?: ResolvedSlot;
}

export function translationSlotId(slotId: string): string {
  return `${slotId}_translation`;
}

function stateOf(doc: Tables<'documents'> | undefined): SlotState {
  return !doc ? 'missing' : doc.status === 'approved' ? 'verified' : 'received';
}

function resolveSlot(slot: StudentDocSlot, docs: Tables<'documents'>[]): ResolvedSlot {
  const doc = findStudentDoc(docs, slot.id);
  const resolved: ResolvedSlot = { slot, doc, state: stateOf(doc) };
  if (slot.translation) {
    const tSlot: StudentDocSlot = { id: translationSlotId(slot.id), name: slot.translation, required: false };
    const tDoc = findStudentDoc(docs, tSlot.id);
    resolved.translation = { slot: tSlot, doc: tDoc, state: stateOf(tDoc) };
  }
  return resolved;
}

export interface ApplicationPack {
  /** Every pack slot, followed by any conditional slot the student uploaded. */
  slots: ResolvedSlot[];
  requiredTotal: number;
  requiredVerified: number;
}

/**
 * The application-pack view of one student's uploads. Matching goes through
 * the same `[slot]` tag / filename-prefix matcher the portal and the
 * translation workflow use, legacy aliases included.
 */
export function buildApplicationPack(docs: Tables<'documents'>[]): ApplicationPack {
  const pack = APPLICATION_PACK_SLOTS.map((s) => resolveSlot(s, docs));
  const extras = CONDITIONAL_DOC_SLOTS.map((s) => resolveSlot(s, docs)).filter((r) => r.doc);
  const required = pack.filter((r) => r.slot.required);
  return {
    slots: [...pack, ...extras],
    requiredTotal: required.length,
    requiredVerified: required.filter((r) => r.state === 'verified').length,
  };
}
