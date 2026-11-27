/**
 * HanPyol — the job apps' schema `ish` in hanguk.uz's Supabase project
 * (hanguk_ish/supabase, P48): what its staff functions (`staff_*`, migration
 * 20261112170000) hand to hanguk.uz.
 * Real responses: hanguk_ish/test/fixtures/backend_samples.json.
 */

/** `closed`: another worker opened the job and it filled; `expired`: 30 minutes passed. */
export type OfferStatus = 'sent' | 'declined' | 'applied' | 'expired' | 'closed';

export type ApplicationStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'checked_in'
  | 'completed'
  | 'no_show';

export const BUSINESS_CATEGORIES = ['cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other'] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

/** How to reach an employer outside the app — the staff's eyes only. */
export interface IshContact {
  contact_name: string;
  phone: string;
  telegram: string;
  /** Where the job was found: a Telegram post, a group, a call. */
  source: string;
  notes: string;
}

export interface IshBusinessBrief {
  id: string;
  name: string;
  name_i18n: Record<string, string>;
  area: string;
  address: string;
  address_detail: string;
  category: string;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  rating: number | null;
  rating_count: number;
  completed_shifts: number;
}

/** `staff_businesses`: an employer the staff keep. */
export interface IshBusiness extends IshBusinessBrief {
  district: string | null;
  contact: IshContact;
  open_shifts: number;
  shifts: number;
}

/** `staff_app_businesses` (P52): a business the 사장님 app opened at once, without a check (P50). */
export interface IshAppBusiness extends IshBusinessBrief {
  /** verified: open; rejected: suspended by the staff; pending: waits for 국세청 (a number was given). */
  status: 'verified' | 'pending' | 'rejected';
  biz_no: string | null;
  created_at: string;
  open_shifts: number;
  shifts: number;
  /** Shifts it posted in the last 24 hours (the app allows 30). */
  shifts_24h: number;
  last_shift_at: string | null;
  /** Workers confirmed for its shifts still to come (a suspension leaves them there). */
  crew: number;
}

/** Where a complaint stands (the staff's note). */
export type ReportStatus = 'open' | 'in_review' | 'closed';

/** `staff_reports` (P52): a worker's complaint from the app (A11 «Shikoyat»). */
export interface IshReport {
  id: string;
  /** employer, payment, safety, other (A11); older: unpaid, not_as_described, time_dispute, no_show, behaviour. */
  reason: string;
  body: string;
  status: ReportStatus;
  created_at: string;
  worker: IshWorker | null;
  business: IshBusinessBrief | null;
  shift_id: string | null;
}

/** What the app business form sends (`staff_update_app_business`). */
export interface IshAppBusinessInput {
  id: string;
  name: string;
  nameUz: string;
  category: BusinessCategory;
  area: string;
  address: string;
  addressDetail: string;
}

/** The worker-app card of a job, as the staff functions start from it. */
export interface IshJobCard {
  id: string;
  title: string;
  duties: string;
  dress: string;
  address: string;
  starts_at: string;
  ends_at: string;
  hourly_wage: number;
  slots: number;
  slots_left: number;
  auto_confirm: boolean;
  status: 'open' | 'cancelled';
  lat: number | null;
  lng: number | null;
  business: IshBusinessBrief;
  /** Only invited workers see and take it (not in the feed or on the map). */
  invite_only: boolean;
  /** Its employer is kept by the staff (outside the app). */
  managed: boolean;
}

/** `staff_board`: a job with its counts. */
export interface IshBoardRow extends IshJobCard {
  offers: { sent: number; declined: number; applied: number };
  applications: { pending: number; confirmed: number; completed: number; no_show: number; paid: number };
  /** Finished, someone still to be marked (came or not). */
  attendance_due: boolean;
}

/** A worker as the staff see them (`staff_worker_card`). */
export interface IshWorker {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_path: string | null;
  language: string;
  languages: string[] | null;
  topik: number | null;
  university: string | null;
  district: string | null;
  visa: string | null;
  reliability: number | null;
  onboarded: boolean;
  completed: number;
  no_shows: number;
  /** Puyl the worker has now. */
  coins?: number;
}

