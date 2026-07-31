import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * Charts, drawn as divs and inline SVG.
 *
 * No charting dependency is added. The repo already ships the exact palette the
 * brief asks for as --chart-1..5 (royal, lime, blue-400, success, slate), so
 * every series below indexes into that and nothing here introduces a colour.
 *
 * Motion uses animate-fade-up-investor (8px / 0.28s / cubic-bezier(.22,.61,.36,1))
 * which is disabled under prefers-reduced-motion in index.css.
 * ------------------------------------------------------------------------ */

export type ChartTone = 'royal' | 'lime' | 'blue' | 'success' | 'slate';

const TONE_VAR: Record<ChartTone, string> = {
  royal: 'var(--chart-1)',
  lime: 'var(--chart-2)',
  blue: 'var(--chart-3)',
  success: 'var(--chart-4)',
  slate: 'var(--chart-5)',
};

const toneColor = (tone: ChartTone) => `hsl(${TONE_VAR[tone]})`;
const toneFill = (tone: ChartTone, alpha: number) => `hsl(${TONE_VAR[tone]} / ${alpha})`;

/* -------------------------------------------------------------- sparkline */

/**
 * 36px area sparkline. Fewer than two points cannot describe a trend, so it
 * renders nothing rather than a flat line that would imply one.
 */
export function Sparkline({
  values,
  tone = 'royal',
  height = 36,
  className,
}: {
  values: number[];
  tone?: ChartTone;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;

  const W = 100;
  const H = 100;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = W / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / span) * H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      className={cn('w-full', className)}
      style={{ height }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="presentation"
      focusable="false"
    >
      <polygon points={`0,${H} ${points.join(' ')} ${W},${H}`} fill={toneFill(tone, 0.15)} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={toneColor(tone)}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ---------------------------------------------------------- grouped bars */

export interface GroupedBarGroup {
  label: string;
  values: number[];
}

/**
 * Two bars per group, 16px wide, radius 5px 5px 2px 2px, 5px inside a group and
 * 18px between groups - the prototype's grouped bar chart, as flex children.
 */
export function GroupedBars({
  groups,
  series,
  height = 190,
  formatValue,
  className,
}: {
  groups: GroupedBarGroup[];
  series: { label: string; tone: ChartTone }[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  const plot = height - 22;

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-[18px]" style={{ height }}>
        {groups.map((group) => (
          <div key={group.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center gap-[5px]">
              {group.values.map((value, i) => (
                <div
                  key={series[i]?.label ?? i}
                  className="animate-fade-up-investor rounded-t-[5px]"
                  style={{
                    width: 16,
                    height: Math.max(2, (value / max) * plot),
                    backgroundColor: toneColor(series[i]?.tone ?? 'slate'),
                    borderBottomLeftRadius: 2,
                    borderBottomRightRadius: 2,
                  }}
                  title={`${group.label} · ${series[i]?.label ?? ''} ${
                    formatValue ? formatValue(value) : value
                  }`}
                />
              ))}
            </div>
            <div className="truncate text-[11px] font-medium text-muted-foreground">
              {group.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ series }: { series: { label: string; tone: ChartTone }[] }) {
  return (
    <div className="flex items-center gap-4">
      {series.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: toneColor(s.tone) }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- funnel */

export interface FunnelRow {
  stage: string;
  value: number;
  tone: ChartTone;
}

/** 118px label, 26px bar in a muted track, right-aligned mono count. */
export function FunnelBars({ rows, className }: { rows: FunnelRow[]; className?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className={cn('space-y-2.5', className)}>
      {rows.map((row) => {
        const pct = Math.round((row.value / top) * 100);
        return (
          <div key={row.stage} className="flex items-center gap-3">
            <div className="w-[118px] shrink-0 truncate text-[13px] text-foreground">
              {row.stage}
            </div>
            <div className="h-[26px] flex-1 overflow-hidden rounded-[7px] bg-muted">
              <div
                className="animate-fade-up-investor h-full rounded-[7px]"
                style={{ width: `${pct}%`, backgroundColor: toneColor(row.tone) }}
              />
            </div>
            <div className="w-[76px] shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground">
              {row.value.toLocaleString('en-US')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- progress */

export function ProgressBar({
  pct,
  tone = 'lime',
  className,
}: {
  pct: number;
  tone?: ChartTone;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn('h-[7px] w-full overflow-hidden rounded-pill bg-muted', className)}>
      <div
        className="h-full rounded-pill"
        style={{ width: `${clamped}%`, backgroundColor: toneColor(tone) }}
      />
    </div>
  );
}

/** The 4px colour rule under each funnel tile. */
export function ToneRule({ tone }: { tone: ChartTone }) {
  return (
    <div
      className="h-1 w-full rounded-pill"
      style={{ backgroundColor: toneColor(tone) }}
      aria-hidden
    />
  );
}
