import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * «Bugun ilovada»'s data (analytics_today_in_app, migration
 * 20261029090000_app_person_profile) and the plan's way of wording a row.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export interface TodayRow {
  id: number;
  rule: 'new_app_request' | 'came_back' | 'report_or_picks' | 'offer_unanswered' | string;
  queue: 'now' | 'today';
  target: 'operators' | 'boss' | 'owner' | 'documents';
  asked_at: string;
  due_at: string | null;
  day: string;
  detail: { via?: string; days?: number; report?: boolean; picks?: number; offers?: number };
  lead_id: string | null;
  user_id: string | null;
  kind: 'lead' | 'student';
  name: string | null;
  source: string | null;
  contact_channel: string | null;
  assigned_to: string | null;
  assignee: string | null;
}

export interface TodayData {
  now: string;
  waiting: number;
  waiting_due_at: string | null;
  came_back: number;
  offers_waiting: number;
  rows: TodayRow[];
}

/** Read now and every 30 seconds. */
export function useTodayInApp(everyMs = 30_000) {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      db.rpc('analytics_today_in_app').then(({ data, error }: { data: TodayData | null; error: { message: string } | null }) => {
        if (!alive) return;
        setError(error ? error.message : null);
        if (!error) setData(data);
        setLoading(false);
      });
    void load();
    const id = window.setInterval(load, everyMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [everyMs]);

  return { data, loading, error };
}

type T = (k: string, o?: Record<string, unknown>) => string;

const pad = (n: number) => String(n).padStart(2, '0');

/** «07:12 qoldi» under an hour, «2 soat 15 daq qoldi» beyond; «03:20 kechikdi» once due. */
export function timerText(dueAt: string, now: number, t: T): string {
  const ms = new Date(dueAt).getTime() - now;
  const s = Math.floor(Math.abs(ms) / 1000);
  const value =
    s >= 3600
      ? t('todayInApp.hoursMinutes', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) })
      : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  return t(ms >= 0 ? 'todayInApp.left' : 'todayInApp.late', { value });
}

/** «Qachon»: «3 daqiqa oldin», «09:12», «Kecha 21:40», «2 kun». */
export function signalWhen(iso: string, now: number, t: T): string {
  const d = new Date(iso);
  const mins = Math.floor((now - d.getTime()) / 60_000);
  if (mins < 60) return t('todayInApp.minutesAgo', { count: Math.max(0, mins) });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days === 0) return time;
  if (days === 1) return t('appPerson.yesterday', { time });
  return t('todayInApp.days', { count: days });
}

/** «Signal»: what happened, in the plan's words. */
export function signalText(r: TodayRow, t: T): string {
  switch (r.rule) {
    case 'new_app_request':
      return t(r.detail.via === 'telegram' ? 'todayInApp.signals.requestTelegram' : 'todayInApp.signals.requestForm');
    case 'came_back':
      return t('todayInApp.signals.cameBack', { count: r.detail.days ?? 2 });
    case 'report_or_picks': {
      const parts = [
        r.detail.report ? t('todayInApp.signals.report') : null,
        r.detail.picks && r.detail.picks >= 3 ? t('todayInApp.signals.picks', { count: r.detail.picks }) : null,
      ].filter(Boolean);
      return parts.join(' · ') || t('todayInApp.signals.report');
    }
    case 'offer_unanswered':
      return t('todayInApp.signals.offer');
    default:
      return r.rule;
  }
}
