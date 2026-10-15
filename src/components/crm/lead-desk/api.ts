/**
 * Lead module v2 — the one place the browser talks to the lead tables and RPCs.
 *
 * Every function throws a `LeadApiError` whose `message` is the raw database
 * message ("missing_fields:goal,decider", "next_action_required", ...). Show it
 * to a person with `explainError()` from ./copy.
 *
 * `supabase` is cast to a loose handle because the generated types
 * (src/integrations/supabase/types.ts) are stale for everything here.
 */
import { supabase } from '@/integrations/supabase/client';
import type {
  AlertRecipient,
  CallResult,
  DeskCounts,
  DeskRow,
  LeadContact,
  LeadDraft,
  LeadPromise,
  LeadReport,
  LeadSettings,
  LeadV2,
  MergeSuggestion,
  ReactivationRow,
  RecordCallPayload,
  RecordCallResult,
  SocialComment,
  Stage,
  TimelineEntry,
  WaitReason,
} from './types';

export class LeadApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'LeadApiError';
    this.code = code;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface LooseClient {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string; code?: string } | null }>;
  from: (table: string) => any;
}
const db = supabase as unknown as LooseClient;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new LeadApiError(error.message, error.code);
  return data as T;
}

async function rows<T>(q: PromiseLike<{ data: any; error: { message: string; code?: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new LeadApiError(error.message, error.code);
  return (data ?? []) as T[];
}

async function one<T>(q: PromiseLike<{ data: any; error: { message: string; code?: string } | null }>): Promise<T | null> {
  const { data, error } = await q;
  if (error) throw new LeadApiError(error.message, error.code);
  return (data ?? null) as T | null;
}

async function exec(q: PromiseLike<{ error: { message: string; code?: string } | null }>): Promise<void> {
  const { error } = await q;
  if (error) throw new LeadApiError(error.message, error.code);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---- desk ------------------------------------------------------------------

export const fetchDesk = () => rpc<DeskRow[]>('lead_desk');
export const fetchDeskCounts = () => rpc<DeskCounts>('lead_desk_counts');
export const fetchTimeline = (leadId: string, limit = 300) =>
  rpc<TimelineEntry[]>('lead_timeline_v2', { p_lead_id: leadId, p_limit: limit });

export const fetchLead = (id: string) => one<LeadV2>(db.from('leads').select('*').eq('id', id).maybeSingle());

// ---- actions (each one is a database function that checks the role itself) -----

export const recordCall = (leadId: string, result: CallResult, payload: RecordCallPayload = {}) =>
  rpc<RecordCallResult>('lead_record_call', { p_lead_id: leadId, p_result: result, p_payload: payload });

export const saveFields = (leadId: string, fields: Record<string, unknown>) =>
  rpc<void>('lead_save_fields', { p_lead_id: leadId, p_fields: fields });

export const setStage = (leadId: string, stage: Exclude<Stage, 'new' | 'student' | 'lost' | 'waiting'>, payload: Record<string, unknown> = {}) =>
  rpc<void>('lead_set_stage', { p_lead_id: leadId, p_stage: stage, p_payload: payload });

export const waitLead = (leadId: string, until: string, reason: WaitReason) =>
  rpc<void>('lead_wait', { p_lead_id: leadId, p_until: until, p_reason: reason });

export const loseLead = (leadId: string, reason: string, competitor?: string | null, note?: string | null) =>
  rpc<void>('lead_lose', { p_lead_id: leadId, p_reason: reason, p_competitor: competitor ?? null, p_note: note ?? null });

export const reopenLead = (leadId: string) => rpc<void>('lead_reopen', { p_lead_id: leadId });
export const claimLead = (leadId: string) => rpc<void>('lead_claim', { p_lead_id: leadId });
export const reassignLead = (leadId: string, ownerId: string | null) =>
  rpc<void>('lead_reassign', { p_lead_id: leadId, p_owner: ownerId });
export const pinLead = (leadId: string, pinned: boolean) => rpc<void>('lead_pin', { p_lead_id: leadId, p_pinned: pinned });

export const requestPromise = (leadId: string, kind: LeadPromise['kind'], text: string, reason?: string) =>
  rpc<string>('lead_request_promise', { p_lead_id: leadId, p_kind: kind, p_text: text, p_reason: reason ?? null });
export const decidePromise = (promiseId: string, approve: boolean) =>
  rpc<void>('lead_decide_promise', { p_promise_id: promiseId, p_approve: approve });

export const startQueue = (queueKey: string) => rpc<number>('lead_start_queue', { p_queue_key: queueKey });

export const confirmMerge = (suggestionId: string) => rpc<void>('lead_merge_confirm', { p_suggestion_id: suggestionId });
export const dismissMerge = (suggestionId: string) => rpc<void>('lead_merge_dismiss', { p_suggestion_id: suggestionId });

export const createManualLead = (args: {
  name: string;
  phone: string;
  origin: 'office' | 'referral' | 'call' | 'missed';
  referralType?: string | null;
  referralName?: string | null;
  fields?: Record<string, unknown>;
}) =>
  rpc<string>('lead_create_manual', {
    p_name: args.name,
    p_phone: args.phone,
    p_origin: args.origin,
    p_referral_type: args.referralType ?? null,
    p_referral_name: args.referralName ?? null,
    p_fields: args.fields ?? {},
  });

export const answerComment = (commentId: string, reply: string) =>
  rpc<void>('lead_comment_answer', { p_comment_id: commentId, p_reply: reply });

export const fetchReport = (from: string, to: string) => rpc<LeadReport>('lead_report', { p_from: from, p_to: to });

// ---- the card's side tables ---------------------------------------------------

export const fetchContacts = (leadId: string) =>
  rows<LeadContact>(db.from('lead_contacts').select('*').eq('lead_id', leadId).order('created_at'));

export const saveContact = (c: Partial<LeadContact> & { lead_id: string }) =>
  exec(c.id ? db.from('lead_contacts').update(c).eq('id', c.id) : db.from('lead_contacts').insert(c));

export const deleteContact = (id: string) => exec(db.from('lead_contacts').delete().eq('id', id));

export const fetchDrafts = (leadId: string) =>
  rows<LeadDraft>(db.from('lead_drafts').select('*').eq('lead_id', leadId).eq('status', 'pending').order('due_at'));

export const handleDraft = (id: string, status: 'sent' | 'skipped', userId: string | null) =>
  exec(db.from('lead_drafts').update({ status, handled_by: userId, handled_at: new Date().toISOString() }).eq('id', id));

export const fetchPromises = (leadId: string) =>
  rows<LeadPromise>(db.from('lead_promises').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }));

export const fetchPendingPromises = () =>
  rows<LeadPromise & { leads?: { full_name: string } | null }>(
    db.from('lead_promises').select('*, leads(full_name)').eq('status', 'pending').order('created_at'),
  );

export const fetchMergeSuggestions = (leadId: string) =>
  rows<MergeSuggestion>(
    db.from('lead_merge_suggestions').select('*').eq('status', 'pending').or(`lead_id.eq.${leadId},other_id.eq.${leadId}`),
  );

/** Other leads with the same name (what a merge suggestion shows). */
export const fetchLeadBrief = (ids: string[]) =>
  ids.length
    ? rows<Pick<LeadV2, 'id' | 'full_name' | 'phone' | 'source' | 'stage' | 'created_at'>>(
        db.from('leads').select('id, full_name, phone, source, stage, created_at').in('id', ids),
      )
    : Promise.resolve([]);

// ---- AI field suggestions (spec §10 "Maydon takliflari") -----------------------------

export interface FieldSuggestion {
  id: string;
  lead_id: string;
  field: string;
  suggested_value: string | null;
  confidence: number | null;
  evidence: string | null;
  evidence_channel: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'corrected';
}

export const fetchSuggestions = (leadId: string) =>
  rows<FieldSuggestion>(
    db.from('lead_field_suggestions').select('*').eq('lead_id', leadId).eq('status', 'pending').order('created_at'),
  );

/** Accept a suggestion, optionally with the operator's corrected value (applied through the v2 field list). */
export const applySuggestion = (suggestionId: string, value?: string | null) =>
  rpc<FieldSuggestion>('lead_apply_suggestion', { p_suggestion_id: suggestionId, p_value: value ?? null });

export const rejectSuggestion = (suggestionId: string) =>
  rpc<FieldSuggestion>('lead_reject_suggestion', { p_suggestion_id: suggestionId });

// ---- comments (Izohlar) -------------------------------------------------------

export const fetchComments = (opts: { onlyOpen?: boolean; limit?: number } = {}) => {
  let q = db.from('social_comments').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.onlyOpen) q = q.is('replied_at', null);
  return rows<SocialComment>(q);
};

