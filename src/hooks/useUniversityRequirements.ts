import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UniversityRequirement {
  id: string;
  university_id: string;
  document_type: 'study_plan' | 'personal_statement';
  min_word_count: number;
  max_word_count: number;
  required_sections: string[];
  language_requirements: string | null;
  formatting_notes: string | null;
  tips: string | null;
}

export function useUniversityRequirements(
  universityId: string | null | undefined,
  documentType: 'study_plan' | 'personal_statement'
) {
  const [requirements, setRequirements] = useState<UniversityRequirement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRequirements = useCallback(async () => {
    if (!universityId) {
      setRequirements(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('university_document_requirements' as any)
        .select('*')
        .eq('university_id', universityId)
        .eq('document_type', documentType)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching requirements:', error);
      }

      if (data) {
        const typedData = data as any;
        setRequirements({
          id: typedData.id,
          university_id: typedData.university_id,
          document_type: typedData.document_type,
          min_word_count: typedData.min_word_count || 500,
          max_word_count: typedData.max_word_count || 1000,
          required_sections: typedData.required_sections || [],
          language_requirements: typedData.language_requirements,
          formatting_notes: typedData.formatting_notes,
          tips: typedData.tips,
        });
      } else {
        // Default requirements if none specified
        setRequirements({
          id: '',
          university_id: universityId,
          document_type: documentType,
          min_word_count: 500,
          max_word_count: 1000,
          required_sections: documentType === 'study_plan' 
            ? ['Introduction', 'Why Korea', 'Why This University', 'Study Goals', 'Career Plans', 'Conclusion']
            : ['Background', 'Motivation', 'Experience', 'Goals'],
          language_requirements: null,
          formatting_notes: null,
          tips: null,
        });
      }
    } catch (error) {
      console.error('Error in useUniversityRequirements:', error);
    } finally {
      setIsLoading(false);
    }
  }, [universityId, documentType]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  return {
    requirements,
    isLoading,
    refetch: fetchRequirements,
  };
}
