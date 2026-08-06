import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/* ---------------------------------------------------------------------------
 * The investor surface.
 *
 * Everything below reads one of the seven v_investor_* views or one of the two
 * investor messaging tables added by migrations 20260729_0002..0005. None of
 * them are in src/integrations/supabase/types.ts yet, so the client is widened
 * once, here, rather than sprinkling `as any` through the screens. Regenerate
 * the types and `rel()` can be deleted in favour of plain supabase.from().
 *
 * Two things to keep in mind when adding to this file:
 *
 *  - The views are the only path to finance and application data. She cannot
 *    read payments, expenses, intakes, applications or student_intakes
 *    directly; migration 0005 added restrictive SELECT denials on all of them.
 *    A query written against a base table will silently return zero rows.
 *  - Every view self-gates on investor_can_view_intake(), so passing an
 *    intake_id below her first_intake_id returns nothing rather than an error.
 *    Do not treat an empty result as a bug.
 * ------------------------------------------------------------------------ */

type LooseRelation = {
  select: (columns?: string, options?: Record<string, unknown>) => any;
  insert: (values: unknown) => any;
  update: (values: unknown) => any;
};

const rel = (name: string): LooseRelation =>
  (supabase as unknown as { from: (n: string) => LooseRelation }).from(name);

export type Season = 'spring' | 'fall';

export interface InvestorIntake {
  intake_id: string;
  season: Season;
  year: number;
  label: string;
  is_default: boolean;
  is_open: boolean;
  starts_on: string | null;
  ends_on: string | null;
  sort_key: number;
}

export interface InvestorPositionRow {
  investor_id: string;
  full_name: string;
  equity_percent: number;
  invested_amount_usd: number;
  invested_at: string;
  intake_id: string;
  currency: string;
  season_revenue: number;
  season_expenses: number;
  season_net_profit: number;
  profit_share: number;
}

export type InvestorIdentity = Pick<
  InvestorPositionRow,
  'investor_id' | 'full_name' | 'equity_percent' | 'invested_amount_usd' | 'invested_at'
>;

export interface InvestorMonthlyRow {
  intake_id: string;
  month: string;
  currency: string;
  revenue: number;
  expenses: number;
  net: number;
  margin_pct: number | null;
}

export interface InvestorPnlRow {
  intake_id: string;
  currency: string;
  side: 'revenue' | 'expense';
  line_item: string;
  amount: number;
  pct_of_revenue: number | null;
}

export interface InvestorFunnelRow {
  intake_id: string;
  stage: string;
  stage_order: number;
  student_count: number;
}

/** Counts only. The `leads` table holds names, phones and emails; the
 *  v_investor_lead_* views deliberately expose none of them. */
export interface InvestorLeadSummaryRow {
  intake_id: string;
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  qualified_leads: number;
  converted_leads: number;
  lost_leads: number;
  leads_last_30_days: number;
  conversion_pct: number | null;
}

export interface InvestorLeadSourceRow {
  intake_id: string;
  source: string;
  lead_count: number;
  converted_count: number;
  converted_pct: number | null;
}

export interface InvestorLeadMonthlyRow {
  intake_id: string;
  month: string;
  lead_count: number;
  converted_count: number;
}

export interface InvestorApplicationRow {
  application_id: string;
  intake_id: string;
  student_name: string;
  plan: string | null;
  university: string | null;
  program: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string | null;
  days_since_movement: number | null;
}

export interface InvestorStaffRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  presence_status: string | null;
}

export interface InvestorThreadRow {
  id: string;
  investor_id: string;
  staff_user_id: string;
  last_message_at: string;
  created_at: string;
}

