import { supabase } from '@/integrations/supabase/client';

/**
 * The intake a student is currently being processed for.
 *
 * The student portal has no season switcher (that's CRM-only), so student-side
 * writes (document uploads, applying to a suggested university) must stamp the
 * student's own current season. We pick the student's most recent membership:
 * highest year, then Fall over Spring. Returns null if the student has no
 * membership yet — callers should then omit intake_id and let the DB default
 * trigger stamp the current default intake.
 */
export async function getStudentActiveIntakeId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('student_intakes')
    .select('intake_id, intake:intakes(year, season)')
    .eq('student_id', userId);

  if (error || !data || data.length === 0) return null;

  const seasonRank = (s?: string | null) => (s === 'fall' ? 1 : 0);
  const sorted = [...data].sort((a, b) => {
    const ay = (a.intake as { year?: number } | null)?.year ?? 0;
    const by = (b.intake as { year?: number } | null)?.year ?? 0;
    if (by !== ay) return by - ay;
    return (
      seasonRank((b.intake as { season?: string } | null)?.season) -
      seasonRank((a.intake as { season?: string } | null)?.season)
    );
  });

  return sorted[0]?.intake_id ?? null;
}
