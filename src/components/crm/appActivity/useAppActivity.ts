import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * `types.ts` predates app_installs / app_events (migration
 * 20261014170000_app_events), so these reads go through an untyped handle, as
 * useLeadProfile does for its newer objects.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface AppEvent {
  id: number;
  install_id: string;
  user_id: string | null;
  event: string;
  screen: string | null;
  props: Record<string, unknown>;
  occurred_at: string;
}

export interface AppInstall {
  install_id: string;
  platform: string | null;
  app_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AppActivity {
  installs: AppInstall[];
  events: AppEvent[];
  /** institution id → name, for the events that name one. */
  names: Record<string, string>;
}

/** How many of the latest events are loaded. */
export const APP_ACTIVITY_LIMIT = 300;

/** Every institution id an event names. */
export function institutionIds(events: AppEvent[]): string[] {
  const ids = new Set<string>();
  for (const e of events) {
    for (const key of ['institution_id', 'other_id']) {
      const v = e.props?.[key];
      if (typeof v === 'string' && v) ids.add(v);
    }
  }
  return [...ids];
}

/**
 * A lead's or a student's activity in the app: the installations tied to them
 * and their latest events, newest first. For a student it also takes what the
 * same phone did as a guest before signing in.
 */
export function useAppActivity(target: { leadId?: string | null; userId?: string | null }) {
  const { leadId, userId } = target;
  const [data, setData] = useState<AppActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!leadId && !userId) {
        setData({ installs: [], events: [], names: {} });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let q = db.from('app_installs').select('install_id, platform, app_version, first_seen_at, last_seen_at');
        q = leadId ? q.eq('lead_id', leadId) : q.eq('user_id', userId);
        const { data: installs, error: e1 } = await q;
        if (e1) throw e1;
        const ids = ((installs ?? []) as AppInstall[]).map((i) => i.install_id);

        let events: AppEvent[] = [];
        if (ids.length || userId) {
          let eq = db
            .from('app_events')
            .select('id, install_id, user_id, event, screen, props, occurred_at')
            .order('occurred_at', { ascending: false })
            .limit(APP_ACTIVITY_LIMIT);
          if (userId && ids.length) {
            eq = eq.or(`user_id.eq.${userId},install_id.in.(${ids.join(',')})`);
          } else if (userId) {
            eq = eq.eq('user_id', userId);
          } else {
            eq = eq.in('install_id', ids);
          }
          const { data: rows, error: e2 } = await eq;
          if (e2) throw e2;
          events = (rows ?? []) as AppEvent[];
        }

        const want = institutionIds(events);
        const names: Record<string, string> = {};
        if (want.length) {
          const { data: inst } = await db.from('institutions').select('id, name_en, name_ko').in('id', want);
          for (const r of (inst ?? []) as { id: string; name_en: string | null; name_ko: string | null }[]) {
            names[r.id] = r.name_en || r.name_ko || r.id;
          }
        }
        if (!cancelled) setData({ installs: (installs ?? []) as AppInstall[], events, names });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [leadId, userId]);

  return { data, loading, error };
}

export interface AppEventsSummary {
  days: number;
  devices: number;
  signed_in_devices: number;
  new_devices: number;
  events: number;
  by_event: { event: string; n: number; devices: number }[];
  by_screen: { screen: string; n: number; devices: number }[];
  funnel: { event: string; devices: number }[];
  top_saved: { institution_id: string; name: string | null; devices: number }[];
  daily: { day: string; devices: number }[];
}

/** The CRM overview (app_events_summary) for the last [days] days. */
export function useAppEventsSummary(days: number) {
  const [data, setData] = useState<AppEventsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    db.rpc('app_events_summary', { p_days: days }).then(
      ({ data: d, error: e }: { data: AppEventsSummary | null; error: { message: string } | null }) => {
        if (cancelled) return;
        if (e) setError(e.message);
        else setData(d);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [days]);

  return { data, loading, error };
}
