import type { Lead } from '@/contexts/LeadsContext';

/**
 * View-model types for the CRM → Leads call worklist.
 *
 * The worklist bands by *urgency*, not by pipeline stage, so the row model
 * carries both: `stage` for the pill on the right, and the next-call due time
 * for the band the row lands in.
 */

/**
 * The lead record as it actually arrives from Supabase.
 *
 * `leads.select('*')` returns `target_intake` and `exam_type`, but the shared
 * `Lead` interface in `LeadsContext` does not declare them. Rather than edit a
 * context this redesign is not scoped to touch, the Leads worklist widens the
 * type locally. Both columns are real — see `integrations/supabase/types.ts`.
 */
export type LeadRecord = Lead & {
  target_intake?: string | null;
  exam_type?: string | null;
};

/** Operator-facing stage. Derived from `leads.status` + the call history. */
export type LeadStage = 'new' | 'attempting' | 'contacted' | 'booked';

/** The four call dispositions an operator can log. */
export type Disposition = 'reached' | 'no_answer' | 'callback' | 'wrong_number';

/** Score tier. Cutoffs live in `leadScore.ts`. */
export type LeadTier = 'hot' | 'warm' | 'cold';

/** The five weighted score factors. */
export type FactorKey = 'intent' | 'budget' | 'education' | 'language' | 'timing';

/** Per-factor 0–100 sub-scores. */
export type ScoreFactors = Record<FactorKey, number>;

/** Who put the next call on the board. */
export type NextCallSetter = { kind: 'ai' } | { kind: 'operator'; name: string };

/**
 * The next call: a goal, a time, who chose it, and why.
 *
 * `reason` is a rendered sentence rather than a key because the AI planner
 * interpolates lead-specific facts into it (attempt counts, missing fields,
 * the intake name). The planner returns translation input; see `aiPlanner.ts`.
 */
export interface NextCall {
  goal: string;
  dueAt: string;
  setBy: NextCallSetter;
  reason: string;
}

/** One entry in the touch history, built from `lead_notes`. */
export interface TouchEntry {
  id: string;
  text: string;
  at: string;
  outcome: string | null;
}

/** A single worklist row. Everything the row and the pane render comes from here. */
export interface LeadVM {
  id: string;
  name: string;
  initials: string;
  phone: string | null;
  city: string | null;
  source: Lead['source'];
  /** True when the lead came in through a student referral. */
  referred: boolean;
  owner: string | null;
  createdAt: string;
  stage: LeadStage;
  /** Logged call attempts — `lead_notes` rows with `contact_type = 'call'`. */
  attempts: number;
  score: number;
  tier: LeadTier;
  factors: ScoreFactors;
  nextCall: NextCall | null;
  /** Minutes until the next call; negative when overdue. Null when unscheduled. */
  dueInMinutes: number | null;
  history: TouchEntry[];
  /** Id of an earlier lead sharing this phone number, if any. */
  duplicateOfId: string | null;
  duplicateNote: string | null;
  /** The underlying record, for mutations and the qualification list. */
  lead: LeadRecord;
}

/** Urgency bands, in fixed render order. */
export type BandKey = 'overdue' | 'new' | 'booked' | 'working';

export interface WorklistBand {
  key: BandKey;
  rows: LeadVM[];
}

/** Source filter chip value — `all` plus the `leads.source` enum. */
export type SourceFilter = 'all' | Lead['source'];
