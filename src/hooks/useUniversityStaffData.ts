/**
 * Phase 3R-B (2026-05-10) — neutered. The
 * `public.university_staff_assignments` table was dropped (always empty
 * per audit cleanup scope), retiring the standalone
 * `/university-portal` route that this hook fed. Returns an empty
 * dataset so the component renders the "no assignment" empty-state
 * without throwing.
 *
 * Re-implement against a future `institution_staff_assignments` table
 * if we resurrect the per-institution staff portal.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { Institution } from '@/hooks/useUniversities';

export interface StaffUniversityData {
  assignment: {
    id: string;
    institution_id: string;
    title: string | null;
    is_active: boolean;
  } | null;
  university: Institution | null;
  applicants: Array<{
    application: Tables<'applications'>;
    profile: { id: string; full_name: string | null; avatar_url: string | null; phone: string | null } | null;
    documents: Tables<'documents'>[];
  }>;
  roomId: string | null;
}

const EMPTY: StaffUniversityData = {
  assignment: null,
  university: null,
  applicants: [],
  roomId: null,
};

export function useUniversityStaffData() {
  const { user } = useAuth();
  const [data, setData] = useState<StaffUniversityData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    // university_staff_assignments was dropped on 2026-05-10. Return empty
    // so the consuming route shows its no-assignment empty-state.
    setData(EMPTY);
    setLoading(false);
  }, [user]);

  return { data, loading };
}
