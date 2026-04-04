import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceNotification } from '@/hooks/useVoiceNotification';

export interface Mention {
  id: string;
  mentioned_user_id: string;
  mentioned_by: string;
  context_type: string;
  context_id: string;
  content_preview: string | null;
  created_at: string;
  read_at: string | null;
  mentioner?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface MentionNotificationsContextType {
  mentions: Mention[];
  loading: boolean;
  unreadCount: number;
  markAsRead: (mentionId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

const MentionNotificationsContext = createContext<MentionNotificationsContextType | undefined>(undefined);

export function MentionNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const { playNotificationSound } = useVoiceNotification();

  const fetchMentions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('mentions')
      .select('*')
      .eq('mentioned_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Fetch mentioner profiles
      const mentionerIds = [...new Set(data.map(m => m.mentioned_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', mentionerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const mentionsWithProfiles = data.map(mention => ({
        ...mention,
        mentioner: profileMap.get(mention.mentioned_by) || { full_name: 'Unknown', avatar_url: null }
      }));

      setMentions(mentionsWithProfiles);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  // Subscribe to realtime updates for new mentions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`mentions_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mentions',
          filter: `mentioned_user_id=eq.${user.id}`
        },
        async (payload) => {
          const newMention = payload.new as Mention;
          
          // Fetch mentioner profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .eq('user_id', newMention.mentioned_by)
            .single();

          const mentionWithProfile = {
            ...newMention,
            mentioner: profile || { full_name: 'Unknown', avatar_url: null }
          };

          setMentions(prev => [mentionWithProfile, ...prev]);
          
          // Play notification sound
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playNotificationSound]);

  const markAsRead = async (mentionId: string) => {
    const { error } = await supabase
      .from('mentions')
      .update({ read_at: new Date().toISOString() })
      .eq('id', mentionId);

    if (!error) {
      setMentions(prev =>
        prev.map(m =>
          m.id === mentionId ? { ...m, read_at: new Date().toISOString() } : m
        )
      );
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('mentions')
      .update({ read_at: new Date().toISOString() })
      .eq('mentioned_user_id', user.id)
      .is('read_at', null);

    if (!error) {
      setMentions(prev =>
        prev.map(m => ({ ...m, read_at: m.read_at || new Date().toISOString() }))
      );
    }
  };

  const unreadCount = mentions.filter(m => !m.read_at).length;

  return (
    <MentionNotificationsContext.Provider value={{
      mentions,
      loading,
      unreadCount,
      markAsRead,
      markAllAsRead,
      refetch: fetchMentions,
    }}>
      {children}
    </MentionNotificationsContext.Provider>
  );
}

export function useMentionNotificationsContext() {
  const context = useContext(MentionNotificationsContext);
  if (context === undefined) {
    throw new Error('useMentionNotificationsContext must be used within a MentionNotificationsProvider');
  }
  return context;
}