// ---- lists --------------------------------------------------------------------

/** A row of any of the list pages (Barcha lidlar / Yo'qotilgan / Baza). */
export type LeadListRow = Pick<
  LeadV2,
  | 'id'
  | 'full_name'
  | 'phone'
  | 'source'
  | 'contact_channel'
  | 'stage'
  | 'crm_generation'
  | 'owner_id'
  | 'cert_level'
  | 'education_level'
  | 'city'
  | 'priority_score'
  | 'last_operator_msg_at'
  | 'last_contacted_at'
  | 'next_action_at'
  | 'next_action_kind'
  | 'ai_summary'
  | 'lost_reason'
  | 'lost_competitor'
  | 'lost_at'
  | 'lost_by'
  | 'created_at'
  | 'updated_at'
  | 'instagram_handle'
  | 'telegram_handle'
  | 'campaign_name'
  | 'form_name'
  | 'pinned_at'
  | 'reactivation_queue'
  | 'call_result'
>;

const LIST_COLUMNS =
  'id, full_name, phone, source, contact_channel, stage, crm_generation, owner_id, cert_level, education_level, city, ' +
  'priority_score, last_operator_msg_at, last_contacted_at, next_action_at, next_action_kind, ai_summary, lost_reason, ' +
  'lost_competitor, lost_at, lost_by, created_at, updated_at, instagram_handle, telegram_handle, campaign_name, form_name, ' +
  'pinned_at, reactivation_queue, call_result';

