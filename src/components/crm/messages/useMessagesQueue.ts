import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import type { MessageThread } from '@/contexts/MessagesContext';
import { channelHandle, toChannelId } from './channels';
import { initialsOf, minutesSince } from './queueLogic';
import { mostAdvancedStatus, stageLabelKey } from './stages';
import type { ConversationVM } from './types';

/**
 * Adapts the global `MessagesContext` into the shared-queue view model.
 *
 * Two facts the context does not expose are fetched here, each in a single
 * batched query:
 *
 * 1. ASSIGNMENT. `message_threads` has no `assigned_to` column, but
 *    `messages.assigned_to` does exist (and was previously written but never
 *    read). A thread counts as claimed when ANY of its messages carries an
 *    assignee — deriving it from the newest message alone would silently
 *    un-claim a thread the moment a new inbound message arrived.
 *
 * 2. STAGE. The queue row shows the student's pipeline stage, folded from
 *    `applications.status` onto the 4-step ladder in `stages.ts`.
 *
 * Both maps refresh whenever the thread list changes, so a claim made in this
 * tab (or another operator's tab, via the context's realtime subscription)
 * lands without a manual reload.
 */
export function useMessagesQueue(locallyRead: ReadonlySet<string> = new Set()) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { threads, loading } = useMessages();

  /** `${source}:${sender_id}` → assignee user id. */
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  /** `profiles.user_id` → most advanced `applications.status`. */
  const [stages, setStages] = useState<Map<string, string>>(new Map());

  const threadKey = threads.map((th) => `${th.source}:${th.sender_id}`).join('|');
  const studentKey = threads
    .map((th) => th.student_id)
    .filter((id): id is string => !!id)
    .sort()
    .join('|');

  const loadAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('source, sender_id, assigned_to')
      .not('assigned_to', 'is', null);

    if (error || !data) return;
    const map = new Map<string, string>();
    for (const row of data) {
      if (!row.sender_id || !row.assigned_to) continue;
      map.set(`${row.source}:${row.sender_id}`, row.assigned_to);
    }
    setAssignments(map);
  }, []);

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
    // threadKey changes whenever the thread list is refetched.
    void loadAssignments();
  }, [threadKey, loadAssignments]);

  useEffect(() => {
    void loadStages(studentKey ? studentKey.split('|') : []);
  }, [studentKey, loadStages]);

  const conversations = useMemo<ConversationVM[]>(() => {
    const now = Date.now();
    return threads.map((th: MessageThread) => {
      const channel = toChannelId(th.source);
      const key = `${th.source}:${th.sender_id}`;
      const assignee = assignments.get(key) ?? null;
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
        preview: last?.content?.replace(/\s+/g, ' ').trim() || '',
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
  }, [threads, assignments, stages, user?.id, t, locallyRead]);

  return { conversations, loading, refreshAssignments: loadAssignments };
}
