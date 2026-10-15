import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionErrorMessage } from '@/lib/edgeFunctionError';

/**
 * Post a public reply under an Instagram comment through the existing
 * `instagram-send` edge function (action `reply_comment`: body
 * `{ action, comment_id, text }`, auth = the staff JWT supabase-js attaches).
 * `commentId` is the Meta comment id (`social_comments.comment_id`), not our
 * row id. Throws an Error with the function's own message ("24-hour window...",
 * "Forbidden: staff role required", ...).
 */
export async function postInstagramReply(commentId: string, text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('instagram-send', {
    body: { action: 'reply_comment', comment_id: commentId, text },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, "Instagramga yuborib bo'lmadi"));
  const failure = (data as { error?: unknown } | null)?.error;
  if (failure) throw new Error(String(failure));
}
