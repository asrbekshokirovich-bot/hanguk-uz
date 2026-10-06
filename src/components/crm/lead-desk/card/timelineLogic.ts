/**
 * Lead card — reading `lead_timeline_v2()` rows (spec §6 "Vaqt chizig'i").
 * Pure: how a row is classified, filtered and worded.
 */
import { CALL_RESULT_LABEL, STAGE_LABEL, WAIT_REASON_LABEL, channelLabel } from '../copy';
import { whenLabel } from '../time';
import type { CallResult, Stage, TimelineEntry, WaitReason } from '../types';

export const PROMISE_STATUS_LABEL: Record<string, string> = {
  pending: 'kutilmoqda',
  approved: 'tasdiqlandi',
  rejected: 'rad etildi',
};

export const PROMISE_KIND_LABEL: Record<string, string> = {
  discount: 'Chegirma',
  installment: "Bo'lib to'lash",
  other: 'Boshqa shart',
};

/** `meta.internal` arrives as the text 'true' (it is `metadata->>'internal'`). */
export function isInternalNote(e: TimelineEntry): boolean {
  const internal = e.meta?.internal;
  return internal === true || internal === 'true' || e.meta?.message_type === 'note';
}

export function isMessage(e: TimelineEntry): boolean {
  return e.kind === 'message_in' || e.kind === 'message_out';
}

/** The channel a row is filtered by: a message's own, "phone" for a call, none for a system line. */
export function entryChannel(e: TimelineEntry): string | null {
  if (e.kind === 'call') return 'phone';
  if (e.kind === 'event') return null;
  return e.channel ?? null;
}

/** Channels that actually occur in the stream, in a stable order. */
export function channelsPresent(entries: TimelineEntry[]): string[] {
  const order = ['instagram', 'telegram', 'facebook', 'phone'];
  const found = new Set<string>();
  for (const e of entries) {
    const c = entryChannel(e);
    if (c) found.add(c);
  }
  return [...found].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}

export function filterByChannel(entries: TimelineEntry[], channel: string | 'all'): TimelineEntry[] {
  return channel === 'all' ? entries : entries.filter((e) => entryChannel(e) === channel);
}

export const channelName = (c: string | null | undefined): string => (c === 'phone' ? 'Tel' : channelLabel(c));

export function callResultLabel(result: unknown): string {
  return CALL_RESULT_LABEL[result as CallResult] ?? String(result ?? '');
}

export interface EventContext {
  lostLabel: (reason: string | null | undefined) => string;
  nameOf: (userId: string | null | undefined) => string | null;
}

const str = (v: unknown): string => (v == null ? '' : String(v));

/** The slim system line for a lead_events row. */
export function describeEvent(e: TimelineEntry, ctx: EventContext): string {
  const m = e.meta ?? {};
  const kind = m.kind;
  const who = ctx.nameOf(e.actor_id);
  const by = who ? ` · ${who}` : '';
  switch (kind) {
    case 'stage': {
      const from = STAGE_LABEL[m.from as Stage] ?? str(m.from);
      const to = STAGE_LABEL[m.to as Stage] ?? str(m.to);
      return `Bosqich: ${from} → ${to}${by}`;
    }
    case 'wait': {
      const reason = WAIT_REASON_LABEL[m.reason as WaitReason] ?? str(m.reason);
      const until = m.until ? whenLabel(`${str(m.until)}T09:00:00+05:00`).replace(/ \d\d:\d\d$/, '') : '';
      return `Kutish${until ? `: ${until} gacha` : ''}${reason ? ` (${reason})` : ''}${by}`;
    }
    case 'lost': {
      const reason = ctx.lostLabel(str(m.reason));
      const comp = str(m.competitor);
      return `Yo'qotildi: ${reason}${comp ? ` · ${comp}` : ''}${by}`;
    }
    case 'promise': {
      const status = PROMISE_STATUS_LABEL[str(m.status)] ?? str(m.status);
      const text = str(m.text);
      return text ? `Va'da so'raldi: ${text} — ${status}${by}` : `Va'da ${status}${by}`;
    }
    case 'merge':
      return `Birlashtirildi${m.name ? `: ${str(m.name)}` : ''}${by}`;
    case 'claim':
      return `Lidni oldi${by}`;
    case 'reassign':
      return `Egasi o'zgartirildi${by}`;
    case 'reactivation':
      return `Qayta faollashtirish navbatidan chiqdi`;
    case 'reopen':
      return m.why === 'client_wrote' ? 'Mijoz yozdi — lid qayta ochildi' : `Qayta ochildi${by}`;
    case 'student_match':
      return 'Talaba bilan mos keldi';
    case 'ladder': {
      const next = m.next ? whenLabel(str(m.next)) : '';
      return `Zinapoya: ${str(m.attempt)}-urinish${next ? `, keyingi ${next}` : ''}`;
    }
    case 'escalation':
      return `Eskalatsiya #${str(m.n)}${m.minutes_late != null ? `: ${str(m.minutes_late)} daq. kechikdi` : ''}`;
    default:
      return str(kind);
  }
}

export function mediaLabel(messageType: unknown): string {
  switch (messageType) {
    case 'image':
      return 'Rasm';
    case 'voice':
      return 'Ovozli xabar';
    case 'file':
      return 'Fayl';
    default:
      return 'Xabar (matnsiz)';
  }
}
