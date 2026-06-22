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

/**
 * Clone a full cycle (with its requirements + documents) into a new
 * year/term. Useful for staff rolling forward last year's admission data.
 */
export function useCloneAdmissionCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceCycleId, institution_id, intake_year, intake_term }: {
      sourceCycleId: string;
      institution_id: string;
      intake_year: number;
      intake_term: string;
    }) => {
      // 1) Fetch source cycle
      const { data: src, error: srcErr } = await (supabase.from('admission_cycles') as any)
        .select('*').eq('id', sourceCycleId).single();
      if (srcErr) throw srcErr;

      // 2) Create new cycle
      const { data: newCycle, error: cErr } = await (supabase.from('admission_cycles') as any)
        .insert({
          institution_id,
          intake_year,
          intake_term,
          cycle_track: src.cycle_track,
          round_number: src.round_number,
          is_unified: src.is_unified,
          applicant_category: src.applicant_category,
          status: 'draft',
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // 3) Clone requirements
      const { data: reqs } = await (supabase.from('requirements') as any)
        .select('*').eq('cycle_id', sourceCycleId);
      if (reqs && reqs.length) {
        const cloned = reqs.map((r: Record<string, unknown>) => ({
          cycle_id: newCycle.id,
          applicant_category: r.applicant_category,
          topik_min_level: r.topik_min_level,
          topik_deferred: r.topik_deferred,
          english_test: r.english_test,
          gpa_floor_pct: r.gpa_floor_pct,
          interview_required: r.interview_required,
          practical_exam_required: r.practical_exam_required,
          prose_ko: r.prose_ko,
        }));
        await (supabase.from('requirements') as any).insert(cloned);
      }

      // 4) Clone documents
      const { data: docs } = await (supabase.from('documents_required') as any)
        .select('*').eq('cycle_id', sourceCycleId);
      if (docs && docs.length) {
        const cloned = docs.map((d: Record<string, unknown>) => ({
          cycle_id: newCycle.id,
          document_type: d.document_type,
          applicant_category: d.applicant_category,
          is_required: d.is_required,
          is_apostille_required: d.is_apostille_required,
          notes_ko: d.notes_ko,
        }));
        await (supabase.from('documents_required') as any).insert(cloned);
      }

      return newCycle;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['university-admissions', vars.institution_id] });
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
