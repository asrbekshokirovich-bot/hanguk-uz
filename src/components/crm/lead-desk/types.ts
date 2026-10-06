/**
 * Lead module v2 — shared types.
 *
 * These mirror the database contract in
 * supabase/migrations/20261005161000_lead_v2_schema.sql and
 * 20261005162000_lead_v2_engine.sql (see docs/lead-module-v2.md). The generated
 * Supabase types are stale for `leads`, so the module has its own.
 */

export type Stage = 'new' | 'contacted' | 'interested' | 'offer' | 'contract' | 'student' | 'waiting' | 'lost';

/** Which kind of 10-minute clock a lead carries. */
export type TimerKind = 'first' | 'reply' | 'ladder' | 'callback';

export type CallResult = 'talked' | 'no_answer' | 'busy' | 'wrong_number';

export type DeskBucket = 'hozir' | 'bugun' | 'keyin';

export type Decider = 'self' | 'parent' | 'relative';

export type ReferralType = 'student' | 'alumni' | 'parent' | 'partner' | 'other';

export type NextActionKind = 'callback' | 'followup' | 'wait_end' | 'reactivation' | 'task';

export type WaitReason = 'exam_result' | 'family_decision' | 'money' | 'next_intake' | 'other';

/** One row of `lead_desk()`: a lead that has something to do. */
export interface DeskRow {
  id: string;
  full_name: string;
  phone: string | null;
  source: string;
  contact_channel: string | null;
  channels: string[] | null;
  handle: string | null;
  campaign_name: string | null;
  form_name: string | null;
  ad_name: string | null;
  stage: Stage;
  owner_id: string | null;
  crm_generation: 'old' | 'new';
  timer_kind: TimerKind | null;
  timer_start_at: string | null;
  due_at: string | null;
  next_action_at: string | null;
  next_action_kind: NextActionKind | null;
  next_action_note: string | null;
  attempt_no: number;
  ladder_state: 'idle' | 'running' | 'stopped' | 'exhausted';
  last_client_msg_at: string | null;
  priority_score: number | null;
  pinned: boolean;
  /** how many of the 5 mandatory fields are still empty */
  missing: number;
  pending_drafts: number;
  referral: boolean;
  ai_summary: string | null;
  bucket: DeskBucket;
  sort_at: string | null;
}

/** The sidebar badges and desk header: `lead_desk_counts()`. */
export interface DeskCounts {
  hozir: number;
  breached: number;
  barcha: number;
  yoqotilgan: number;
  baza: number;
  comments: number;
}

/** The lead row as the card reads it (`select *` on `leads`, only what v2 uses). */
export interface LeadV2 {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  source_id: string | null;
  status: string;
  stage: Stage;
  crm_generation: 'old' | 'new';
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  first_contact_at: string | null;
  timer_kind: TimerKind | null;
  timer_start_at: string | null;
  due_at: string | null;
  last_client_msg_at: string | null;
  last_operator_msg_at: string | null;
  last_contacted_at: string | null;
  /** when the last call attempt was recorded (call_attempts); null = never called */
  last_attempt_at: string | null;
  /** the old CRM's call result (kept for old leads) */
  call_result: string | null;
  answered_at: string | null;
  answered_by: string | null;
  answer_kind: 'call' | 'call_attempt+chat' | 'call_attempt' | 'chat' | 'comment' | null;
  attempt_no: number;
  next_attempt_at: string | null;
  ladder_state: 'idle' | 'running' | 'stopped' | 'exhausted';
  next_action_at: string | null;
  next_action_kind: NextActionKind | null;
  next_action_note: string | null;
  wait_until: string | null;
  wait_reason: WaitReason | null;
  lost_reason: string | null;
  lost_competitor: string | null;
  lost_at: string | null;
  /** who closed it (null: the system, e.g. the ladder's "aloqa yo'q", or an old-CRM card) */
  lost_by?: string | null;
  // the card
  education_level: string | null; // "Maqsad"
  cert_level: string | null;
  age: number | null;
  study_year: string | null;
  city: string | null;
  decider: Decider | null;
  objection: string | null;
  competitor: string | null;
  exam_date: string | null;
  target_intake: string | null;
  budget_range: string | null;
  language: 'uz' | 'ru' | null;
  preferred_channel: string | null;
  preferred_time_text: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  form_name: string | null;
  utm: Record<string, unknown> | null;
  referral_type: ReferralType | null;
  referral_name: string | null;
  referred_by_student_id: string | null;
  product_fit: string | null;
  contact_channel: string | null;
  how_heard: string | null;
  ai_summary: string | null;
  ai_brief_at: string | null;
  priority_score: number | null;
  pinned_at: string | null;
  merged_into_id: string | null;
  matched_student_id: string | null;
  converted_to_student_id: string | null;
  instagram_handle: string | null;
  telegram_handle: string | null;
  notes: string | null;
  asked_price: boolean;
  reactivation_queue: string | null;
  contract_date: string | null;
}

export type TimelineKind = 'message_in' | 'message_out' | 'call' | 'event' | 'comment';

