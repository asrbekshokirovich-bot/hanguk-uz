import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProgramFilters {
  programLevel: string;
  languageTrack: string;
  region: string;
  faculty: string;
  maxTuition: number | null;
  maxTopik: number | null;
  partnerOnly: boolean;
  searchQuery: string;
}

export const defaultFilters: ProgramFilters = {
  programLevel: '',
  languageTrack: '',
  region: '',
  faculty: '',
  maxTuition: null,
  maxTopik: null,
  partnerOnly: false,
  searchQuery: '',
};

export interface ProgramWithUniversity {
  id: string;
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
  notes: string | null;
  university: {
    id: string;
    name_uz: string;
    name_en: string | null;
    name_ko: string | null;
    name_ru: string | null;
    city_uz: string | null;
    city_en: string | null;
    city_ko: string | null;
    city_ru: string | null;
    is_partner: boolean | null;
    ranking: number | null;
    logo_url: string | null;
    website: string | null;
  };
}

export function useProgramSearch(filters: ProgramFilters) {
  return useQuery({
    queryKey: ['program-search', filters],
    queryFn: async () => {
      let query = supabase
        .from('university_programs')
        .select(`
          id, program_name, program_level, faculty_name, department_name,
          language_track, tuition_per_semester, tuition_per_year,
          topik_requirement, ielts_requirement, toefl_requirement, notes,
          university:institutions!inner(
            id, name_uz, name_en, name_ko, name_ru,
            city_uz, city_en, city_ko, city_ru,
            is_partner, ranking, logo_url, website
          )
        `)
        .eq('is_available_for_international', true);

      if (filters.programLevel) {
        query = query.eq('program_level', filters.programLevel);
      }
      if (filters.languageTrack) {
        query = query.eq('language_track', filters.languageTrack);
      }
      if (filters.maxTopik) {
        query = query.or(`topik_requirement.lte.${filters.maxTopik},topik_requirement.is.null`);
      }
      if (filters.maxTuition) {
        query = query.lte('tuition_per_semester', filters.maxTuition);
      }

      const { data, error } = await query.order('program_name').limit(500);
      if (error) throw error;

      let results = (data || []) as unknown as ProgramWithUniversity[];

      // Client-side filters
      if (filters.partnerOnly) {
        results = results.filter(p => p.university.is_partner === true);
      }

      if (filters.region) {
        results = results.filter(p => {
          const city = p.university.city_en?.toLowerCase() || '';
          return city.includes(filters.region.toLowerCase());
        });
      }

      if (filters.faculty) {
        const f = filters.faculty.toLowerCase();
        results = results.filter(p =>
          p.faculty_name?.toLowerCase().includes(f)
        );
      }

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        results = results.filter(p =>
          p.program_name.toLowerCase().includes(q) ||
          (p.faculty_name?.toLowerCase().includes(q)) ||
          (p.university.name_en?.toLowerCase().includes(q)) ||
          (p.university.name_uz?.toLowerCase().includes(q)) ||
          (p.university.name_ru?.toLowerCase().includes(q)) ||
          (p.university.name_ko?.toLowerCase().includes(q))
        );
      }

      return results;
    },
    placeholderData: keepPreviousData,
  });
}

export function useAvailableRegions() {
  return useQuery({
    queryKey: ['available-regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('city_ko')
        .not('city_ko', 'is', null);
      if (error) throw error;
      // Phase 3R-B: institutions has only city_ko. Returns Korean-keyed
      // distinct cities; UI is responsible for displaying the Korean label.
      const unique = new Map<string, { en: string; uz: string; ru: string; ko: string }>();
      (data || []).forEach((u: { city_ko: string | null }) => {
        const c = u.city_ko;
        if (c && !unique.has(c)) {
          unique.set(c, { en: c, uz: c, ru: c, ko: c });
        }
      });
      return Array.from(unique.values());
    },
    staleTime: 60_000,
  });
}

export function useAvailableFaculties() {
  return useQuery({
    queryKey: ['available-faculties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('university_programs')
        .select('faculty_name')
        .eq('is_available_for_international', true)
        .not('faculty_name', 'is', null);
      if (error) throw error;
      const unique = [...new Set((data || []).map(d => d.faculty_name).filter(Boolean) as string[])].sort();
      return unique;
    },
    staleTime: 60_000,
  });
}

export type EligibilityStatus = 'eligible' | 'not_eligible' | 'unknown';

export function checkEligibility(
  program: ProgramWithUniversity,
  studentProfile: { topik_level: number | null; ielts_score: number | null }
) {
  const issues: string[] = [];
  let hasUnknown = false;

  if (program.topik_requirement) {
    if (studentProfile.topik_level === null) {
      hasUnknown = true;
    } else if (studentProfile.topik_level < program.topik_requirement) {
      issues.push(`TOPIK ${program.topik_requirement} required`);
    }
  }
  if (program.ielts_requirement) {
    if (studentProfile.ielts_score === null) {
      hasUnknown = true;
    } else if (studentProfile.ielts_score < program.ielts_requirement) {
      issues.push(`IELTS ${program.ielts_requirement} required`);
    }
  }

  const status: EligibilityStatus = issues.length > 0 ? 'not_eligible' : hasUnknown ? 'unknown' : 'eligible';
  return { status, eligible: status === 'eligible', issues };
}
