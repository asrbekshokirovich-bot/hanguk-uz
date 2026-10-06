/**
 * Pure helpers that turn a list row into what the tables (and the CSV export)
 * show. No React, no network: tested directly.
 */
import { channelLabel, NEXT_ACTION_LABEL } from '../copy';
import { clock, dayKey, whenLabel } from '../time';
import type { LeadListRow } from '../api';
import { sourceLabel } from './labels';

type ChannelFields = Pick<LeadListRow, 'instagram_handle' | 'telegram_handle' | 'phone' | 'source' | 'contact_channel'>;

/** "IG", "TG", "Tel", "Forma" ...: every channel this lead is reachable on, without repeats. */
export function channelsOf(row: ChannelFields): string[] {
  const out: string[] = [];
  const add = (key: string) => {
    const label = channelLabel(key);
    if (!out.includes(label)) out.push(label);
  };
  if (row.instagram_handle || row.source === 'instagram') add('instagram');
  if (row.telegram_handle || row.source === 'telegram') add('telegram');
  if (row.source === 'facebook') add('facebook');
  if (row.phone) add('phone');
  if (row.source === 'meta_form') add('meta_form');
  if (out.length === 0) out.push(row.source ? sourceLabel(row.source) : channelLabel(row.contact_channel));
  return out;
}

/** "@dilnoza_a" for the line under the name. */
export function handleOf(row: Pick<LeadListRow, 'instagram_handle' | 'telegram_handle'>): string | null {
  const h = row.instagram_handle || row.telegram_handle;
  if (!h) return null;
  return h.startsWith('@') ? h : `@${h}`;
}

/** The last time anybody on our side touched the lead. */
export function lastActionAt(row: Pick<LeadListRow, 'last_contacted_at' | 'last_operator_msg_at'>): string | null {
  const a = row.last_contacted_at;
  const b = row.last_operator_msg_at;
  if (a && b) return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
  return a ?? b ?? null;
}

/** "07.10 10:00 · Qo'ng'iroq", or "—" when nothing is planned. */
export function nextActionText(row: Pick<LeadListRow, 'next_action_at' | 'next_action_kind'>, now: Date = new Date()): string {
  if (!row.next_action_at) return '—';
  const when = whenLabel(row.next_action_at, now);
  const kind = row.next_action_kind ? (NEXT_ACTION_LABEL[row.next_action_kind] ?? row.next_action_kind) : null;
  return kind ? `${when} · ${kind}` : when;
}

/** "2026-10-05 14:12" in Tashkent; empty for no value. */
export function stamp(v: string | null | undefined): string {
  const day = dayKey(v);
  return day ? `${day} ${clock(v)}` : '';
}

export const truncate = (text: string | null | undefined, max: number): string => {
  const t = (text ?? '').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
};

/** The score bar's colour band. */
export function scoreTone(score: number | null | undefined): 'high' | 'mid' | 'low' | 'none' {
  if (score == null) return 'none';
  if (score >= 60) return 'high';
  if (score >= 30) return 'mid';
  return 'low';
}
