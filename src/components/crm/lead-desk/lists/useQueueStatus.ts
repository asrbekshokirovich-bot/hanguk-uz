/**
 * Where a lost lead stands in the reactivation queues (Baza, spec §3.6): one
 * light read of `reactivation_queues` for the ids on the page.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queueShortLabel } from './labels';

export interface QueueEntry {
  lead_id: string;
  queue_key: string;
  status: 'waiting' | 'ready' | 'moved';
  due_at: string | null;
  channel: 'call' | 'dm';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as { from: (table: string) => any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchQueueStatus(leadIds: string[]): Promise<Record<string, QueueEntry[]>> {
  if (leadIds.length === 0) return {};
  const { data, error } = await db
    .from('reactivation_queues')
    .select('lead_id, queue_key, status, due_at, channel')
    .in('lead_id', leadIds)
    .in('status', ['waiting', 'ready', 'moved']);
  if (error) throw new Error(error.message);
  const out: Record<string, QueueEntry[]> = {};
  for (const r of (data ?? []) as QueueEntry[]) (out[r.lead_id] ??= []).push(r);
  return out;
}

const STATUS_TEXT: Record<QueueEntry['status'], string> = {
  waiting: 'kutmoqda',
  ready: 'boshlangan',
  moved: "BUGUN'ga tushgan",
};

/** "Hanbox · kutmoqda", "Aloqa yo'q · boshlangan"; empty when the lead is in no queue. */
export function queueStatusText(entries: QueueEntry[] | undefined): string {
  if (!entries || entries.length === 0) return '';
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const e of entries) {
    const text = `${queueShortLabel(e.queue_key)} · ${STATUS_TEXT[e.status]}`;
    if (!seen.has(text)) {
      seen.add(text);
      parts.push(text);
    }
  }
  return parts.join(', ');
}

/** `ids` are the lost leads on the current page. */
export function useQueueStatus(ids: string[]) {
  const key = [...ids].sort().join(',');
  const query = useQuery({
    queryKey: ['lead-v2', 'queue-status', key],
    queryFn: () => fetchQueueStatus(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
  return { byLead: query.data ?? {}, loading: query.isLoading };
}
