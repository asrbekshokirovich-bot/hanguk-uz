import type { Lead } from '@/contexts/LeadsContext';

/**
 * How long a fresh lead may sit without a call result before the CRM treats
 * it as overdue. Kept in step with `fn_lead_sla_scan`'s default in
 * `supabase/migrations/20260923090000_lead_sla_watchdog.sql` — that function
 * sends the Telegram alert to owners/admins at the same line this draws in
 * red, so the two must not drift apart.
 */
export const UNCONTACTED_SLA_MINUTES = 10;

/** Starts warning this many minutes before the SLA line is crossed. */
const WARN_LEAD_MINUTES = 3;

/**
 * True once nobody has recorded any contact with this lead. `call_result` is
 * what the ALOQA column actually writes; `last_contacted_at` is kept as a
 * fallback for the same signal from elsewhere, so either one stops the clock.
 */
export const isUncontacted = (lead: Lead): boolean =>
  !lead.call_result && !lead.last_contacted_at;

export type UncontactedSla =
  | { state: 'warn'; minutesLeft: number }
  | { state: 'breached'; minutesWaiting: number };

/**
 * How urgent an uncontacted lead's wait has become, or `null` while there is
 * still time to spare. Only meaningful for `isUncontacted` leads — once a
 * lead has a call result its clock has already stopped.
 */
export const uncontactedSla = (lead: Lead, now: Date): UncontactedSla | null => {
  if (!isUncontacted(lead)) return null;
  const elapsedMinutes = (now.getTime() - new Date(lead.created_at).getTime()) / 60_000;
  if (elapsedMinutes >= UNCONTACTED_SLA_MINUTES) {
    return { state: 'breached', minutesWaiting: Math.floor(elapsedMinutes) };
  }
  if (elapsedMinutes >= UNCONTACTED_SLA_MINUTES - WARN_LEAD_MINUTES) {
    return { state: 'warn', minutesLeft: Math.ceil(UNCONTACTED_SLA_MINUTES - elapsedMinutes) };
  }
  return null;
};
