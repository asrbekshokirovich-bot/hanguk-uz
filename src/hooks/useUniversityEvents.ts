import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type EventType = 'tuition_payment' | 'interview' | 'deadline' | 'orientation' | 'other';

export interface UniversityEvent {
  id: string;
  room_id: string;
  title_uz: string;
  title_en: string | null;
  title_ru: string | null;
  title_ko: string | null;
  description_uz: string | null;
  description_en: string | null;
  description_ru: string | null;
  description_ko: string | null;
  event_type: EventType;
  event_date: string;
  end_date: string | null;
  is_all_day: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useUniversityEvents(roomId: string | null) {
  const { user } = useAuth();
  const [events, setEvents] = useState<UniversityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('university_events')
      .select('*')
      .eq('room_id', roomId)
      .order('event_date', { ascending: true });

    if (!error && data) {
      setEvents(data as UniversityEvent[]);
    }

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getEventsForDate = (date: Date): UniversityEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = event.event_date.split('T')[0];
      return eventDate === dateStr;
    });
  };

  const getUpcomingEvents = (limit = 5): UniversityEvent[] => {
    const now = new Date();
    return events
      .filter(event => new Date(event.event_date) >= now)
      .slice(0, limit);
  };

  const getEventsByType = (type: EventType): UniversityEvent[] => {
    return events.filter(event => event.event_type === type);
  };

  const getEventTypeColor = (type: EventType): string => {
    switch (type) {
      case 'tuition_payment':
        return 'bg-red-500';
      case 'interview':
        return 'bg-blue-500';
      case 'deadline':
        return 'bg-orange-500';
      case 'orientation':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventTypeTextColor = (type: EventType): string => {
    switch (type) {
      case 'tuition_payment':
        return 'text-red-600';
      case 'interview':
        return 'text-blue-600';
      case 'deadline':
        return 'text-orange-600';
      case 'orientation':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return {
    events,
    loading,
    getEventsForDate,
    getUpcomingEvents,
    getEventsByType,
    getEventTypeColor,
    getEventTypeTextColor,
    refetch: fetchEvents,
  };
}
