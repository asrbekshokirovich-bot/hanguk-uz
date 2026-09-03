import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  source: 'telegram' | 'instagram' | 'whatsapp' | 'manual';
  external_id: string | null;
  sender_name: string | null;
  sender_id: string | null;
  sender_avatar: string | null;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'voice';
  direction: 'incoming' | 'outgoing';
  status: 'unread' | 'read' | 'replied' | 'archived';
  student_id: string | null;
  assigned_to: string | null;
  replied_by: string | null;
  replied_at: string | null;
  metadata: any;
  created_at: string;
  /** 'sending' | 'sent' | 'failed' for outgoing rows; null on inbound/legacy. */
  delivery_status?: 'sending' | 'sent' | 'failed' | null;
  delivery_error?: string | null;
  client_msg_id?: string | null;
}

export interface MessageThread {
  id: string;
  source: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  student_id: string | null;
  last_message_at: string;
  unread_count: number;
  status: 'active' | 'archived';
  created_at: string;
  lastMessage?: Message;
  /** Latest assignee, resolved server-side by get_thread_previews. */
  assigned_to?: string | null;
}

interface MessagesContextType {
  threads: MessageThread[];
  messages: Message[];
  selectedThread: MessageThread | null;
  loading: boolean;
  hasMoreMessages: boolean;
  stats: any;
  setSelectedThread: (thread: MessageThread | null) => void;
  fetchThreads: () => Promise<void>;
  fetchMessages: (thread: MessageThread) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (
    content: string,
    source: string,
    senderId: string,
    file?: File | null,
  ) => Promise<{ error: Error | null; queued: boolean }>;
  retryMessage: (message: Message) => Promise<{ error: Error | null }>;
  appendLocalMessage: (message: Message) => void;
  archiveThread: (threadId: string) => Promise<{ error: Error | null }>;
  assignThread: (threadId: string, userId: string) => Promise<{ error: Error | null }>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

const PAGE_SIZE = 50;

const CHAT_MEDIA_BUCKET = 'chat-media';

/** Attachment already uploaded to the chat-media bucket, ready to relay. */
interface OutboundMedia {
  media_path: string;
  media_mime: string;
  media_filename: string | null;
}

type DeliveryBody = (
  senderId: string,
  text: string,
  messageId: string,
  media: OutboundMedia | null,
) => Record<string, unknown>;

/**
 * How an outbound reply reaches each channel. Both channels share one delivery
 * path so their failure handling cannot drift. The inserted row's id travels
 * as message_id so the edge function stamps delivery_status ('sent'/'failed')
 * on the exact row the operator is looking at. Media travels as the storage
 * path — the edge functions mint their own signed URLs from it.
 */
const DELIVERY_BY_SOURCE: Record<string, { fn: string; body: DeliveryBody } | undefined> = {
  telegram: {
    fn: 'send-telegram',
    body: (senderId, text, messageId, media) => ({
      chat_id: senderId,
      text,
      message_id: messageId,
      ...(media
        ? { media_path: media.media_path, media_mime: media.media_mime, media_filename: media.media_filename }
        : {}),
    }),
  },
  instagram: {
    fn: 'send-instagram',
    body: (senderId, text, messageId, media) => ({
      recipient_id: senderId,
      text,
      message_id: messageId,
      ...(media ? { media_path: media.media_path, media_mime: media.media_mime } : {}),
    }),
  },
};

/** Pull relay-ready media info back out of a stored row's metadata (for Retry). */
function mediaFromMetadata(metadata: any): OutboundMedia | null {
  const path = metadata?.media_path;
  if (!path) return null;
  return {
    media_path: String(path),
    media_mime: String(metadata?.media_mime ?? 'application/octet-stream'),
    media_filename: metadata?.media_filename ? String(metadata.media_filename) : null,
  };
}

/** Invoke a send function and return the failure, or null if it delivered. */
async function deliver(
  delivery: { fn: string; body: DeliveryBody },
  senderId: string,
  text: string,
  messageId: string,
  media: OutboundMedia | null,
): Promise<Error | null> {
  try {
    const { error } = await supabase.functions.invoke(delivery.fn, {
      body: delivery.body(senderId, text, messageId, media),
    });
    if (!error) return null;
    // A non-2xx arrives as FunctionsHttpError whose body carries the real
    // reason ("24-hour window expired", ...). Surface that, not the wrapper.
    let detail = '';
    try {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      detail = body?.error || '';
    } catch {
      // Body was not JSON — fall back to the wrapper message.
    }
    return new Error(detail || error.message || `${delivery.fn} failed`);
  } catch (thrown) {
    return thrown instanceof Error ? thrown : new Error(`${delivery.fn} failed`);
  }
}

/** Map one get_thread_previews row onto the MessageThread shape. */
function rowToThread(row: any): MessageThread {
  return {
    id: row.id,
    source: row.source,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    sender_avatar: row.sender_avatar,
    student_id: row.student_id,
    last_message_at: row.last_message_at,
    unread_count: row.unread_count ?? 0,
    status: row.status,
    created_at: row.last_message_at,
    assigned_to: row.assigned_to ?? null,
    lastMessage: row.last_created_at
      ? ({
          id: `preview-${row.id}`,
          source: row.source,
          external_id: null,
          sender_name: row.sender_name,
          sender_id: row.sender_id,
          sender_avatar: null,
          content: row.last_content ?? '',
          message_type: row.last_message_type ?? 'text',
          direction: row.last_direction ?? 'incoming',
          status: 'read',
          student_id: row.student_id,
          assigned_to: null,
          replied_by: null,
          replied_at: null,
          metadata: row.last_metadata ?? null,
          created_at: row.last_created_at,
          delivery_status: row.last_delivery_status ?? null,
        } as Message)
      : undefined,
  };
}

function sortThreads(list: MessageThread[]): MessageThread[] {
  return [...list].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  );
}

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const loadingOlder = useRef(false);

  const selectedThreadRef = useRef(selectedThread);
  selectedThreadRef.current = selectedThread;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  /**
   * One RPC returns every thread with its preview and latest assignee —
   * previously this was two unbounded queries (all threads + ALL messages).
   */
  const fetchThreads = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)('get_thread_previews');
    if (error) {
      // An inbox that failed to load and an inbox with nothing in it look
      // identical on screen. This error was read by nothing at all; at minimum
      // it belongs in the console so "where are my conversations" has an
      // answer.
      console.error('get_thread_previews failed', error);
    } else if (data) {
      setThreads((data as any[]).map(rowToThread));
    }
    setLoading(false);
  }, []);

  /** Latest page only — older pages stream in via loadOlderMessages. */
  const fetchMessages = useCallback(async (thread: MessageThread) => {
    const { data, error } = await (supabase.rpc as any)('get_thread_messages', {
      p_source: thread.source,
      p_sender_id: thread.sender_id,
      p_limit: PAGE_SIZE,
    });
    if (error) {
      console.error('get_thread_messages failed', error);
      return;
    }
    if (!data) return;
    // A slower response for a thread the operator has already left must not
    // overwrite the stream they are looking at now.
    const current = selectedThreadRef.current;
    if (current && current.id !== thread.id) return;

    const page = (data as Message[]).slice().reverse();
    setMessages(page);
    setHasMoreMessages((data as any[]).length === PAGE_SIZE);

    // Mark-read bookkeeping must never block rendering the stream, but it must
    // not vanish either. This was two independent updates with their results
    // thrown away, which is how `messages.status` and the thread's counter
    // drifted twenty-fold apart without anyone seeing an error. One RPC does
    // both, and a failure at least reaches the console instead of nowhere.
    void (supabase.rpc as any)('mark_thread_read', {
      p_source: thread.source,
      p_sender_id: thread.sender_id,
    }).then(({ error }: { error: unknown }) => {
      if (error) console.error('mark_thread_read failed', error);
    });
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t)));
  }, []);

  /** Keyset pagination: everything strictly older than the oldest loaded row. */
  const loadOlderMessages = useCallback(async () => {
    const thread = selectedThreadRef.current;
    const oldest = messagesRef.current[0];
    if (!thread || !oldest || loadingOlder.current) return;
    loadingOlder.current = true;
    try {
      const { data, error } = await (supabase.rpc as any)('get_thread_messages', {
        p_source: thread.source,
        p_sender_id: thread.sender_id,
        p_before: oldest.created_at,
        p_before_id: oldest.id,
        p_limit: PAGE_SIZE,
      });
      if (!error && data) {
        const page = (data as Message[]).slice().reverse();
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...page.filter((m) => !ids.has(m.id)), ...prev];
        });
        setHasMoreMessages((data as any[]).length === PAGE_SIZE);
      }
    } finally {
      loadingOlder.current = false;
    }
  }, []);

  /** Insert or replace a message row in the open stream (dedupes by id). */
  const upsertMessageRow = useCallback((row: Message) => {
    const sel = selectedThreadRef.current;
    if (!sel || row.source !== sel.source || row.sender_id !== sel.sender_id) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === row.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...row };
        return next;
      }
      const next = [...prev, row];
      next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return next;
    });
  }, []);

  /** Reflect a new/changed message in the thread list without refetching. */
  const bumpThreadPreview = useCallback(
    (row: Message) => {
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.source === row.source && t.sender_id === row.sender_id);
        if (idx < 0) {
          // Unknown thread — a brand-new conversation. Refresh the list once.
          void fetchThreads();
          return prev;
        }
        const t = prev[idx];
        const isNewer =
          !t.lastMessage || new Date(row.created_at).getTime() >= new Date(t.lastMessage.created_at).getTime();
        if (!isNewer) return prev;
        const next = [...prev];
        next[idx] = {
          ...t,
          lastMessage: row,
          last_message_at:
            new Date(row.created_at).getTime() > new Date(t.last_message_at).getTime()
              ? row.created_at
              : t.last_message_at,
        };
        return sortThreads(next);
      });
    },
    [fetchThreads],
  );

  /** Used by the internal-notes write path so a note appears instantly. */
  const appendLocalMessage = useCallback(
    (row: Message) => {
      upsertMessageRow(row);
      bumpThreadPreview(row);
    },
    [upsertMessageRow, bumpThreadPreview],
  );

  const markRowFailed = useCallback(async (id: string, detail: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, delivery_status: 'failed', delivery_error: detail } : m)),
    );
    // The edge function usually stamps this itself; this covers the invoke
    // never reaching it (network drop, timeouts).
    await supabase
      .from('messages')
      .update({ delivery_status: 'failed', delivery_error: detail.slice(0, 500) } as any)
      .eq('id', id)
      .is('external_id', null);
  }, []);

  /**
   * Telegram-style sending: the row is inserted as delivery_status='sending'
   * and shown immediately; the edge function (or the userbot, via DB triggers)
   * flips it to 'sent' or 'failed', which arrives back as a realtime UPDATE
   * and turns the clock into a tick. A failed bubble STAYS in the stream with
   * its error and a Retry — it is never silently deleted.
   *
   * Attachments upload to the private chat-media bucket FIRST, so a failed
   * upload costs nothing — no orphan bubble, the composer keeps the draft.
   * The row then carries media_path/media_mime/... in metadata, which is both
   * what MessageAttachment renders from and what Retry re-delivers from.
   */
  const sendMessage = useCallback(
    async (content: string, source: string, senderId: string, file?: File | null) => {
      if (!user) return { error: new Error('Not authenticated'), queued: false };

      let media: OutboundMedia | null = null;
      let mediaMeta: Record<string, unknown> | null = null;
      if (file) {
        const safeName = (file.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
        const path = `outgoing/${senderId || 'unknown'}/${Date.now()}-${safeName}`;
        const mime = file.type || 'application/octet-stream';
        const { error: uploadError } = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(path, file, { contentType: mime });
        if (uploadError) {
          return { error: new Error(uploadError.message), queued: false };
        }
        media = { media_path: path, media_mime: mime, media_filename: file.name || null };
        mediaMeta = {
          media_path: path,
          media_mime: mime,
          media_size: file.size,
          media_filename: file.name || null,
        };
      }

      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          source,
          sender_id: senderId,
          content,
          direction: 'outgoing',
          status: 'replied',
          replied_by: user.id,
          replied_at: new Date().toISOString(),
          delivery_status: 'sending',
          client_msg_id: crypto.randomUUID(),
          ...(media
            ? {
                message_type: media.media_mime.startsWith('image/') ? 'image' : 'file',
                metadata: mediaMeta,
              }
            : {}),
        } as any)
        .select('*')
        .single();

      if (error || !inserted) {
        return { error: error ? new Error(error.message) : new Error('Failed to save message'), queued: false };
      }

      const row = inserted as unknown as Message;
      upsertMessageRow(row);
      bumpThreadPreview(row);

      const delivery = DELIVERY_BY_SOURCE[source];
      let sendError: Error | null = null;
      if (delivery && senderId) {
        sendError = await deliver(delivery, senderId, content, row.id, media);
        if (sendError) {
          console.error(`Failed to send ${source} message:`, sendError);
          await markRowFailed(row.id, sendError.message);
        }
      }
      return { error: sendError, queued: true };
    },
    [user, upsertMessageRow, bumpThreadPreview, markRowFailed],
  );

  /** Re-deliver a failed row. Same id, same content — no retyping, no duplicate. */
  const retryMessage = useCallback(
    async (message: Message) => {
      const delivery = DELIVERY_BY_SOURCE[message.source];
      if (!delivery || !message.sender_id) return { error: new Error('Unsupported channel') };
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, delivery_status: 'sending', delivery_error: null } : m)),
      );
      await supabase
        .from('messages')
        .update({ delivery_status: 'sending', delivery_error: null } as any)
        .eq('id', message.id)
        .is('external_id', null);
      const err = await deliver(
        delivery,
        message.sender_id,
        message.content,
        message.id,
        mediaFromMetadata(message.metadata),
      );
      if (err) await markRowFailed(message.id, err.message);
      return { error: err };
    },
    [markRowFailed],
  );

  const archiveThread = useCallback(async (threadId: string) => {
    const { error } = await supabase.from('message_threads').update({ status: 'archived' }).eq('id', threadId);
    if (!error) {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, status: 'archived' as const } : t)));
    }
    return { error };
  }, []);

  const assignThread = useCallback(
    async (threadId: string, userId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return { error: new Error('Thread not found') };
      // One row. This used to stamp `assigned_to` onto every message in the
      // conversation — hundreds of UPDATEs for one click on Claim, every one of
      // them broadcast to every open CRM tab through realtime. The assignee is
      // a fact about the thread, and now lives on it.
      const { error } = await supabase
        .from('message_threads')
        .update({ assigned_to: userId, assigned_at: new Date().toISOString() })
        .eq('id', threadId);
      if (!error) {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, assigned_to: userId } : t)));
      }
      return { error };
    },
    [threads],
  );

  const fetchThreadsRef = useRef(fetchThreads);
  fetchThreadsRef.current = fetchThreads;
  const upsertRef = useRef(upsertMessageRow);
  upsertRef.current = upsertMessageRow;
  const bumpRef = useRef(bumpThreadPreview);
  bumpRef.current = bumpThreadPreview;

  useEffect(() => {
    fetchThreadsRef.current();

    // Realtime, applied IN PLACE. The old subscription refetched the entire
    // thread list and stream (with an 800ms debounce) on every INSERT — that
    // full-reload cascade was why the inbox never felt like a messenger.
    const channel = supabase
      .channel('messages-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Message;
        upsertRef.current(row);
        bumpRef.current(row);
        const sel = selectedThreadRef.current;
        if (
          sel &&
          row.source === sel.source &&
          row.sender_id === sel.sender_id &&
          row.direction === 'incoming'
        ) {
          // The operator is looking at this thread, so it is read on arrival.
          void (supabase.rpc as any)('mark_thread_read', {
            p_source: sel.source,
            p_sender_id: sel.sender_id,
          }).then(({ error }: { error: unknown }) => {
            if (error) console.error('mark_thread_read failed', error);
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Message;
        upsertRef.current(row); // delivery ticks flip here
        // Keep the preview's tick in sync when the last message settles.
        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.source === row.source && t.sender_id === row.sender_id);
          if (idx < 0) return prev;
          const t = prev[idx];
          if (!t.lastMessage || new Date(t.lastMessage.created_at).getTime() > new Date(row.created_at).getTime()) {
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...t, lastMessage: { ...t.lastMessage, ...row } };
          return next;
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const oldId = (payload.old as { id?: string })?.id;
        if (oldId) setMessages((prev) => prev.filter((m) => m.id !== oldId));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_threads' }, () => {
        void fetchThreadsRef.current();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_threads' }, (payload) => {
        const row = payload.new as any;
        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.id === row.id);
          if (idx < 0) {
            void fetchThreadsRef.current();
            return prev;
          }
          const sel = selectedThreadRef.current;
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            last_message_at: row.last_message_at ?? next[idx].last_message_at,
            // The open thread reads as zero locally even if the server count
            // ticked up before our mark-read write landed.
            unread_count: sel?.id === row.id ? 0 : row.unread_count ?? next[idx].unread_count,
            status: row.status ?? next[idx].status,
            sender_name: row.sender_name ?? next[idx].sender_name,
            sender_avatar: row.sender_avatar ?? next[idx].sender_avatar,
            student_id: row.student_id ?? next[idx].student_id,
          };
          return sortThreads(next);
        });
      })
      .subscribe((status) => {
        // Without this the realtime channel could drop and the inbox would
        // simply stop updating — no error, no indicator, messages arriving
        // that nobody sees until the page is reloaded.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`messages realtime channel ${status} — refreshing`);
          void fetchThreadsRef.current();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread);
    } else {
      setMessages([]);
      setHasMoreMessages(false);
    }
  }, [selectedThread, fetchMessages]);

  const stats = {
    total: threads.length,
    unread: threads.reduce((acc, t) => acc + t.unread_count, 0),
    telegram: threads.filter((t) => t.source === 'telegram').length,
    instagram: threads.filter((t) => t.source === 'instagram').length,
  };

  return (
    <MessagesContext.Provider
      value={{
        threads,
        messages,
        selectedThread,
        loading,
        hasMoreMessages,
        stats,
        setSelectedThread,
        fetchThreads,
        fetchMessages,
        loadOlderMessages,
        sendMessage,
        retryMessage,
        appendLocalMessage,
        archiveThread,
        assignThread,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessagesContext() {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessagesContext must be used within a MessagesProvider');
  }
  return context;
}