/** One entry of `lead_timeline_v2()`. */
export interface TimelineEntry {
  at: string;
  kind: TimelineKind;
  channel: string | null;
  direction: string | null;
  body: string | null;
  actor_id: string | null;
  meta: Record<string, unknown> & { kind?: string };
}

export interface LeadContact {
  id: string;
  lead_id: string;
  role: 'student' | 'parent' | 'relative';
  name: string | null;
  phone: string | null;
  relation: string | null;
  preferred_time: string | null;
  is_decider: boolean;
}

export interface LeadDraft {
  id: string;
  lead_id: string;
  kind: 'followup_d1' | 'followup_d3' | 'followup_d7' | 'ladder_dm' | 'wait_reminder' | 'ai_reply' | 'reactivation';
  channel: string | null;
  text: string;
  due_at: string;
  status: 'pending' | 'sent' | 'skipped';
}

export interface LeadPromise {
  id: string;
  lead_id: string;
  operator_id: string | null;
  kind: 'discount' | 'installment' | 'other';
  text: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface MergeSuggestion {
  id: string;
  lead_id: string;
  other_id: string;
  reason: string;
  status: 'pending' | 'merged' | 'dismissed';
}

export interface SocialComment {
  id: string;
  platform: string;
  post_id: string | null;
  post_label: string | null;
  comment_id: string | null;
  author_username: string | null;
  text: string | null;
  created_at: string;
  lead_id: string | null;
  replied_at: string | null;
  replied_by: string | null;
  reply_text: string | null;
}

export interface ReactivationRow {
  id: string;
  lead_id: string;
  queue_key: string;
  reason: string | null;
  offer_key: string | null;
  channel: 'call' | 'dm';
  due_at: string | null;
  status: 'waiting' | 'ready' | 'moved' | 'done' | 'cancelled';
}

export interface AlertRecipient {
  chat_id: string;
  label: string | null;
  enabled: boolean;
  watchdog: boolean;
  staff_user_id: string | null;
  escalate: boolean;
  boss_alerts: boolean;
  reports_daily: boolean;
  reports_weekly: boolean;
}

/** What `lead_record_call` returns. */
export interface RecordCallResult {
  ok: boolean;
  result: CallResult;
  stage?: Stage;
  attempt_no?: number;
  next_attempt_at?: string | null;
  next_action_at?: string | null;
  /** a first/reply timer is still running: the operator should write in the chat now */
  chat_prompt?: boolean;
  chat_available?: boolean;
  /** template key to offer ("confirm_phone") */
  template?: string;
  /** the lead was closed ("aloqa yo'q") */
  lost?: boolean;
}

export interface RecordCallPayload {
  started_at?: string;
  fields?: Partial<
    Pick<
      LeadV2,
      | 'education_level'
      | 'cert_level'
      | 'age'
      | 'study_year'
      | 'city'
      | 'decider'
      | 'objection'
      | 'competitor'
      | 'referral_type'
      | 'referral_name'
      | 'product_fit'
      | 'exam_date'
      | 'target_intake'
      | 'preferred_time_text'
      | 'language'
    >
  >;
  stage?: Exclude<Stage, 'new' | 'student'>;
  next_action_at?: string;
  next_action_kind?: 'callback' | 'followup';
  note?: string;
  wait_until?: string;
  wait_reason?: WaitReason;
  lost_reason?: string;
  lost_competitor?: string;
}

// ---- settings (lead_settings.key -> value) ----------------------------------

export interface LostReasonSetting {
  key: string;
  label: string;
  queue: string | null;
}

export interface TemplateSetting {
  key: string;
  group: string;
  uz: string;
  ru: string;
  needs_boss?: boolean;
}

export interface OfferSetting {
  title: string;
  text: string;
  needs_boss: boolean;
}

export interface LeadSettings {
  work_hours: { start: string; end: string; days: number[] };
  timer_minutes: number;
  escalation_repeat_minutes: number;
  ladder: {
    steps: { kind: 'minutes' | 'next_day' | 'days'; value?: number; at?: string }[];
    window_days: number;
    dm_after_attempt: number;
  };
  auto_reply: { uz: string; ru: string };
  forbidden_words: string[];
  boss_alert_words: string[];
  queue_daily_limit: number;
  chat_answers_phone_leads: boolean;
  control_line_10min: boolean;
  tv_warning: boolean;
  hanbox_group_date: string;
  hanbox_announced: boolean;
  no_risk_announced: boolean;
  lost_reasons: LostReasonSetting[];
  objections: { key: string; label: string }[];
  competitors: string[];
  offers: Record<string, OfferSetting>;
  templates: TemplateSetting[];
}

/** The `lead_report()` payload. */
export interface LeadReport {
  from: string;
  to: string;
  totals: {
    leads: number;
    answered: number;
    answered_in_10: number;
    talked: number;
    offers: number;
    contracts_sent: number;
    students: number;
  };
  by_source: { source: string; leads: number; answered: number; talked: number; offers: number; students: number }[];
  by_ad: { ad: string; leads: number; students: number }[];
  by_operator: { operator_id: string; students: number }[];
  lost: { reason: string | null; n: number }[];
  generation: { generation: 'old' | 'new'; leads: number; answered: number; students: number }[];
}
