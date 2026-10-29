import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAnalyticsQuality } from './api';
import { coverageOf } from './helpers';
import { whenLabel } from './person';

const PERIODS = [1, 7, 30];

function seconds(s: number | null | undefined, t: (k: string, o?: Record<string, unknown>) => string) {
  if (s === null || s === undefined) return '—';
  if (s < 60) return t('appAnalytics.quality.sec', { n: Math.round(s) });
  if (s < 3600) return t('appAnalytics.quality.min', { n: Math.round(s / 60) });
  return t('appAnalytics.quality.hours', { n: Math.round(s / 360) / 10 });
}

/**
 * "Sifat": whether the app's analytics can be trusted — the flow of events by
 * the hour, each build's events (and those a new build stopped sending),
 * what the server turned away, test devices, how late events arrive, and the
 * event registry (analytics_quality).
 */
export default function QualityTab() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const { data, loading, error } = useAnalyticsQuality(days);
  const describe = useMemo(() => Object.fromEntries((data?.registry ?? []).map((r) => [r.event, r.description])), [data]);

  if (loading && !data) return <p className="text-[13px] text-muted-foreground">{t('appActivity.loading')}</p>;
  if (error || !data) return <p className="text-[13px] text-destructive">{t('appActivity.error')}</p>;

  const latest = data.builds[0];
  const cov = latest ? coverageOf(data, latest.build) : { named: null, timed: null };
  const maxHour = Math.max(1, ...data.hourly.map((h) => h.events));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">
          {data.last_refresh
            ? t('appAnalytics.quality.refreshed', { time: whenLabel(data.last_refresh, t) })
            : t('appAnalytics.quality.neverRefreshed')}
        </p>
        <div className="flex gap-1" role="group" aria-label={t('appActivity.page.period')}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              aria-pressed={days === p}
              className={cn(
                'rounded-md border px-3 py-1 text-[12.5px] font-semibold',
                days === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground',
              )}
            >
              {t('appActivity.page.days', { count: p })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label={t('appAnalytics.quality.devices')} value={data.devices.toLocaleString()}
          sub={t('appAnalytics.quality.testDevices', { count: data.test_devices })} />
        <Card
          label={t('appAnalytics.quality.namedTaps')}
          value={cov.named === null ? '—' : `${cov.named}%`}
          sub={latest ? t('appAnalytics.quality.ofBuild', { build: latest.build }) : undefined}
          bad={cov.named !== null && cov.named < 95}
        />
        <Card
          label={t('appAnalytics.quality.timedScreens')}
          value={cov.timed === null ? '—' : `${cov.timed}%`}
          sub={latest ? t('appAnalytics.quality.ofBuild', { build: latest.build }) : undefined}
        />
        <Card
          label={t('appAnalytics.quality.delay')}
          value={seconds(data.delay_s?.p50, t)}
          sub={t('appAnalytics.quality.delaySub', { p90: seconds(data.delay_s?.p90, t), p99: seconds(data.delay_s?.p99, t) })}
        />
      </div>

      <Section title={t('appAnalytics.quality.hourly')} note={t('appAnalytics.quality.hourlyNote')}>
        {data.hourly.length === 0 ? (
          <Empty />
        ) : (
          <div className="mt-3 flex h-28 items-end gap-[2px] overflow-x-auto">
            {data.hourly.map((h) => (
              <div
                key={h.hour}
                className="min-w-[6px] flex-1 rounded-t bg-primary"
                style={{ height: `${Math.max(3, (h.events / maxHour) * 100)}px` }}
                title={`${whenLabel(h.hour, t)}: ${h.events} · ${h.devices}`}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title={t('appAnalytics.quality.builds')}>
        {data.builds.length === 0 ? (
          <Empty />
        ) : (
          <Grid
            head={[t('appAnalytics.quality.build'), t('appActivity.page.devices'), t('appAnalytics.quality.events'), t('appAnalytics.quality.namedTaps'), t('appAnalytics.quality.timedScreens'), t('appAnalytics.quality.lastSeen')]}
            rows={data.builds.map((b) => {
              const c = coverageOf(data, b.build);
              return {
                key: String(b.build),
                cells: [
                  String(b.build),
                  b.devices.toLocaleString(),
                  b.events.toLocaleString(),
                  c.named === null ? '—' : `${c.named}%`,
                  c.timed === null ? '—' : `${c.timed}%`,
                  whenLabel(b.last_at, t),
                ],
              };
            })}
          />
        )}
      </Section>

      <Section title={t('appAnalytics.quality.missing')} note={t('appAnalytics.quality.missingNote')}>
        {data.missing.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">{t('appAnalytics.quality.missingNone')}</p>
        ) : (
          <Grid
            head={[t('appAnalytics.quality.build'), t('appAnalytics.quality.event'), t('appAnalytics.quality.prevDevices')]}
            rows={data.missing.map((m) => ({
              key: `${m.build}:${m.event}`,
              cells: [String(m.build), describe[m.event] ? `${describe[m.event]} (${m.event})` : m.event, String(m.prev_devices)],
            }))}
            warn
          />
        )}
      </Section>

      <Section title={t('appAnalytics.quality.rejected')} note={t('appAnalytics.quality.rejectedNote')}>
        {data.rejected.length === 0 ? (
          <Empty />
        ) : (
          <Grid
            head={[t('appAnalytics.quality.reason'), t('appAnalytics.quality.event'), t('appAnalytics.quality.build'), t('appActivity.page.times'), t('appAnalytics.quality.lastSeen')]}
            rows={data.rejected.map((r) => ({
              key: `${r.reason}:${r.event}:${r.build}`,
              cells: [
                t(`appAnalytics.quality.reasons.${r.reason}`, { defaultValue: r.reason }),
                r.event || '—',
                r.build ? String(r.build) : '—',
                r.n.toLocaleString(),
                whenLabel(r.last_at, t),
              ],
            }))}
          />
        )}
      </Section>

      <Section title={t('appAnalytics.quality.testByReason')}>
        {Object.keys(data.test_by_reason).length === 0 ? (
          <Empty />
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-[12.5px]">
            {Object.entries(data.test_by_reason).map(([reason, n]) => (
              <li key={reason} className="rounded-md border border-border px-2 py-1">
                {t(`appAnalytics.settings.reasons.${reason}`, { defaultValue: reason })}: <b className="tabular-nums">{n}</b>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('appAnalytics.quality.registry')} note={t('appAnalytics.quality.registryNote', { count: data.registry.length })}>
        <Grid
          head={[t('appAnalytics.quality.event'), t('appAnalytics.quality.family'), t('appActivity.page.devices'), t('appActivity.page.times')]}
          rows={data.registry.map((r) => ({
            key: r.event,
            cells: [
              `${r.description} (${r.event})${r.status === 'deprecated' ? ` · ${t('appAnalytics.quality.deprecated')}` : ''}`,
              t(`appAnalytics.quality.families.${r.family}`, { defaultValue: r.family }),
              r.devices.toLocaleString(),
              r.n.toLocaleString(),
            ],
            dim: r.n === 0,
          }))}
        />
      </Section>
    </div>
  );
}

function Card({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-card px-4 py-3', bad ? 'border-destructive' : 'border-border')}>
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', bad ? 'text-destructive' : 'text-foreground')}>{value}</p>
      {sub && <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="text-[13px] font-bold text-foreground">{title}</h2>
      {note && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

function Empty() {
  const { t } = useTranslation();
  return <p className="mt-2 text-[12.5px] text-muted-foreground">{t('appActivity.empty')}</p>;
}

function Grid({
  head,
  rows,
  warn,
}: {
  head: string[];
  rows: { key: string; cells: string[]; dim?: boolean }[];
  warn?: boolean;
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={cn('pb-1 pr-2 font-semibold', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key} className={cn(r.dim && 'text-muted-foreground', warn && 'text-destructive')}>
              {r.cells.map((c, i) => (
                <td key={i} className={cn('py-1 pr-2', i > 0 && 'text-right tabular-nums')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
