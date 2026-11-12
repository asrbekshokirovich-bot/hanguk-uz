/**
 * Hanguk Ish — the job apps' schema `ish` in hanguk.uz's Supabase project
 * (hanguk_ish/supabase, P48): what its staff functions (`staff_*`, migration
 * 20261112170000) hand to hanguk.uz.
 * Real responses: hanguk_ish/test/fixtures/backend_samples.json.
 */

export type OfferStatus = 'sent' | 'declined' | 'applied';

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
  worker: IshWorker;
}

/** `staff_shift`: one job with what only the staff see. */
export interface IshJobPage extends IshJobCard {
  business_id: string;
  contact: IshContact | null;
  notes: { source: string; notes: string } | null;
  offers: IshOffer[];
  applications: IshApplication[];
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
