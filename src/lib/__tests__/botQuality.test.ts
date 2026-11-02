import { describe, expect, it } from 'vitest';
import { confidencePct, readyForOn, verdictOf, type QualityStats } from '../botQuality';

const stats = (p: Partial<QualityStats>): QualityStats => ({
  days: 7, messages: 0, proposals: 0, shadow: 0, on: 0, judged: 0, correct: 0, wrong: 0, unjudged: 0, precision: null, ...p,
});

describe('botQuality', () => {
  it('verdictOf: owner bahosi ustun, keyin xodim tanlovi', () => {
    expect(verdictOf({ review: 'wrong', status: 'accepted' })).toBe('wrong');
    expect(verdictOf({ review: null, status: 'accepted' })).toBe('correct');
    expect(verdictOf({ review: null, status: 'rejected' })).toBe('wrong');
    expect(verdictOf({ review: null, status: 'shadow' })).toBe(null);
    expect(verdictOf({ review: null, status: 'expired' })).toBe(null);
  });

  it('readyForOn: 20+ baholangan va >= 90%', () => {
    expect(readyForOn(null)).toBe(false);
    expect(readyForOn(stats({ judged: 10, precision: 100 }))).toBe(false);
    expect(readyForOn(stats({ judged: 25, precision: 88 }))).toBe(false);
    expect(readyForOn(stats({ judged: 25, precision: 92 }))).toBe(true);
  });

  it('confidencePct', () => {
    expect(confidencePct(0.876)).toBe('88%');
    expect(confidencePct(null)).toBe('');
  });
});