/** `staff_candidates`: who fits a job, best first. */
export interface IshCandidate extends IshWorker {
  distance_km: number | null;
  /** The job's hour is in their «Qachon ishlay olaman» (or they set none). */
  available: boolean;
  /** On another shift at that time. */
  busy: boolean;
  offer_status: OfferStatus | null;
  application_status: ApplicationStatus | null;
}

export interface IshOffer {
  id: string;
  status: OfferStatus;
  note: string;
  created_at: string;
  /** The 30 minutes end (null: sent before offers had an end). */
  expires_at?: string | null;
  responded_at: string | null;
  worker: IshWorker;
}

export interface IshApplication {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  decided_at: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  pay_amount: number | null;
  paid_at: string | null;
  /** Puyl the worker spent to open the job (0: it came another way). */
  coins_paid?: number;
  /** The worker's own marks: 0 opened, 1 called the employer, 2 went to work. */
  worker_step?: number;
  worker: IshWorker;
}

/** `staff_shift`: one job with what only the staff see. */
export interface IshJobPage extends IshJobCard {
  business_id: string;
  contact: IshContact | null;
  notes: { source: string; notes: string } | null;
  offers: IshOffer[];
  applications: IshApplication[];
  /** What the whole job pays as the staff wrote it (null: hours × wage). */
  total_pay?: number | null;
  /** What it pays in all, the worker sees this. */
  job_pay?: number;
  /** Puyl to open the phone and address. */
  unlock_price?: number;
  /** When the staff last talked to the employer. */
  checked_at?: string | null;
}

/** A `messages` row (A10 chat). */
export interface IshMessage {
  id: number;
  application_id: string;
  sender_id: string;
  body: string;
  lang: string | null;
  translations: Record<string, string>;
  created_at: string;
}

/** What the employer form sends (`staff_save_business`). */
export interface IshBusinessInput {
  id: string | null;
  name: string;
  nameUz: string;
  category: BusinessCategory;
  area: string;
  address: string;
  addressDetail: string;
  district: string | null;
  lat: number | null;
  lng: number | null;
  contact: IshContact;
}

/** What the job form sends (`staff_save_shift`); times in ISO with offset. */
export interface IshJobInput {
  id: string | null;
  businessId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  hourlyWage: number;
  slots: number;
  duties: string;
  dress: string;
  address: string;
  autoConfirm: boolean;
  inviteOnly: boolean;
  source: string;
  notes: string;
}

/** P58: HanPyol's own staff roles — an admin keeps the staff list. */
export type IshStaffRole = 'operator' | 'admin';

/** `staff_people`: one of HanPyol's staff. */
export interface IshStaffMember {
  id: string;
  role: IshStaffRole;
  added_at: string;
  /** As in the CRM (hanguk.uz's profile), else the HanPyol profile. */
  name: string | null;
  email: string | null;
  /** The signed-in admin: nobody changes or removes themselves. */
  me: boolean;
}

/** `staff_people`: a hanguk.uz CRM account not on the list yet. */
export interface IshStaffCandidate {
  id: string;
  name: string | null;
  email: string | null;
  /** Its CRM roles (call_operator, admin, …). */
  roles: string[];
}

export interface IshStaffPeople {
  staff: IshStaffMember[];
  candidates: IshStaffCandidate[];
}

/** A job paid by the month (`ish.monthly_jobs`), as the staff keep it. */
export interface IshMonthlyJob {
  id: string;
  title: string;
  company: string;
  area: string;
  address: string;
  lat: number | null;
  lng: number | null;
  monthly_wage: number;
  days_per_week: number | null;
  hours_per_day: number | null;
  description: string;
  /** {"uz": {"title", "company", "description", "area"}, "ru": …} */
  translations: Record<string, Partial<Record<'title' | 'company' | 'description' | 'area', string>>>;
  status: 'open' | 'closed';
  category: string | null;
  work_time: 'day' | 'night' | null;
  /** Shown to a worker only after they pay (`unlock_monthly_job`); staff only. */
  contact_phone?: string | null;
  created_at: string;
}

