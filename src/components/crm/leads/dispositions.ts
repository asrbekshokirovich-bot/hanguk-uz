import type { Disposition, LeadRecord, LeadStage } from './types';
import type { PlanOutcome } from './aiPlanner';

/**
 * What logging a call does to a lead.
 *
 * Pure and table-driven, so the state machine can be read in one place and
 * tested without a database: which stage the lead lands in, whether the
 * attempt counter moves, which `lead_notes` outcome is written, and whether
 * the lead leaves the worklist entirely.
 */

/** The four buttons an operator sees, in render order. */
export const DISPOSITIONS: Disposition[] = ['reached', 'no_answer', 'callback', 'wrong_number'];

export interface DispositionEffect {
  /** The operator stage after the call. Null when the lead leaves the list. */
  stage: LeadStage | null;
  /** `leads.status` to write. */
  status: LeadRecord['status'];
  /** Whether this counts as an attempt against the number. */
  countsAsAttempt: boolean;
  /**
   * `lead_notes.contact_type` for the history row. This is what the attempt
   * counter is derived from, so it has to agree with `countsAsAttempt`:
   * only a `call` touch is an attempt against the number.
   */
  touchType: 'call' | 'meeting';
  /** `lead_notes.outcome` for the history row. */
  outcome: string;
  /** The planner outcome this disposition triggers, if any. */
  plan: PlanOutcome | null;
  /** True when the lead drops out of the worklist. */
  removes: boolean;
}

/**
 * The transition table.
 *
 * Every disposition lands in the same place regardless of the stage it came
 * from — a no-answer is a no-answer whether the lead was new or booked — so
 * the table is keyed by disposition alone. `booked` is not a disposition; it
 * is a separate action, below.
 *
 * Wrong number maps to `lost` rather than deleting the row: the number was
 * wrong, but the record is still evidence of an inbound enquiry, and deleting
 * it would let the same bad number be re-imported tomorrow.
 */
const TABLE: Record<Disposition, DispositionEffect> = {
  reached: {
    stage: 'contacted',
    status: 'contacted',
    countsAsAttempt: true,
    touchType: 'call',
    outcome: 'answered',
    plan: 'reached',
    removes: false,
  },
  no_answer: {
    stage: 'attempting',
    status: 'contacted',
    countsAsAttempt: true,
    touchType: 'call',
    outcome: 'no_answer',
    plan: 'no_answer',
    removes: false,
  },
  callback: {
    stage: 'contacted',
    status: 'contacted',
    countsAsAttempt: true,
    touchType: 'call',
    outcome: 'callback_requested',
    plan: 'callback',
    removes: false,
  },
  wrong_number: {
    stage: null,
    status: 'lost',
    countsAsAttempt: true,
    touchType: 'call',
    outcome: 'not_interested',
    plan: null,
    removes: true,
  },
};

export function dispositionEffect(disposition: Disposition): DispositionEffect {
  return TABLE[disposition];
}

/**
 * Booking a consultation. Not a call disposition — it is the outcome of one,
 * so it moves the stage without spending an attempt.
 */
export const BOOK_EFFECT: DispositionEffect = {
  stage: 'booked',
  status: 'qualified',
  countsAsAttempt: false,
  touchType: 'meeting',
  outcome: 'interested',
  plan: 'booked',
  removes: false,
};

/** Attempts after applying a disposition. */
export function nextAttempts(attempts: number, effect: DispositionEffect): number {
  return effect.countsAsAttempt ? attempts + 1 : attempts;
}
