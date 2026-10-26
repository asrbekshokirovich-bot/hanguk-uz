import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { channelLabel, PLATFORM_LABEL, type JourneyStep } from './person';
import { duration } from './steps';

/**
 * «Jonli» (the plan's mock-up, section 7): analytics_live every ten seconds,
 * and each step as one line — «Ism · Lid · Instagram — konsultant formasini
 * ochdi», «Mehmon · Web — universitet sahifasi, 52 s».
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

type T = (k: string, o?: Record<string, unknown>) => string;

export interface LiveEvent extends JourneyStep {
  platform: string | null;
  kind: 'guest' | 'lead' | 'student';
  name: string | null;
  lead_id: string | null;
  source: string | null;
  contact_channel: string | null;
}

export interface Live {
  now: string;
  /** Devices with a step in the last five minutes (test devices aside). */
  devices: number;
  /** Of them, tied to a lead card (not a signed-in student). */
  leads: number;
  /** The last hour, newest first (at most 60). */
  events: LiveEvent[];
}

export function useLive(everyMs = 10_000) {
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      db.rpc('analytics_live', { p_minutes: 5 }).then(({ data, error }: { data: Live | null; error: { message: string } | null }) => {
        if (!alive) return;
        setError(error ? error.message : null);
        if (!error) setData(data);
      });
    void load();
    const id = window.setInterval(load, everyMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [everyMs]);
  return { data, error };
}

/** «Ism · Lid · Instagram», «Ism · Talaba», «Mehmon · Android». */
export function liveWho(e: LiveEvent, t: T): string {
  const kind = t(`appPerson.kind.${e.kind}`);
  if (e.kind === 'guest') return [kind, e.platform ? PLATFORM_LABEL[e.platform] ?? e.platform : null].filter(Boolean).join(' · ');
  const channel = e.kind === 'lead' ? channelLabel(e.contact_channel, e.source, t) : null;
  return [e.name, kind, channel].filter(Boolean).join(' · ');
}

/**
 * The line goes on after a dash, so it starts in lower case — unless it
 * starts with a name («Study Plan», «QR skaner», «Vizam chiqadimi?» in quotes).
 */
export function lowerFirst(s: string): string {
  const [first, second] = s.split(' ');
  if (!/^\p{Lu}[\p{Ll}'ʻʼ‘’-]*[\p{Ll}?:,]*$/u.test(first ?? '')) return s;
  // «Study Plan», «Hanguk AI»: a name of two words; «Bosdi: Orqaga» is not.
  if (second && !/[:,]$/.test(first) && /^\p{Lu}/u.test(second)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const FORMS = new Set(['lead', 'quiz_contact', 'client_code', 'survey']);

/** What the step was, in the feed's words; [describe] is the shared describer («To'liq yo'l»). */
export function liveWhat(e: LiveEvent, describe: (s: JourneyStep) => string, screen: (s: string | null) => string, t: T): string {
  const secs = e.duration_ms ? duration(e.duration_ms / 1000, t) : '';
  const form = typeof e.props?.form === 'string' ? e.props.form : null;
  switch (e.event) {
    case 'form_open':
      if (form && FORMS.has(form)) return t(`live.forms.${form}`);
      break;
    case 'report_view':
      return t('live.report');
    case 'tab_open': {
      const tab = typeof e.props?.tab === 'string' ? e.props.tab : '';
      return t('live.tab', { tab: t(`appActivity.tabs.${tab}`, { defaultValue: tab }) });
    }
    case 'screen_leave': {
      const name = screen(e.screen);
      if (name) return [lowerFirst(name), secs].filter(Boolean).join(', ');
      break;
    }
  }
  return [lowerFirst(describe(e)), secs].filter(Boolean).join(', ');
}
