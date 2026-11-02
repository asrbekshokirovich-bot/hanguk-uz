// Compact "who this answer is about" cards for the CRM answer layout (Asrbek's
// design, 2026-10-29): name, season, document pack, one pill per university.
// Built from tool results, never from the model's text.
//
// deno-lint-ignore-file no-explicit-any

export type PillTone = "good" | "bad" | "neutral";

/** Furthest step of one university; the CRM translates the code (4 languages). */
export type UniStatus =
  | "chosen" | "online" | "offline" | "interview" | "accepted" | "rejected" | "final"
  | "visa_process" | "visa_waiting" | "visa_received";

export interface StudentEntity {
  kind: "student";
  id: string;
  name: string;
  initials: string;
  /** "spring 2027" / "fall 2027" — the CRM writes it in its language. */
  season: string | null;
  docsApproved: number | null;
  docsRequired: number | null;
  universities: { name: string; status: UniStatus; tone: PillTone }[];
}

export type Entity = StudentEntity;

/** "MURATOV SHOKHRUKH ULUGBEKOVICH" → "Muratov Shokhrukh". */
export function shortName(full: string): string {
  return String(full || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase("en") + w.slice(1).toLocaleLowerCase("en"))
    .join(" ");
}

export function initials(full: string): string {
  return String(full || "").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

/** "Hanyang University" → "Hanyang"; "University of Seoul" → "Seoul". */
export function shortUniversity(name: string): string {
  return String(name || "")
    .replace(/^University of\s+/i, "")
    .replace(/\s+(National\s+)?University$/i, (m) => (/national/i.test(m) ? " National" : ""))
    .trim();
}

/** "Spring 2027" → "spring 2027". */
export function seasonCode(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/(spring|fall)\s+(\d{4})/i);
  return m ? `${m[1].toLowerCase()} ${m[2]}` : String(s);
}

const VISA: Record<string, UniStatus> = {
  "viza jarayonida": "visa_process",
  "viza natijasini kutyapti": "visa_waiting",
  "viza oldi": "visa_received",
};

/** The furthest step of one university (ai_student_card row). */
export function universityStatus(u: any): { status: UniStatus; tone: PillTone } {
  if (u?.result === "rad etildi") return { status: "rejected", tone: "bad" };
  if (u?.visa_status && VISA[u.visa_status]) return { status: VISA[u.visa_status], tone: "good" };
  if (u?.final_choice) return { status: "final", tone: "good" };
  if (u?.result === "qabul qilindi") return { status: "accepted", tone: "good" };
  if (u?.interview_at) return { status: "interview", tone: "good" };
  if (u?.offline_sent_at) return { status: "offline", tone: "good" };
  if (u?.online_submitted_at) return { status: "online", tone: "good" };
  return { status: "chosen", tone: "neutral" };
}

/** ai_student_card result → card, or null when the card is an error. */
export function studentEntity(id: string, card: any): StudentEntity | null {
  if (!card || typeof card !== "object" || card.error || !card.student) return null;
  const active = (card.seasons ?? []).find((s: any) => s?.contract_status === "faol") ?? card.seasons?.[0];
  return {
    kind: "student",
    id,
    name: shortName(card.student.full_name),
    initials: initials(card.student.full_name),
    season: seasonCode(active?.season),
    docsApproved: card.document_pack?.approved ?? null,
    docsRequired: card.document_pack?.required ?? null,
    universities: (card.universities ?? []).map((u: any) => ({ name: shortUniversity(u.university), ...universityStatus(u) })),
  };
}