export interface LeadListFilter {
  q?: string;
  stage?: Stage | 'active' | null;
  source?: string | null;
  ownerId?: string | 'none' | null;
  city?: string | null;
  cert?: string | null;
  lostReason?: string | null;
  from?: string | null; // ISO instant, created_at >=
  to?: string | null; // ISO instant, created_at <
  limit?: number;
  offset?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyListFilter(q: any, f: LeadListFilter) {
  if (f.q?.trim()) {
    const s = f.q.trim().replace(/[%,()]/g, ' ');
    const digits = s.replace(/\D/g, '');
    const parts = [`full_name.ilike.%${s}%`, `instagram_handle.ilike.%${s}%`, `telegram_handle.ilike.%${s}%`];
    if (digits.length >= 4) parts.push(`phone.ilike.%${digits}%`);
    q = q.or(parts.join(','));
  }
  if (f.source) q = q.eq('source', f.source);
  if (f.city) q = q.eq('city', f.city);
  if (f.cert) q = q.eq('cert_level', f.cert);
  if (f.lostReason) q = q.eq('lost_reason', f.lostReason);
  if (f.ownerId === 'none') q = q.is('owner_id', null);
  else if (f.ownerId) q = q.eq('owner_id', f.ownerId);
  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lt('created_at', f.to);
  return q;
}

/**
 * "Barcha lidlar": active leads of the new system (and old cards that wrote
 * again). Students and lost leads have their own pages.
 */
export const fetchAllLeads = (f: LeadListFilter = {}) => {
  let q = db
    .from('leads')
    .select(LIST_COLUMNS, { count: 'exact' })
    .is('merged_into_id', null)
    .not('first_contact_at', 'is', null);
  q = f.stage && f.stage !== 'active' ? q.eq('stage', f.stage) : q.not('stage', 'in', '(student,lost)');
  q = applyListFilter(q, f).order('updated_at', { ascending: false }).range(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 50) - 1);
  return listWithCount<LeadListRow>(q);
};

