import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { useToast } from '@/hooks/use-toast';
import { MessagesQueue } from '@/components/crm/messages/MessagesQueue';
import { QueueClearState } from '@/components/crm/messages/QueueClearState';
import { StudentContextRail } from '@/components/crm/messages/StudentContextRail';
import { ThreadPane } from '@/components/crm/messages/ThreadPane';
import { filterConversations, sortConversations } from '@/components/crm/messages/queueLogic';
import { useMessagesQueue } from '@/components/crm/messages/useMessagesQueue';
import { useStudentContext } from '@/components/crm/messages/useStudentContext';
import { useThreadMessages } from '@/components/crm/messages/useThreadMessages';
import { useThreadTranslation } from '@/components/crm/messages/useThreadTranslation';
import { translateMessage } from '@/components/crm/messages/translateMessage';
import type {
  ChannelFilter,
  ConversationVM,
  MessageVM,
  QueueTab,
  SendLanguage,
} from '@/components/crm/messages/types';

/**
 * CRM → Messages: a shared-queue inbox for call operators.
 *
 * Three panes inside the CRM shell — queue, thread, student context — over the
 * existing `message_threads` / `messages` tables. This file is orchestration
 * only: filtering lives in `messages/queueLogic`, the Supabase adapters in the
 * `messages/use*` hooks, and every pixel in the `messages/*` components.
 *
 * Channels: Telegram, Instagram and the Hanguk App in-app chat. Only the first
 * two currently have ingest and relay paths (`telegram-webhook`,
 * `instagram-webhook`, `send-telegram`, `send-instagram`); the app channel
 * renders correctly but no producer writes `source = 'app'` yet.
 */
/** An outbound message shown before the server has confirmed it. */
interface PendingMessage {
  id: string;
  threadId: string;
  text: string;
  internal: boolean;
  createdAt: string;
}

