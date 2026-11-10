/**
 * "Topshirish ro'yxati": every active student's chosen universities with the
 * faculty staff entered (Asrbek, 2026-11-10).
 */
import type { UniversityChoice } from '@/hooks/useUniversityChoices';

export const CHOICE_STATUS_LABEL: Record<string, string> = {
  offered: 'Taklif qilingan',
  accepted: 'Talaba rozi',
  change_requested: "O'zgartirish so'ragan",
  confirmed: 'Biriktirildi',
};

export interface SubmissionRow {
  studentId: string;
  student: string;
  rank: number;
  university: string;
  faculty: string | null;
  college: string | null;
  status: string;
}

export function buildSubmissionRows(
  students: { user_id: string; full_name: string | null; contractCancelled?: boolean }[],
  byStudent: Map<string, UniversityChoice[]>,
  universityName: (institutionId: string) => string,
): SubmissionRow[] {
  const rows: SubmissionRow[] = [];
  const sorted = [...students]
    .filter((s) => !s.contractCancelled)
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
  for (const s of sorted) {
    for (const c of byStudent.get(s.user_id) ?? []) {
      rows.push({
        studentId: s.user_id,
        student: s.full_name ?? '—',
        rank: c.rank,
        university: universityName(c.institution_id),
        faculty: c.faculty_name,
        college: c.faculty_college,
        status: CHOICE_STATUS_LABEL[c.status] ?? c.status,
      });
    }
  }
  return rows;
}

const cell = (v: string | number | null) => {
  const t = v == null ? '' : String(v);
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Semicolon CSV with a BOM — opens in Excel with Uzbek/Korean letters intact. */
export function submissionCsv(rows: SubmissionRow[]): string {
  const head = ['Talaba', '№', 'Universitet', 'Fakultet', 'Kollej', 'Holat'];
  const body = rows.map((r) => [r.student, r.rank, r.university, r.faculty, r.college, r.status].map(cell).join(';'));
  return '﻿' + [head.join(';'), ...body].join('\n');
}
