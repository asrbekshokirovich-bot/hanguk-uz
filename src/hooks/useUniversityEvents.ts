/**
 * Phase 3R-B (2026-05-10) — neutered. The `public.university_events`
 * table was dropped (always empty per audit cleanup scope). Hook keeps
 * its public shape so call sites compile, but returns an empty list
 * synchronously and no-ops on writes.
 *
 * Re-implement against the uni_db `cycle_dates` table (which already
 * powers VerifiedDeadlinesOverlay in the Flutter app) when Phase 3R-C
 * rebuilds the staff-rooms calendar.
 */

import { useState, useCallback } from 'react';

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
  is_all_day?: boolean;
  location: string | null;
  attendees: string[] | null;
  posted_by: string;
  is_recurring: boolean;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  poster_name?: string | null;
}

export function useUniversityEvents(_roomId: string | null) {
  const [events] = useState<UniversityEvent[]>([]);
  const loading = false;

  const refetch = useCallback(async () => {
    // table retired
  }, []);

  const create = useCallback(async (_payload: Partial<UniversityEvent>) => {
    throw new Error('university_events is retired. Phase 3R-C will reroute writes to cycle_dates.');
  }, []);

  const remove = useCallback(async (_id: string) => {
    throw new Error('university_events is retired.');
  }, []);

  const update = useCallback(async (_id: string, _payload: Partial<UniversityEvent>) => {
    throw new Error('university_events is retired.');
  }, []);

  // Read helpers the calendar still calls. They work on the (always empty)
  // list, so the Taqvim tab renders its empty state instead of crashing.
  const getEventsForDate = useCallback((date: Date): UniversityEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.event_date.split('T')[0] === dateStr);
  }, [events]);

  const getUpcomingEvents = useCallback((limit = 5): UniversityEvent[] => {
    const now = new Date();
    return events.filter(event => new Date(event.event_date) >= now).slice(0, limit);
  }, [events]);

  return {
    events,
    loading,
    refetch,
    create,
    remove,
    update,
    getEventsForDate,
    getUpcomingEvents,
    getEventTypeColor,
    getEventTypeTextColor,
  };
}

function getEventTypeColor(type: EventType): string {
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
}

function getEventTypeTextColor(type: EventType): string {
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
}