export interface InvestorMessageRow {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface InvestorPayoutRow {
  id: string;
  investor_id: string;
  period_label: string;
  due_date: string | null;
  paid_at: string | null;
  amount_uzs: number;
  status: string;
}

const KEY = 'investor';

/** The seasons she is allowed to see, newest first. Her visibility floor is
 *  applied inside the view, so this list is already correct - never filter it
 *  again in the UI. */
export function useInvestorIntakes() {
  return useQuery({
    queryKey: [KEY, 'intakes'],
    queryFn: async (): Promise<InvestorIntake[]> => {
      const { data, error } = await rel('v_investor_intakes')
        .select('*')
        .order('sort_key', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvestorIntake[];
    },
  });
}

/** Name, equity and the cheque - season-independent, used by the shell. */
export function useInvestorIdentity() {
  return useQuery({
    queryKey: [KEY, 'identity'],
    queryFn: async (): Promise<InvestorIdentity | null> => {
      const { data, error } = await rel('v_investor_position')
        .select('investor_id, full_name, equity_percent, invested_amount_usd, invested_at')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as InvestorIdentity | null;
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** One row per currency for the season. profit_share is computed in the view as
 *  season_net_profit * equity_percent / 100 - do not recompute it in a screen. */
export function useInvestorPosition(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'position', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorPositionRow[]> => {
      const { data, error } = await rel('v_investor_position')
        .select('*')
        .eq('intake_id', intakeId);
      if (error) throw error;
      return (data ?? []) as InvestorPositionRow[];
    },
  });
}

export function useInvestorMonthly(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'monthly', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorMonthlyRow[]> => {
      const { data, error } = await rel('v_investor_season_monthly')
        .select('*')
        .eq('intake_id', intakeId)
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvestorMonthlyRow[];
    },
  });
}

export function useInvestorPnl(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'pnl', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorPnlRow[]> => {
      const { data, error } = await rel('v_investor_season_pnl')
        .select('*')
        .eq('intake_id', intakeId)
        .order('amount', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvestorPnlRow[];
    },
  });
}

export function useInvestorFunnel(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'funnel', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorFunnelRow[]> => {
      const { data, error } = await rel('v_investor_season_funnel')
        .select('*')
        .eq('intake_id', intakeId)
        .order('stage_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvestorFunnelRow[];
    },
  });
}

/** Season lead totals. One row, or none when the season is below her floor. */
export function useInvestorLeadSummary(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'leads', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorLeadSummaryRow | null> => {
      const { data, error } = await rel('v_investor_season_leads')
        .select('*')
        .eq('intake_id', intakeId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as InvestorLeadSummaryRow | null;
    },
  });
}

export function useInvestorLeadSources(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'lead-sources', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorLeadSourceRow[]> => {
      const { data, error } = await rel('v_investor_lead_sources')
        .select('*')
        .eq('intake_id', intakeId)
        .order('lead_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvestorLeadSourceRow[];
    },
  });
}

export function useInvestorLeadMonthly(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'lead-monthly', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorLeadMonthlyRow[]> => {
      const { data, error } = await rel('v_investor_lead_monthly')
        .select('*')
        .eq('intake_id', intakeId)
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvestorLeadMonthlyRow[];
    },
  });
}

// What the investor may not see is now decided in SQL, by
// v_investor_applications and v_investor_season_funnel: demo accounts
// (profiles.is_demo) and free re-applications
// (student_intakes.is_free_reapplication) are excluded there.
//
// This used to be a list of student names matched here. Two things were wrong
// with that. It only reached the Applications screen — the funnel count is
// computed in SQL and counted the same students anyway, so the two screens
// disagreed. And one of the names was a real student being hidden because
// there was no way to express what she is; she is a free re-application, and
// saying so is what the flag does.

