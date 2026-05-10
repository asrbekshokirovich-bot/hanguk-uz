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
  parsed_output: unknown | null;
  accuracy_self_score: number | null;
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
        .select('*');
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

  return { accept, editAccept, reject };
}
