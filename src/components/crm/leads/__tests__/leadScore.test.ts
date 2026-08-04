import { describe, expect, it } from 'vitest';
import {
  FACTOR_ORDER,
  HOT_THRESHOLD,
  SCORE_WEIGHTS,
  WARM_THRESHOLD,
  factorStrength,
  leadScore,
  scoreFactors,
  tierFor,
} from '../leadScore';
import type { LeadRecord } from '../types';

const NOW = new Date('2026-08-04T09:00:00Z');

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'l1',
    full_name: 'Test Lead',
    phone: null,
    email: null,
    source: 'manual',
    source_id: null,
    status: 'new',
    interest_level: 'medium',
    notes: null,
    ai_summary: null,
    assigned_to: null,
    referred_by_student_id: null,
    converted_to_student_id: null,
    created_by: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    preferred_university: null,
    preferred_program: null,
    budget_range: null,
    city: null,
    birth_date: null,
    education_level: null,
    english_level: null,
    korean_level: null,
    preferred_start_date: null,
    how_heard: null,
    priority_score: null,
    next_follow_up: null,
    last_contacted_at: null,
    contract_number: null,
    contract_date: null,
    payment_plan: null,
    ...overrides,
  } as LeadRecord;
}

describe('score weights', () => {
  it('sums to 1 across the five factors', () => {
    const total = FACTOR_ORDER.reduce((sum, key) => sum + SCORE_WEIGHTS[key], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('applies the documented weighting', () => {
    const score = leadScore({ intent: 100, budget: 0, education: 0, language: 0, timing: 0 });
    expect(score).toBe(30);
    expect(leadScore({ intent: 100, budget: 100, education: 100, language: 100, timing: 100 })).toBe(100);
    expect(leadScore({ intent: 0, budget: 0, education: 0, language: 0, timing: 0 })).toBe(0);
  });
});

describe('tiers', () => {
  it('cuts at the documented thresholds', () => {
    expect(tierFor(HOT_THRESHOLD)).toBe('hot');
    expect(tierFor(HOT_THRESHOLD - 1)).toBe('warm');
    expect(tierFor(WARM_THRESHOLD)).toBe('warm');
    expect(tierFor(WARM_THRESHOLD - 1)).toBe('cold');
  });

  it('honours a custom hot threshold', () => {
    expect(tierFor(70, 65)).toBe('hot');
    expect(tierFor(70)).toBe('warm');
  });
});

describe('factor derivation', () => {
  it('scores an unknown field as zero so the gap stays visible', () => {
    const factors = scoreFactors(lead(), NOW);
    expect(factors.budget).toBe(0);
    expect(factors.education).toBe(0);
    expect(factors.language).toBe(0);
    expect(factors.timing).toBe(0);
    expect(factorStrength(factors.budget)).toBe('weak');
  });

  it('reads intent off interest level and adds a referral bump', () => {
    expect(scoreFactors(lead({ interest_level: 'high' }), NOW).intent).toBe(88);
    expect(scoreFactors(lead({ interest_level: 'low' }), NOW).intent).toBe(28);
    expect(
      scoreFactors(lead({ interest_level: 'high', referred_by_student_id: 's1' }), NOW).intent,
    ).toBe(96);
  });

  it('falls back to the payment plan when no budget range is set', () => {
    expect(scoreFactors(lead({ payment_plan: 'standard' }), NOW).budget).toBe(74);
    expect(scoreFactors(lead({ budget_range: '20000_plus' }), NOW).budget).toBe(95);
  });

  it('parses free-text Korean levels and credits a booked exam', () => {
    expect(scoreFactors(lead({ korean_level: 'Beginner' }), NOW).language).toBe(42);
    expect(scoreFactors(lead({ korean_level: 'TOPIK 4' }), NOW).language).toBe(72);
    expect(scoreFactors(lead({ korean_level: 'Advanced', exam_type: 'topik' }), NOW).language).toBe(100);
  });

  it('scores intake timing by how soon the intake is', () => {
    expect(scoreFactors(lead({ target_intake: 'fall_2026' }), NOW).timing).toBe(95);
    expect(scoreFactors(lead({ target_intake: 'spring_2027' }), NOW).timing).toBe(78);
    expect(scoreFactors(lead({ target_intake: 'undecided' }), NOW).timing).toBe(0);
    expect(scoreFactors(lead({ preferred_start_date: 'fall_2028' }), NOW).timing).toBe(52);
  });

  it('is a pure function of the record and the injected clock', () => {
    const record = lead({ interest_level: 'high', budget_range: '10000_20000' });
    expect(scoreFactors(record, NOW)).toEqual(scoreFactors(record, NOW));
  });
});

describe('factor strength bands', () => {
  it('splits at 75 and 50', () => {
    expect(factorStrength(75)).toBe('strong');
    expect(factorStrength(74)).toBe('partial');
    expect(factorStrength(50)).toBe('partial');
    expect(factorStrength(49)).toBe('weak');
  });
});
