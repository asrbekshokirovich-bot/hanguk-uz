import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Staff side of the investor portal: the CRM "Investor" desk.
 *
 *  - Messages: staff_investor_threads() lists the caller's threads (owner: all)
 *    with the investor's name; replies go into investor_messages, whose policy
 *    only lets the staff member ON the thread write. mark_investor_thread_read()
 *    clears the unread count. Migration 20261026190000_investor_desk.sql.
 *  - Payouts: investor_payouts, owner-only by policy (investor_payouts_admin_write).
 *
 * None of these objects are in the generated types yet.
 */

type Loose = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};
const db = supabase as unknown as Loose;

const KEY = 'investor-desk';

export interface DeskThread {
  thread_id: string;
  investor_id: string;
  investor_name: string;
  staff_user_id: string;
  staff_name: string | null;
  last_message_at: string;
  preview: string | null;
  unread: number;
}

export interface DeskMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface DeskInvestor {
  id: string;
  full_name: string;
  equity_percent: number;
}

export type PayoutStatus = 'accruing' | 'paid';

export interface DeskPayout {
  id: string;
  investor_id: string;
  period_label: string;
  due_date: string | null;
  paid_at: string | null;
  amount_uzs: number;
  status: PayoutStatus;
  created_at: string;
}

export function useDeskThreads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'threads', user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async (): Promise<DeskThread[]> => {
      const { data, error } = await db.rpc('staff_investor_threads');
      if (error) throw error;
      return (data ?? []) as DeskThread[];
    },
  });
}

export function useDeskMessages(threadId: string | null) {
  return useQuery({
    queryKey: [KEY, 'messages', threadId],
    enabled: !!threadId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<DeskMessage[]> => {
      const { data, error } = await db
        .from('investor_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DeskMessage[];
    },
  });
}

export function useDeskSend() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { error } = await db
        .from('investor_messages')
        .insert({ thread_id: threadId, sender_user_id: user!.id, body });
      if (error) throw error;
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'messages', vars.threadId] });
      qc.invalidateQueries({ queryKey: [KEY, 'threads'] });
    },
  });
}

export function useDeskMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await db.rpc('mark_investor_thread_read', { p_thread_id: threadId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'threads'] }),
  });
}

/** Owner and admin can read investors; only the owner may write payouts. */
export function useDeskInvestors(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'investors'],
    enabled,
    queryFn: async (): Promise<DeskInvestor[]> => {
      const { data, error } = await db
        .from('investors')
        .select('id, full_name, equity_percent')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as DeskInvestor[];
    },
  });
}

export function useDeskPayouts(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'payouts'],
    enabled,
    queryFn: async (): Promise<DeskPayout[]> => {
      const { data, error } = await db
        .from('investor_payouts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeskPayout[];
    },
  });
}

export interface PayoutInput {
  id?: string;
  investor_id: string;
  period_label: string;
  amount_uzs: number;
  status: PayoutStatus;
  due_date: string | null;
  paid_at: string | null;
}

export function useDeskSavePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PayoutInput) => {
      const row = {
        investor_id: input.investor_id,
        period_label: input.period_label.trim(),
        amount_uzs: input.amount_uzs,
        status: input.status,
        due_date: input.due_date || null,
        // The table requires paid_at on a paid row and nothing else.
        paid_at: input.status === 'paid' ? input.paid_at || null : null,
      };
      const q = input.id
        ? db.from('investor_payouts').update(row).eq('id', input.id)
        : db.from('investor_payouts').insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'payouts'] }),
  });
}

export function useDeskDeletePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('investor_payouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'payouts'] }),
  });
}
