/**
 * Phase 3R-B (2026-05-10) — neutered. The `public.university_announcements`
 * table was dropped (always empty per the prompt cleanup scope). Hook
 * keeps its public shape so existing call sites compile, but returns an
 * empty list synchronously and no-ops on writes.
 *
 * Re-implement against `public.announcements` + announcement_sources
 * (uni_db) when the staff-rooms feature is rebuilt in Phase 3R-C.
 */

import { useState, useCallback } from 'react';

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

export function useUniversityAnnouncements(_roomId: string | null) {
  const [announcements] = useState<UniversityAnnouncement[]>([]);
  const loading = false;

  const refetch = useCallback(async () => {
    // legacy table dropped; nothing to fetch.
  }, []);

  const create = useCallback(
    async (_payload: Partial<UniversityAnnouncement>) => {
      throw new Error('university_announcements is retired. Phase 3R-C will reroute writes to public.announcements.');
    },
    [],
  );

  const remove = useCallback(async (_id: string) => {
    throw new Error('university_announcements is retired.');
  }, []);

  return { announcements, loading, refetch, create, remove };
}
