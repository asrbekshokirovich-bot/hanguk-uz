import { formatCity, formatPhone } from './format';
import type { BandKey, LeadVM, SourceFilter, WorklistBand } from './types';

/**
 * Pure worklist logic — search, source filter, Call Today, urgency banding and
 * the header stats. No React, no Supabase, no clock reads: `now` is always
 * passed in. Everything here is unit-testable in isolation.
 */

/**
 * A lead is "call today" when its next call is due within the working day, or
 * is already overdue. Twelve hours out is the same window the mockup uses —
 * anything further is tomorrow's problem.
 */
export const CALL_TODAY_WINDOW_MINUTES = 720;

/** Attempts at or above this count turn the attempt pill danger-tinted. */
export const ATTEMPT_ALARM = 4;

/** Bands render in this fixed order; empty ones are dropped. */
export const BAND_ORDER: BandKey[] = ['overdue', 'new', 'booked', 'working'];

/**
 * Due today or already overdue. A lead with no next call scheduled counts as
 * due today — nothing is holding it, so it is the operator's to pick up now.
 */
export function isCallToday(lead: LeadVM): boolean {
  if (lead.dueInMinutes === null) return true;
  return lead.dueInMinutes <= CALL_TODAY_WINDOW_MINUTES;
}

/** Past its due time. Unscheduled leads are not overdue, they are unplanned. */
export function isOverdue(lead: LeadVM): boolean {
  return lead.dueInMinutes !== null && lead.dueInMinutes < 0;
}

/**
 * Search matches name, phone, city and the programme the lead asked about.
 *
 * Both the stored and the displayed forms are searched, so typing what is on
 * screen ("Tashkent city", "+998 94") finds the row even though the record
 * holds `tashkent_city` and `941966909`.
 */
export function matchesQuery(lead: LeadVM, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    lead.name,
    lead.phone,
    formatPhone(lead.phone),
    lead.city,
    formatCity(lead.city),
    lead.lead.preferred_program,
    lead.lead.preferred_university,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** Source chip AND Call Today AND search — the three filters compose. */
export function filterLeads(
  leads: LeadVM[],
  source: SourceFilter,
  callToday: boolean,
  query: string,
): LeadVM[] {
  return leads.filter((lead) => {
    if (source !== 'all' && lead.source !== source) return false;
    if (callToday && !isCallToday(lead)) return false;
    return matchesQuery(lead, query);
  });
}

/**
 * Which band a row belongs to. Order matters: overdue outranks everything
 * except a never-called lead, because a lead that has never been called has no
 * promise to break — it has a first-response clock instead.
 */
export function bandFor(lead: LeadVM): BandKey {
  if (lead.stage === 'new') return 'new';
  if (isOverdue(lead)) return 'overdue';
  if (lead.stage === 'booked') return 'booked';
  return 'working';
}

/**
 * Group into the four bands, dropping empties. Within a band the highest score
 * comes first, and an overdue lead sorts by how long it has been waiting.
 */
export function buildBands(leads: LeadVM[]): WorklistBand[] {
  return BAND_ORDER.map((key) => ({
    key,
    rows: leads
      .filter((lead) => bandFor(lead) === key)
      .sort((a, b) => {
        if (key === 'overdue') return (a.dueInMinutes ?? 0) - (b.dueInMinutes ?? 0);
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name);
      }),
  })).filter((band) => band.rows.length > 0);
}

export interface WorklistStats {
  uncalled: number;
  overdue: number;
  booked: number;
  avgScore: number;
  callToday: number;
}

/**
 * Header stats. Computed over the whole worklist rather than the filtered view
 * — an operator narrowing to Instagram still needs to see the real overdue
 * count, otherwise the filter hides the very work the strip is there to surface.
 */
export function worklistStats(leads: LeadVM[]): WorklistStats {
  const total = leads.length;
  const sum = leads.reduce((acc, lead) => acc + lead.score, 0);
  return {
    uncalled: leads.filter((lead) => lead.stage === 'new').length,
    overdue: leads.filter((lead) => lead.stage !== 'new' && isOverdue(lead)).length,
    booked: leads.filter((lead) => lead.stage === 'booked').length,
    avgScore: total ? Math.round(sum / total) : 0,
    callToday: leads.filter(isCallToday).length,
  };
}

/** Minutes between now and an ISO timestamp; negative when it has passed. */
export function minutesUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
}
