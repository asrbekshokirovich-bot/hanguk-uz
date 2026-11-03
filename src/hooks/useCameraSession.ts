import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraSessionLoadError,
  fetchCameraSession,
  isExpiring,
  refreshDelayMs,
  type CameraSession,
  type CameraSessionError,
} from '@/lib/cameraSession';

export interface CameraSessionState {
  session: CameraSession | null;
  error: CameraSessionError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * camera-session kaliti: sahifa ochilganda olinadi, tugashidan 60 s oldin yangilanadi.
 * Tab yashirin bo'lsa yangilanmaydi (har yangilash jurnalga yoziladi) — qaytganda darrov olinadi.
 * Yangilashda vaqtinchalik xato bo'lsa eski kalit muddati tugaguncha ishlatiladi.
 */
export function useCameraSession(load: () => Promise<CameraSession> = fetchCameraSession): CameraSessionState {
  const [session, setSession] = useState<CameraSession | null>(null);
  const [error, setError] = useState<CameraSessionError | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useRef<CameraSession | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    window.clearTimeout(timer.current);
    try {
      const next = await loadRef.current();
      if (!alive.current) return;
      current.current = next;
      setSession(next);
      setError(null);
      timer.current = window.setTimeout(() => {
        if (document.visibilityState === 'visible') void refresh();
      }, refreshDelayMs(next.expires_at, Date.now()));
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof CameraSessionLoadError ? e.code : 'load_failed';
      const old = current.current;
      if (code === 'load_failed' && old && !isExpiring(old.expires_at, Date.now())) {
        timer.current = window.setTimeout(() => void refresh(), 30_000);
      } else {
        current.current = null;
        setSession(null);
        setError(code);
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const s = current.current;
      if (s && isExpiring(s.expires_at, Date.now())) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void refresh();
  }, [refresh]);

  return { session, error, loading, reload };
}
