import type { FactorKey, LeadRecord, LeadTier, ScoreFactors } from './types';

/**
 * The weighted lead score.
 *
 * Pure and deterministic: every input comes off the lead record, and `now` is
 * injected rather than read from the clock, so the whole thing is unit-testable
 * and renders identically on every machine.
 *
 * Unknown fields score 0 — that is deliberate. A blank budget is not a neutral
 * signal for a call operator, it is a qualification gap, and the pane renders
 * it as "Weak" so the gap is visible rather than averaged away.
 */

/** Factor weights. Must sum to 1. */
export const SCORE_WEIGHTS: Record<FactorKey, number> = {
  intent: 0.3,
  budget: 0.25,
  education: 0.2,
  language: 0.1,
  timing: 0.15,
};

/** Tier cutoffs. Hot is tweakable per the design brief; Warm is fixed. */
export const HOT_THRESHOLD = 78;
export const WARM_THRESHOLD = 55;

/** Render order of the factor bars in the detail pane. */
export const FACTOR_ORDER: FactorKey[] = ['intent', 'budget', 'education', 'language', 'timing'];

const BUDGET_SCORES: Record<string, number> = {
  '20000_plus': 95,
  '10000_20000': 86,
  '5000_10000': 72,
  under_5000: 52,
  scholarship: 44,
};

const EDUCATION_SCORES: Record<string, number> = {
  phd: 92,
  master: 90,
  bachelor: 86,
  high_school: 70,
  other: 55,
};

/** Free-text Korean level, so match on substrings rather than an enum. */
function koreanScore(level: string | null): number {
  if (!level) return 0;
  const v = level.toLowerCase();
  if (v.includes('advanc') || /level\s*[56]/.test(v) || /topik\s*[56]/.test(v)) return 92;
  if (v.includes('intermed') || /level\s*[34]/.test(v) || /topik\s*[34]/.test(v)) return 72;
  if (v.includes('beginner') || /level\s*[12]/.test(v) || /topik\s*[12]/.test(v)) return 42;
  if (v.includes('none') || v.includes('yo’q') || v.includes('yoq')) return 10;
  return 50;
}

/** Pull a 4-digit year out of an intake string like `fall_2026` or `Sep 2026`. */
function intakeYear(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

/**
 * Intake urgency: the sooner the intake, the more a call is worth making now.
 * An undecided intake is a gap, not a far-off date.
 */
function timingScore(lead: LeadRecord, now: Date): number {
  const raw = lead.target_intake ?? lead.preferred_start_date;
  if (!raw || raw === 'undecided') return 0;
  const year = intakeYear(raw);
  if (year === null) return 45;
  const delta = year - now.getFullYear();
  if (delta <= 0) return 95;
  if (delta === 1) return 78;
  if (delta === 2) return 52;
  return 30;
}

function intentScore(lead: LeadRecord): number {
  const base = lead.interest_level === 'high' ? 88 : lead.interest_level === 'medium' ? 58 : 28;
  // A referral from an enrolled student is the strongest cheap intent signal.
  return Math.min(100, base + (lead.referred_by_student_id ? 8 : 0));
}

function budgetScore(lead: LeadRecord): number {
  if (lead.budget_range && BUDGET_SCORES[lead.budget_range] !== undefined) {
    return BUDGET_SCORES[lead.budget_range];
  }
  // A chosen payment plan is itself proof of budget fit, even without a range.
  if (lead.payment_plan) return 74;
  return 0;
}

function languageScore(lead: LeadRecord): number {
  const base = koreanScore(lead.korean_level);
  if (base === 0) return 0;
  // A booked or sat exam is corroboration on top of the self-reported level.
  return Math.min(100, base + (lead.exam_type ? 8 : 0));
}

/** The five 0–100 sub-scores behind the headline number. */
export function scoreFactors(lead: LeadRecord, now: Date): ScoreFactors {
  return {
    intent: intentScore(lead),
    budget: budgetScore(lead),
    education: lead.education_level ? EDUCATION_SCORES[lead.education_level] ?? 55 : 0,
    language: languageScore(lead),
    timing: timingScore(lead, now),
  };
}

/** Weighted 0–100 roll-up of the factors. */
export function leadScore(factors: ScoreFactors): number {
  const total = FACTOR_ORDER.reduce((sum, key) => sum + factors[key] * SCORE_WEIGHTS[key], 0);
  return Math.round(total);
}

/** Hot / Warm / Cold for a score. */
export function tierFor(score: number, hotThreshold = HOT_THRESHOLD): LeadTier {
  if (score >= hotThreshold) return 'hot';
  if (score >= WARM_THRESHOLD) return 'warm';
  return 'cold';
}

/** Strong / Partial / Weak band for one factor bar. */
export function factorStrength(value: number): 'strong' | 'partial' | 'weak' {
  if (value >= 75) return 'strong';
  if (value >= 50) return 'partial';
  return 'weak';
}
