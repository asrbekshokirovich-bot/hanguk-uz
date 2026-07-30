import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

/* ---------------------------------------------------------------------------
 * The small pieces every investor screen is built from.
 *
 * Three of the brief's non-negotiables live here rather than being repeated in
 * four screens:
 *   - status is always a soft-tint pill, never a solid fill;
 *   - money and counts use the mono face, and the unit belongs in the column
 *     header, so <Money> renders a bare number;
 *   - lime is never body text or a link colour on light. The one place lime
 *     appears as ink is `tone="lime"` on a pill, which sits on --tint-lime and
 *     uses --lime-700 (the only lime value that passes contrast on white).
 * ------------------------------------------------------------------------ */

export function InvestorCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('rounded-lg border-border bg-card shadow-card', className)}>{children}</Card>
  );
}

export function CardHead({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'lime';

const PILL_TONE: Record<PillTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-soft-info text-info',
  success: 'bg-soft-success text-success',
  warning: 'bg-soft-warning text-warning',
  danger: 'bg-soft-danger text-destructive',
  lime: 'bg-tint-lime text-lime-ink',
};

/** 24px tall, 12px/600, radius 999px - TOKENS.md's badge spec. */
export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[12px] font-semibold leading-none',
        PILL_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Growth against a comparable earlier season. Rendered only when there IS a
 *  comparable season - her visibility floor usually means there is not. */
export function DeltaPill({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <StatusPill tone={up ? 'success' : 'danger'}>
      {up ? '+' : ''}
      {Math.round(pct)}%
    </StatusPill>
  );
}

/** Bare mono number. The unit goes in the column header, never here. */
export function Money({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[13px] font-medium tabular-nums', className)}>
      {children}
    </span>
  );
}

export function TableHeadCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** What a card says when the season genuinely has no rows yet. Deliberately
 *  plain: an investor reading an empty card should understand it is empty
 *  because nothing has happened, not because something failed. */
export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('px-5 py-8 text-center text-[13px] text-muted-foreground', className)}>
      {children}
    </p>
  );
}

/** A figure the CRM does not record yet. Says so rather than showing a zero
 *  that would read as a real result. */
export function NotTracked() {
  return <span className="text-[13px] text-muted-foreground">Not tracked yet</span>;
}

export function MetricRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-soft-line px-5 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0 text-right">{value}</div>
    </div>
  );
}

const AVATAR_TONES = [
  'bg-tint-blue text-primary',
  'bg-tint-lime text-lime-ink',
  'bg-soft-info text-info',
  'bg-soft-success text-success',
  'bg-soft-danger text-destructive',
];

/** Initials avatar. The tone is derived from the name so a person keeps the
 *  same colour everywhere, as TOKENS.md asks. */
export function InitialsAvatar({
  name,
  size = 30,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  const letters = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-pill font-bold',
        tone,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {letters}
    </span>
  );
}
