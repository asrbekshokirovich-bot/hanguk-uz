/**
 * Loads `buildStudentPipeline` for students outside useCRMData (Messages rail
 * and queue, Reports). Same sources as the Arizalar board — never the legacy
 * `applications` table.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { buildStudentPipeline, type StudentPipeline, type SubmissionFacts } from '@/lib/studentPipeline';

interface Result { data: unknown; error: { message: string } | null }
interface UntypedQuery extends PromiseLike<Result> {
  select: (columns: string) => UntypedQuery;
  in: (column: string, values: string[]) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
}
const untyped = supabase as unknown as { from: (table: string) => UntypedQuery };

export const SUBMISSION_COLUMNS =
  'student_id, institution_id, online_submitted_at, offline_sent_at, interview_at, result, result_at, final_at, visa_status';

export async function loadStudentPipelines(studentIds: string[]): Promise<Map<string, StudentPipeline>> {
  const ids = [...new Set(studentIds.filter(Boolean))];
  const out = new Map<string, StudentPipeline>();
  if (ids.length === 0) return out;

  const [membersRes, docsRes, subsRes, choicesRes] = await Promise.all([
    supabase
      .from('student_intakes')
      .select('student_id, docs_ready, created_at')
      .in('student_id', ids)
      .is('contract_cancelled_at', null),
    supabase.from('documents').select('student_id, name, file_path, status, created_at').in('student_id', ids),
    untyped.from('student_university_submissions').select(SUBMISSION_COLUMNS).in('student_id', ids),
    untyped
      .from('student_university_choices')
      .select('student_id, institution_id, rank')
      .in('student_id', ids)
      .eq('status', 'confirmed'),
  ]);

  // The latest active season decides "docs ready".
  const docsReady = new Map<string, boolean>();
  for (const m of [...(membersRes.data ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    docsReady.set(m.student_id, !!m.docs_ready);
  }
  const group = <T extends { student_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.student_id, [...(m.get(r.student_id) ?? []), r]);
    return m;
  };
  const docs = group((docsRes.data ?? []) as Tables<'documents'>[]);
  const subs = group((subsRes.data ?? []) as SubmissionFacts[]);
  const choices = group(
    ((choicesRes.data ?? []) as { student_id: string; institution_id: string; rank: number | null }[]).sort(
      (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
    ),
  );

  for (const id of ids) {
    out.set(
      id,
      buildStudentPipeline({
        docsReady: docsReady.get(id) ?? false,
        documents: docs.get(id) ?? [],
        submissions: subs.get(id) ?? [],
        confirmedChoiceIds: (choices.get(id) ?? []).map((c) => c.institution_id),
      }),
    );
  }
  return out;
}
