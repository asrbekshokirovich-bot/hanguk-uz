import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** How many active surveys this student still has questions left to answer.
 *  Drives the badge in the portal — without it a survey sitting on the site
 *  is invisible unless staff happen to send the link. */
export function usePendingSurveys(): number {
  const { user } = useAuth();
  const userId = user?.id;
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!userId) {
      setPending(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      // RLS already limits this to surveys that are active and open.
      const { data: surveys } = await supabase.from('surveys').select('id');
      const ids = ((surveys ?? []) as { id: string }[]).map((s) => s.id);
      if (ids.length === 0) {
        if (!cancelled) setPending(0);
        return;
      }

      const [{ data: questions }, { data: mine }] = await Promise.all([
        supabase.from('survey_questions').select('survey_id').in('survey_id', ids),
        supabase
          .from('survey_responses')
          .select('survey_id')
          .eq('user_id', userId)
          .in('survey_id', ids),
      ]);

      const total: Record<string, number> = {};
      for (const q of (questions ?? []) as { survey_id: string }[]) {
        total[q.survey_id] = (total[q.survey_id] ?? 0) + 1;
      }
      const answered: Record<string, number> = {};
      for (const r of (mine ?? []) as { survey_id: string }[]) {
        answered[r.survey_id] = (answered[r.survey_id] ?? 0) + 1;
      }

      const count = ids.filter(
        (id) => (total[id] ?? 0) > 0 && (answered[id] ?? 0) < total[id]
      ).length;
      if (!cancelled) setPending(count);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return pending;
}
