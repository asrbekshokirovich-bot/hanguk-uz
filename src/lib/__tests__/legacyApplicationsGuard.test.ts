/**
 * Keeps the CRM on ONE source for "where is this student".
 *
 * Asrbek, 2026-10-27: screens showed "Apostil" / a university / 3/6 for a
 * student the Arizalar board had in "Yangi" — they read the legacy
 * `applications` table, which staff stopped using on 2026-10-15. Every screen
 * now reads src/lib/studentPipeline.ts (documents, student_intakes,
 * student_university_choices, student_university_submissions); the student
 * portal and app read the same facts through my_universities()
 * (src/lib/myUniversities.ts).
 *
 * This test fails when new code touches `applications` outside the list
 * below. If you think you need it: you almost certainly want
 * `student.pipeline` (useCRMData) or `loadStudentPipelines()` instead.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '../../..');
const DIRS = ['src', 'supabase/functions', 'hanguk_app/lib'];
const EXT = /\.(ts|tsx|dart)$/;
const LEGACY = /\.from\(\s*['"]applications['"]\s*\)|\bai\.applications\b/;
/** The old per-student copy of those rows (`student.applications[0].status` …). */
const LEGACY_FIELD = /\b(?:student|students|s|selectedStudent|profile)\??\.applications\b/;

/** Each remaining use and why it is not a progress read. */
const ALLOWED: Record<string, string> = {
  'src/hooks/useCRMData.ts': "reads only the student's app requests (pending_approval) and degree_level",
  'src/components/crm/StudentDetail.tsx': 'approve / reject a student request, set degree_level, attach a recommended university',
  'src/components/crm/SuggestUniversityDialog.tsx': 'writes a suggestion row',
  'src/components/crm/DeleteStudentDialog.tsx': "deletes the student's rows",
  'src/hooks/useSystemHealth.ts': 'System map health check of the table itself',
  'src/lib/intakeQuery.ts': 'doc comment example only',
  'src/components/student/SuggestedUniversities.tsx': 'student request insert (pending_approval)',
  'hanguk_app/lib/features/applications/data/applications_repository.dart':
    'student request insert (pending_approval); reads go through my_universities()',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const files = DIRS.flatMap((d) => {
  try {
    return walk(join(ROOT, d));
  } catch {
    return [];
  }
});
const users = files
  .filter((f) => {
    const text = readFileSync(f, 'utf8');
    return LEGACY.test(text) || LEGACY_FIELD.test(text);
  })
  .map((f) => relative(ROOT, f).split('\\').join('/'))
  .filter((f) => !f.startsWith('src/integrations/supabase/'));

describe('legacy applications table', () => {
  it('is only touched by the known, non-progress uses', () => {
    const unexpected = users.filter((f) => !(f in ALLOWED));
    expect(unexpected, 'Read student progress from src/lib/studentPipeline.ts, not applications').toEqual([]);
  });

  it('allow-list has no stale entries', () => {
    const stale = Object.keys(ALLOWED).filter((f) => !users.includes(f));
    expect(stale, 'Remove entries that no longer use applications').toEqual([]);
  });
});

describe('no invented CRM data', () => {
  // Hujjatlar showed "Tayyorlovchi Aziz K. / Konsultant Sitora N. / Muddat M11 13"
  // picked at random from a hard-coded list. Numbers and people come from the
  // database or are not shown.
  it('has no hard-coded staff name pools in CRM pages', () => {
    const crm = files.filter((f) => /src[\\/]components[\\/]crm[\\/]/.test(f));
    const offenders = crm.filter((f) => /\[\s*'[A-Z][a-z]+ [A-Z]\.'\s*,\s*'[A-Z][a-z]+ [A-Z]\.'/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
