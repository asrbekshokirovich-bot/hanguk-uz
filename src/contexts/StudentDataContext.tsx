import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { fetchMyUniversities, type MyUniversity } from '@/lib/myUniversities';

type Application = Tables<'applications'> & {
  university?: Tables<'universities'>;
};

/** Portal cards keep their old shape; the data is my_universities(). */
const toApplication = (u: MyUniversity, studentId: string): Application =>
  ({
    id: u.id,
    student_id: studentId,
    institution_id: u.institution_id,
    status: u.status,
    degree_level: u.program,
    created_at: u.created_at,
    updated_at: u.created_at,
    notes: null,
    university: { id: u.institution_id, name_en: u.name_en, name_ko: u.name_ko, city_ko: u.city_ko, is_partner: u.is_partner },
  }) as unknown as Application;

interface StudentDataContextType {
  applications: Application[];
  documents: Tables<'documents'>[];
  universities: Tables<'universities'>[];
  suggestions: Tables<'student_suggestions'>[];
  loading: boolean;
  refetchApplications: () => Promise<void>;
  refetchDocuments: () => Promise<void>;
  refetchSuggestions: () => Promise<void>;
}

const StudentDataContext = createContext<StudentDataContextType | undefined>(undefined);

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Tables<'documents'>[]>([]);
  const [universities, setUniversities] = useState<Tables<'universities'>[]>([]);
  const [suggestions, setSuggestions] = useState<Tables<'student_suggestions'>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    
    try {
      const rows = await fetchMyUniversities();
      setApplications(rows.map((u) => toApplication(u, user.id)));
    } catch (error) {
      console.error('my_universities failed', error);
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

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('student_suggestions')
      .select('*, university:institutions(*)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSuggestions(data);
    }
  }, [user]);

  const fetchUniversities = useCallback(async () => {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .eq('is_visible_on_map', true)
      .order('tier', { ascending: true, nullsFirst: false });

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

    // Use a completely unique string to ensure we don't accidentally stomp other active connections globally
    const channel = supabase
      .channel(`documents:student_id=eq.${user.id}-global-ctx`)
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_suggestions',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          fetchSuggestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchDocuments, fetchSuggestions]);

  return (
    <StudentDataContext.Provider value={{
      applications,
      documents,
      universities,
      suggestions,
      loading,
      refetchApplications: fetchApplications,
      refetchDocuments: fetchDocuments,
      refetchSuggestions: fetchSuggestions,
    }}>
      {children}
    </StudentDataContext.Provider>
  );
}

export function useStudentDataContext() {
  const context = useContext(StudentDataContext);
  if (context === undefined) {
    throw new Error('useStudentDataContext must be used within a StudentDataProvider');
  }
  return context;
}
