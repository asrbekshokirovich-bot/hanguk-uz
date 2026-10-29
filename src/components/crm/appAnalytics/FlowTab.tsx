import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCREEN_ROUTES, isLaunchScreen, screenLabel } from '@/components/crm/appActivity/describe';
import { cn } from '@/lib/utils';
import { plan } from './planUi';
import { addDays, periodOf, tashkentToday, useChannelNames, useSegmentOptions, type PeriodKey, type Segment } from './marketing';
import { useEventNames } from './person';
import { layoutFlow, useCustomFunnel, usePaths, type Paths as PathsData } from './flow';
import PeriodControls from './PeriodControls';
import Segments from './Segments';

type T = (k: string, o?: Record<string, unknown>) => string;

const DEFAULT_STEPS = ['screen:/guest', 'university_open', 'report_view', 'lead_submit'];
const MAX_STEPS = 8;

/**
 * «Oqim» (plan v2, stage 4): where visits go screen by screen — the first
 * four screens of each visit as a Sankey, «Chiqdi» where it ended — and a
 * funnel from any steps, events or screens, in order. A period and a cut
 * (S4) as on the Marketing panel; test devices aside.
 */
export default function FlowTab() {
  const { t } = useTranslation();
  const today = tashkentToday();
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [range, setRange] = useState({ from: addDays(today, -29), to: today });
  const [seg, setSeg] = useState<Segment>({});
  const [steps, setSteps] = useState<string[]>(DEFAULT_STEPS);
  const p = periodOf(period, range, today);
  const names = useChannelNames();
  const options = useSegmentOptions(false);
  const channelKeys = useMemo(() => [...Object.keys(names), 'unknown'], [names]);
  const paths = usePaths(p.from, p.to, false, seg);
  const funnel = useCustomFunnel(p.from, p.to, steps, false, seg);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodControls period={period} onPeriod={setPeriod} range={range} onRange={setRange} today={today} />
      </div>
      <Segments seg={seg} onChange={setSeg} names={names} options={options} channels={channelKeys} t={t} />
      <Paths data={paths.data} loading={paths.loading} error={paths.error} t={t} />
      <StepFunnel steps={steps} onSteps={setSteps} data={funnel.data} loading={funnel.loading} error={funnel.error} t={t} />
    </div>
  );
}

/** A node's name; [step] 1 is where every visit starts, so the shell it passes through is the launch. */
function screenName(screen: string, t: T, step?: number): string {
  if (screen === '__exit__') return t('flow.exit');
  if (screen === '__other__') return t('flow.other');
  if (step === 1 && isLaunchScreen(screen)) return t('appActivity.screens.home');
  return screenLabel(screen, t) || screen;
}

function Paths({ data, loading, error, t }: { data: PathsData | null; loading: boolean; error: string | null; t: T }) {
  return (
    <section className={plan.frame}>
      <div className={plan.bar}>
        <span>{t('flow.pathsTitle')}</span>
        {data && <span className={plan.badge}>{t('flow.visits', { count: data.sessions })}</span>}
      </div>
      <div className={plan.body}>
        <p className={plan.note}>{t('flow.pathsNote')}</p>
        {loading && !data ? (
          <p className={plan.note}>{t('appActivity.loading')}</p>
        ) : error ? (
          <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>
        ) : data && data.links.some((l) => l.sessions > 0) ? (
          <div className="overflow-x-auto">
            <FlowChart data={data} t={t} />
          </div>
        ) : (
          <p className={plan.note}>{t('flow.noVisits')}</p>
        )}
      </div>
    </section>
  );
}

const W = 920;
const H = 380;

