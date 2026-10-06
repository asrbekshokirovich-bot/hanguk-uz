/**
 * The two steps of "Yuborish" on a comment (spec §3.2):
 *   1. post the public reply on Instagram (edge function instagram-send),
 *   2. record it in the CRM (`lead_comment_answer`), which stops the lead's timer.
 *
 * Order matters: the CRM only calls the comment answered once Instagram has
 * it. If step 2 fails after step 1 succeeded the reply is already public, so
 * the outcome says so and a retry must only repeat step 2 (`alreadyPosted`),
 * never post the reply twice.
 */
import type { SocialComment } from '../types';

export type ReplyOutcome =
  | { status: 'ok' }
  | { status: 'post_failed'; message: string }
  | { status: 'record_failed'; message: string };

export interface ReplyDeps {
  /** posts under the Meta comment id */
  post: (metaCommentId: string, text: string) => Promise<void>;
  /** records the answer on our comment row */
  record: (commentRowId: string, text: string) => Promise<void>;
}

const messageOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);

export async function submitCommentReply(
  comment: Pick<SocialComment, 'id' | 'comment_id'>,
  text: string,
  deps: ReplyDeps,
  opts: { alreadyPosted?: boolean } = {},
): Promise<ReplyOutcome> {
  const reply = text.trim();
  if (!opts.alreadyPosted) {
    if (!comment.comment_id) {
      return { status: 'post_failed', message: "Izohning Instagram identifikatori yo'q — ochiq javob yuborib bo'lmaydi" };
    }
    try {
      await deps.post(comment.comment_id, reply);
    } catch (e) {
      return { status: 'post_failed', message: messageOf(e, "Instagramga yuborib bo'lmadi") };
    }
  }
  try {
    await deps.record(comment.id, reply);
  } catch (e) {
    return { status: 'record_failed', message: messageOf(e, "CRMga yozib bo'lmadi") };
  }
  return { status: 'ok' };
}
