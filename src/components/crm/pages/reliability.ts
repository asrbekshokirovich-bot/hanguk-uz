/**
 * The auto-crawl reliability gauntlet (services/uni_db/verify) writes its verdict
 * into review_queue.reviewer_notes, prefixed with a colour tag, e.g.
 *   "[RED] reliability · tuition\n  consensus DISAGREEMENT on tuition:인문 …"
 * and flags red items with needs_attention. This derives the badge colour + the
 * human-readable detail from those two fields, degrading gracefully when the
 * reliability migration / a live crawl haven't populated them yet.
 */

export type ReliabilityColor = 'red' | 'amber' | 'green';

export interface Reliability {
  color: ReliabilityColor | null;
  /** The full reviewer-notes text (gate findings), or null if none. */
  detail: string | null;
}

const TAG = /^\s*\[(RED|AMBER|GREEN)\]/i;

export function parseReliability(
  reviewerNotes?: string | null,
  needsAttention?: boolean | null,
): Reliability {
  const detail = (reviewerNotes ?? '').trim() || null;
  const m = detail ? TAG.exec(detail) : null;
  if (m) return { color: m[1].toLowerCase() as ReliabilityColor, detail };
  if (needsAttention) return { color: 'red', detail };
  return { color: null, detail };
}

/** Worst colour wins, for a per-guideline rollup across its sections. */
export function rollupColor(colors: Array<ReliabilityColor | null>): ReliabilityColor | null {
  if (colors.includes('red')) return 'red';
  if (colors.includes('amber')) return 'amber';
  if (colors.includes('green')) return 'green';
  return null;
}

export const RELIABILITY_LABEL: Record<ReliabilityColor, string> = {
  red: 'Needs fixing',
  amber: 'Check carefully',
  green: 'Checks passed',
};

/** Maps a colour to a shadcn <Badge> variant name used elsewhere in the CRM. */
export function reliabilityBadgeVariant(
  color: ReliabilityColor | null,
): 'destructive' | 'warning' | 'successSoft' | 'neutral' {
  if (color === 'red') return 'destructive';
  if (color === 'amber') return 'warning';
  if (color === 'green') return 'successSoft';
  return 'neutral';
}
