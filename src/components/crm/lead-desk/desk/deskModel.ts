/**
 * The desk's pure rules: grouping the `lead_desk()` rows into the three blocks,
 * searching them, and deciding what a row's timer, action and badges say.
 *
 * Nothing here touches React or the clock — `now` is always passed in — so the
 * rules are unit-tested on their own (desk/__tests__/deskModel.test.ts).
 */
import { channelLabel, NEXT_ACTION_LABEL, STAGE_LABEL, TIMER_LABEL } from '../copy';
import { clock, dayKey, formatCountdown, secondsUntil, urgency, whenLabel, type Urgency } from '../time';
import type { DeskBucket, DeskRow } from '../types';

/** KEYIN can be long: show this many before "Hammasini ko'rsatish". */
export const KEYIN_PREVIEW = 40;

/** The ladder has five calls (spec §9). */
export const LADDER_STEPS = 5;

export const BUCKETS: DeskBucket[] = ['hozir', 'bugun', 'keyin'];

export type GroupedRows = Record<DeskBucket, DeskRow[]>;

/** Split the rows by `bucket`, keeping the database order inside each block. */
export function groupByBucket(rows: readonly DeskRow[] | null | undefined): GroupedRows {
  const grouped: GroupedRows = { hozir: [], bugun: [], keyin: [] };
  for (const row of rows ?? []) {
    if (row.bucket === 'hozir' || row.bucket === 'bugun' || row.bucket === 'keyin') grouped[row.bucket].push(row);
  }
  return grouped;
}

// ---- search --------------------------------------------------------------------

/** Name, phone or @username, over what is already loaded. An empty query matches all. */
export function matchesQuery(row: DeskRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((row.full_name ?? '').toLowerCase().includes(q)) return true;

  const bare = q.replace(/^@/, '');
  const handle = (row.handle ?? '').toLowerCase().replace(/^@/, '');
  if (bare && handle.includes(bare)) return true;

  const digits = q.replace(/\D/g, '');
  return digits.length >= 3 && (row.phone ?? '').replace(/\D/g, '').includes(digits);
}

export function filterGrouped(grouped: GroupedRows, query: string): GroupedRows {
  if (!query.trim()) return grouped;
  return {
    hozir: grouped.hozir.filter((r) => matchesQuery(r, query)),
    bugun: grouped.bugun.filter((r) => matchesQuery(r, query)),
    keyin: grouped.keyin.filter((r) => matchesQuery(r, query)),
  };
}

// ---- HOZIR: the live countdown ---------------------------------------------------

export interface HozirTimer {
  /** whole seconds until `due_at`, negative once the 10 minutes are gone */
  seconds: number | null;
  /** "04:12", "−02:40" */
  text: string;
  /** green while there is time, yellow from the last 5 minutes, red once late */
  tone: Urgency;
  late: boolean;
  /** "KECHIKDI" once late */
  suffix: string | null;
}

export function hozirTimer(row: Pick<DeskRow, 'due_at'>, now: Date): HozirTimer {
  const seconds = secondsUntil(row.due_at, now);
  const tone = urgency(row.due_at, now);
  const late = tone === 'late';
  return { seconds, text: formatCountdown(seconds), tone, late, suffix: late ? 'KECHIKDI' : null };
}

/** Past its deadline and still in HOZIR (the database's own "breached"). */
export function isBreached(row: Pick<DeskRow, 'bucket' | 'due_at'>, now: Date): boolean {
  return row.bucket === 'hozir' && urgency(row.due_at, now) === 'late';
}

/**
 * A breached lead that somebody else owns: any operator may take it over, but
 * must press "Olish" first (spec §4). `myId` unknown means "do not offer it".
 */
export function isClaimable(row: Pick<DeskRow, 'bucket' | 'due_at' | 'owner_id'>, myId: string | null | undefined, now: Date): boolean {
  return Boolean(myId) && Boolean(row.owner_id) && row.owner_id !== myId && isBreached(row, now);
}

// ---- BUGUN / KEYIN: a time instead of a countdown ----------------------------------

export interface LaterTimer {
  /** the text of the left-hand cell: "10:00", "Ertaga 10:00", "07.10 10:00", "Mijoz yozdi 09:41" */
  primary: string;
  /** a reply timer also counts down to the moment it jumps to HOZIR */
  countdownTo: string | null;
}

const sameDay = (a: string, now: Date) => dayKey(a) === dayKey(now);

/** The moment a not-yet-HOZIR row is "for": the call time, the planned action, the draft's day. */
export function plannedAt(row: DeskRow): string | null {
  if (row.timer_kind === 'ladder' || row.timer_kind === 'callback') return row.due_at ?? row.sort_at;
  if (row.due_at) return row.timer_start_at ?? row.due_at;
  return row.next_action_at ?? row.sort_at;
}

