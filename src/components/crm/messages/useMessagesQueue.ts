import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStudentPipelines } from '@/lib/loadStudentPipelines';
import type { PipelineStage } from '@/lib/studentPipeline';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import type { MessageThread } from '@/contexts/MessagesContext';
import { channelHandle, toChannelId } from './channels';
import { initialsOf, minutesSince, STALE_AFTER_DAYS } from './queueLogic';
import { stageLabelKey } from './stages';
import { isMediaPlaceholder, mediaPreviewKey } from './media';
import type { ConversationVM } from './types';

/**
 * Adapts the global `MessagesContext` into the shared-queue view model.
 *
 * Assignment, the lead behind the chat, the person's handle and the two
 * timestamps the waiting rule needs all arrive WITH the thread list
 * (`get_thread_previews`). Only the pipeline stage (the Arizalar board column,
 * src/lib/studentPipeline.ts) needs its own batched query.
 */
export function useMessagesQueue(locallyRead: ReadonlySet<string> = new Set()) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { threads, loading, fetchThreads } = useMessages();

  /** `profiles.user_id` → Arizalar board column. */
  const [stages, setStages] = useState<Map<string, PipelineStage>>(new Map());

  const studentKey = threads
    .map((th) => th.student_id)
    .filter((id): id is string => !!id)
    .sort()
    .join('|');

  const loadStages = useCallback(async (studentIds: string[]) => {
    if (studentIds.length === 0) {
      setStages(new Map());
      return;
    }
    const pipelines = await loadStudentPipelines(studentIds);
    const map = new Map<string, PipelineStage>();
    pipelines.forEach((p, id) => map.set(id, p.stage));
    setStages(map);
  }, []);

  useEffect(() => {
    void loadStages(studentKey ? studentKey.split('|') : []);
  }, [studentKey, loadStages]);

  // Claims made elsewhere land via the context's realtime subscription; a
  // manual refresh is one cheap RPC now, kept for the post-claim path.
  const refreshAssignments = useCallback(async () => {
    await fetchThreads();
  }, [fetchThreads]);

  const conversations = useMemo<ConversationVM[]>(() => {
    const now = Date.now();
    const staleBefore = now - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    return threads.map((th: MessageThread) => {
      const channel = toChannelId(th.source);
      const assignee = th.assigned_to ?? null;
      const last = th.lastMessage;
      const handle = channelHandle(channel, th.handle, th.sender_name);
      const name = th.sender_name?.trim() || handle || t('messages.queue.unknownName');

      // The person is waiting when their latest message is newer than the
      // latest reply written by a PERSON on our side. Automatic replies and
      // internal notes are excluded server-side (get_thread_previews v2).
      const incomingAt = th.last_incoming_at ? new Date(th.last_incoming_at).getTime() : null;
      const humanAt = th.last_human_out_at ? new Date(th.last_human_out_at).getTime() : null;
      const isWaiting = incomingAt !== null && (humanAt === null || incomingAt > humanAt);

      return {
        threadId: th.id,
        channel,
        senderId: th.sender_id,
        name,
        initials: initialsOf(th.sender_name, channel === 'telegram' ? 'TG' : channel === 'instagram' ? 'IG' : 'HK'),
        avatarUrl: th.sender_avatar,
        handle,
        studentId: th.student_id,
        leadId: th.lead_id ?? null,
        kind: th.kind ?? 'lead',
        stage: t(stageLabelKey(th.student_id, th.student_id ? stages.get(th.student_id) : null)),
        preview: previewFor(last, t),
        lastAt: th.last_message_at,
        isWaiting,
        waitingSince: isWaiting ? th.last_incoming_at : null,
        waitingMinutes: isWaiting && th.last_incoming_at ? minutesSince(th.last_incoming_at, now) : 0,
        isStale: new Date(th.last_message_at).getTime() < staleBefore,
        isMine: !!assignee && assignee === user?.id,
        isAssigned: !!assignee,
        isDone: th.status === 'archived',
        unreadCount: locallyRead.has(th.id) ? 0 : th.unread_count ?? 0,
      };
    });
  }, [threads, stages, user?.id, t, locallyRead]);

  return { conversations, loading, refreshAssignments };
}

/**
 * One-line queue preview. Media rows store a placeholder caption such as
 * "[document]" or "🎤 Voice message"; those are replaced with a localised
 * label so raw ingest strings never leak into the queue.
 */
function previewFor(
  last: MessageThread['lastMessage'],
  t: (key: string) => string,
): string {
  if (!last) return '';
  const body = last.content?.replace(/\s+/g, ' ').trim() ?? '';
  const key = mediaPreviewKey(last.message_type as string);
  if (key && (!body || isMediaPlaceholder(body))) return t(key);
  return body;
}
