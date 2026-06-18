import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdmissionCycleInput {
  institution_id: string;
  intake_year: number;
  intake_term: string;
  cycle_track: string;
  round_number: number | null;
  is_unified: boolean;
  applicant_category: string | null;
  status: string;
}

export interface RequirementInput {
  cycle_id: string;
  applicant_category: string | null;
  topik_min_level: number | null;
  topik_deferred: boolean;
  english_test: Record<string, unknown> | null;
  gpa_floor_pct: number | null;
  interview_required: boolean;
  practical_exam_required: boolean;
  prose_ko: string | null;
}

export function useCreateAdmissionCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdmissionCycleInput) => {
      const { data, error } = await (supabase.from('admission_cycles') as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['university-admissions', vars.institution_id] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}

export function useUpdateAdmissionCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AdmissionCycleInput & { id: string }) => {
      const { data, error } = await (supabase.from('admission_cycles') as any)
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['university-admissions', vars.institution_id] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}

export function useDeleteAdmissionCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, institution_id }: { id: string; institution_id: string }) => {
      const { error } = await (supabase.from('admission_cycles') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['university-admissions', vars.institution_id] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}

export function useCreateRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RequirementInput) => {
      const { data, error } = await (supabase.from('requirements') as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['university-admissions'] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}

export function useUpdateRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: RequirementInput & { id: string }) => {
      const { data, error } = await (supabase.from('requirements') as any)
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['university-admissions'] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}

export function useDeleteRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await (supabase.from('requirements') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['university-admissions'] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}
