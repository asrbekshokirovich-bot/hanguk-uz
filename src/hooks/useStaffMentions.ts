import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MentionableStaff {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}

export function useStaffMentions() {
  const [staffList, setStaffList] = useState<MentionableStaff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      // Get all users who have roles (staff members)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];

      if (userIds.length === 0) {
        setStaffList([]);
        setLoading(false);
        return;
      }

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, username, avatar_url')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        setLoading(false);
        return;
      }

      setStaffList(
        (profiles || []).map(p => ({
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name || 'Unknown',
          username: p.username,
          avatar_url: p.avatar_url,
        }))
      );
      setLoading(false);
    };

    fetchStaff();
  }, []);

  const searchStaff = (query: string): MentionableStaff[] => {
    if (!query) return staffList;
    const lowerQuery = query.toLowerCase();
    return staffList.filter(
      s =>
        s.full_name.toLowerCase().includes(lowerQuery) ||
        (s.username && s.username.toLowerCase().includes(lowerQuery))
    );
  };

  return {
    staffList,
    loading,
    searchStaff,
  };
}
