import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

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
  const isStaff = roles.length > 0;
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
    isOwner,
    isAdmin,
    isCallOperator,
    isDocumentHandler,
    isUniversityStaff,
  };
}
