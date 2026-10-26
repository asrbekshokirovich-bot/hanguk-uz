/**
 * Investor pipeline rules shared by Overview and Applications.
 *
 * CRM application statuses, in order: documents_collection ->
 * documents_translation -> apostille -> application_submitted ->
 * university_response -> visa_documents -> completed ("Visa Applied").
 * Mirrors v_investor_season_funnel (migration 20261026180000).
 */

export const SUBMITTED_STATUSES = new Set([
  'application_submitted',
  'university_response',
  'visa_documents',
  'completed',
]);

/** "completed" is the last CRM step (visa applied): nothing left to move. */
export const FINAL_STATUSES = new Set(['completed']);

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
