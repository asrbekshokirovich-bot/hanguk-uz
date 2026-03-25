import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UniversityRoom {
  id: string;
  university_id: string;
  is_active: boolean;
  created_at: string;
}

export interface RoomChannel {
  id: string;
  room_id: string;
  channel_type: 'discussion' | 'announcement';
  name_uz: string;
  name_en: string | null;
  name_ru: string | null;
  name_ko: string | null;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useUniversityRoom(universityId: string | null) {
  const { user } = useAuth();
  const [room, setRoom] = useState<UniversityRoom | null>(null);
  const [channels, setChannels] = useState<RoomChannel[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!universityId || !user) {
      setLoading(false);
      return;
    }

    const fetchRoomData = async () => {
      setLoading(true);

      // Fetch room
      const { data: roomData, error: roomError } = await supabase
        .from('university_rooms')
        .select('*')
        .eq('university_id', universityId)
        .eq('is_active', true)
        .single();

      if (roomError || !roomData) {
        setLoading(false);
        return;
      }

      setRoom(roomData);

      // Fetch channels
      const { data: channelsData } = await supabase
        .from('room_channels')
        .select('*')
        .eq('room_id', roomData.id)
        .order('channel_type', { ascending: true });

      if (channelsData) {
        setChannels(channelsData as RoomChannel[]);
      }

      // Check membership and fetch members
      const { data: membersData } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomData.id);

      if (membersData) {
        setMembers(membersData);
        setIsMember(membersData.some(m => m.user_id === user.id));
      }

      setLoading(false);
    };

    fetchRoomData();
  }, [universityId, user]);

  const joinRoom = async () => {
    if (!room || !user) return false;

    const { error } = await supabase
      .from('room_members')
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'student'
      });

    if (!error) {
      setIsMember(true);
      return true;
    }
    return false;
  };

  const getChannelByType = (type: 'discussion' | 'announcement') => {
    return channels.find(c => c.channel_type === type);
  };

  return {
    room,
    channels,
    members,
    loading,
    isMember,
    joinRoom,
    getChannelByType,
  };
}
