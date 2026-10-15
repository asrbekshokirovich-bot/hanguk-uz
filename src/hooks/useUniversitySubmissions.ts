/**
 * Onlayn / oflayn ariza progress for each (student, chosen university) pair —
 * public.student_university_submissions. Not in the generated types yet, so
 * read untyped like useUniversityChoices.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UniversitySubmission {
  id: string;
  student_id: string;
  institution_id: string;
  online_submitted_at: string | null;
  offline_sent_at: string | null;
  copies: number | null;
  note: string | null;
  /** null while waiting for the university's answer. */
  result: AdmissionResult | null;
  result_at: string | null;
  /** Staff picked this as the student's final university (one per student). */
  final_at: string | null;
  /** The student confirmed the final university in the app. */
  student_confirmed_at: string | null;
}

export type AdmissionResult = 'accepted' | 'rejected';

export type SubmissionPatch = Partial<
  Pick<UniversitySubmission, 'online_submitted_at' | 'offline_sent_at' | 'copies' | 'note' | 'result' | 'final_at'>
>;

interface Result {
  data: unknown;
  error: { message: string } | null;
}
interface UntypedQuery extends PromiseLike<Result> {
  select: (columns?: string) => UntypedQuery;
  upsert: (values: unknown, options?: { onConflict?: string }) => UntypedQuery;
  update: (values: unknown) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  neq: (column: string, value: unknown) => UntypedQuery;
}
const db = supabase as unknown as { from: (table: string) => UntypedQuery };

const KEY = ['university-submissions'] as const;

export const submissionKey = (studentId: string, institutionId: string) => `${studentId}:${institutionId}`;

export function useUniversitySubmissions() {
  const qc = useQueryClient();

  const query = useQuery<UniversitySubmission[], Error>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db
        .from('student_university_submissions')
        .select(
          'id, student_id, institution_id, online_submitted_at, offline_sent_at, copies, note, result, result_at, final_at, student_confirmed_at',
        );
      if (error) throw new Error(error.message);
      return (data ?? []) as UniversitySubmission[];
    },
  });

  const byKey = useMemo(
    () => new Map((query.data ?? []).map((s) => [submissionKey(s.student_id, s.institution_id), s])),
    [query.data],
  );

  /** Insert-or-update the row for one student at one university. */
  const save = useMutation({
    mutationFn: async ({ studentId, institutionId, patch }: { studentId: string; institutionId: string; patch: SubmissionPatch }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      const row: Record<string, unknown> = {
        student_id: studentId,
        institution_id: institutionId,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      if ('online_submitted_at' in patch) row.online_submitted_by = patch.online_submitted_at ? uid : null;
      if ('offline_sent_at' in patch) row.offline_sent_by = patch.offline_sent_at ? uid : null;
      if ('result' in patch) {
        row.result_at = patch.result ? new Date().toISOString() : null;
        row.result_by = patch.result ? uid : null;
        // Only an accepted university can stay the final one.
        if (patch.result !== 'accepted') {
          row.final_at = null;
          row.final_by = null;
          row.student_confirmed_at = null;
        }
      }
      if ('final_at' in patch) {
        row.final_by = patch.final_at ? uid : null;
        row.student_confirmed_at = null;
        // One final university per student: clear the previous pick first.
        if (patch.final_at) {
          const { error: clearError } = await db
            .from('student_university_submissions')
            .update({ final_at: null, final_by: null, student_confirmed_at: null })
            .eq('student_id', studentId)
            .neq('institution_id', institutionId);
          if (clearError) throw new Error(clearError.message);
        }
      }
      const { error } = await db
        .from('student_university_submissions')
        .upsert(row, { onConflict: 'student_id,institution_id' });
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { byKey, loading: query.isLoading, error: query.error ?? null, save };
}