export default function MessagesContent() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    threads,
    messages,
    selectedThread,
    setSelectedThread,
    sendMessage,
    archiveThread,
    assignThread,
    fetchThreads,
    fetchMessages,
  } = useMessages();

  // Opening a thread marks it read in the database (MessagesContext.fetchMessages
  // zeroes `message_threads.unread_count`), but the local `threads` array is not
  // refetched, so the badge would sit there stale until the next realtime INSERT.
  // Tracking what this operator has opened clears it immediately.
  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => new Set());
  const { conversations, loading, refreshAssignments } = useMessagesQueue(locallyRead);

  const [tab, setTab] = useState<QueueTab>('unassigned');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const optimisticSeq = useRef(0);

  const filtered = useMemo(
    () => sortConversations(filterConversations(conversations, tab, channel, query), tab),
    [conversations, tab, channel, query],
  );

  // The selection is held as an id, never as a snapshot, so a claim or a new
  // inbound message re-derives the active row instead of showing stale state.
  //
  // It is deliberately sticky against the FULL conversation list rather than
  // the filtered one. Replying auto-assigns the thread, which drops it out of
  // the Unassigned tab — matching against `filtered` here would yank the
  // operator to the top of the queue mid-conversation, right after they sent
  // a message. The thread stays open until they pick another one.
  const activeId =
    selectedId && conversations.some((c) => c.threadId === selectedId)
      ? selectedId
      : filtered[0]?.threadId ?? null;
  const active = useMemo<ConversationVM | null>(
    () => conversations.find((c) => c.threadId === activeId) ?? null,
    [conversations, activeId],
  );

  // ...and the open thread stays pinned in the list, so the row the operator
  // is looking at never vanishes from under them either.
  const visible = useMemo(() => {
    if (!active || filtered.some((c) => c.threadId === active.threadId)) return filtered;
    return [active, ...filtered];
  }, [filtered, active]);

  // Changing a filter is an explicit "show me something else", so the sticky
  // selection is released and the first row of the new list opens.
  const changeTab = useCallback((next: QueueTab) => {
    setTab(next);
    setSelectedId(null);
  }, []);
  const changeChannel = useCallback((next: ChannelFilter) => {
    setChannel(next);
    setSelectedId(null);
  }, []);

  // Mirror the local selection into MessagesContext, which owns the message
  // fetch. Guarded on id so a refetched `threads` array cannot loop.
  useEffect(() => {
    if (!activeId) {
      if (selectedThread) setSelectedThread(null);
      return;
    }
    if (selectedThread?.id === activeId) return;
    const thread = threads.find((th) => th.id === activeId);
    if (thread) setSelectedThread(thread);
  }, [activeId, threads, selectedThread, setSelectedThread]);

  // Whatever is open counts as read for this operator, from the moment it opens.
  useEffect(() => {
    if (!activeId) return;
    setLocallyRead((prev) => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
  }, [activeId]);

  // MessagesContext refetches the stream asynchronously after the selection
  // changes, so for a moment `messages` still holds the PREVIOUS thread.
  // Rendering that would show one student's conversation under another
  // student's name, so the stream is treated as loading until the rows match
  // the open thread. An empty array is a genuinely empty thread, not staleness.
  const streamMatchesActive =
    !active || messages.length === 0 || messages[0]?.sender_id === active.senderId;
  const activeMessages = useMemo(
    () => (streamMatchesActive ? messages : []),
    [streamMatchesActive, messages],
  );

  const confirmedMessages = useThreadMessages(activeMessages);

  // Retire an optimistic bubble as soon as the real row for it comes back.
  useEffect(() => {
    if (pending.length === 0) return;
    const landed = new Set(
      confirmedMessages.filter((m) => m.kind === 'out' || m.kind === 'note').map((m) => m.text),
    );
    setPending((prev) => prev.filter((p) => !landed.has(p.text)));
  }, [confirmedMessages, pending.length]);

  const threadMessages = useMemo<MessageVM[]>(() => {
    const mine = pending.filter((p) => p.threadId === activeId);
    if (mine.length === 0) return confirmedMessages;
    return [
      ...confirmedMessages,
      ...mine.map<MessageVM>((p) => ({
        id: p.id,
        kind: p.internal ? 'note' : 'out',
        text: p.text,
        createdAt: p.createdAt,
        senderLabel: null,
        deliveryStatus: null,
        translation: null,
        translatable: false,
        media: null,
        pending: true,
      })),
    ];
  }, [confirmedMessages, pending, activeId]);
  const { autoTranslate, toggleAuto, isExpanded, toggleMessage } = useThreadTranslation(activeId);
  const { student, loading: studentLoading } = useStudentContext(active?.studentId ?? null);

  const handleSelect = useCallback((conversation: ConversationVM) => {
    setSelectedId(conversation.threadId);
  }, []);

  const handleClaim = useCallback(async () => {
    if (!active || !user || claiming) return;
    setClaiming(true);
    const { error } = await assignThread(active.threadId, user.id);
    if (error) {
      toast({
        title: t('common.error'),
        description: t('messages.toast.claimFailed'),
        variant: 'destructive',
      });
    } else {
      // No automatic tab switch: the thread stays pinned and open where the
      // operator is already looking. Jumping them to another tab mid-read was
      // the same disorientation as the post-send jump.
      await refreshAssignments();
    }
    setClaiming(false);
  }, [active, user, claiming, assignThread, refreshAssignments, toast, t]);

  const handleMarkDone = useCallback(async () => {
    if (!active) return;
    const { error } = await archiveThread(active.threadId);
    if (error) {
      toast({
        title: t('common.error'),
        description: t('messages.toast.doneFailed'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: t('messages.toast.doneTitle'), description: t('messages.toast.doneBody') });
    setSelectedId(null);
  }, [active, archiveThread, toast, t]);

  const handleSend = useCallback(
    async (text: string, options: { internal: boolean; language: SendLanguage }): Promise<boolean> => {
      if (!active || !selectedThread) return false;

      // Show the bubble immediately. Everything below — the insert, the
      // Telegram/Instagram relay, the assignment write and the refetches — is
      // several seconds of round trips, and the operator should not be staring
      // at a frozen composer for any of it.
      const optimisticId = `pending-${optimisticSeq.current++}`;
      const optimistic: PendingMessage = {
        id: optimisticId,
        threadId: active.threadId,
        text,
        internal: options.internal,
        createdAt: new Date().toISOString(),
      };
      setPending((prev) => [...prev, optimistic]);

      const dropOptimistic = () =>
        setPending((prev) => prev.filter((p) => p.id !== optimisticId));

      if (options.internal) {
        // Internal notes are stored on the thread but never relayed to the
        // channel, so they bypass MessagesContext.sendMessage entirely.
        const { error } = await supabase.from('messages').insert({
          source: selectedThread.source,
          sender_id: selectedThread.sender_id,
          student_id: selectedThread.student_id,
          content: text,
          direction: 'outgoing',
          message_type: 'note',
          status: 'read',
          metadata: { internal: true },
          replied_by: user?.id ?? null,
          replied_at: new Date().toISOString(),
        });
        if (error) {
          dropOptimistic();
          toast({
            title: t('common.error'),
            description: t('messages.toast.noteFailed'),
            variant: 'destructive',
          });
          return false;
        }
        void fetchMessages(selectedThread);
        return true;
      }

      const { error } = await sendMessage(text, selectedThread.source, selectedThread.sender_id);
      if (error) {
        dropOptimistic();
        toast({
          title: t('common.error'),
          description: error.message || t('messages.toast.sendFailed'),
          variant: 'destructive',
        });
        return false;
      }

      // Replying takes ownership of a conversation nobody had claimed yet.
      // Deliberately not awaited: the message is already delivered and on
      // screen, so the bookkeeping must not hold the composer hostage.
      if (!active.isAssigned && user) {
        void assignThread(active.threadId, user.id).then(() => refreshAssignments());
      }
      void fetchThreads();
      return true;
    },
    [
      active,
      selectedThread,
      sendMessage,
      assignThread,
      refreshAssignments,
      fetchThreads,
      fetchMessages,
      user,
      toast,
      t,
    ],
  );

  const handleToggleTranslation = useCallback(
    async (message: MessageVM, expanded: boolean) => {
      if (message.translation) {
        toggleMessage(message.id, expanded);
        return;
      }
      setTranslatingId(message.id);
      const result = await translateMessage({
        messageId: message.id,
        text: message.text,
        targetLang: 'English',
      });
      setTranslatingId(null);
      if (!result) {
        toast({
          title: t('messages.toast.translationUnavailableTitle'),
          description: t('messages.toast.translationUnavailableBody'),
        });
      }
    },
    [toggleMessage, toast, t],
  );

  const unassignedCount = conversations.filter((c) => !c.isAssigned && !c.isDone).length;
  const mineCount = conversations.filter((c) => c.isMine && !c.isDone).length;

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[520px] flex-col">
      <p className="mb-3 shrink-0 text-xs text-muted-foreground">
        {t('messages.header.summary', { unassigned: unassignedCount, mine: mineCount })}
      </p>

      <div className="flex min-h-0 flex-1 overflow-x-auto rounded-lg border border-border">
        <MessagesQueue
          conversations={conversations}
          visible={visible}
          selectedThreadId={activeId}
          loading={loading}
          tab={tab}
          channel={channel}
          query={query}
          onTabChange={changeTab}
          onChannelChange={changeChannel}
          onQueryChange={setQuery}
          onSelect={handleSelect}
        />

        {active ? (
          <>
            <ThreadPane
              conversation={active}
              messages={threadMessages}
              messagesLoading={!streamMatchesActive}
              autoTranslate={autoTranslate}
              contextOpen={contextOpen}
              claiming={claiming}
              translatingId={translatingId}
              isExpanded={isExpanded}
              onToggleTranslation={handleToggleTranslation}
              onToggleAutoTranslate={toggleAuto}
              onToggleContext={() => setContextOpen((v) => !v)}
              onClaim={handleClaim}
              onMarkDone={handleMarkDone}
              onSend={handleSend}
            />
            {contextOpen && (
              <StudentContextRail conversation={active} student={student} loading={studentLoading} />
            )}
          </>
        ) : (
          <section className="flex min-w-[520px] flex-1 flex-col bg-background">
            <QueueClearState
              onGoToUnassigned={() => {
                setTab('unassigned');
                setChannel('all');
                setQuery('');
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