export function useInvestorApplications(intakeId: string | null) {
  return useQuery({
    queryKey: [KEY, 'applications', intakeId],
    enabled: !!intakeId,
    queryFn: async (): Promise<InvestorApplicationRow[]> => {
      const { data, error } = await rel('v_investor_applications')
        .select('*')
        .eq('intake_id', intakeId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InvestorApplicationRow[];
    },
  });
}

/** Name, role and presence for the nine staff she may message. Nothing else -
 *  staff_presence itself is denied to her. */
export function useInvestorStaffDirectory() {
  return useQuery({
    queryKey: [KEY, 'staff'],
    queryFn: async (): Promise<InvestorStaffRow[]> => {
      const { data, error } = await rel('v_investor_staff_directory')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvestorStaffRow[];
    },
  });
}

export function useInvestorPayouts() {
  return useQuery({
    queryKey: [KEY, 'payouts'],
    queryFn: async (): Promise<InvestorPayoutRow[]> => {
      const { data, error } = await rel('investor_payouts')
        .select('*')
        .order('due_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as InvestorPayoutRow[];
    },
  });
}

/** Drives the lime count pill on the Messages nav item. */
export function useInvestorUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'unread', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { count, error } = await rel('investor_messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .neq('sender_user_id', user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

/* ---------------------------------------------------------------------------
 * Messaging - the only writable surface in the portal.
 *
 * Two policies shape everything below:
 *   investor_threads_investor_insert  with check (investor_id = current_investor_id()
 *                                                 and is_staff_user(staff_user_id))
 *   investor_messages_participant_insert with check (sender_user_id = auth.uid()
 *                                                 and she is on the thread)
 * So a thread can only ever be between her and a real staff member, and she can
 * only ever send as herself. Neither is enforced in the UI; the UI just avoids
 * asking for things the database will refuse.
 * ------------------------------------------------------------------------ */

export interface InvestorThreadWithPreview extends InvestorThreadRow {
  staff: InvestorStaffRow | null;
  preview: string | null;
  preview_at: string | null;
  unread: number;
}

export function useInvestorThreads() {
  const { user } = useAuth();
  const staff = useInvestorStaffDirectory();
  const staffRows = staff.data;

  // The staff directory is joined in AFTER the fetch, never inside the query
  // key. Putting staff.data?.length in the key rotated the cache entry every
  // time the directory refetched, which blanked the open conversation
  // mid-read. The threads query now depends on nothing but the user.
  const q = useQuery({
    queryKey: [KEY, 'threads', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Omit<InvestorThreadWithPreview, 'staff'>[]> => {
      const { data: threads, error } = await rel('investor_threads')
        .select('*')
        .order('last_message_at', { ascending: false });
      if (error) throw error;

      const rows = (threads ?? []) as InvestorThreadRow[];
      if (rows.length === 0) return [];

      // One round trip for every thread's messages; the volume here is a
      // handful of conversations, so grouping client-side beats a view.
      const { data: msgs, error: msgErr } = await rel('investor_messages')
        .select('thread_id, body, created_at, read_at, sender_user_id')
        .in('thread_id', rows.map((t) => t.id))
        .order('created_at', { ascending: false });
      if (msgErr) throw msgErr;

      const byThread = new Map<string, InvestorMessageRow[]>();
      for (const m of (msgs ?? []) as InvestorMessageRow[]) {
        const list = byThread.get(m.thread_id);
        if (list) list.push(m);
        else byThread.set(m.thread_id, [m]);
      }

      return rows.map((t) => {
        const list = byThread.get(t.id) ?? [];
        const latest = list[0] ?? null;
        return {
          ...t,
          preview: latest?.body ?? null,
          preview_at: latest?.created_at ?? t.last_message_at,
          unread: list.filter((m) => !m.read_at && m.sender_user_id !== user!.id).length,
        };
      });
    },
  });

  const data = useMemo<InvestorThreadWithPreview[]>(() => {
    const byId = new Map((staffRows ?? []).map((s) => [s.user_id, s]));
    return (q.data ?? []).map((t) => ({ ...t, staff: byId.get(t.staff_user_id) ?? null }));
  }, [q.data, staffRows]);

  return { ...q, data };
}

export function useInvestorMessages(threadId: string | null) {
  return useQuery({
    queryKey: [KEY, 'messages', threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<InvestorMessageRow[]> => {
      const { data, error } = await rel('investor_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvestorMessageRow[];
    },
    refetchInterval: 30_000,
  });
}

/** Returns the thread with this staff member, creating it on first message. */
export function useOpenThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      staffUserId,
      investorId,
    }: {
      staffUserId: string;
      investorId: string;
    }): Promise<string> => {
      const { data: existing, error: findErr } = await rel('investor_threads')
        .select('id')
        .eq('staff_user_id', staffUserId)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing?.id) return existing.id as string;

      const { data, error } = await rel('investor_threads')
        .insert({ investor_id: investorId, staff_user_id: staffUserId })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'threads'] });
    },
  });
}

/**
 * Optimistic send.
 *
 * The thread id is a mutation argument rather than a hook argument on purpose:
 * the first message to someone she has never written to creates the thread and
 * sends in the same gesture, so the id does not exist when the hook is called.
 * The temporary row carries a client-side id so the list does not jump when the
 * real row arrives; on error it is rolled back and the composer keeps the text.
 */
export function useSendInvestorMessage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { data, error } = await rel('investor_messages')
        .insert({ thread_id: threadId, sender_user_id: user!.id, body })
        .select('*')
        .single();
      if (error) throw error;
      return data as InvestorMessageRow;
    },
    onMutate: async ({ threadId, body }) => {
      const key = [KEY, 'messages', threadId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InvestorMessageRow[]>(key) ?? [];
      const optimistic: InvestorMessageRow = {
        id: `pending-${Date.now()}`,
        thread_id: threadId,
        sender_user_id: user?.id ?? '',
        body,
        created_at: new Date().toISOString(),
        read_at: null,
      };
      qc.setQueryData<InvestorMessageRow[]>(key, [...previous, optimistic]);
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'messages', vars.threadId] });
      qc.invalidateQueries({ queryKey: [KEY, 'threads'] });
      qc.invalidateQueries({ queryKey: [KEY, 'unread'] });
    },
  });
}

/** Marks the staff side of an open thread as read. Updating read_at is the one
 *  update an investor session is allowed, and only on her own threads. */
export function useMarkThreadRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await rel('investor_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .is('read_at', null)
        .neq('sender_user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, 'threads'] });
      qc.invalidateQueries({ queryKey: [KEY, 'unread'] });
    },
  });
}
