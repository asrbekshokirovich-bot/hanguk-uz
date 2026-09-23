import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { NewCenterStudent } from '@/lib/learningCenterRows';

/* ---------------------------------------------------------------------------
 * Partner learning centers (o'quv markazlar).
 *
 * A center enters its students; the database turns each one into a lead
 * (trigger fn_learning_center_student_to_lead). The center never reads
 * public.leads — progress reaches it through v_learning_center_students.
 *
 * None of these relations are in src/integrations/supabase/types.ts yet, so
 * the client is widened once, here. Regenerate the types and `rel()` can go.
 * ------------------------------------------------------------------------ */

type LooseRelation = {
  select: (columns?: string, options?: Record<string, unknown>) => any;
  insert: (values: unknown) => any;
  update: (values: unknown) => any;
};

const rel = (name: string): LooseRelation =>
  (supabase as unknown as { from: (n: string) => LooseRelation }).from(name);

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export interface LearningCenter {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  user_id: string | null;
  assigned_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface CenterStudent {
  id: string;
  center_id: string;
  full_name: string;
  phone: string;
  city: string | null;
  age: number | null;
  korean_level: string | null;
  notes: string | null;
  already_lead: boolean;
  created_at: string;
  lead_status: LeadStatus | null;
}

export type { NewCenterStudent } from '@/lib/learningCenterRows';
export { parseStudentRows, phoneKey } from '@/lib/learningCenterRows';

/** What the center is told about a student's progress. */
export const CENTER_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Yangi',
  contacted: 'Bog‘lanildi',
  qualified: 'Qiziqmoqda',
  converted: 'Shartnoma tuzildi',
  lost: 'Rad etdi',
};

// ---------------------------------------------------------------------------
// The center's own side
// ---------------------------------------------------------------------------

export function useMyLearningCenter() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-learning-center', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<LearningCenter | null> => {
      const { data, error } = await rel('learning_centers')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as LearningCenter | null;
    },
  });
}

export function useCenterStudents(centerId: string | null | undefined) {
  return useQuery({
    queryKey: ['learning-center-students', centerId],
    enabled: Boolean(centerId),
    staleTime: 30_000,
    queryFn: async (): Promise<CenterStudent[]> => {
      const { data, error } = await rel('v_learning_center_students')
        .select('*')
        .eq('center_id', centerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CenterStudent[];
    },
  });
}

export interface AddStudentsResult {
  added: number;
  duplicates: string[];
  failed: { row: NewCenterStudent; message: string }[];
}

/**
 * Insert one row at a time so one bad row (a phone this center already
 * entered, a typo) does not reject the whole pasted list.
 */
export function useAddCenterStudents(centerId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: NewCenterStudent[]): Promise<AddStudentsResult> => {
      const result: AddStudentsResult = { added: 0, duplicates: [], failed: [] };
      for (const row of rows) {
        const { error } = await rel('learning_center_students').insert({
          center_id: centerId,
          full_name: row.full_name.trim(),
          phone: row.phone.trim(),
          city: row.city?.trim() || null,
          age: row.age ?? null,
          korean_level: row.korean_level?.trim() || null,
          notes: row.notes?.trim() || null,
        });
        if (!error) result.added += 1;
        else if (error.code === '23505') result.duplicates.push(row.full_name);
        else result.failed.push({ row, message: error.message });
      }
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['learning-center-students', centerId] }),
  });
}

// ---------------------------------------------------------------------------
// The staff side
// ---------------------------------------------------------------------------

export interface LearningCenterWithStats extends LearningCenter {
  student_count: number;
  converted_count: number;
}

export function useLearningCenters() {
  return useQuery({
    queryKey: ['learning-centers'],
    queryFn: async (): Promise<LearningCenterWithStats[]> => {
      const [{ data: centers, error }, { data: students, error: sErr }] = await Promise.all([
        rel('learning_centers').select('*').order('created_at', { ascending: false }),
        rel('v_learning_center_students').select('center_id, lead_status, already_lead'),
      ]);
      if (error) throw error;
      if (sErr) throw sErr;
      const list = (students ?? []) as Pick<CenterStudent, 'center_id' | 'lead_status' | 'already_lead'>[];
      return ((centers ?? []) as LearningCenter[]).map((c) => {
        const own = list.filter((s) => s.center_id === c.id);
        return {
          ...c,
          student_count: own.length,
          converted_count: own.filter((s) => s.lead_status === 'converted').length,
        };
      });
    },
  });
}

export interface CreateCenterInput {
  name: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
  assignedTo?: string | null;
  username: string;
  password: string;
}

export function useCreateLearningCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCenterInput) => {
      const { data, error } = await supabase.functions.invoke('create-learning-center', { body: input });
      if (error) {
        // functions.invoke hides the JSON body of a non-2xx reply behind a
        // generic message; the body says what was actually wrong.
        const ctx = (error as { context?: Response }).context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data as { centerId: string; userId: string; username: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-centers'] }),
  });
}

export function useUpdateLearningCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LearningCenter> & { id: string }) => {
      const { error } = await rel('learning_centers').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning-centers'] }),
  });
}
