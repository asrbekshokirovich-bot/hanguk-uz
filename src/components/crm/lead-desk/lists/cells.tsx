import { Pin } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STAGE_LABEL } from '../copy';
import type { LeadListRow } from '../api';
import type { Stage } from '../types';
import { channelsOf, handleOf, scoreTone } from './rowFormat';

const STAGE_TONE: Record<Stage, BadgeProps['variant']> = {
  new: 'warning',
  contacted: 'info',
  interested: 'lime',
  offer: 'info',
  contract: 'highlight',
  student: 'successSoft',
  waiting: 'neutral',
  lost: 'destructive',
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge variant={STAGE_TONE[stage] ?? 'neutral'} className="px-2 py-0 text-[11px] font-medium">
      {STAGE_LABEL[stage] ?? stage}
    </Badge>
  );
}

export function ChannelChips({ row }: { row: Parameters<typeof channelsOf>[0] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {channelsOf(row).map((c) => (
        <span key={c} className="rounded border bg-muted/60 px-1.5 py-0 text-[11px] leading-5 text-muted-foreground">
          {c}
        </span>
      ))}
    </div>
  );
}

/** Name, with the @username (or phone) under it and a pin mark when a senior pinned the lead. */
export function LeadNameCell({ row }: { row: Pick<LeadListRow, 'full_name' | 'phone' | 'instagram_handle' | 'telegram_handle' | 'pinned_at'> }) {
  const sub = handleOf(row) ?? row.phone;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 font-medium">
        {row.pinned_at && <Pin className="h-3 w-3 shrink-0 text-accent-foreground" aria-label="Pin qilingan" />}
        <span className="truncate">{row.full_name || '—'}</span>
      </div>
      {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const SCORE_BAR: Record<ReturnType<typeof scoreTone>, string> = {
  high: 'bg-success',
  mid: 'bg-warning',
  low: 'bg-muted-foreground/50',
  none: 'bg-transparent',
};

/** 0–100 priority score as a number with a thin bar. */
export function ScoreCell({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const v = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="flex items-center gap-1.5" title={`Ball: ${v}`}>
      <span className="w-6 text-right tabular-nums">{v}</span>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className={cn('block h-full rounded-full', SCORE_BAR[scoreTone(v)])} style={{ width: `${v}%` }} />
      </span>
    </div>
  );
}

export function Dash() {
  return <span className="text-muted-foreground">—</span>;
}
