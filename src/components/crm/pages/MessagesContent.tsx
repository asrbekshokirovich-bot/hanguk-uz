import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const { conversations, loading, refreshAssignments } = useMessagesQueue();

  const [tab, setTab] = useState<QueueTab>('unassigned');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [sending, setSending] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  const visible = useMemo(
    () => sortConversations(filterConversations(conversations, tab, channel, query), tab),
    [conversations, tab, channel, query],
  );

  // The selection is held as an id, never as a snapshot, so a claim or a new
  // inbound message re-derives the active row instead of showing stale state.
  const activeId = visible.some((c) => c.threadId === selectedId) ? selectedId : visible[0]?.threadId ?? null;
  const active = useMemo<ConversationVM | null>(
    () => conversations.find((c) => c.threadId === activeId) ?? null,
    [conversations, activeId],
  );

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

  const threadMessages = useThreadMessages(messages);
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
      await refreshAssignments();
      setTab('mine');
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
    async (text: string, options: { internal: boolean; language: SendLanguage }) => {
      if (!active || !selectedThread || sending) return;
      setSending(true);

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
          toast({
            title: t('common.error'),
            description: t('messages.toast.noteFailed'),
            variant: 'destructive',
          });
        } else {
          await fetchMessages(selectedThread);
          await fetchThreads();
        }
        setSending(false);
        return;
      }

      const { error } = await sendMessage(text, selectedThread.source, selectedThread.sender_id);
      if (error) {
        toast({
          title: t('common.error'),
          description: error.message || t('messages.toast.sendFailed'),
          variant: 'destructive',
        });
        setSending(false);
        return;
      }

      // Replying takes ownership of a conversation nobody had claimed yet.
      if (!active.isAssigned && user) {
        await assignThread(active.threadId, user.id);
        await refreshAssignments();
      }
      await fetchThreads();
      setSending(false);
    },
    [
      active,
      selectedThread,
      sending,
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
          onTabChange={setTab}
          onChannelChange={setChannel}
          onQueryChange={setQuery}
          onSelect={handleSelect}
        />

        {active ? (
          <>
            <ThreadPane
              conversation={active}
              messages={threadMessages}
              autoTranslate={autoTranslate}
              contextOpen={contextOpen}
              claiming={claiming}
              sending={sending}
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