/** The Sankey: a column per step, bands by visits, the exits red. Hover for numbers. */
function FlowChart({ data, t }: { data: PathsData; t: T }) {
  const f = useMemo(() => layoutFlow(data, W, H), [data]);
  const name = (screen: string, step: number) => screenName(screen, t, step);
  return (
    <svg viewBox={`0 0 ${W} ${f.height + 4}`} width={W} height={f.height + 4} className="max-w-none" role="img" aria-label={t('flow.pathsTitle')}>
      {f.links.map((l, i) => {
        const x0 = l.from.x + f.nodeWidth;
        const x1 = l.to.x;
        const xm = (x0 + x1) / 2;
        return (
          <path
            key={i}
            d={`M${x0},${l.y0} C${xm},${l.y0} ${xm},${l.y1} ${x1},${l.y1} L${x1},${l.y1 + l.h} C${xm},${l.y1 + l.h} ${xm},${l.y0 + l.h} ${x0},${l.y0 + l.h} Z`}
            className={l.to.exit ? 'fill-[#B4232E]/20 dark:fill-[#FF8C92]/20' : 'fill-[#93A7FF]/35 dark:fill-[#93A7FF]/25'}
          >
            <title>{`${name(l.from.screen, l.from.step)} → ${name(l.to.screen, l.to.step)}: ${t('flow.visits', { count: l.sessions })}`}</title>
          </path>
        );
      })}
      {f.nodes.map((n) => (
        <g key={n.key}>
          <rect x={n.x} y={n.y} width={f.nodeWidth} height={n.h} className={n.exit ? 'fill-[#B4232E] dark:fill-[#FF8C92]' : 'fill-[#2447D6] dark:fill-[#93A7FF]'}>
            <title>{`${name(n.screen, n.step)}: ${t('flow.visits', { count: n.sessions })}`}</title>
          </rect>
          <text
            x={n.x + f.nodeWidth + 6}
            y={n.y + n.h / 2}
            dy="0.35em"
            className={cn('text-[12px]', n.exit ? 'fill-[#B4232E] dark:fill-[#FF8C92]' : 'fill-[#0A1A34] dark:fill-[#EEF2FB]')}
          >
            {`${name(n.screen, n.step)} · ${n.sessions}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

function StepFunnel({
  steps,
  onSteps,
  data,
  loading,
  error,
  t,
}: {
  steps: string[];
  onSteps: (s: string[]) => void;
  data: ReturnType<typeof useCustomFunnel>['data'];
  loading: boolean;
  error: string | null;
  t: T;
}) {
  const events = useEventNames();
  const choices = useMemo(() => {
    const screens = SCREEN_ROUTES.map((r) => ({ key: `screen:${r}`, label: t('flow.screenStep', { screen: screenLabel(r, t) }) }));
    const evs = Object.entries(events)
      .filter(([e]) => e !== 'screen_view')
      .map(([e, d]) => ({ key: e, label: d || e }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [...screens, ...evs];
  }, [events, t]);
  // until the registry has loaded, an event step reads by the CRM's own name, not its key
  const labelOf = (k: string) => choices.find((c) => c.key === k)?.label ?? t(`appActivity.page.eventNames.${k}`, { defaultValue: k });
  const set = (i: number, v: string) => onSteps(steps.map((s, j) => (j === i ? v : s)));
  const top = data?.steps[0]?.devices ?? 0;

  return (
    <section className={plan.tile}>
      <h3 className={plan.tileTitle}>{t('flow.funnelTitle')}</h3>
      <p className={cn('text-[13px]', plan.muted)}>{t('flow.funnelNote')}</p>
      <ol className="mt-1 space-y-1.5">
        {steps.map((s, i) => {
          const n = data?.steps[i]?.devices;
          const pct = top && n != null ? Math.round((n / top) * 100) : 0;
          return (
            <li key={i} className="grid grid-cols-[1.4rem_minmax(12rem,18rem)_minmax(0,1fr)_3.5rem_3rem_1.5rem] items-center gap-2 text-[13px] max-[720px]:grid-cols-[1.4rem_minmax(0,1fr)_3rem_1.5rem]">
              <span className={cn('text-right tabular-nums', plan.muted)}>{i + 1}.</span>
              <select
                value={s}
                onChange={(e) => set(i, e.target.value)}
                aria-label={t('flow.step', { n: i + 1 })}
                className="min-w-0 rounded-md border border-border bg-background px-2 py-1 text-[12.5px]"
              >
                {!choices.some((c) => c.key === s) && <option value={s}>{labelOf(s)}</option>}
                {choices.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="h-2.5 overflow-hidden rounded-full bg-[#E3E9FB] max-[720px]:hidden dark:bg-[#17235F]">
                <span className="block h-full rounded-full bg-[#2447D6] dark:bg-[#93A7FF]" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{n ?? (loading ? '…' : '—')}</span>
              <span className={cn('text-right tabular-nums max-[720px]:hidden', plan.muted)}>{top && n != null ? `${pct}%` : ''}</span>
              <button
                type="button"
                disabled={steps.length <= 2}
                onClick={() => onSteps(steps.filter((_, j) => j !== i))}
                aria-label={t('flow.removeStep', { n: i + 1 })}
                className="text-[15px] leading-none text-muted-foreground disabled:opacity-30"
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={plan.btn}
          disabled={steps.length >= MAX_STEPS}
          onClick={() => onSteps([...steps, steps[steps.length - 1] ?? DEFAULT_STEPS[0]])}
        >
          {t('flow.addStep')}
        </button>
        {error && <span className={cn('text-[12.5px]', plan.bad)}>{t('appActivity.error')}</span>}
      </div>
    </section>
  );
}
