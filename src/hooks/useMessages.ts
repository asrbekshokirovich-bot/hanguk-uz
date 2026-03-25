import React, { useState, useEffect } from 'react';
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

export function useMessages() {
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
      // Batch fetch last messages for all threads (fix N+1 query)
      const senderIds = data.map(t => t.sender_id);
      const { data: allMessages } = await supabase
        .from('messages')
        .select('*')
        .in('sender_id', senderIds)
        .order('created_at', { ascending: false });

      // Group by source+sender_id, pick first (latest) message
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
      
      // Mark as read
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
      // Send to Telegram if source is telegram
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
    // Update all messages in thread
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return { error: new Error('Thread not found') };

    const { error } = await supabase
      .from('messages')
      .update({ assigned_to: userId })
      .eq('source', thread.source)
      .eq('sender_id', thread.sender_id);

    return { error };
  };

  // Track selectedThread with ref to avoid stale closure
  const selectedThreadRef = React.useRef(selectedThread);
  selectedThreadRef.current = selectedThread;

  // Real-time subscription
  useEffect(() => {
    fetchThreads();

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          fetchThreads();
          if (selectedThreadRef.current) {
            fetchMessages(selectedThreadRef.current);
          }
        }
      )
      .subscribe();

    return () => {
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

  return {
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
  };
}
