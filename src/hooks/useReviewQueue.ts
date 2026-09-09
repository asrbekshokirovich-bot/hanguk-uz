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
  /** A correction saved but not yet approved (fn_review_save_edit). */
  reviewer_decision: Record<string, unknown> | null;
  parsed_output: unknown | null;
  accuracy_self_score: number | null;
  // Added by migration 20260523150000 — lowest per-row extractor confidence.
  // Optional so the UI keeps working before the migration is applied (it then
  // falls back to a client-computed min, then accuracy_self_score).
  min_row_confidence?: number | null;
  // Added by migration 20260901000000 — the reliability gauntlet's verdict.
  // reviewer_notes is prefixed "[RED]/[AMBER]/[GREEN] …"; needs_attention flags
  // red items. Optional so the UI degrades gracefully before that migration.
  reviewer_notes?: string | null;
  needs_attention?: boolean | null;
  status?: string | null;
  // Added by migration 20260714000000 — the source document's classified
  // admission cycle (guideline_documents.academic_year/semester). Optional so
  // the UI keeps working before the migration/backfill are applied.
  doc_academic_year?: number | null;
  doc_semester?: string | null;
  // Added by migration 20260918000000 — the owning institution. This is the
  // triage rail's grouping key: without it the rail grouped by guideline
  // document, so a university with three stored guidelines appeared as three
  // identical cards. Optional so the UI degrades to per-document grouping if
  // the migration has not been applied yet.
  institution_id?: string | null;
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

  /**
   * Patch one row in the cache instead of refetching the queue.
   *
   * Every mutation used to end in `invalidate()`, and the dashboard query is
   * `select *` over 138 rows carrying their whole `parsed_output` — measured
   * at 1.8 MB and 229 ms of server time, before the round trip from Tashkent
   * to a Seoul database, the JSON parse, and re-rendering every card. That is
   * what a reviewer felt when they pressed Saqlash: the button did its work in
   * a few milliseconds and then the screen waited on a megabyte and a half of
   * data it already had.
   *
   * These three mutations each change exactly one row, and they change fields
   * this client already knows the new value of. So write it locally.
   * `flagSourceWrong` still invalidates — it resolves every row sharing a PDF,
   * and this client does not know which ones.
   */
  const patchRow = (queueItemId: string, patch: Partial<ReviewQueueRow>) =>
    qc.setQueryData<ReviewQueueRow[]>(REVIEW_QUEUE_KEY, (rows) =>
      rows?.map((r) => (r.id === queueItemId ? { ...r, ...patch } : r)),
    );

  const accept = useMutation<string, Error, AcceptArgs>({
    mutationFn: async ({ queueItemId }) => {
      const { data, error } = await supabase.rpc('fn_review_accept' as never, {
        queue_item_id: queueItemId,
      } as never);
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: (_id, { queueItemId }) => patchRow(queueItemId, { status: 'approved' }),
  });

  // Save the reviewer's corrections WITHOUT approving them. Approving is a
  // separate click, because "the data now matches the PDF" and "this may go
  // to a student" are separate judgements.
  const saveEdit = useMutation<string, Error, EditAcceptArgs>({
    mutationFn: async ({ queueItemId, correctedPayload, reviewerNotes }) => {
      const { data, error } = await supabase.rpc('fn_review_save_edit' as never, {
        queue_item_id: queueItemId,
        corrected_payload: correctedPayload,
        reviewer_notes: reviewerNotes ?? null,
      } as never);
      if (error) throw new Error(error.message);
      return data as unknown as string;
    },
    onSuccess: (_id, { queueItemId, correctedPayload }) =>
      patchRow(queueItemId, { status: 'in_review', reviewer_decision: correctedPayload }),
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
    onSuccess: (_id, { queueItemId, correctedPayload }) =>
      patchRow(queueItemId, { status: 'approved', reviewer_decision: correctedPayload }),
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
    onSuccess: (_id, { queueItemId }) => patchRow(queueItemId, { status: 'rejected' }),
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

  return { accept, saveEdit, editAccept, reject, flagSourceWrong };
}
