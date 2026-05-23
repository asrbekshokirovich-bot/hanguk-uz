import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Authorization gate for the university-data review (HITL) queue.
 *
 * Calls the server-side `public.fn_can_review_uni_db()` RPC, which returns
 * true for any non-student staff role (owner / admin / call_operator /
 * document_handler / university_staff). This is UX-only — row-level security
 * still blocks the underlying data for non-staff even if the gate is bypassed.
 */
export function useCanReviewUniDb() {
  const { user } = useAuth();
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!user) {
        setCanReview(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      // RPC not present in the auto-generated types yet.
      const { data, error } = await supabase.rpc('fn_can_review_uni_db' as never);

      if (!cancelled) {
        setCanReview(!error && data === true);
        setLoading(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { canReview, loading };
}
