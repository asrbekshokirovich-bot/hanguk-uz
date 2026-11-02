/**
 * CRM «AI takliflari» (xodim boti PR-9) uchun sof yordamchilar.
 * Baza: bot_proposals_list / bot_proposal_review / bot_quality_stats — migratsiya 20261103030000_staff_bot_quality.sql.
 */

export interface ProposalRow {
  id: string;
  created_at: string;
  kind: 'create' | 'close';
  mode: 'shadow' | 'on';
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'shadow';
  review: 'correct' | 'wrong' | null;
  title: string | null;
  due_date: string | null;
  priority: string | null;
  confidence: number | null;
  reason: string | null;
  author_name: string;
  assignee_name: string;
  source_text: string | null;
}

export interface QualityStats {
  days: number;
  messages: number;
  proposals: number;
  shadow: number;
  on: number;
  judged: number;
  correct: number;
  wrong: number;
  unjudged: number;
  precision: number | null;
}

export const TARGET_PRECISION = 90;

/** Yakuniy baho: owner bahosi, bo'lmasa «Yoqilgan» rejimdagi xodim tanlovi. */
export function verdictOf(p: Pick<ProposalRow, 'review' | 'status'>): 'correct' | 'wrong' | null {
  if (p.review) return p.review;
  if (p.status === 'accepted') return 'correct';
  if (p.status === 'rejected') return 'wrong';
  return null;
}

/** «Yoqilgan» rejimga o'tishga tayyormi: kamida 20 ta baholangan va aniqlik >= 90%. */
export function readyForOn(s: QualityStats | null): boolean {
  return !!s && s.judged >= 20 && (s.precision ?? 0) >= TARGET_PRECISION;
}

/** Ishonch 0..1 → foiz. */
export function confidencePct(c: number | null | undefined): string {
  return typeof c === 'number' && Number.isFinite(c) ? `${Math.round(c * 100)}%` : '';
}
