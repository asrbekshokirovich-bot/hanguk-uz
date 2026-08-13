// The tuition review card shows the fee a student pays to enrol — once per
// faculty, not twice.
//
// Korean guidelines quote 첫 학기 등록금 and 두 번째 학기 이후 등록금, and the
// extraction emits both. Rendered as-is, Hankuk University of Foreign Studies'
// card put the same faculty on screen twice at two prices: six faculties
// reading as twelve rows, which looks like an extraction bug rather than the
// document's own structure. The later figure is not published either, so
// showing it would offer a reviewer a row their approval does not act on.
import { describe, it, expect } from 'vitest';

import { isEntrySemester } from '../ReviewSectionBodies';

describe('isEntrySemester', () => {
  it('keeps the first-semester row and drops the later one', () => {
    expect(isEntrySemester({ is_first_semester: true })).toBe(true);
    expect(isEntrySemester({ is_first_semester: false })).toBe(false);
  });

  it('falls back to the semester number when the flag is absent', () => {
    // The model omits the flag often enough that the pair would both show.
    expect(isEntrySemester({ semester_number: 1 })).toBe(true);
    expect(isEntrySemester({ semester_number: 2 })).toBe(false);
    expect(isEntrySemester({ semester: '2' })).toBe(false);
  });

  it('keeps a row that states neither', () => {
    // Most guidelines draw no distinction at all; dropping those would hide a
    // real fee behind a split their own document never made.
    expect(isEntrySemester({})).toBe(true);
    expect(isEntrySemester({ semester_number: null })).toBe(true);
    expect(isEntrySemester({ semester: 'ikkinchi' })).toBe(true);
  });

  it('prefers the explicit flag over a contradicting number', () => {
    expect(isEntrySemester({ is_first_semester: true, semester_number: 2 })).toBe(true);
    expect(isEntrySemester({ is_first_semester: false, semester_number: 1 })).toBe(false);
  });
});
