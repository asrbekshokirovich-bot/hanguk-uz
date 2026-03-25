import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';

export interface StaffUniversityData {
  assignment: {
    id: string;
    university_id: string;
    title: string | null;
    is_active: boolean;
  } | null;
  university: Tables<'universities'> | null;
  applicants: Array<{
    application: Tables<'applications'>;
    profile: { id: string; full_name: string | null; avatar_url: string | null; phone: string | null } | null;
    documents: Tables<'documents'>[];
  }>;
  roomId: string | null;
}

export function useUniversityStaffData() {
  const { user } = useAuth();
  const [data, setData] = useState<StaffUniversityData>({
    assignment: null,
    university: null,
    applicants: [],
    roomId: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Get staff assignment
      const { data: assignments } = await supabase
        .from('university_staff_assignments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const assignment = assignments?.[0] || null;
      if (!assignment) {
        setData({ assignment: null, university: null, applicants: [], roomId: null });
        setLoading(false);
        return;
      }

      // Fetch university details
      const { data: university } = await supabase
        .from('universities')
        .select('*')
        .eq('id', assignment.university_id)
        .single();

      // Fetch applications for this university
      const { data: applications } = await supabase
        .from('applications')
        .select('*')
        .eq('university_id', assignment.university_id)
        .order('created_at', { ascending: false });

      // Batch fetch profiles and documents (Issue 4: fix N+1, Issue 9: use user_id)
      let applicants: StaffUniversityData['applicants'] = [];
      if (applications && applications.length > 0) {
        const studentIds = [...new Set(applications.map(a => a.student_id))];

        const [{ data: profiles }, { data: docs }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, user_id, full_name, avatar_url, phone')
            .in('user_id', studentIds),
          supabase
            .from('documents')
            .select('*')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false }),
        ]);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const docMap = new Map<string, typeof docs>();
        docs?.forEach(d => {
          if (!docMap.has(d.student_id)) docMap.set(d.student_id, []);
          docMap.get(d.student_id)!.push(d);
        });

        applicants = applications.map(app => ({
          application: app,
          profile: profileMap.get(app.student_id) || null,
          documents: docMap.get(app.student_id) || [],
        }));
      }

      // Get room ID
      const { data: room } = await supabase
        .from('university_rooms')
        .select('id')
        .eq('university_id', assignment.university_id)
        .eq('is_active', true)
        .single();

      setData({
        assignment,
        university,
        applicants,
        roomId: room?.id || null,
      });
      setLoading(false);
    };

    fetchData();
  }, [user]);

  return { ...data, loading };
}
