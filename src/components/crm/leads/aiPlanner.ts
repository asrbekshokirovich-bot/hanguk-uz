import { missingQualification } from './qualification';
import { leadScore, scoreFactors, tierFor } from './leadScore';
import type { LeadRecord } from './types';

/**
 * Hanguk AI's next-call planner.
 *
 * A pure function of the lead's own record — the last call outcome, how many
 * attempts have been made, which channel the lead arrived on, which
 * qualification fields are still open, how soon the intake is, and the score
 * tier. No network, no clock read, no randomness: `now` is injected, so the
 * same lead always produces the same plan and every branch is unit-testable.
 *
 * When this moves behind a real model, this function stays as the fallback and
 * as the specification of what the model is expected to produce.
 */

/** The outcome the planner is reacting to. */
export type PlanOutcome = 'reached' | 'no_answer' | 'callback' | 'booked';

/**
 * Every goal the planner can assign. The first seven are also the manual
 * preset chips; the last three only ever come from the planner, because they
 * are reactions to a specific call outcome rather than standing intentions.
 */
export type GoalKey =
  | 'qualifyBudgetIntake'
  | 'sendPlanComparison'
  | 'bookConsultation'
  | 'confirmAttendance'
  | 'sendDocumentChecklist'
  | 'closeContract'
  | 'finalAttempt'
  | 'retryDifferentTime'
  | 'messageOnSource'
  | 'callbackAgreed';

/** The seven presets an operator can pick from by hand. */
export const MANUAL_GOALS: GoalKey[] = [
  'qualifyBudgetIntake',
  'sendPlanComparison',
  'bookConsultation',
  'confirmAttendance',
  'sendDocumentChecklist',
  'closeContract',
  'finalAttempt',
];

/** Attempts at or above this count trigger the final-attempt branch. */
export const FINAL_ATTEMPT_THRESHOLD = 4;

/** Timing constants, in minutes, so the decision table reads as the spec does. */
const IN_4_HOURS = 240;
const LATER_TODAY = 300;
const SAME_DAY = 1080;
const TOMORROW = 1200;
const IN_2_DAYS = 2880;

export interface PlanInput {
  lead: LeadRecord;
  /** Attempts logged *before* this outcome. */
  attempts: number;
  outcome: PlanOutcome;
  now: Date;
}

export interface AiPlan {
  goal: GoalKey;
  /** Minutes from `now` until the call is due. */
  dueInMinutes: number;
  dueAt: string;
  /** Translation key for the "Why Hanguk AI chose this" sentence. */
  reasonKey: string;
  /** Interpolations for that sentence. */
  reasonVars: Record<string, string | number>;
}

function at(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/** True when the intake is this calendar year or already under way. */
function intakeIsImminent(lead: LeadRecord, now: Date): boolean {
  const raw = lead.target_intake ?? lead.preferred_start_date;
  if (!raw || raw === 'undecided') return false;
  const year = raw.match(/(20\d{2})/);
  return year ? Number(year[1]) <= now.getFullYear() : false;
}

/**
 * The decision table, in priority order. Outcome-driven branches come first
 * because a call that just happened outranks the lead's standing state.
 */
export function aiPlan({ lead, attempts, outcome, now }: PlanInput): AiPlan {
  const plan = (goal: GoalKey, dueInMinutes: number, reasonKey: string, reasonVars: Record<string, string | number> = {}): AiPlan => ({
    goal,
    dueInMinutes,
    dueAt: at(now, dueInMinutes),
    reasonKey: `leads.nextCall.why.${reasonKey}`,
    reasonVars,
  });

  // The tier is part of the AI's stated reasoning — "four unanswered attempts
  // against a cold score" is the sentence that justifies parking the lead.
  const tier = tierFor(leadScore(scoreFactors(lead, now)));
  const gaps = missingQualification(lead);

  if (outcome === 'no_answer') {
    const madeAttempts = attempts + 1;
    if (madeAttempts >= FINAL_ATTEMPT_THRESHOLD) {
      return plan('finalAttempt', IN_2_DAYS, 'finalAttempt', { n: madeAttempts, tier });
    }
    if (madeAttempts === 3) {
      return plan('messageOnSource', TOMORROW, 'messageOnSource', { source: lead.source });
    }
    return plan('retryDifferentTime', IN_4_HOURS, 'retryDifferentTime');
  }

  if (outcome === 'callback') return plan('callbackAgreed', TOMORROW, 'callbackAgreed');
  if (outcome === 'booked') return plan('confirmAttendance', SAME_DAY, 'confirmAttendance');

  // Reached, so the plan now follows what the record is still missing.
  if (gaps.length > 1) {
    return plan('qualifyBudgetIntake', TOMORROW, 'gapsMany', { n: gaps.length });
  }
  if (gaps.length === 1) {
    return plan('qualifyBudgetIntake', TOMORROW, 'gapsOne', { field: gaps[0] });
  }
  if (intakeIsImminent(lead, now)) {
    return plan('closeContract', IN_4_HOURS, 'closeNow', {
      intake: lead.target_intake ?? lead.preferred_start_date ?? '',
      tier,
    });
  }
  return plan('sendPlanComparison', LATER_TODAY, 'keepMomentum');
}

/**
 * The plan for a lead nobody has just called — what the pane shows as the AI's
 * standing suggestion. Derived from the stage rather than a fresh outcome.
 */
export function standingPlan(
  lead: LeadRecord,
  attempts: number,
  stage: 'new' | 'attempting' | 'contacted' | 'booked',
  now: Date,
): AiPlan {
  const outcome: PlanOutcome =
    stage === 'attempting' ? 'no_answer' : stage === 'booked' ? 'booked' : 'reached';
  return aiPlan({ lead, attempts, outcome, now });
}

/** The four manual timing presets. */
export type TimingKey = 'in1h' | 'today17' | 'tomorrow10' | 'in3days';

export const MANUAL_TIMINGS: TimingKey[] = ['in1h', 'today17', 'tomorrow10', 'in3days'];

/**
 * Resolve a timing chip to an absolute instant.
 *
 * "Today 17:00" and "Tomorrow 10:00" are wall-clock times, not offsets, so
 * they are built from the operator's local date. If 17:00 has already passed,
 * the chip rolls to tomorrow rather than scheduling a call into the past.
 */
export function resolveTiming(key: TimingKey, now: Date): string {
  switch (key) {
    case 'in1h':
      return new Date(now.getTime() + 60 * 60_000).toISOString();
    case 'in3days':
      return new Date(now.getTime() + 3 * 24 * 60 * 60_000).toISOString();
    case 'today17': {
      const target = new Date(now);
      target.setHours(17, 0, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      return target.toISOString();
    }
    case 'tomorrow10': {
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(10, 0, 0, 0);
      return target.toISOString();
    }
  }
}