export function laterTimer(row: DeskRow, now: Date): LaterTimer {
  if (row.timer_kind === 'reply' && row.due_at) {
    const wrote = row.last_client_msg_at ?? row.timer_start_at;
    return { primary: `${TIMER_LABEL.reply} ${clock(wrote)}`, countdownTo: row.timer_start_at ?? row.due_at };
  }
  const at = plannedAt(row);
  if (!at) return { primary: '—', countdownTo: null };
  // BUGUN: today's items are just a clock time; an overdue one says "Kecha 10:00".
  const primary = row.bucket === 'bugun' && sameDay(at, now) ? clock(at) : whenLabel(at, now);
  return { primary, countdownTo: null };
}

// ---- the action cell ---------------------------------------------------------------

export interface RowAction {
  /** "Qo'ng'iroq", "2-urinish", "Mijoz yozdi", "Kutish tugadi" */
  label: string;
  /** the next action's note, a draft count... */
  detail: string | null;
  /** full text for the tooltip: "Qo'ng'iroq · Bugun 18:00" */
  title: string;
}

/** "zinapoya 2/5" while a lead is on the "Ko'tarmadi" ladder, otherwise null. */
export function ladderLabel(row: Pick<DeskRow, 'timer_kind' | 'ladder_state' | 'attempt_no'>): string | null {
  if (row.timer_kind !== 'ladder' && row.ladder_state !== 'running') return null;
  const step = Math.min(LADDER_STEPS, Math.max(1, (row.attempt_no ?? 0) + 1));
  return `zinapoya ${step}/${LADDER_STEPS}`;
}

export function rowAction(row: DeskRow, now: Date): RowAction {
  // A running clock names itself: the timer kind, or the ladder's attempt.
  if (row.timer_kind && row.due_at) {
    if (row.timer_kind === 'ladder') {
      const label = `${Math.max(1, (row.attempt_no ?? 0) + 1)}-urinish`;
      return { label, detail: null, title: `${label} · ${whenLabel(row.due_at, now)}` };
    }
    const label = TIMER_LABEL[row.timer_kind];
    return { label, detail: null, title: `${label} · ${whenLabel(row.due_at, now)}` };
  }

  if (row.next_action_at) {
    const label = (row.next_action_kind && NEXT_ACTION_LABEL[row.next_action_kind]) || 'Keyingi harakat';
    const note = row.next_action_note?.trim() || null;
    return { label, detail: note, title: `${label} · ${whenLabel(row.next_action_at, now)}${note ? ` · ${note}` : ''}` };
  }

  if (row.pending_drafts > 0) {
    return { label: 'Qoralama', detail: `${row.pending_drafts} ta`, title: `Yuborilishi kutilayotgan qoralama: ${row.pending_drafts} ta` };
  }
  if (row.stage === 'contract') {
    return { label: STAGE_LABEL.contract, detail: "to'lov kutilmoqda", title: "Shartnoma yuborilgan, to'lov kutilmoqda" };
  }
  if (row.stage === 'offer') {
    return { label: STAGE_LABEL.offer, detail: "javob yo'q", title: 'Taklif yuborilgan, mijoz javob bermagan' };
  }
  return { label: '—', detail: null, title: '' };
}

// ---- the name cell -------------------------------------------------------------------

export const displayName = (row: Pick<DeskRow, 'full_name' | 'handle' | 'phone'>): string =>
  row.full_name?.trim() || row.handle?.trim() || row.phone?.trim() || 'Nomsiz lid';

export const handleText = (row: Pick<DeskRow, 'handle'>): string | null => {
  const h = row.handle?.trim();
  if (!h) return null;
  return h.startsWith('@') ? h : `@${h}`;
};

/** The channels a lead writes on, as short labels ("IG", "TG", "Forma"), each once. */
export function channelBadges(row: Pick<DeskRow, 'channels' | 'contact_channel' | 'source'>): string[] {
  const raw = row.channels && row.channels.length > 0 ? row.channels : [row.contact_channel ?? row.source];
  const labels = raw.filter(Boolean).map((c) => channelLabel(c));
  return [...new Set(labels.filter((l) => l !== '—'))];
}

/** The ad / form / campaign a lead came from (what the boss pays for). */
export const sourceText = (row: Pick<DeskRow, 'form_name' | 'ad_name' | 'campaign_name'>): string | null =>
  row.form_name?.trim() || row.ad_name?.trim() || row.campaign_name?.trim() || null;

/** "Hovuz" when nobody owns it yet, "Siz" for the viewer, otherwise the name. */
export function ownerLabel(
  ownerId: string | null,
  names: Readonly<Record<string, string>>,
  myId?: string | null,
): string {
  if (!ownerId) return 'Hovuz';
  if (myId && ownerId === myId) return 'Siz';
  return names[ownerId] || 'Operator';
}

// ---- alerts ------------------------------------------------------------------------------

/**
 * The HOZIR rows that were not in HOZIR at the previous refresh. `previous` is
 * null on the first load — then nothing is new (an operator opening the desk
 * is not alerted about what is already there).
 */
export function detectNewHozir(previous: ReadonlySet<string> | null, rows: readonly DeskRow[]): DeskRow[] {
  if (previous === null) return [];
  return rows.filter((r) => r.bucket === 'hozir' && !previous.has(r.id));
}

export const hozirIds = (rows: readonly DeskRow[]): Set<string> =>
  new Set(rows.filter((r) => r.bucket === 'hozir').map((r) => r.id));
