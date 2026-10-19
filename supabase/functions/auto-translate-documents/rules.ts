// What an automatic translation needs before it may run.
//
// The owner's rule (2026-10-19): names on a translation come from identity
// documents, never from the document being translated.
//   * Diploma / attestat  -> the student's foreign (zagran) passport: the
//                            student's name, surname and patronymic.
//   * Birth certificate   -> the student's foreign passport AND the father's and
//                            the mother's passport (ID card or foreign passport).
// Until every one of them is uploaded the job waits; uploading the missing one
// puts it back in the queue (trigger in migration 20261019090000).
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
  | { ready: true; supporting: PlannedFile[] }
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

interface Requirement { label: string; role: SupportingRole; anyOf: string[] }

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
  birth_certificate: [STUDENT_PASSPORT, FATHER, MOTHER],
};

/**
 * Decide whether the source slot can be translated with the student's current
 * uploads. Every document found for a requirement is attached (a parent's ID
 * card and foreign passport both help with spelling).
 */
export function planTranslation(sourceSlot: string, docs: StudentDoc[]): Plan {
  const missing: string[] = [];
  const supporting: PlannedFile[] = [];
  for (const req of REQUIREMENTS[sourceSlot] ?? []) {
    const found = req.anyOf.map((s) => newestFor(docs, s)).filter((d): d is StudentDoc => !!d);
    if (found.length === 0) {
      missing.push(req.label);
      continue;
    }
    for (const d of found) {
      supporting.push({ documentId: d.id, path: d.file_path, bucket: "student-documents", role: req.role });
    }
  }
  return missing.length ? { ready: false, missing } : { ready: true, supporting };
}

export function waitingMessage(missing: string[]): string {
  return `Hujjat kutilmoqda: ${missing.join(", ")}`;
}

/**
 * What to do with an existing translation in the `<slot>_translation` slot:
 *   * none                  -> add ours
 *   * approved              -> keep it; an admin already signed it off
 *   * newer than the source -> keep it; someone put it there for this upload
 *   * otherwise             -> replace it (it belongs to an earlier upload)
 */
export function existingTranslationAction(
  existing: Pick<StudentDoc, "status" | "created_at"> | undefined,
  source: Pick<StudentDoc, "created_at">,
): "add" | "keep" | "replace" {
  if (!existing) return "add";
  if (existing.status === "approved") return "keep";
  if (Date.parse(existing.created_at) > Date.parse(source.created_at)) return "keep";
  return "replace";
}
