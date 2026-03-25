import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UniversityAnnouncement {
  id: string;
  room_id: string;
  posted_by: string;
  title: string;
  content: string;
  priority: string;
  attachment_url: string | null;
  attachment_name: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  poster_name?: string | null;
}

export function useUniversityAnnouncements(roomId: string | null) {
  const [announcements, setAnnouncements] = useState<UniversityAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const fetchAnnouncements = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('university_announcements')
        .select('*')
        .eq('room_id', roomId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Fetch poster names
        const posterIds = [...new Set(data.map(a => a.posted_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', posterIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        setAnnouncements(data.map(a => ({
          ...a,
          poster_name: profileMap.get(a.posted_by) || null,
        })));
      }
      setLoading(false);
    };

    fetchAnnouncements();

    // Subscribe to realtime
    const channel = supabase
      .channel(`announcements-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'university_announcements',
        filter: `room_id=eq.${roomId}`,
      }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const createAnnouncement = async (data: {
    title: string;
    content: string;
    priority?: string;
    is_pinned?: boolean;
    attachment_url?: string;
    attachment_name?: string;
  }) => {
    if (!roomId) return false;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { error } = await supabase
      .from('university_announcements')
      .insert({
        room_id: roomId,
        posted_by: userData.user.id,
        title: data.title,
        content: data.content,
        priority: data.priority || 'normal',
        is_pinned: data.is_pinned || false,
        attachment_url: data.attachment_url || null,
        attachment_name: data.attachment_name || null,
      });

    return !error;
  };

  return { announcements, loading, createAnnouncement };
}
