import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Scholarship {
  id: string;
  institution_id: string | null;
  name: string;
  name_uz: string | null;
  name_ru: string | null;
  name_ko: string | null;
  name_en: string | null;
  description: string | null;
  description_uz: string | null;
  description_ru: string | null;
  description_ko: string | null;
  description_en: string | null;
  scholarship_type: string;
  coverage: string | null;
  amount_krw: number | null;
  amount_description: string | null;
  eligibility_criteria: Record<string, any>;
  required_documents: string[] | null;
  application_deadline: string | null;
  application_url: string | null;
  is_active: boolean;
  program_level: string | null;
  language_track: string | null;
  university?: {
    id: string;
    name_uz: string;
    name_en: string | null;
    name_ko: string | null;
    name_ru: string | null;
    logo_url: string | null;
  };
}

export interface ScholarshipFilters {
  scholarshipType: string;
  programLevel: string;
}

export function useScholarships(filters: ScholarshipFilters) {
  return useQuery({
    queryKey: ['scholarships', filters],
    queryFn: async () => {
      let query = supabase
        .from('scholarships')
        .select(`
          *,
          university:institutions(id, name_en, name_ko, logo_url)
        `)
        .eq('is_active', true);

      if (filters.scholarshipType) {
        query = query.eq('scholarship_type', filters.scholarshipType);
      }
      if (filters.programLevel) {
        query = query.or(`program_level.eq.${filters.programLevel},program_level.is.null`);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as unknown as Scholarship[];
    },
    placeholderData: keepPreviousData,
  });
}
