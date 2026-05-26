import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * One row of `public.v_review_queue_dashboard` (Phase 1 review_views
 * migration). Defined inline because the auto-generated supabase types
 * do not (yet) include uni_db views or RPCs.
 */
export interface ReviewQueueRow {
  id: string;
  priority: number;
  reason: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  name_ko: string | null;
  name_en: string | null;
  source_url_ko: string | null;
  storage_path: string | null;
  guideline_document_id: string | null;
  field_group: string | null;
  parsed_output: unknown | null;
  accuracy_self_score: number | null;
  // Added by migration 20260523150000 — lowest per-row extractor confidence.
  // Optional so the UI keeps working before the migration is applied (it then
  // falls back to a client-computed min, then accuracy_self_score).
  min_row_confidence?: number | null;
}

export type RejectionReason =
  | 'wrong_year'
  | 'wrong_archetype'
  | 'hallucinated_field'
  | 'ocr_garbled'
  | 'source_404'
  | 'other';

export const REVIEW_REJECTION_REASONS: RejectionReason[] = [
  'wrong_year',
  'wrong_archetype',
  'hallucinated_field',
  'ocr_garbled',
  'source_404',
  'other',
];

const REVIEW_QUEUE_KEY = ['uni_db', 'review_queue_dashboard'] as const;

export function useReviewQueue(enabled = true) {
  return useQuery<ReviewQueueRow[], Error>({
    queryKey: REVIEW_QUEUE_KEY,
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        // @ts-expect-error - view not in generated types yet
        .from('v_review_queue_dashboard')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ReviewQueueRow[];
    },
  });
}

interface AcceptArgs {
  queueItemId: string;
}

interface EditAcceptArgs extends AcceptArgs {
  correctedPayload: Record<string, unknown>;
  reviewerNotes?: string;
}

interface RejectArgs extends AcceptArgs {
  reason: RejectionReason;
  reasonDetail?: string;
}

interface FlagSourceWrongArgs extends AcceptArgs {
  detail?: string;
}

export function useReviewActions() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY });

  const accept = useMutation<string, Error, AcceptArgs>({
    mutationFn: async ({ queueItemId }) => {
      const { data, error } = await supabase.rpc('fn_review_accept' as never, {
        queue_item_id: queueItemId,
      } as never);
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: invalidate,
  });

  const editAccept = useMutation<string, Error, EditAcceptArgs>({
    mutationFn: async ({ queueItemId, correctedPayload, reviewerNotes }) => {
      const { data, error } = await supabase.rpc('fn_review_edit_accept' as never, {
        queue_item_id: queueItemId,
        corrected_payload: correctedPayload,
        reviewer_notes: reviewerNotes ?? null,
      } as never);
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation<string, Error, RejectArgs>({
    mutationFn: async ({ queueItemId, reason, reasonDetail }) => {
      const { data, error } = await supabase.rpc('fn_review_reject' as never, {
        queue_item_id: queueItemId,
        reason,
        reason_detail: reasonDetail ?? null,
      } as never);
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: invalidate,
  });

  // Marks the whole source document bad and rejects every open queue item that
  // shares it. Returns the number of items rejected.
  const flagSourceWrong = useMutation<number, Error, FlagSourceWrongArgs>({
    mutationFn: async ({ queueItemId, detail }) => {
      const { data, error } = await supabase.rpc('fn_flag_source_wrong' as never, {
        queue_item_id: queueItemId,
        detail: detail ?? null,
      } as never);
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
    onSuccess: invalidate,
  });

  return { accept, editAccept, reject, flagSourceWrong };
}
