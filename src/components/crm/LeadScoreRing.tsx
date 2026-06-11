import { cn } from '@/lib/utils';

interface LeadScoreRingProps {
  /** Priority score 0–100 (null = unscored). */
  score: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

// Priority thresholds follow the code: Hot ≥70, Warm ≥50, Cold < 50.
function ringColor(score: number) {
  if (score >= 70) return 'text-destructive';
  if (score >= 50) return 'text-warning';
  return 'text-info';
}

/**
 * Circular AI score ring (presentational). Color encodes priority via semantic
 * tokens (Hot=destructive / Warm=warning / Cold=info); the track uses muted.
 */
export function LeadScoreRing({ score, size = 44, strokeWidth = 4, className }: LeadScoreRingProps) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const color = score == null ? 'text-muted-foreground' : ringColor(score);

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('stroke-current transition-all', color)}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-extrabold text-foreground"
        style={{ fontSize: Math.round(size * 0.3) }}
      >
        {score == null ? '—' : score}
      </div>
    </div>
  );
}

export default LeadScoreRing;
