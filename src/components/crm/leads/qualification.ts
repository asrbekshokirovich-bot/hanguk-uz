import type { LeadRecord } from './types';

/**
 * The qualification gate.
 *
 * Five fields have to be on record before a contract can be raised. They are
 * defined here, as a pure function of the lead, because three separate things
 * depend on the same answer: the pane's checklist, the AI planner's notion of
 * an "open gap", and the convert button's block rule.
 */

export type QualificationKey = 'education' | 'intake' | 'plan' | 'topik' | 'korean';

export const QUALIFICATION_ORDER: QualificationKey[] = [
  'education',
  'intake',
  'plan',
  'topik',
  'korean',
];

export interface QualificationField {
  key: QualificationKey;
  /** Raw stored value, or null when the field is still an open gap. */
  value: string | null;
}

/**
 * Read the five fields off the record.
 *
 * Intake and plan each have a fallback column: the app writes the intake to
 * either `target_intake` or `preferred_start_date` depending on which form
 * captured it, and budget to either `budget_range` or `payment_plan`.
 * `undecided` is stored like a value but is not one — it is an unanswered
 * question, so it counts as a gap.
 */
export function qualificationFields(lead: LeadRecord): QualificationField[] {
  const intake = lead.target_intake ?? lead.preferred_start_date;
  const plan = lead.budget_range ?? lead.payment_plan;
  const values: Record<QualificationKey, string | null> = {
    education: lead.education_level || null,
    intake: intake && intake !== 'undecided' ? intake : null,
    plan: plan || null,
    topik: lead.exam_type || null,
    korean: lead.korean_level || null,
  };
  return QUALIFICATION_ORDER.map((key) => ({ key, value: values[key] }));
}

/** The keys still missing, in render order. */
export function missingQualification(lead: LeadRecord): QualificationKey[] {
  return qualificationFields(lead)
    .filter((field) => field.value === null)
    .map((field) => field.key);
}

/**
 * Convert is blocked while more than one field is missing. One gap is
 * recoverable during the signing call; two or more means the plan cannot even
 * be quoted, so the contract would be guesswork.
 */
export const MAX_MISSING_TO_CONVERT = 1;

export function canConvert(lead: LeadRecord): boolean {
  return missingQualification(lead).length <= MAX_MISSING_TO_CONVERT;
}
