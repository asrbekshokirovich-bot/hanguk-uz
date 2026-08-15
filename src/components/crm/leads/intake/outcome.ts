import type { Lead } from '@/contexts/LeadsContext';
import { isLeadComplete } from './intakeForm';

/**
 * How a lead leaves the intake list.
 *
 * A record is worked on until one of two things is true: the person became a
 * student, or they are not going to. Everything else is "active" — still ours
 * to finish. Kept free of React and i18n so the list, the badges and the row
 * actions all read the same rule.
 */
export type LeadOutcome = 'active' | 'converted' | 'rejected';

export const leadOutcome = (lead: Lead): LeadOutcome => {
  if (lead.status === 'converted' || lead.converted_to_student_id) return 'converted';
  if (lead.status === 'lost') return 'rejected';
  return 'active';
};

/**
 * Whether the lead can be turned into a student right now.
 *
 * Conversion opens a student account off this record, so the record has to
 * carry every answer the intake form asks for — a half-filled lead would
 * become a half-filled student, and nothing downstream would flag it.
 */
export const canConvertLead = (lead: Lead): boolean =>
  leadOutcome(lead) === 'active' && isLeadComplete(lead);

/** Why a lead is not worth working any further. Stored verbatim, as in `options`. */
export const REJECT_REASONS = [
  'Qiziqmaydi',
  "Bog'lanib bo'lmadi",
  'Byudjeti yetmaydi',
  'Boshqa markazni tanladi',
  'Hujjatlari mos emas',
  'Dublikat yozuv',
  'Boshqa sabab',
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

/** The prefix that marks the rejection line inside a lead's free-text note. */
const REJECT_PREFIX = 'Rad etildi:';

/**
 * Records the rejection in the lead's note.
 *
 * Appended to whatever the operator already wrote rather than replacing it:
 * the reason a lead was dropped is only ever useful next to the history that
 * led there. A previous rejection line is dropped first so re-rejecting a
 * restored lead does not stack duplicates.
 */
export const noteWithRejection = (
  existingNote: string | null,
  reason: string,
  detail: string,
): string => {
  const kept = (existingNote ?? '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith(REJECT_PREFIX))
    .join('\n')
    .trim();
  const line = [`${REJECT_PREFIX} ${reason}`.trim(), detail.trim()].filter(Boolean).join(' — ');
  return [kept, line].filter(Boolean).join('\n');
};

/** Strips the rejection line again when a lead is put back into the list. */
export const noteWithoutRejection = (existingNote: string | null): string =>
  (existingNote ?? '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith(REJECT_PREFIX))
    .join('\n')
    .trim();
