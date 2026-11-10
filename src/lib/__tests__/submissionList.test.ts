import { describe, expect, it } from 'vitest';
import { buildSubmissionRows, submissionCsv } from '../submissionList';
import type { UniversityChoice } from '@/hooks/useUniversityChoices';

const ch = (student_id: string, rank: number, faculty: string | null, status: UniversityChoice['status'] = 'confirmed') =>
  ({ id: `${student_id}-${rank}`, student_id, institution_id: `i${rank}`, rank, status, faculty_name: faculty, faculty_college: faculty ? 'College' : null } as UniversityChoice);

describe("Topshirish ro'yxati (2026-11-10)", () => {
  const students = [
    { user_id: 'b', full_name: 'BEKOV' },
    { user_id: 'a', full_name: 'ALIYEV' },
    { user_id: 'x', full_name: 'BEKOR', contractCancelled: true },
  ];
  const by = new Map([
    ['a', [ch('a', 1, 'Business'), ch('a', 2, null, 'accepted')]],
    ['b', [ch('b', 1, null, 'offered')]],
    ['x', [ch('x', 1, 'Law')]],
  ]);
  const rows = buildSubmissionRows(students, by, (id) => `Uni ${id}`);

  it('lists active students by name with their faculty; cancelled contracts left out', () => {
    expect(rows.map((r) => `${r.student}/${r.rank}/${r.faculty ?? '-'}/${r.status}`)).toEqual([
      'ALIYEV/1/Business/Biriktirildi',
      'ALIYEV/2/-/Talaba rozi',
      'BEKOV/1/-/Taklif qilingan',
    ]);
  });

  it('exports a semicolon CSV with a BOM', () => {
    const csv = submissionCsv(rows);
    expect(csv.startsWith('﻿Talaba;№;Universitet;Fakultet;Kollej;Holat')).toBe(true);
    expect(csv).toContain('ALIYEV;1;Uni i1;Business;College;Biriktirildi');
  });
});
