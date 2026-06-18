import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdmissionPeriodInput {
  institution_id: string;
  semester: string;
  year: number;
  program_level: string;
  language_track: string | null;
  application_start: string | null;
  application_end: string | null;
  document_deadline: string | null;
  result_announcement: string | null;
  online_application_start: string | null;
  online_application_end: string | null;
  application_fee_krw: number | null;
  application_fee_usd: number | null;
  application_form_url: string | null;
  application_guide_url: string | null;
}

export function useCreateAdmissionPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdmissionPeriodInput) => {
      const { data, error } = await (supabase.from('university_admission_periods') as any)
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

export function useUpdateAdmissionPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AdmissionPeriodInput & { id: string }) => {
      const { data, error } = await (supabase.from('university_admission_periods') as any)
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

export function useDeleteAdmissionPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, institution_id }: { id: string; institution_id: string }) => {
      const { error } = await (supabase.from('university_admission_periods') as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['university-admissions', vars.institution_id] });
      qc.invalidateQueries({ queryKey: ['crm-institution-search'] });
    },
  });
}
