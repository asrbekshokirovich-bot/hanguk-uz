import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * `src/integrations/supabase/types.ts` is generated and predates the tables this
 * page reads — lead_field_suggestions, the lead_channel_overview view and the
 * lead_timeline / accept_lead_suggestion functions. Regenerating it here would
 * rewrite eight thousand lines and drag in unrelated drift, so the few calls
 * that touch the new objects go through an untyped handle instead. The shapes
 * they return are declared as interfaces above; this only silences the table
 * NAME check, not the result type.
 */
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

/** The three places a customer reaches HANGUK from. */
export type Channel = 'phone' | 'telegram' | 'instagram';
export const CHANNELS: Channel[] = ['instagram', 'telegram', 'phone'];

export interface TimelineEntry {
  id: string;
  channel: Channel;
  direction: 'incoming' | 'outgoing';
  at: string;
  author: string;
  body: string;
  /** Call length in seconds; null for messages. */
  seconds: number | null;
  /** Call outcome; null for messages. */
  status: string | null;
}

export interface Suggestion {
  id: string;
  field: string;
  suggested_value: string;
  confidence: number;
  evidence: string | null;
  evidence_channel: Channel | null;
  status: 'pending' | 'accepted' | 'rejected' | 'corrected';
  corrected_value: string | null;
  decided_at: string | null;
  decided_by: string | null;
  sources: Record<string, unknown> | null;
  created_at: string;
}

export interface ChannelOverview {
  calls: number;
  telegram_messages: number;
  instagram_messages: number;
  last_call_at: string | null;
  last_telegram_at: string | null;
  last_instagram_at: string | null;
  last_contact_at: string | null;
  channels_used: number;
  pending_suggestions: number;
  last_analysis_at: string | null;
}

export interface LeadRecord {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  status: string | null;
  interest_level: string | null;
  current_stage: string | null;
  preferred_program: string | null;
  created_at: string;
}

/**
 * Fields whose proposals are unfinished WORK rather than attributes.
 *
 * The distinction drives the whole panel. `korean_level` is something true
 * about the customer; "we promised to call on the 2nd and did not" is an
 * outstanding debt. Filed together they read as one undifferentiated list and
 * the debts get skimmed past, which is exactly how they became debts.
 */
export const WORK_FIELDS = new Set(['open_question', 'promised_to_client', 'client_promised']);

export interface LeadProfile {
  lead: LeadRecord | null;
  overview: ChannelOverview | null;
  timeline: TimelineEntry[];
  suggestions: Suggestion[];
  loading: boolean;
  error: string | null;
  /** Median hours between a customer message and our next reply. */
  responseHours: number | null;
  refetch: () => Promise<void>;
  accept: (id: string, value?: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  analyze: () => Promise<void>;
  analyzing: boolean;
}

/**
 * How fast we answer this customer.
 *
 * Measured as the MEDIAN, not the mean: one forgotten thread that sat for three
 * weeks would otherwise swamp fifty replies sent within the hour and the number
 * would describe the outlier instead of the habit. Only an outgoing message
 * that directly follows an incoming one counts — our own follow-ups are not
 * replies to anything.
 */
function medianResponseHours(entries: TimelineEntry[]): number | null {
  const chronological = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const gaps: number[] = [];
  let awaiting: string | null = null;

  for (const entry of chronological) {
    if (entry.direction === 'incoming') {
      if (awaiting === null) awaiting = entry.at;
    } else if (awaiting !== null) {
      const hours = (new Date(entry.at).getTime() - new Date(awaiting).getTime()) / 3_600_000;
      if (hours >= 0) gaps.push(hours);
      awaiting = null;
    }
  }

  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

export function useLeadProfile(leadId: string | null): LeadProfile {
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [overview, setOverview] = useState<ChannelOverview | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const [leadRes, overviewRes, timelineRes, suggestionRes] = await Promise.all([
        // `current_stage` is newer than the generated types too.
        db
          .from('leads')
          .select(
            'id, full_name, phone, city, status, interest_level, current_stage, preferred_program, created_at',
          )
          .eq('id', leadId)
          .maybeSingle(),
        db.from('lead_channel_overview').select('*').eq('lead_id', leadId).maybeSingle(),
        db.rpc('lead_timeline', { p_lead_id: leadId, p_limit: 500 }),
        db
          .from('lead_field_suggestions')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: true }),
      ]);

      if (leadRes.error) throw leadRes.error;
      if (timelineRes.error) throw timelineRes.error;

      setLead((leadRes.data as LeadRecord) ?? null);
      setOverview((overviewRes.data as ChannelOverview) ?? null);
      setTimeline((timelineRes.data as TimelineEntry[]) ?? []);
      setSuggestions((suggestionRes.data as Suggestion[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Accept and reject go through database functions, not a table update from
   * the browser. Writing the lead column and closing the proposal must happen
   * together — a half-applied accept leaves the card showing a value the queue
   * still lists as pending, and the operator decides it twice.
   */
  const accept = useCallback(
    async (id: string, value?: string) => {
      const { error: rpcError } = await db.rpc('accept_lead_suggestion', {
        p_suggestion_id: id,
        p_value: value ?? null,
      });
      if (rpcError) throw rpcError;
      await load();
    },
    [load],
  );

  const reject = useCallback(
    async (id: string) => {
      const { error: rpcError } = await db.rpc('reject_lead_suggestion', {
        p_suggestion_id: id,
      });
      if (rpcError) throw rpcError;
      await load();
    },
    [load],
  );

  const analyze = useCallback(async () => {
    if (!leadId) return;
    setAnalyzing(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('suggest-lead-profile', {
        body: { lead_id: leadId },
      });
      if (fnError) throw fnError;
      await load();
    } finally {
      setAnalyzing(false);
    }
  }, [leadId, load]);

  const responseHours = useMemo(() => medianResponseHours(timeline), [timeline]);

  return {
    lead,
    overview,
    timeline,
    suggestions,
    loading,
    error,
    responseHours,
    refetch: load,
    accept,
    reject,
    analyze,
    analyzing,
  };
}
