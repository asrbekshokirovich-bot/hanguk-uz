import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// `cameras` / `camera_events` are not in the generated Supabase types yet —
// the migration ships in this change and types.ts is regenerated separately.
// Same `as any` escape hatch the gamification hooks use for the same reason.

export interface Camera {
  id: string;
  name: string;
  location: string | null;
  model: string | null;
  did: string | null;
  stream_key: string;
  ptz_supported: boolean;
  is_active: boolean;
}

export interface CameraEvent {
  id: string;
  camera_id: string;
  source: string;
  label: string | null;
  score: number | null;
  started_at: string;
  ended_at: string | null;
  clip_path: string | null;
  thumb_path: string | null;
  ai_summary: string | null;
}

const EVENT_PAGE_SIZE = 50;

export function useCameras() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [camerasRes, eventsRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('cameras' as any) as any)
          .select('id, name, location, model, did, stream_key, ptz_supported, is_active')
          .eq('is_active', true)
          .order('name'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('camera_events' as any) as any)
          .select('id, camera_id, source, label, score, started_at, ended_at, clip_path, thumb_path, ai_summary')
          .order('started_at', { ascending: false })
          .limit(EVENT_PAGE_SIZE),
      ]);

      if (camerasRes.error) throw camerasRes.error;
      if (eventsRes.error) throw eventsRes.error;

      setCameras((camerasRes.data || []) as Camera[]);
      setEvents((eventsRes.data || []) as CameraEvent[]);
    } catch (err) {
      // A missing table (migration not applied yet) lands here too, which is
      // why the page shows the message instead of an empty timeline that
      // looks like "nothing happened".
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live feed: the bridge agent upserts events as they happen, so the
  // timeline updates without the operator refreshing.
  useEffect(() => {
    const channel = supabase
      .channel('camera-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'camera_events' },
        (payload) => {
          const row = payload.new as CameraEvent | null;
          if (!row?.id) return;
          setEvents((prev) => {
            const without = prev.filter((e) => e.id !== row.id);
            return [row, ...without]
              .sort((a, b) => b.started_at.localeCompare(a.started_at))
              .slice(0, EVENT_PAGE_SIZE);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { cameras, events, loading, error, refetch: fetchAll };
}

/**
 * Base URL of the on-prem bridge (go2rtc). Empty when unconfigured, which the
 * page surfaces as a setup hint rather than a broken player.
 */
export function cameraBridgeUrl(): string {
  return (import.meta.env.VITE_CAMERA_BRIDGE_URL || '').replace(/\/$/, '');
}
