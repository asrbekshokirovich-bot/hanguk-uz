import { describe, it, expect } from 'vitest';
import { trackStats } from '../uni-db-review/ReviewSectionBodies';

/**
 * A requirement chip has to answer "how much", not "yes".
 *
 * Measured on production: of 69 rows where English is required, 55 carry a
 * usable number, 5 carry only Korean prose (a university's own English paper,
 * or an explicit "no minimum is stated"), and 9 carry nothing. TOPIK is
 * required on 139 rows, 7 with no level. All 16 of those rendered as a bare
 * "Ha" — which reads as the extractor having failed, when usually the
 * guideline simply never states a threshold.
 */

// Stand-in for i18next: returns the key so assertions name what was chosen,
// and interpolates the two templated strings the chips use.
const t = ((key: string, opts?: Record<string, unknown>) => {
  if (key === 'uniReview.req.topikLevel') return `TOPIK ${opts?.n}+`;
  if (key === 'uniReview.req.gpaMin') return `GPA ${opts?.p}%`;
  return key;
}) as never;

const stat = (rows: ReturnType<typeof trackStats>, key: string) =>
  rows.find((s) => s.k === key)!;

describe('requirement chips', () => {
  it('shows the TOPIK level when the guideline states one', () => {
    const s = stat(trackStats(t, { topik_status: 'required', topik_min_level: 3 }), 'uniReview.req.topik');
    expect(s.v).toBe('TOPIK 3+');
    expect(s.note).toBeFalsy();
  });

  it('says the threshold is unstated instead of a bare yes', () => {
    // The reported case: required, no level. "Ha" alone sent the reviewer
    // hunting for an extraction bug that was not there.
    const s = stat(trackStats(t, { topik_status: 'required', topik_min_level: null }), 'uniReview.req.topik');
    expect(s.v).toBe('uniReview.req.yes');
    expect(s.note).toBe('uniReview.req.noThreshold');
  });

  it('never adds the unstated note when the answer is a real number', () => {
    const s = stat(
      trackStats(t, { english_status: 'required', english_test: { test: 'ielts', min_score: 5.5 } }),
      'uniReview.req.english',
    );
    expect(s.v).toBe('IELTS 5.5+');
    expect(s.note).toBeFalsy();
  });

  it('surfaces the university\'s own exam rather than calling it IELTS', () => {
    // 세종대학교: the requirement is an in-house English paper. Rendering
    // "IELTS: Ha" does not merely lose detail, it names the wrong exam.
    const own = '세종대학교 자체 영어 필답고사 (총점 200점, 객관식 60문항 내외).';
    const s = stat(
      trackStats(t, { english_status: 'required', english_test: { test: 'other', other_ko: own } }),
      'uniReview.req.english',
    );
    expect(s.v).toBe('uniReview.req.otherTest');
    expect(s.v).not.toBe('uniReview.req.yes');
    expect(s.note).toBe(own);
  });

  it('keeps the guideline\'s own words when it says no minimum exists', () => {
    // 울산과학기술원: a certificate is required but no minimum is published.
    // That sentence IS the answer, and it was being discarded.
    const ko = 'TOEFL, IELTS, TEPS, TOEIC 중 공인 영어성적표 제출 필수. 최저 점수 기준은 본문에 명시되지 않음.';
    const s = stat(
      trackStats(t, { english_status: 'required', english_test: { test: 'other', other_ko: ko } }),
      'uniReview.req.english',
    );
    expect(s.note).toBe(ko);
  });

  it('prefers a number over prose when the guideline gives both', () => {
    const s = stat(
      trackStats(t, {
        english_status: 'required',
        english_test: { ielts: 5.5, other_ko: 'TOEIC 650 이상도 인정' },
      }),
      'uniReview.req.english',
    );
    expect(s.v).toBe('IELTS 5.5+');
    expect(s.note).toBe('TOEIC 650 이상도 인정');
  });

  it('adds no note when the requirement does not apply', () => {
    // "Not required" is already a complete answer; annotating it would imply
    // something is missing.
    const s = stat(trackStats(t, { topik_status: 'not_required' }), 'uniReview.req.topik');
    expect(s.note).toBeFalsy();
  });

  it('adds no note when the field was never stated at all', () => {
    const s = stat(trackStats(t, { gpa_status: 'not_stated' }), 'uniReview.req.gpa');
    expect(s.v).toBeNull();
    expect(s.note).toBeFalsy();
  });
});
