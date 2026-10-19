// What an automatic translation needs before it may run.
//
// The owner's rule (2026-10-19): names on a translation come from identity
// documents, never from the document being translated.
//   * Diploma / attestat  -> the student's foreign (zagran) passport: the
//                            student's name, surname and patronymic.
//   * Birth certificate   -> the student's foreign passport. The father's and
//                            the mother's passport (ID card or foreign passport)
//                            are used when uploaded; for a parent without one
//                            (e.g. deceased) the name is taken as written on
//                            the birth certificate (owner, 2026-10-19).
// Until a required document is uploaded the job waits; uploading it puts the
// job back in the queue. A parent's passport arriving after a translation that
// had to use the certificate's spelling queues a fresh one (trigger in
// migration 20261019120000), which replaces it unless an admin approved it.
//
// Slot ids and legacy aliases mirror src/lib/translationDocuments.ts.

export interface StudentDoc {
  id: string;
  name: string;
  file_path: string;
  created_at: string;
  status: string;
  intake_id: string | null;
}

export type SupportingRole = "student_passport" | "father_id" | "mother_id";

export interface PlannedFile { documentId: string; path: string; bucket: "student-documents"; role: SupportingRole }

export type Plan =
  | { ready: true; supporting: PlannedFile[]; namesFromSource: SupportingRole[] }
  | { ready: false; missing: string[] };

/** Source slots translated automatically, and the translation type each one uses. */
export const AUTO_SOURCES: Record<string, { typeCode: string; documentNote?: string }> = {
  diploma: {
    typeCode: "diploma",
    documentNote:
      "The MAIN document is either a higher-education DIPLOMA or a school leaving certificate (ATTESTAT). " +
      "Title the translation after what the document actually is.",
  },
  birth_certificate: { typeCode: "birth_certificate" },
};

const SLOT_ALIASES: Record<string, string[]> = {
  foreign_passport: ["foreign_passport", "applicant_passport"],
  father_id_card: ["father_id_card", "parent_passport"],
};

/** The `[slot]` tag the portal writes at the start of documents.name. */
export function slotTag(doc: Pick<StudentDoc, "name">): string | null {
  const m = /^\[([^\]]+)\]/.exec(doc.name || "");
  return m ? m[1].toLowerCase() : null;
}

function matches(doc: StudentDoc, slotId: string): boolean {
  const ids = SLOT_ALIASES[slotId] ?? [slotId];
  const tag = slotTag(doc);
  const file = (doc.file_path || "").split("/").pop()!.toLowerCase();
  return ids.some((id) => tag === id || file.startsWith(`${id}-`) || file.startsWith(`${id}.`));
}

/** Newest upload for a slot. */
export function newestFor(docs: StudentDoc[], slotId: string): StudentDoc | undefined {
  return docs
    .filter((d) => matches(d, slotId))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}

interface Requirement { label: string; role: SupportingRole; anyOf: string[]; optional?: boolean }

const STUDENT_PASSPORT: Requirement = {
  label: "talabaning zagran pasporti",
  role: "student_passport",
  anyOf: ["foreign_passport"],
};
const FATHER: Requirement = {
  label: "otasining pasporti (ID karta yoki zagran)",
  role: "father_id",
  anyOf: ["father_id_card", "father_foreign_passport"],
};
const MOTHER: Requirement = {
  label: "onasining pasporti (ID karta yoki zagran)",
  role: "mother_id",
  anyOf: ["mother_id_card", "mother_foreign_passport"],
};

const REQUIREMENTS: Record<string, Requirement[]> = {
  diploma: [STUDENT_PASSPORT],
  birth_certificate: [STUDENT_PASSPORT, { ...FATHER, optional: true }, { ...MOTHER, optional: true }],
};

/**
 * Decide whether the source slot can be translated with the student's current
 * uploads. Every document found for a requirement is attached (a parent's ID
 * card and foreign passport both help with spelling). An optional one that is
 * absent is listed in `namesFromSource`: that person's name is copied from the
 * document being translated.
 */
export function planTranslation(sourceSlot: string, docs: StudentDoc[]): Plan {
  const missing: string[] = [];
  const supporting: PlannedFile[] = [];
  const namesFromSource: SupportingRole[] = [];
  for (const req of REQUIREMENTS[sourceSlot] ?? []) {
    const found = req.anyOf.map((s) => newestFor(docs, s)).filter((d): d is StudentDoc => !!d);
    if (found.length === 0) {
      if (req.optional) namesFromSource.push(req.role);
      else missing.push(req.label);
      continue;
    }
    for (const d of found) {
      supporting.push({ documentId: d.id, path: d.file_path, bucket: "student-documents", role: req.role });
    }
  }
  return missing.length ? { ready: false, missing } : { ready: true, supporting, namesFromSource };
}

const PERSON: Record<SupportingRole, string> = { student_passport: "STUDENT", father_id: "FATHER", mother_id: "MOTHER" };

/**
 * Prompt override for parents without an identity document: their name is
 * taken from the birth certificate itself instead of being flagged unclear.
 */
export function namesFromSourceNote(roles: SupportingRole[]): string | undefined {
  if (roles.length === 0) return undefined;
  const who = roles.map((r) => PERSON[r]).join(" and the ");
  return `EXCEPTION TO NAME ACCURACY: no passport / ID card is provided for the ${who}. ` +
    `Copy that name exactly as written on the MAIN document, transliterated to Latin with the OCR rules below. ` +
    `Do not add it to "unclearItems" for lack of an identity document.`;
}

export function waitingMessage(missing: string[]): string {
  return `Hujjat kutilmoqda: ${missing.join(", ")}`;
}

/** Storage name suffix of a translation this worker filed. */
export const AUTO_FILE_SUFFIX = "-auto.docx";

/**
 * What to do with an existing translation in the `<slot>_translation` slot:
 *   * none                        -> add ours
 *   * approved                    -> keep it; an admin already signed it off
 *   * an earlier one of ours      -> replace it (e.g. now with a parent's passport)
 *   * newer than the source       -> keep it; someone put it there for this upload
 *   * otherwise                   -> replace it (it belongs to an earlier upload)
 */
export function existingTranslationAction(
  existing: Pick<StudentDoc, "status" | "created_at" | "file_path"> | undefined,
  source: Pick<StudentDoc, "created_at">,
): "add" | "keep" | "replace" {
  if (!existing) return "add";
  if (existing.status === "approved") return "keep";
  if (existing.file_path.endsWith(AUTO_FILE_SUFFIX)) return "replace";
  if (Date.parse(existing.created_at) > Date.parse(source.created_at)) return "keep";
  return "replace";
}
