import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Reads `public.profiles.role` for the current auth user and reports
 * whether they are a uni_db reviewer or admin.
 *
 * `profiles.role` is the uni_db-side role column added by the
 * `00000000000003_pre_uni_db_profiles_role.sql` bridge migration.
 * It is intentionally separate from the existing `public.user_roles`
 * (which uses the `app_role` ENUM and powers the staff CRM gate).
 *
 * Two role systems coexist:
 *   - `user_roles.role`   ENUM: owner / admin / call_operator / document_handler / university_staff
 *   - `profiles.role`     TEXT: student / contracted_student / counselor / admin / uni_db_reviewer / uni_db_admin
 *
 * See `docs/runbooks/hanguk-uz-staff-crm-architecture.md` §1 in the
 * hanguk_app repo for the full breakdown.
 */
export function useUniDbReviewer() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        // @ts-expect-error - `role` is added by a uni_db bridge migration
        // and may not be reflected in the auto-generated types yet.
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data && typeof (data as { role?: unknown }).role === 'string') {
          setRole((data as { role: string }).role);
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    };

    fetchRole();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isUniDbReviewer = role === 'uni_db_reviewer' || role === 'uni_db_admin' || role === 'admin';
  const isUniDbAdmin = role === 'uni_db_admin' || role === 'admin';

  return { role, isUniDbReviewer, isUniDbAdmin, loading };
}
