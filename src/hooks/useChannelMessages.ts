import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffMentions } from '@/hooks/useStaffMentions';
import { extractMentions, getContentPreview, getUniqueMentionedUserIds } from '@/lib/mentionParser';
import { createMention } from '@/hooks/useMentionNotifications';

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
  updated_at: string;
  sender?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useChannelMessages(channelId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { staffList } = useStaffMentions();

  const fetchMessages = useCallback(async () => {
    if (!channelId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const { data, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Fetch sender profiles separately
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithSenders = data.map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || { full_name: 'Unknown', avatar_url: null }
      }));

      setMessages(messagesWithSenders);
    }
    
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`channel_messages_${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          const newMessage = payload.new as ChannelMessage;
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .eq('user_id', newMessage.sender_id)
            .single();

          const messageWithSender = {
            ...newMessage,
            sender: profile || { full_name: 'Unknown', avatar_url: null }
          };

          setMessages(prev => [...prev, messageWithSender]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const sendMessage = async (content: string): Promise<boolean> => {
    if (!channelId || !user || !content.trim()) return false;

    const { error, data } = await supabase
      .from('channel_messages')
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        content: content.trim(),
        message_type: 'text'
      })
      .select()
      .single();

    // Process mentions in the message
    if (!error && data) {
      const mentions = extractMentions(content, staffList);
      const mentionedUserIds = getUniqueMentionedUserIds(mentions);
      const contentPreview = getContentPreview(content);

      // Create mention records for each mentioned user
      for (const mentionedUserId of mentionedUserIds) {
        await createMention(
          mentionedUserId,
          user.id,
          'room_chat',
          data.id,
          contentPreview
        );
      }
    }

    return !error;
  };

  const deleteMessage = async (messageId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('channel_messages')
      .delete()
      .eq('id', messageId);

    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      return true;
    }
    return false;
  };

  return {
    messages,
    loading,
    sendMessage,
    deleteMessage,
    refetch: fetchMessages,
  };
}
