import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Staff "insider tips" attached to an institution (public.institution_notes).
 * Written here in the CRM; read server-side by the compare-universities edge
 * function to enrich the student comparison. RLS restricts writes to
 * owner/admin/document_handler — this hook just surfaces the CRUD. The table is
 * not in the generated Supabase types yet, so queries are cast at the boundary
 * (same pattern as the uni_db review views).
 */

export type InstitutionNoteType = 'tip' | 'general' | 'warning';

export interface InstitutionNote {
  id: string;
  institution_id: string;
  note_type: InstitutionNoteType;
  content: string;
  is_active: boolean;
  created_at: string;
}

const key = (institutionId: string | null) => ['institution_notes', institutionId] as const;

export function useInstitutionNotes(institutionId: string | null) {
  return useQuery<InstitutionNote[], Error>({
    queryKey: key(institutionId),
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        // @ts-expect-error - institution_notes not in generated types yet
        .from('institution_notes')
        .select('*')
        .eq('institution_id', institutionId as string)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InstitutionNote[];
    },
  });
}

interface AddArgs {
  institutionId: string;
  noteType: InstitutionNoteType;
  content: string;
}

export function useInstitutionNoteActions(institutionId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: key(institutionId) });

  const add = useMutation<void, Error, AddArgs>({
    mutationFn: async ({ institutionId: id, noteType, content }) => {
      const body = { institution_id: id, note_type: noteType, content: content.trim() };
      const { error } = await supabase
        // @ts-expect-error - institution_notes not in generated types yet
        .from('institution_notes')
        .insert(body as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  // Soft-delete so the note stops feeding the comparison without losing history.
  const remove = useMutation<void, Error, string>({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        // @ts-expect-error - institution_notes not in generated types yet
        .from('institution_notes')
        .update({ is_active: false } as never)
        .eq('id', noteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}
