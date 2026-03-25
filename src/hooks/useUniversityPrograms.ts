import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UniversityProgram {
  id: string;
  university_id: string;
  program_name: string;
  program_level: string;
  faculty_name: string | null;
  department_name: string | null;
  language_track: string;
  tuition_per_semester: number | null;
  tuition_per_year: number | null;
  topik_requirement: number | null;
  ielts_requirement: number | null;
  toefl_requirement: number | null;
  is_available_for_international: boolean;
  notes: string | null;
}

export interface UniversityAdmissionPeriod {
  id: string;
  university_id: string;
  program_level: string;
  semester: string;
  year: number;
  application_start: string | null;
  application_end: string | null;
  document_deadline: string | null;
  result_announcement: string | null;
  application_fee_krw: number | null;
  application_form_url: string | null;
}

export interface ProgramsByTrack {
  englishTrack: { faculty: string; programs: string[] }[];
  koreanTrack: { faculty: string; programs: string[] }[];
  bothTracks: { faculty: string; programs: string[] }[];
}

export function useUniversityPrograms(universityId: string | null) {
  return useQuery({
    queryKey: ['university-programs', universityId],
    queryFn: async () => {
      if (!universityId) return null;
      
      const { data, error } = await supabase
        .from('university_programs')
        .select('*')
        .eq('university_id', universityId)
        .eq('is_available_for_international', true);
      
      if (error) throw error;
      return data as UniversityProgram[];
    },
    enabled: !!universityId,
    placeholderData: keepPreviousData,
  });
}

export function useUniversityAdmissionPeriods(universityId: string | null) {
  return useQuery({
    queryKey: ['university-admission-periods', universityId],
    queryFn: async () => {
      if (!universityId) return null;
      
      const currentYear = new Date().getFullYear();
      
      const { data, error } = await supabase
        .from('university_admission_periods')
        .select('*')
        .eq('university_id', universityId)
        .gte('year', currentYear)
        .order('year', { ascending: true })
        .order('semester', { ascending: true });
      
      if (error) throw error;
      return data as UniversityAdmissionPeriod[];
    },
    enabled: !!universityId,
  });
}

export function groupProgramsByTrack(programs: UniversityProgram[] | null): ProgramsByTrack {
  if (!programs) {
    return { englishTrack: [], koreanTrack: [], bothTracks: [] };
  }
  
  const englishMap = new Map<string, string[]>();
  const koreanMap = new Map<string, string[]>();
  const bothMap = new Map<string, string[]>();
  
  programs.forEach(program => {
    const faculty = program.faculty_name || 'General';
    
    if (program.language_track === 'english') {
      if (!englishMap.has(faculty)) englishMap.set(faculty, []);
      englishMap.get(faculty)!.push(program.program_name);
    } else if (program.language_track === 'korean') {
      if (!koreanMap.has(faculty)) koreanMap.set(faculty, []);
      koreanMap.get(faculty)!.push(program.program_name);
    } else {
      if (!bothMap.has(faculty)) bothMap.set(faculty, []);
      bothMap.get(faculty)!.push(program.program_name);
    }
  });
  
  return {
    englishTrack: Array.from(englishMap.entries()).map(([faculty, programs]) => ({ faculty, programs })),
    koreanTrack: Array.from(koreanMap.entries()).map(([faculty, programs]) => ({ faculty, programs })),
    bothTracks: Array.from(bothMap.entries()).map(([faculty, programs]) => ({ faculty, programs })),
  };
}

export function getLanguageRequirements(programs: UniversityProgram[] | null): {
  topikRange: { min: number; max: number } | null;
  ieltsRange: { min: number; max: number } | null;
} {
  if (!programs || programs.length === 0) {
    return { topikRange: null, ieltsRange: null };
  }
  
  const topikLevels = programs
    .filter(p => p.topik_requirement)
    .map(p => p.topik_requirement!);
  
  const ieltsScores = programs
    .filter(p => p.ielts_requirement)
    .map(p => p.ielts_requirement!);
  
  return {
    topikRange: topikLevels.length > 0 
      ? { min: Math.min(...topikLevels), max: Math.max(...topikLevels) }
      : null,
    ieltsRange: ieltsScores.length > 0 
      ? { min: Math.min(...ieltsScores), max: Math.max(...ieltsScores) }
      : null,
  };
}
