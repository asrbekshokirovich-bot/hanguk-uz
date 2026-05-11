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

  return { events, loading, refetch, create, remove, update };
}
