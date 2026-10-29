import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * A person in the student app, as the CRM reads them (migration
 * 20261029090000_app_person_profile): analytics_person for the lead card's
 * «Ilovada» block, analytics_person_journey for «To'liq yo'l», and the
 * app-journey-summary edge function for «Gapni boshlash». Both reads are
 * logged on the server (analytics_access_log). types.ts predates these, so
 * they go through an untyped handle.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export interface PersonPick {
  institution_id: string;
  name_en: string | null;
  name_ko: string | null;
}

export interface PersonVisa {
  band: 'high' | 'mid' | 'low' | string;
  bucket: number | null;
  /** The old quiz's first weak point: language, income, deposit, gap, age. */
  low: string | null;
  topik: number | null;
  income: 'yes' | 'no' | null;
}

export interface Person {
  person_key: string;
  lead_id: string | null;
  user_id: string | null;
  platform: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  visits: number;
  active_days: number;
  milestones: string[];
  lead_source: string | null;
  contact_channel: string | null;
  how_heard: string | null;
  how_heard_key: string | null;
  for_whom: string | null;
  picks: PersonPick[];
  visa: PersonVisa | null;
  tariff: string | null;
  report_views: number;
  report_at: string | null;
  request_at: string | null;
  score: number;
  is_test: boolean;
  ai_summary: string | null;
  ai_starter: string | null;
  ai_at: string | null;
  ai_fresh: boolean;
  ties: { via: string; at: string }[];
  devices: { platform: string | null; model: string | null; os: string | null; app_version: string | null; last_seen_at: string }[];
}

export interface JourneyStep {
  at: string;
  event: string;
  screen: string | null;
  element: string | null;
  duration_ms: number | null;
  props: Record<string, unknown> | null;
}

export interface JourneySession {
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  entry_screen: string | null;
  exit_screen: string | null;
  exit_event: string | null;
  events: number;
  taps: number;
  platform: string | null;
}

export interface Journey {
  person_key: string;
  sessions: JourneySession[];
  steps: JourneyStep[];
  truncated: boolean;
}

/** The lead's person in the app, or null when no phone is tied to it. */
export function usePerson(leadId: string | null | undefined) {
  const [data, setData] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!leadId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    db.rpc('analytics_person', { p_lead_id: leadId }).then(
      ({ data, error }: { data: Person | null; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else setData(data);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [leadId]);

  return { data, loading, error };
}

/** «To'liq yo'l»: read only when the dialog is opened. */
export function useJourney(leadId: string | null | undefined, open: boolean) {
  const [data, setData] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leadId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    db.rpc('analytics_person_journey', { p_lead_id: leadId, p_days: 30, p_limit: 500 }).then(
      ({ data, error }: { data: Journey | null; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else setData(data);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [leadId, open]);

  return { data, loading, error };
}

/**
 * «Gapni boshlash» (and the summary behind it): the profile's own when it is
 * fresh, otherwise written now by app-journey-summary.
 */
export function useAiStarter(person: Person | null) {
  const [starter, setStarter] = useState<string | null>(person?.ai_fresh ? person.ai_starter : null);
  const [summary, setSummary] = useState<string | null>(person?.ai_fresh ? person.ai_summary : null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async (leadId: string, force = false) => {
    setLoading(true);
    setFailed(false);
    const { data, error } = await supabase.functions.invoke('app-journey-summary', {
      body: { lead_id: leadId, force },
    });
    const out = data as { summary?: string | null; starter?: string | null } | null;
    if (error || !out) setFailed(true);
    else {
      setStarter(out.starter ?? null);
      setSummary(out.summary ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!person?.lead_id) return;
    if (person.ai_fresh && person.ai_starter) {
      setStarter(person.ai_starter);
      setSummary(person.ai_summary);
      return;
    }
    void run(person.lead_id);
  }, [person, run]);

  return { starter, summary, loading, failed };
}

/** Universities by id → their English (or Korean) name. */
export async function institutionNames(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await db.from('institutions').select('id, name_en, name_ko').in('id', ids);
  const rows = (data ?? []) as { id: string; name_en: string | null; name_ko: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.name_en || r.name_ko || '']));
}

/** Each event's Uzbek description from the app's registry (app_event_types). */
export function useEventNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    db.from('app_event_types')
      .select('event, description_uz')
      .then(({ data }: { data: { event: string; description_uz: string }[] | null }) => {
        if (!alive || !data) return;
        setNames(Object.fromEntries(data.map((r) => [r.event, r.description_uz])));
      });
    return () => {
      alive = false;
    };
  }, []);
  return names;
}

const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** "Bugun 14:20", "Kecha 21:40", "24-okt 18:30" (the plan's way of writing a time). */
export function whenLabel(
  iso: string | null | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
  now: Date = new Date(),
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return t('appPerson.today', { time });
  if (diff === 1) return t('appPerson.yesterday', { time });
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]} ${time}`;
}

/**
 * "15-okt", or "20-yan 2025" outside the current year — a day the way the
 * plan writes it. A bare 'YYYY-MM-DD' is that calendar day; a timestamp is
 * read in local time.
 */
export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

export const PLATFORM_LABEL: Record<string, string> = { android: 'Android', ios: 'iOS', web: 'Web' };

export const TARIFF_LABEL: Record<string, string> = {
  standart: 'Standart',
  premium: 'Premium',
  no_risk: 'NO RISK',
  hanbox: 'Hanbox',
};

/** How the phone got into the app, as a «Manba» chip after the first source. */
export const TIE_KEY: Record<string, string | null> = {
  link: 'operatorLink',
  referrer: 'operatorLink',
  web: 'operatorLink',
  telegram_code: 'telegramCode',
  bot_start: 'telegramCode',
  // The form is the request itself, not a way in.
  form: null,
};

/** The «Manba» chips: the person's own answer (or the channel the lead came by) first, then the ways the phone was tied. */
export function sourceChips(p: Person, t: (k: string) => string): string[] {
  const out: string[] = [];
  const first = p.how_heard || channelLabel(p.contact_channel, p.lead_source, t);
  if (first) out.push(first);
  for (const tie of p.ties) {
    const key = TIE_KEY[tie.via];
    if (!key) continue;
    const label = t(`appPerson.ties.${key}`);
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/** The channel the lead came by: the CRM's contact channel, else its source. */
export function channelLabel(contactChannel: string | null, source: string | null, t: (k: string) => string): string | null {
  if (contactChannel) return contactChannel;
  if (!source) return null;
  const key = `appPerson.sources.${source}`;
  const label = t(key);
  return label === key ? source : label;
}

export interface JourneyGroup {
  session: JourneySession | null;
  steps: JourneyStep[];
}

/**
 * The steps under their visits (newest first). Steps newer than the last
 * visit the server has put together yet (it does so every five minutes) make
 * a group of their own on top.
 */
export function groupBySession(sessions: JourneySession[], steps: JourneyStep[]): JourneyGroup[] {
  const groups: JourneyGroup[] = sessions.map((s) => ({ session: s, steps: [] }));
  const loose: JourneyStep[] = [];
  for (const step of steps) {
    const at = new Date(step.at).getTime();
    const g = groups.find((x) => {
      const start = new Date(x.session!.started_at).getTime();
      const end = new Date(x.session!.ended_at ?? x.session!.started_at).getTime();
      return at >= start - 1000 && at <= end + 60_000;
    });
    if (g) g.steps.push(step);
    else loose.push(step);
  }
  const out = groups.filter((g) => g.steps.length);
  return loose.length ? [{ session: null, steps: loose }, ...out] : out;
}
