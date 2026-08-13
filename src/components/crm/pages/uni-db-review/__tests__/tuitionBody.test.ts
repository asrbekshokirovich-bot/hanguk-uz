// The tuition review card shows the fee a student pays to enrol, once per
// faculty the guideline actually names.
//
// Two things made Hankuk University of Foreign Studies' card unreadable:
// every faculty appeared twice (첫 학기 등록금 and 두 번째 학기 이후 등록금 are
// both extracted), and `faculty_group` is one of eleven fixed buckets, so its
// 융합인재대학 and its Cultural & Technology 융합대학 both rendered as the single
// word "interdisciplinary" — four rows, no way to tell which was which.
import { describe, it, expect } from 'vitest';

import { facultyDetail, isEntrySemester } from '../ReviewSectionBodies';

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
  });

  it('prefers the explicit flag over a contradicting number', () => {
    expect(isEntrySemester({ is_first_semester: true, semester_number: 2 })).toBe(true);
  });
});

describe('facultyDetail', () => {
  it('names the college the bucket collapsed', () => {
    // Both of these are `interdisciplinary`; only this line separates them.
    expect(
      facultyDetail({
        source_text_uz: "Konvergent iste'dodlar kolleji — birinchi semestr o'qish to'lovi 5 339 000 von",
      }),
    ).toBe("Konvergent iste'dodlar kolleji");

    expect(
      facultyDetail({
        source_text_uz:
          'Cultural & Technology konvergentsiya kolleji (Raqamli kontent fakulteti) — birinchi semestr 5 360 000 von',
      }),
    ).toBe('Cultural & Technology konvergentsiya kolleji (Raqamli kontent fakulteti)');
  });

  it('falls back to the Korean quote when there is no translation', () => {
    expect(facultyDetail({ source_text_ko: '인문대학 — 첫 학기 등록금 4,496,000원' })).toBe(
      '인문대학',
    );
  });

  it('uses the whole quote when it carries no dash', () => {
    // After the verbatim-quote fix the citation is a raw substring, so the
    // dash this splits on will usually not be there at all.
    expect(facultyDetail({ source_text_ko: '- 인문계열: 4,800,000원' })).toBe(
      '- 인문계열: 4,800,000원',
    );
  });

  it('truncates rather than letting one row push the money columns around', () => {
    const long = 'A'.repeat(400);
    const out = facultyDetail({ source_text_uz: long });
    expect(out).toHaveLength(120);
    expect(out?.endsWith('…')).toBe(true);
  });

  it('returns null when the row carries no quote', () => {
    expect(facultyDetail({})).toBeNull();
    expect(facultyDetail({ source_text_uz: '   ' })).toBeNull();
  });
});