/** "Yo'qotilgan": lost leads, any generation. */
export const fetchLostLeads = (f: LeadListFilter = {}) => {
  let q = db.from('leads').select(LIST_COLUMNS, { count: 'exact' }).is('merged_into_id', null).eq('stage', 'lost');
  q = applyListFilter(q, f).order('lost_at', { ascending: false, nullsFirst: false }).range(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 50) - 1);
  return listWithCount<LeadListRow>(q);
};

/** "Baza": every lead of the old CRM. */
export const fetchBazaLeads = (f: LeadListFilter = {}) => {
  let q = db.from('leads').select(LIST_COLUMNS, { count: 'exact' }).is('merged_into_id', null).eq('crm_generation', 'old');
  if (f.stage && f.stage !== 'active') q = q.eq('stage', f.stage);
  q = applyListFilter(q, f).order('updated_at', { ascending: false }).range(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? 50) - 1);
  return listWithCount<LeadListRow>(q);
};

async function listWithCount<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: PromiseLike<{ data: any; error: { message: string; code?: string } | null; count: number | null }>,
) {
  const { data, error, count } = await q;
  if (error) throw new LeadApiError(error.message, error.code);
  return { rows: (data ?? []) as T[], total: count ?? 0 };
}

// ---- reactivation queues ---------------------------------------------------------

export interface QueueSummary {
  queue_key: string;
  waiting: number; // not started
  ready: number; // started, flowing to BUGUN
  due: number; // eligible now
}

/** Counts per queue (spec §3.4 "Navbatlar"). */
export async function fetchQueueSummary(): Promise<QueueSummary[]> {
  const all: Pick<ReactivationRow, 'queue_key' | 'status' | 'due_at'>[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const page = await rows<Pick<ReactivationRow, 'queue_key' | 'status' | 'due_at'>>(
      db.from('reactivation_queues').select('queue_key, status, due_at').in('status', ['waiting', 'ready']).range(from, from + 999),
    );
    all.push(...page);
    if (page.length < 1000) break;
  }
  const now = Date.now();
  const by = new Map<string, QueueSummary>();
  for (const r of all) {
    const s = by.get(r.queue_key) ?? { queue_key: r.queue_key, waiting: 0, ready: 0, due: 0 };
    if (r.status === 'ready') s.ready += 1;
    else s.waiting += 1;
    if (r.due_at && new Date(r.due_at).getTime() <= now) s.due += 1;
    by.set(r.queue_key, s);
  }
  return [...by.values()].sort((a, b) => b.waiting + b.ready - (a.waiting + a.ready));
}

// ---- settings --------------------------------------------------------------------

export async function fetchSettings(): Promise<Partial<LeadSettings>> {
  const list = await rows<{ key: string; value: unknown }>(db.from('lead_settings').select('key, value'));
  return Object.fromEntries(list.map((r) => [r.key, r.value])) as Partial<LeadSettings>;
}

export const saveSetting = (key: keyof LeadSettings, value: unknown, userId: string | null) =>
  exec(db.from('lead_settings').upsert({ key, value, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'key' }));

export const fetchRecipients = () => rows<AlertRecipient>(db.from('lead_alert_recipients').select('*').order('label'));

export const saveRecipient = (r: Partial<AlertRecipient> & { chat_id: string }) =>
  exec(db.from('lead_alert_recipients').upsert(r, { onConflict: 'chat_id' }));

export const deleteRecipient = (chatId: string) => exec(db.from('lead_alert_recipients').delete().eq('chat_id', chatId));
