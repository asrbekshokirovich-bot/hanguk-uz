/**
 * Investor pipeline rules shared by Overview and Applications.
 *
 * Each row of v_investor_applications is one (student, university) step, the
 * same facts as the Arizalar board (migration 20261030210000):
 *   chosen -> online -> offline -> interview -> accepted | rejected ->
 *   final -> visa_process -> visa_waiting -> visa_received
 */

/** Sent to the university (online or on paper) or further. */
export const SUBMITTED_STATUSES = new Set([
  'online',
  'offline',
  'interview',
  'accepted',
  'rejected',
  'final',
  'visa_process',
  'visa_waiting',
  'visa_received',
]);

/** Nothing left to move: the visa is in hand, or the university said no. */
export const FINAL_STATUSES = new Set(['visa_received', 'rejected']);

export const STUCK_DAYS = 14;

export interface PipelineApplication {
  student_id?: string | null;
  status: string;
  days_since_movement: number | null;
}

export function isSubmitted(status: string | null | undefined): boolean {
  return !!status && SUBMITTED_STATUSES.has(status);
}

/** Open applications untouched for STUCK_DAYS or more, oldest first. */
export function stuckApplications<T extends PipelineApplication>(rows: T[], days = STUCK_DAYS): T[] {
  return rows
    .filter((a) => !FINAL_STATUSES.has(a.status) && (a.days_since_movement ?? 0) >= days)
    .sort((a, b) => (b.days_since_movement ?? 0) - (a.days_since_movement ?? 0));
}

/** Students who have applications but none has reached a university yet. */
export function studentsNotSubmitted(rows: PipelineApplication[]): number {
  const byStudent = new Map<string, boolean>();
  for (const a of rows) {
    if (!a.student_id) continue;
    byStudent.set(a.student_id, (byStudent.get(a.student_id) ?? false) || isSubmitted(a.status));
  }
  let n = 0;
  for (const sent of byStudent.values()) if (!sent) n += 1;
  return n;
}

/** Signed students with no application at all this season. */
export function studentsWithoutApplication(signed: number | null, rows: PipelineApplication[]): number {
  if (signed == null) return 0;
  const withApp = new Set(rows.map((a) => a.student_id).filter((id): id is string => !!id));
  return Math.max(signed - withApp.size, 0);
}

const ADMITTED = new Set(['accepted', 'final', 'visa_process', 'visa_waiting', 'visa_received']);
const VISA_TRACK = new Set(['final', 'visa_process', 'visa_waiting', 'visa_received']);

/** Accepted among applications with a university answer; null until one is recorded. */
export function acceptanceRate(rows: { status: string }[]): number | null {
  const decided = rows.filter((r) => ADMITTED.has(r.status) || r.status === 'rejected');
  if (decided.length === 0) return null;
  return (decided.filter((r) => ADMITTED.has(r.status)).length * 100) / decided.length;
}

/** Visas received among final universities; null until a final university is chosen. */
export function visaRate(rows: { status: string }[]): number | null {
  const finals = rows.filter((r) => VISA_TRACK.has(r.status));
  if (finals.length === 0) return null;
  return (finals.filter((r) => r.status === 'visa_received').length * 100) / finals.length;
}
