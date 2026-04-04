import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';

type Application = Tables<'applications'> & {
  university?: Tables<'universities'>;
};

export function useStudentData() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Tables<'documents'>[]>([]);
  const [universities, setUniversities] = useState<Tables<'universities'>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('applications')
      .select('*, university:universities(*)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setApplications(data);
    }
  }, [user]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
  }, [user]);

  const [suggestions, setSuggestions] = useState<Tables<'student_suggestions'>[]>([]);

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('student_suggestions')
      .select('*, university:universities(*)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSuggestions(data);
    }
  }, [user]);

  const fetchUniversities = useCallback(async () => {
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .eq('is_visible_on_map', true)
      .order('ranking', { ascending: true });

    if (!error && data) {
      setUniversities(data);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchApplications(),
        fetchDocuments(),
        fetchUniversities(),
        fetchSuggestions(),
      ]);
      setLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, fetchApplications, fetchDocuments, fetchUniversities, fetchSuggestions]);

  // Realtime subscription — auto-refresh documents when staff approves/rejects
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`documents:student_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchDocuments]);

  return {
    applications,
    documents,
    universities,
    suggestions,
    loading,
    refetchApplications: fetchApplications,
    refetchDocuments: fetchDocuments,
    refetchSuggestions: fetchSuggestions,
  };
}
