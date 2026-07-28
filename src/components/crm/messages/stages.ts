/**
 * Pipeline-stage mapping for the Messages section.
 *
 * The repo has two parallel stage vocabularies: the CRM's 5-column board
 * (`ApplicationsContent.STAGE_ORDER`) and the student-facing 7-step tracker
 * (`ProcessTracker`). The context rail in this design shows four steps —
 * Consultation → Documents → Application → Visa & Flight — so this module
 * folds the raw `applications.status` strings onto that shorter ladder. It is
 * read-only: nothing here writes a status back.
 */

/** Index on the 4-step ladder. 4 means every step is complete. */
export type StageIndex = 0 | 1 | 2 | 3 | 4;

export const STAGE_KEYS = [
  'messages.stages.consultation',
  'messages.stages.documents',
  'messages.stages.application',
  'messages.stages.visa',
] as const;

/**
 * Shorter variants for the queue-row stage pill, which has far less room than
 * the rail's progress tracker.
 */
export const STAGE_PILL_KEYS = [
  'messages.stages.consultation',
  'messages.stages.documents',
  'messages.stages.application',
  'messages.stages.visaShort',
] as const;

const DOCUMENTS = new Set([
  'pending',
  'pending_approval',
  'new',
  'draft',
  'documents',
  'documents_collection',
  'documents_translation',
  'apostille',
]);

const APPLICATION = new Set([
  'in_review',
  'review',
  'university_response',
  'application_submitted',
  'submitted',
  'online_ariza',
  'rejected',
  'waitlist',
]);

const VISA = new Set(['visa_documents', 'visa']);

const COMPLETE = new Set(['completed', 'accepted', 'enrolled', 'decision']);

/**
 * Folds a raw `applications.status` onto the 4-step ladder.
 * `null` (no application row yet) means the student is still at consultation.
 */
export function stageIndexFor(status: string | null | undefined): StageIndex {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (COMPLETE.has(s)) return 4;
  if (VISA.has(s)) return 3;
  if (APPLICATION.has(s)) return 2;
  if (DOCUMENTS.has(s)) return 1;
  return 1;
}

/**
 * i18n key for the queue-row stage pill: the step currently in progress, or
 * "Enrolled" once the ladder is complete, or "New Lead" when the thread is not
 * linked to a student at all.
 */
export function stageLabelKey(studentId: string | null, status: string | null | undefined): string {
  if (!studentId) return 'messages.stages.newLead';
  const idx = stageIndexFor(status);
  if (idx === 4) return 'messages.stages.enrolled';
  return STAGE_PILL_KEYS[idx];
}

/** Picks the most advanced status across a student's applications. */
export function mostAdvancedStatus(statuses: string[]): string | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((best, s) => (stageIndexFor(s) > stageIndexFor(best) ? s : best), statuses[0]);
}
