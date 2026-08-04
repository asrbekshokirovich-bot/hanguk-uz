import { describe, expect, it } from 'vitest';
import {
  FINAL_ATTEMPT_THRESHOLD,
  MANUAL_GOALS,
  MANUAL_TIMINGS,
  aiPlan,
  resolveTiming,
  standingPlan,
} from '../aiPlanner';
import type { PlanOutcome } from '../aiPlanner';
import type { LeadRecord } from '../types';

const NOW = new Date('2026-08-04T09:00:00Z');

/** Fully qualified with a far-off intake — the neutral starting point. */
function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'l1',
    source: 'instagram',
    interest_level: 'medium',
    education_level: 'bachelor',
    target_intake: 'fall_2029',
    budget_range: '10000_20000',
    exam_type: 'topik',
    korean_level: 'Intermediate',
    preferred_start_date: null,
    payment_plan: null,
    referred_by_student_id: null,
    ...overrides,
  } as LeadRecord;
}

function plan(outcome: PlanOutcome, attempts = 0, overrides: Partial<LeadRecord> = {}) {
  return aiPlan({ lead: lead(overrides), attempts, outcome, now: NOW });
}

describe('the decision table', () => {
  it('retries at a different time of day on the first two misses', () => {
    for (const attempts of [0, 1]) {
      const result = plan('no_answer', attempts);
      expect(result.goal).toBe('retryDifferentTime');
      expect(result.dueInMinutes).toBe(240);
    }
  });

  it('switches to the source channel on the third miss', () => {
    const result = plan('no_answer', 2);
    expect(result.goal).toBe('messageOnSource');
    expect(result.dueInMinutes).toBe(1200);
    expect(result.reasonVars.source).toBe('instagram');
  });

  it('makes a final attempt at four or more', () => {
    const result = plan('no_answer', 3);
    expect(result.goal).toBe('finalAttempt');
    expect(result.dueInMinutes).toBe(2880);
    expect(result.reasonVars.n).toBe(FINAL_ATTEMPT_THRESHOLD);
    expect(plan('no_answer', 9).goal).toBe('finalAttempt');
  });

  it('honours a requested callback', () => {
    const result = plan('callback');
    expect(result.goal).toBe('callbackAgreed');
    expect(result.dueInMinutes).toBe(1200);
  });

  it('confirms attendance same-day once a consultation is booked', () => {
    const result = plan('booked');
    expect(result.goal).toBe('confirmAttendance');
    expect(result.dueInMinutes).toBe(1080);
  });

  it('qualifies when two or more fields are open', () => {
    const result = plan('reached', 1, { budget_range: null, korean_level: null });
    expect(result.goal).toBe('qualifyBudgetIntake');
    expect(result.dueInMinutes).toBe(1200);
    expect(result.reasonVars.n).toBe(2);
  });

  it('qualifies with a different reason when exactly one is open', () => {
    const result = plan('reached', 1, { korean_level: null });
    expect(result.goal).toBe('qualifyBudgetIntake');
    expect(result.reasonKey).toBe('leads.nextCall.why.gapsOne');
  });

  it('closes when qualified and the intake is imminent', () => {
    const result = plan('reached', 1, { target_intake: 'fall_2026' });
    expect(result.goal).toBe('closeContract');
    expect(result.dueInMinutes).toBe(240);
    expect(result.reasonVars.intake).toBe('fall_2026');
  });

  it('sends materials when qualified but the intake is far out', () => {
    const result = plan('reached', 1);
    expect(result.goal).toBe('sendPlanComparison');
    expect(result.dueInMinutes).toBe(300);
  });

  it('lets an outcome outrank the standing state', () => {
    // Gaps are open, but a no-answer is what just happened.
    expect(plan('no_answer', 0, { budget_range: null, korean_level: null }).goal).toBe(
      'retryDifferentTime',
    );
  });
});

describe('purity', () => {
  it('returns the same plan for the same inputs', () => {
    expect(plan('reached', 2)).toEqual(plan('reached', 2));
  });

  it('derives dueAt from the injected clock, not the real one', () => {
    const result = plan('callback');
    expect(result.dueAt).toBe(new Date(NOW.getTime() + 1200 * 60_000).toISOString());
  });

  it('always names a reason key under the nextCall namespace', () => {
    const outcomes: PlanOutcome[] = ['reached', 'no_answer', 'callback', 'booked'];
    for (const outcome of outcomes) {
      expect(plan(outcome, 1).reasonKey).toMatch(/^leads\.nextCall\.why\./);
    }
  });
});

describe('standing plan', () => {
  it('maps the stage onto the outcome the planner reacts to', () => {
    expect(standingPlan(lead(), 1, 'attempting', NOW).goal).toBe('retryDifferentTime');
    expect(standingPlan(lead(), 1, 'booked', NOW).goal).toBe('confirmAttendance');
    expect(standingPlan(lead(), 1, 'contacted', NOW).goal).toBe('sendPlanComparison');
    expect(standingPlan(lead(), 1, 'new', NOW).goal).toBe('sendPlanComparison');
  });
});

describe('manual presets', () => {
  it('offers seven goals and four timings', () => {
    expect(MANUAL_GOALS).toHaveLength(7);
    expect(MANUAL_TIMINGS).toHaveLength(4);
  });

  it('resolves relative timings off the injected clock', () => {
    expect(resolveTiming('in1h', NOW)).toBe('2026-08-04T10:00:00.000Z');
    expect(resolveTiming('in3days', NOW)).toBe('2026-08-07T09:00:00.000Z');
  });

  it('never schedules a wall-clock chip into the past', () => {
    const evening = new Date('2026-08-04T20:00:00Z');
    expect(new Date(resolveTiming('today17', evening)).getTime()).toBeGreaterThan(evening.getTime());
    expect(new Date(resolveTiming('tomorrow10', NOW)).getTime()).toBeGreaterThan(NOW.getTime());
  });
});
