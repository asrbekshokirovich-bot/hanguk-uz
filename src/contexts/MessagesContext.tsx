import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
}

interface MessagesContextType {
  threads: MessageThread[];
  messages: Message[];
  selectedThread: MessageThread | null;
  loading: boolean;
  stats: any;
  setSelectedThread: (thread: MessageThread | null) => void;
  fetchThreads: () => Promise<void>;
  fetchMessages: (thread: MessageThread) => Promise<void>;
  sendMessage: (content: string, source: string, senderId: string) => Promise<{ error: Error | null }>;
  archiveThread: (threadId: string) => Promise<{ error: Error | null }>;
  assignThread: (threadId: string, userId: string) => Promise<{ error: Error | null }>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchThreads = async () => {
    const { data, error } = await supabase
      .from('message_threads')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      const senderIds = data.map(t => t.sender_id);
      const { data: allMessages } = await supabase
        .from('messages')
        .select('*')
        .in('sender_id', senderIds)
        .order('created_at', { ascending: false });

      const lastMessageMap = new Map<string, Message>();
      (allMessages || []).forEach(msg => {
        const key = `${msg.source}:${msg.sender_id}`;
        if (!lastMessageMap.has(key)) {
          lastMessageMap.set(key, msg as Message);
        }
      });

      const threadsWithMessages = data.map(thread => ({
        ...thread,
        lastMessage: lastMessageMap.get(`${thread.source}:${thread.sender_id}`) || undefined,
      }));
      setThreads(threadsWithMessages as MessageThread[]);
    }
    setLoading(false);
  };

  const fetchMessages = async (thread: MessageThread) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('source', thread.source)
      .eq('sender_id', thread.sender_id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
      
      await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('source', thread.source)
        .eq('sender_id', thread.sender_id)
        .eq('status', 'unread');

      await supabase
        .from('message_threads')
        .update({ unread_count: 0 })
        .eq('id', thread.id);
    }
  };

  const sendMessage = async (content: string, source: string, senderId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('messages')
      .insert({
        source,
        sender_id: senderId,
        content,
        direction: 'outgoing',
        status: 'replied',
        replied_by: user.id,
        replied_at: new Date().toISOString(),
      });

    if (!error) {
      if (source === 'telegram' && senderId) {
        try {
          await supabase.functions.invoke('send-telegram', {
            body: { chat_id: senderId, text: content },
          });
        } catch (telegramError) {
          console.error('Failed to send Telegram message:', telegramError);
        }
      }
      if (selectedThread) {
        await fetchMessages(selectedThread);
      }
    }
    return { error };
  };

  const archiveThread = async (threadId: string) => {
    const { error } = await supabase
      .from('message_threads')
      .update({ status: 'archived' })
      .eq('id', threadId);

    if (!error) {
      await fetchThreads();
    }
    return { error };
  };

  const assignThread = async (threadId: string, userId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return { error: new Error('Thread not found') };

    const { error } = await supabase
      .from('messages')
      .update({ assigned_to: userId })
      .eq('source', thread.source)
      .eq('sender_id', thread.sender_id);

    return { error };
  };

  const selectedThreadRef = useRef(selectedThread);
  selectedThreadRef.current = selectedThread;
  const fetchThreadsRef = useRef(fetchThreads);
  fetchThreadsRef.current = fetchThreads;
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;

  useEffect(() => {
    fetchThreadsRef.current();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('messages-changes-globalctx')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchThreadsRef.current();
            if (selectedThreadRef.current) {
              fetchMessagesRef.current(selectedThreadRef.current);
            }
          }, 800);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread);
    }
  }, [selectedThread]);

  const stats = {
    total: threads.length,
    unread: threads.reduce((acc, t) => acc + t.unread_count, 0),
    telegram: threads.filter(t => t.source === 'telegram').length,
    instagram: threads.filter(t => t.source === 'instagram').length,
  };

  return (
    <MessagesContext.Provider value={{
      threads,
      messages,
      selectedThread,
      loading,
      stats,
      setSelectedThread,
      fetchThreads,
      fetchMessages,
      sendMessage,
      archiveThread,
      assignThread,
    }}>
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
