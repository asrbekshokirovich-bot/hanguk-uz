import { describe, expect, it } from 'vitest';
import {
  MAX_MISSING_TO_CONVERT,
  QUALIFICATION_ORDER,
  canConvert,
  missingQualification,
  qualificationFields,
} from '../qualification';
import type { LeadRecord } from '../types';

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    education_level: null,
    target_intake: null,
    preferred_start_date: null,
    budget_range: null,
    payment_plan: null,
    exam_type: null,
    korean_level: null,
    ...overrides,
  } as LeadRecord;
}

describe('qualification fields', () => {
  it('returns the five fields in render order', () => {
    expect(qualificationFields(lead()).map((f) => f.key)).toEqual(QUALIFICATION_ORDER);
    expect(QUALIFICATION_ORDER).toHaveLength(5);
  });

  it('treats every empty field as a gap', () => {
    expect(missingQualification(lead())).toEqual(QUALIFICATION_ORDER);
  });

  it('falls back to the secondary column for intake and plan', () => {
    expect(missingQualification(lead({ preferred_start_date: 'fall_2026' }))).not.toContain('intake');
    expect(missingQualification(lead({ payment_plan: 'standard' }))).not.toContain('plan');
    expect(missingQualification(lead({ target_intake: 'fall_2026' }))).not.toContain('intake');
    expect(missingQualification(lead({ budget_range: '20000_plus' }))).not.toContain('plan');
  });

  it('counts an undecided intake as unanswered, not as a value', () => {
    expect(missingQualification(lead({ target_intake: 'undecided' }))).toContain('intake');
  });
});

describe('convert gate', () => {
  const complete = {
    education_level: 'bachelor',
    target_intake: 'fall_2026',
    budget_range: '20000_plus',
    exam_type: 'topik',
    korean_level: 'Intermediate',
  };

  it('allows conversion at zero or one gap and blocks at two', () => {
    expect(canConvert(lead(complete))).toBe(true);
    expect(canConvert(lead({ ...complete, korean_level: null }))).toBe(true);
    expect(canConvert(lead({ ...complete, korean_level: null, exam_type: null }))).toBe(false);
    expect(canConvert(lead())).toBe(false);
  });

  it('gates on the documented threshold', () => {
    expect(MAX_MISSING_TO_CONVERT).toBe(1);
  });
});
