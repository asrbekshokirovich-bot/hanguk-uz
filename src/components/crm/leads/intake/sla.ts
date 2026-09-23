import type { Lead } from '@/contexts/LeadsContext';

/**
 * How long a "Yangi lid" may wait for its first call before owners/admins are
 * alerted. Kept in step with `fn_lead_sla_scan`'s default (see
 * `supabase/migrations/20260923150000_new_lead_section.sql`) — that function
 * sends the Telegram alert at the same moment this countdown reaches zero.
 */
export const UNCONTACTED_SLA_MINUTES = 10;

/** Turns the countdown red once this many seconds remain (or fewer). */
const URGENT_AT_SECONDS_LEFT = 5 * 60;

/**
 * A "Yangi lid": an Instagram/Telegram lead whose phone and name arrived after
 * the section went live (`new_lead_at`, set by the database), that nobody has
 * called yet. Older leads never carry `new_lead_at`, so they never land here.
 * `call_result` is what the ALOQA column writes; `last_contacted_at` is the
 * same signal from elsewhere — either one takes the lead out.
 */
export const isNewLead = (lead: Lead): boolean =>
  !!lead.new_lead_at &&
  !lead.call_result &&
  !lead.last_contacted_at &&
  lead.status !== 'converted' &&
  lead.status !== 'lost' &&
  !lead.converted_to_student_id;

export interface NewLeadCountdown {
  /** Seconds until the 10-minute line; negative once past it. */
  secondsLeft: number;
  /** True from 5 minutes remaining onward, including after the line is crossed. */
  urgent: boolean;
}

/** The live countdown for a "Yangi lid", or `null` for any other lead. */
export const newLeadCountdown = (lead: Lead, now: Date): NewLeadCountdown | null => {
  if (!isNewLead(lead)) return null;
  const elapsedSeconds = (now.getTime() - new Date(lead.new_lead_at as string).getTime()) / 1000;
  const secondsLeft = Math.round(UNCONTACTED_SLA_MINUTES * 60 - elapsedSeconds);
  return { secondsLeft, urgent: secondsLeft <= URGENT_AT_SECONDS_LEFT };
};

/** "9:59" — minutes:seconds, always the magnitude (sign is conveyed by the caller's wording). */
export const formatCountdown = (seconds: number): string => {
  const abs = Math.max(0, Math.trunc(Math.abs(seconds)));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
