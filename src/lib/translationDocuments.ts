import type { Tables } from '@/integrations/supabase/types';

type DocumentRow = Tables<'documents'>;

export type SupportingRole = 'student_passport' | 'father_id' | 'mother_id' | 'other';

export interface ResolvedFile {
  slotId: string;
  path: string;
  bucket: 'student-documents';
  role: SupportingRole;
  label: string;
  documentId: string;
}

export interface ResolvedTranslationInputs {
  source: ResolvedFile | null;
  supporting: ResolvedFile[];
}

// Student upload slots that matter for translation, with display labels.
export const STUDENT_DOC_SLOTS: Record<string, { uz: string; en: string; ru: string }> = {
  applicant_id_card: { uz: 'ID karta (pasport)', en: 'ID card (passport)', ru: 'ID-карта (паспорт)' },
  foreign_passport: { uz: 'Zagran pasport', en: 'Foreign passport', ru: 'Загранпаспорт' },
  father_id_card: { uz: 'Ota ID karta', en: "Father's ID card", ru: 'ID-карта отца' },
  mother_id_card: { uz: 'Ona ID karta', en: "Mother's ID card", ru: 'ID-карта матери' },
  father_foreign_passport: { uz: 'Ota zagran pasporti', en: "Father's foreign passport", ru: 'Загранпаспорт отца' },
  mother_foreign_passport: { uz: 'Ona zagran pasporti', en: "Mother's foreign passport", ru: 'Загранпаспорт матери' },
  birth_certificate: { uz: "Tug'ilganlik guvohnomasi", en: 'Birth certificate', ru: 'Свидетельство о рождении' },
  diploma: { uz: 'Diplom / attestat', en: 'Diploma / certificate', ru: 'Диплом / аттестат' },
  diploma_supplement: { uz: 'Diplom ilovasi', en: 'Diploma supplement', ru: 'Приложение к диплому' },
  marriage_certificate: { uz: 'Nikoh guvohnomasi', en: 'Marriage certificate', ru: 'Свидетельство о браке' },
  language_certificate: { uz: 'Til sertifikati', en: 'Language certificate', ru: 'Языковой сертификат' },
  death_certificate: { uz: "O'lim guvohnomasi", en: 'Death certificate', ru: 'Свидетельство о смерти' },
};

// Legacy aliases — handles documents uploaded before slot renames.
const SLOT_ALIASES: Record<string, string> = {
  applicant_passport: 'foreign_passport',
  parent_passport: 'father_id_card',
};

// Same matching logic as DocumentUpload.matchesDocSlot: bracket tag in name,
// exact filename prefix, and bidirectional legacy aliases.
export function matchesSlot(doc: DocumentRow, slotId: string): boolean {
  const checkId = (id: string): boolean => {
    const nameLower = (doc.name || '').toLowerCase();
    const parts = (doc.file_path || '').split('/');
    const filename = parts[parts.length - 1].toLowerCase();
    const normalId = id.toLowerCase();
    return (
      nameLower.includes(`[${normalId}]`) ||
      filename.startsWith(`${normalId}-`) ||
      filename.startsWith(`${normalId}.`)
    );
  };

  if (checkId(slotId)) return true;
  for (const [alias, target] of Object.entries(SLOT_ALIASES)) {
    if (target === slotId && checkId(alias)) return true;
    if (alias === slotId && checkId(target)) return true;
  }
  return false;
}

// Most recently uploaded document for a slot.
export function findStudentDoc(documents: DocumentRow[], slotId: string): DocumentRow | undefined {
  const matches = documents.filter((d) => matchesSlot(d, slotId));
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

// Translation document-type code -> the student upload slot that is its source.
const TYPE_TO_SOURCE_SLOT: Record<string, string> = {
  diploma: 'diploma',
  attestat: 'diploma',
  birth_certificate: 'birth_certificate',
  passport: 'foreign_passport',
  marriage_certificate: 'marriage_certificate',
  transcript: 'diploma_supplement',
};

function toResolved(doc: DocumentRow, slotId: string, role: SupportingRole, lang: string): ResolvedFile {
  const labels = STUDENT_DOC_SLOTS[slotId];
  const label = labels ? labels[(lang as 'uz' | 'en' | 'ru')] ?? labels.en : slotId;
  return {
    slotId,
    path: doc.file_path,
    bucket: 'student-documents',
    role,
    label,
    documentId: doc.id,
  };
}

// Resolve the likely source document and the supporting identity documents that
// should be auto-attached for a given translation type. The student's foreign
// passport is always attached (authoritative name source); for birth
// certificates the parents' IDs/passports are attached too. Staff can override.
export function resolveTranslationInputs(
  typeCode: string,
  documents: DocumentRow[],
  lang: string = 'uz',
): ResolvedTranslationInputs {
  const sourceSlot = TYPE_TO_SOURCE_SLOT[typeCode];
  const sourceDoc = sourceSlot ? findStudentDoc(documents, sourceSlot) : undefined;
  const source = sourceDoc ? toResolved(sourceDoc, sourceSlot!, 'other', lang) : null;

  const supporting: ResolvedFile[] = [];
  const seen = new Set<string>();
  const add = (slotId: string, role: SupportingRole) => {
    const doc = findStudentDoc(documents, slotId);
    if (!doc || seen.has(doc.id)) return;
    if (source && doc.id === source.documentId) return; // don't attach the source to itself
    seen.add(doc.id);
    supporting.push(toResolved(doc, slotId, role, lang));
  };

  // Always: student's foreign passport (authoritative spelling of the student name).
  add('foreign_passport', 'student_passport');

  // Birth certificate: parents' identity documents.
  if (typeCode === 'birth_certificate') {
    add('father_id_card', 'father_id');
    add('father_foreign_passport', 'father_id');
    add('mother_id_card', 'mother_id');
    add('mother_foreign_passport', 'mother_id');
  }

  return { source, supporting };
}
