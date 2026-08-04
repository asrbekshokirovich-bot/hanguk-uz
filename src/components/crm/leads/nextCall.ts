import { standingPlan } from './aiPlanner';
import type { AiPlan, GoalKey } from './aiPlanner';
import type { LeadRecord, LeadStage, NextCall } from './types';

/**
 * Reconciling the stored next call with what Hanguk AI would choose now.
 *
 * A lead's next call may have been set by the AI after the last logged
 * outcome, or overridden by an operator. Either way the AI keeps an opinion,
 * and the pane shows it: as the "why" note when the AI's plan is the one in
 * force, or as a "suggests instead" card with a one-click revert when it is not.
 */

/** The literal stored in `next_call_set_by` when the AI assigned the call. */
export const AI_SETTER = 'ai';

export interface ResolvedNextCall {
  /** What is actually on the board. */
  current: NextCall;
  /** What the AI would pick right now, given the record as it stands. */
  suggestion: AiPlan;
  /** True when the AI's plan is the one in force. */
  aiInForce: boolean;
}

/**
 * Build the pane's next-call state.
 *
 * With no stored goal — a fresh lead, or a database that has not had the
 * `next_call_*` migration applied — the AI's standing plan *is* the current
 * plan. That keeps the screen useful either way; it just is not durable until
 * the columns exist.
 */
export function resolveNextCall(
  lead: LeadRecord,
  attempts: number,
  stage: LeadStage,
  now: Date,
  operatorName: string,
): ResolvedNextCall {
  const suggestion = standingPlan(lead, attempts, stage, now);
  const storedGoal = lead.next_call_goal ?? null;
  const storedSetter = lead.next_call_set_by ?? null;

  if (!storedGoal) {
    return {
      current: {
        goal: suggestion.goal,
        dueAt: lead.next_follow_up,
        setBy: { kind: 'ai' },
        reason: '',
      },
      suggestion,
      aiInForce: true,
    };
  }

  const aiInForce = storedSetter === AI_SETTER || storedSetter === null;
  return {
    current: {
      goal: storedGoal,
      dueAt: lead.next_follow_up,
      setBy: aiInForce ? { kind: 'ai' } : { kind: 'operator', name: operatorName },
      reason: lead.next_call_reason ?? '',
    },
    suggestion,
    aiInForce,
  };
}

/** True when the stored goal is one of the planner's own keys. */
export function isGoalKey(goal: string): goal is GoalKey {
  return GOAL_KEYS.has(goal);
}

const GOAL_KEYS = new Set<string>([
  'qualifyBudgetIntake',
  'sendPlanComparison',
  'bookConsultation',
  'confirmAttendance',
  'sendDocumentChecklist',
  'closeContract',
  'finalAttempt',
  'retryDifferentTime',
  'messageOnSource',
  'callbackAgreed',
]);
