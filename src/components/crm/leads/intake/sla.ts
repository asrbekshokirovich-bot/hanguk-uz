import type { Lead } from '@/contexts/LeadsContext';

/**
 * How long a fresh lead may sit without a call result before the CRM treats
 * it as overdue and alerts owners/admins. Kept in step with
 * `fn_lead_sla_scan`'s default in
 * `supabase/migrations/<ts>_lead_sla_watchdog.sql` — that function sends the
 * Telegram alert at the same line this countdown reaches zero.
 */
export const UNCONTACTED_SLA_MINUTES = 10;

/** Turns the countdown red once this many seconds remain (or fewer). */
const URGENT_AT_SECONDS_LEFT = 5 * 60;

/**
 * True once nobody has recorded any contact with this lead. `call_result` is
 * what the ALOQA column actually writes; `last_contacted_at` is kept as a
 * fallback for the same signal from elsewhere, so either one stops the clock.
 */
export const isUncontacted = (lead: Lead): boolean =>
  !lead.call_result && !lead.last_contacted_at;

export interface UncontactedCountdown {
  /** Seconds until the SLA line; negative once past it. */
  secondsLeft: number;
  /** True from 5 minutes remaining onward, including after the line is crossed. */
  urgent: boolean;
}

/**
 * The live countdown for an uncontacted lead, or `null` once it has a call
 * result and the clock has stopped. Ticks with `now`, so a caller re-renders
 * it on an interval to keep the number moving in front of the operator.
 */
export const uncontactedCountdown = (lead: Lead, now: Date): UncontactedCountdown | null => {
  if (!isUncontacted(lead)) return null;
  const elapsedSeconds = (now.getTime() - new Date(lead.created_at).getTime()) / 1000;
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
