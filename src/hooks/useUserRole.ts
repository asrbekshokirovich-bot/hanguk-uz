import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

// 'investor' was added to public.app_role by migration 20260729_0001 and is not
// in the generated Database type yet, so it is matched as a plain string.
const INVESTOR_ROLE = 'investor';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!error && data) {
        setRoles(data.map((r) => r.role));
      }
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole) => roles.includes(role);

  const isInvestor = (roles as string[]).includes(INVESTOR_ROLE);

  // "Staff" means holding a role that is NOT investor.
  //
  // This used to be `roles.length > 0`. CRMPortal gates the entire CRM on it,
  // so under the old definition the moment Dilrabo's user_roles row was
  // inserted she would have been admitted to every staff screen - students,
  // documents, finance, settings. The database would still have refused her the
  // rows, but the app would have tried, and she would have seen the shell of a
  // CRM she is not supposed to know exists.
  const isStaff = (roles as string[]).some((r) => r !== INVESTOR_ROLE);

  const isOwner = hasRole('owner');
  const isAdmin = hasRole('owner') || hasRole('admin');
  const isCallOperator = hasRole('call_operator') || isAdmin;
  const isDocumentHandler = hasRole('document_handler') || isAdmin;
  const isUniversityStaff = hasRole('university_staff');

  return {
    roles,
    loading,
    hasRole,
    isStaff,
    isInvestor,
    isOwner,
    isAdmin,
    isCallOperator,
    isDocumentHandler,
    isUniversityStaff,
  };
}
