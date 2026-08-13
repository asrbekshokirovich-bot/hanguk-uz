import { describe, it, expect } from 'vitest';
import { tuitionKey, semesterLabel } from '../uni-db-review/ReviewSectionBodies';

/**
 * Korean universities charge more in the semester carrying 입학금, so one
 * faculty legitimately appears twice at two prices. The review table showed
 * neither the semester nor the faculty name, so those pairs read as a
 * duplicated faculty with an unexplained price difference — reported twice as
 * "the same faculty repeats 3-4 times".
 *
 * Real production pairs this covers (HUFS 2027):
 *   인문대학 … 첫 학기          4,496,000  semester_number 1
 *   인문대학 … 두 번째 학기 이후  4,298,000  semester_number 2
 */

const t = ((key: string, opts?: { n?: number }) => {
  if (key === 'uniReview.tui.sem.first') return '1-semestr';
  if (key === 'uniReview.tui.sem.fromSecond') return "2-semestrdan keyin";
  if (key === 'uniReview.tui.sem.nth') return `${opts?.n}-semestr`;
  return key;
}) as never;

describe('semesterLabel', () => {
  it('labels semester 1 and semester 2 distinctly', () => {
    expect(semesterLabel({ semester_number: 1 }, t)).toBe('1-semestr');
    expect(semesterLabel({ semester_number: 2 }, t)).toBe("2-semestrdan keyin");
  });

  it('reads the number even when the extractor emitted it as a string', () => {
    expect(semesterLabel({ semester_number: '2' }, t)).toBe("2-semestrdan keyin");
  });

  it('ignores is_first_semester, which means "includes 입학금"', () => {
    // 83 production rows carry semester_number=1 with the flag false. The flag
    // marks the admission-fee row, not the first semester, so labelling from it
    // would mislabel every one of them.
    expect(semesterLabel({ semester_number: 1, is_first_semester: false }, t)).toBe('1-semestr');
  });

  it('says nothing rather than guessing when the semester is absent', () => {
    expect(semesterLabel({}, t)).toBeNull();
    expect(semesterLabel({ semester_number: null }, t)).toBeNull();
  });

  it('falls back to a numbered label beyond the usual two', () => {
    expect(semesterLabel({ semester_number: 3 }, t)).toBe('3-semestr');
  });
});

describe('tuitionKey', () => {
  it('prefers the printed faculty over the bucket', () => {
    expect(tuitionKey({ faculty_ko: '공학·예능', faculty_group: 'arts_pe' })).toBe('공학·예능');
  });

  it('prefers the Uzbek rendering when present', () => {
    expect(tuitionKey({ faculty_uz: 'Muhandislik', faculty_ko: '공과대학' })).toBe('Muhandislik');
  });

  it('falls back to the bucket for rows that predate faculty_ko', () => {
    expect(tuitionKey({ faculty_group: 'humanities' })).toBe('humanities');
  });

  it('groups a faculty\'s two semesters under one key', () => {
    const first = { faculty_ko: '인문대학', semester_number: 1 };
    const later = { faculty_ko: '인문대학', semester_number: 2 };
    expect(tuitionKey(first)).toBe(tuitionKey(later));
  });

  it('keeps two different faculties apart even in the same bucket', () => {
    // Both bucket as interdisciplinary; only the name separates them, which is
    // why four "interdisciplinary" rows looked like one faculty repeated.
    const a = { faculty_ko: '융합인재대학', faculty_group: 'interdisciplinary' };
    const b = { faculty_ko: 'Cultural & Technology 융합대학', faculty_group: 'interdisciplinary' };
    expect(tuitionKey(a)).not.toBe(tuitionKey(b));
  });
});
