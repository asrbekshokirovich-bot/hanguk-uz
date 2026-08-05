import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import type { MessageThread } from '@/contexts/MessagesContext';
import { channelHandle, toChannelId } from './channels';
import { initialsOf, minutesSince } from './queueLogic';
import { mostAdvancedStatus, stageLabelKey } from './stages';
import { isMediaPlaceholder, mediaPreviewKey } from './media';
import type { ConversationVM } from './types';

/**
 * Adapts the global `MessagesContext` into the shared-queue view model.
 *
 * Assignment now arrives WITH the thread list: `get_thread_previews` resolves
 * each thread's latest assignee server-side, so the old client-side scan of
 * every assigned message in the database is gone. Only the pipeline stage
 * (from `applications.status`) still needs its own batched query.
 */
export function useMessagesQueue(locallyRead: ReadonlySet<string> = new Set()) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { threads, loading, fetchThreads } = useMessages();

  /** `profiles.user_id` → most advanced `applications.status`. */
  const [stages, setStages] = useState<Map<string, string>>(new Map());

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
    const { data, error } = await supabase
      .from('applications')
      .select('student_id, status')
      .in('student_id', studentIds);

    if (error || !data) return;
    const byStudent = new Map<string, string[]>();
    for (const row of data) {
      if (!row.student_id) continue;
      const list = byStudent.get(row.student_id) ?? [];
      list.push(row.status);
      byStudent.set(row.student_id, list);
    }
    const map = new Map<string, string>();
    byStudent.forEach((statuses, id) => {
      const best = mostAdvancedStatus(statuses);
      if (best) map.set(id, best);
    });
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
    return threads.map((th: MessageThread) => {
      const channel = toChannelId(th.source);
      const assignee = th.assigned_to ?? null;
      const last = th.lastMessage;
      const name = th.sender_name?.trim() || channelHandle(channel, th.sender_id, th.sender_name);

      return {
        threadId: th.id,
        channel,
        senderId: th.sender_id,
        name,
        initials: initialsOf(name, channel === 'telegram' ? 'TG' : channel === 'instagram' ? 'IG' : 'HK'),
        avatarUrl: th.sender_avatar,
        handle: channelHandle(channel, th.sender_id, th.sender_name),
        studentId: th.student_id,
        stage: t(stageLabelKey(th.student_id, th.student_id ? stages.get(th.student_id) : null)),
        preview: previewFor(last, t),
        lastAt: th.last_message_at,
        // Nothing is "waiting" once the operator has replied, so an outbound
        // last message resets the SLA clock to zero.
        waitingMinutes: last?.direction === 'incoming' ? minutesSince(th.last_message_at, now) : 0,
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
