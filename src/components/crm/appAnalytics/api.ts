import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * The app analytics' reads and writes (migration 20261027090000_app_events_v2).
 * `types.ts` predates these objects, so they go through an untyped handle, as
 * useAppActivity does.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface QualityData {
  days: number;
  /** The last 48 hours, by the hour the server received the events. */
  hourly: { hour: string; events: number; devices: number }[];
  builds: { build: number; devices: number; events: number; last_at: string }[];
  matrix: { build: number; event: string; n: number; devices: number }[];
  /** Events the previous build sent (on 3+ devices) that this one never did. */
  missing: { build: number; event: string; prev_devices: number }[];
  rejected: { reason: string; event: string; build: number; n: number; last_at: string }[];
  /** Per build: how many taps carry a name, how many screens were timed. */
  coverage?: { build: number; taps: number; named_taps: number; screen_views: number; timed_leaves: number }[];
  devices: number;
  test_devices: number;
  test_by_reason: Record<string, number>;
  /** Seconds between an event happening and reaching the server. */
  delay_s: { p50: number | null; p90: number | null; p99: number | null } | null;
  registry: { event: string; family: string; description: string; status: 'active' | 'deprecated'; n: number; devices: number }[];
  last_refresh: string | null;
}

export function useAnalyticsQuality(days: number) {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    db.rpc('analytics_quality', { p_days: days }).then(({ data, error }: { data: QualityData | null; error: { message: string } | null }) => {
      if (!alive) return;
      if (error) setError(error.message);
      else setData(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [days, tick]);

  return { data, loading, error, reload: useCallback(() => setTick((n) => n + 1), []) };
}

export type TestReason = 'staff' | 'demo' | 'dev' | 'manual';
export const TEST_REASONS: TestReason[] = ['manual', 'staff', 'demo', 'dev'];

export interface TestDevice {
  install_id: string;
  platform: string | null;
  model: string | null;
  os: string | null;
  os_version: string | null;
  app_version: string | null;
  app_build: number | null;
  test_reason: TestReason;
  test_marked_by: string | null;
  test_marked_at: string | null;
  last_seen_at: string;
}

/** What the app shows as the device's code: the install id's first 8 characters, "XXXX-XXXX". */
export function deviceCode(installId: string): string {
  const c = installId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export function useTestDevices() {
  const [devices, setDevices] = useState<TestDevice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await db
        .from('app_installs')
        .select('install_id, platform, model, os, os_version, app_version, app_build, test_reason, test_marked_by, test_marked_at, last_seen_at')
        .not('test_reason', 'is', null)
        .order('test_marked_at', { ascending: false, nullsFirst: false })
        .limit(300);
      if (!alive) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as TestDevice[];
      setDevices(rows);
      // Who marked them, by name where the profile is readable.
      const ids = [...new Set(rows.map((r) => r.test_marked_by).filter((x): x is string => !!x))];
      if (ids.length) {
        const { data: people } = await db.from('profiles').select('user_id, full_name').in('user_id', ids);
        if (alive && people) {
          setNames(Object.fromEntries((people as { user_id: string; full_name: string | null }[]).map((p) => [p.user_id, p.full_name ?? ''])));
        }
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  return { devices, names, loading, error, reload: useCallback(() => setTick((n) => n + 1), []) };
}

export type MarkResult =
  | { status: 'ok'; install_id: string }
  | { status: 'short_code' | 'not_found' | 'bad_reason' }
  | { status: 'ambiguous'; count: number }
  | { status: 'error'; message: string };

export async function markTestDevice(code: string, reason: TestReason): Promise<MarkResult> {
  const { data, error } = await db.rpc('app_install_mark_test', { p_code: code, p_reason: reason });
  if (error) return { status: 'error', message: error.message };
  return data as MarkResult;
}

export async function unmarkTestDevice(installId: string): Promise<boolean> {
  const { data, error } = await db.rpc('app_install_unmark_test', { p_install_id: installId });
  return !error && data === true;
}