/** What the staff type for a monthly job. */
export interface IshMonthlyJobInput {
  id: string | null;
  title: string;
  company: string;
  area: string;
  address: string;
  lat: number | null;
  lng: number | null;
  monthlyWage: number;
  daysPerWeek: number | null;
  hoursPerDay: number | null;
  description: string;
  category: string | null;
  workTime: 'day' | 'night' | null;
  contactPhone: string;
  translations: IshMonthlyJob['translations'];
}

/** `staff_monthly_interest`: a worker who said «Qiziqaman». */
export interface IshMonthlyInterest {
  job_id: string;
  worker_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
}

/** A move of a worker's puyl (`coin_ledger`): staff, unlock, topup, bonus. */
export interface IshCoinMove {
  delta: number;
  balance: number;
  reason: 'staff' | 'unlock' | 'topup' | 'bonus';
  note: string;
  created_at: string;
}

/** A worker as «Coinlar» lists them (`staff_coin_workers`): the balance and the last 5 moves. */
export interface IshCoinWorker {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  balance: number;
  history: IshCoinMove[];
}

/** `staff_topups`: a worker sent money for puyl; the staff check and approve. */
export interface IshTopup {
  id: string;
  worker_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  pyols: number;
  amount_won: number;
  method: 'bank' | 'kakaopay' | 'toss';
  payer_name: string;
  /** Bank transfer on the web / mini app: what the worker wrote as 입금자명. */
  code: string | null;
  status: 'unpaid' | 'pending' | 'approved' | 'rejected' | 'expired';
  note: string;
  created_at: string;
  /** When the worker tapped «Pul o'tkazdim». */
  paid_at: string | null;
  decided_at: string | null;
}

/** Where workers send the money (staff_set_payment_setting keys). */
export type IshPaymentKey =
  | 'bank'
  | 'kakaopay'
  | 'toss'
  | 'note'
  | 'bank_name'
  | 'bank_account'
  | 'bank_holder'
  | 'contact';

/** `payment_details`: the packs and where workers send the money. */
export interface IshPaymentDetails {
  packs: { pyols: number; won: number }[];
  methods: Partial<Record<IshPaymentKey, string>>;
}

/** `staff_free_dates_summary`: how many workers are free, by day and place. */
export interface IshFreeDay {
  day: string;
  district: string;
  part: 'day' | 'night' | 'any';
  workers: number;
}

/** `staff_free_workers`: one worker free on a day. */
export interface IshFreeWorker {
  worker_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  district: string;
  part: 'day' | 'night' | 'any';
  note: string;
  /** What matters most for that day: more money, lighter work, close to home (2026-11-26). */
  priority?: 'pay' | 'easy' | 'near' | 'any';
  languages: string[] | null;
  topik: number | null;
  reliability: number | null;
  coins: number;
  /** The no-show card: 'none', 'yellow', 'red' or 'blocked' (red/blocked: busy). */
  card: 'none' | 'yellow' | 'red' | 'blocked' | null;
  busy: boolean;
}

/** `staff_monthly_hires`: a long-term hire and its ₩50,000 fee after 2 weeks. */
export interface IshMonthlyHire {
  id: string;
  job_id: string;
  title: string;
  company: string;
  worker_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  hired_at: string;
  check_due: string;
  still_working: boolean | null;
  fee_won: number;
  fee_paid_at: string | null;
  state: 'check_due' | 'waiting' | 'fee_unpaid' | 'fee_paid' | 'left';
}

/** `staff_pyol_report`: one day of puyl. */
export interface IshPyolDay {
  day: string;
  sold: number | null;
  sold_won: number | null;
  free: number | null;
  gift: number | null;
  refunded: number | null;
  spent: number | null;
}

/** `staff_cards`: a worker or business with a yellow / red card (or blocked). */
export interface IshCard {
  subject_id: string;
  subject: 'worker' | 'business';
  name: string | null;
  phone: string | null;
  level: 'yellow' | 'red' | 'blocked';
  red_until: string | null;
  closed: boolean;
  good_jobs: number;
  last_why: 'no_show' | 'cancelled_booked' | 'staff' | 'good_jobs' | 'cleared' | null;
  updated_at: string;
}
