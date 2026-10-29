import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { screenLabel } from '@/components/crm/appActivity/describe';
import { useAppEventsSummary } from '@/components/crm/appActivity/useAppActivity';
import { dayLabel, useEventNames } from '@/components/crm/appAnalytics/person';

const PERIODS = [7, 30, 90];

/**
 * "Ilova faolligi": how the student app is used — devices, the path from
 * opening the app to a consultant request, the bottom-nav sections and the
 * screens people opened, and the universities they put a ♥ on
 * (app_events_summary).
 */
export default function AppActivityContent({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const { data, loading, error } = useAppEventsSummary(days);
  // the app's registry names what the CRM has no wording of its own for (tap, card_view, …)
  const registry = useEventNames();

  const opened = data?.funnel.find((f) => f.event === 'app_open')?.devices ?? 0;
  const maxDaily = Math.max(1, ...(data?.daily.map((d) => d.devices) ?? [1]));

  return (
    <div className={cn('space-y-4', !embedded && 'mx-auto max-w-5xl p-4')}>
      <header className={cn('flex flex-wrap items-center gap-3', embedded ? 'justify-end' : 'justify-between')}>
        {!embedded && (
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('appActivity.page.title')}</h1>
            <p className="text-[12.5px] text-muted-foreground">{t('appActivity.page.subtitle')}</p>
          </div>
        )}
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
      </header>

      {loading ? (
        <p className="text-[13px] text-muted-foreground">{t('appActivity.loading')}</p>
      ) : error || !data ? (
        <p className="text-[13px] text-destructive">{t('appActivity.error')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label={t('appActivity.page.kpi.devices')} value={data.devices} />
            <Kpi
              label={t('appActivity.page.kpi.signedIn')}
              value={data.people ?? data.signed_in_devices}
              sub={[
                data.people !== undefined
                  ? t('appActivity.page.kpi.signedInSub', { people: data.people, devices: data.signed_in_devices })
                  : null,
                data.demo_people ? t('appActivity.page.kpi.demoNote', { count: data.demo_people }) : null,
              ]}
            />
            <Kpi
              label={t('appActivity.page.kpi.newDevices')}
              value={data.new_devices}
              sub={[
                data.tracking_since
                  ? t('appActivity.page.kpi.newDevicesNote', {
                      date: dayLabel(data.tracking_since),
                    })
                  : null,
              ]}
            />
            <Kpi label={t('appActivity.page.kpi.events')} value={data.events} />
          </div>

          <section className="rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">{t('appActivity.page.funnel')}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{t('appActivity.page.funnelNote')}</p>
            <ol className="mt-2 space-y-2">
              {data.funnel.map((f) => {
                const pct = opened ? Math.round((f.devices / opened) * 100) : 0;
                return (
                  <li key={f.event}>
                    <div className="flex justify-between text-[12.5px]">
                      <span className="text-foreground">{t(`appActivity.page.steps.${f.event}`, { defaultValue: f.event })}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {f.devices.toLocaleString()} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-card px-4 py-3">
              <h2 className="text-[13px] font-bold text-foreground">{t('appActivity.page.sections')}</h2>
              <Table
                empty={t('appActivity.empty')}
                rows={(data.sections ?? []).map((s) => ({
                  key: s.section,
                  label: t(`appActivity.tabs.${s.section}`, { defaultValue: s.section }),
                  devices: s.devices,
                  n: s.n,
                }))}
                head={[t('appActivity.page.section'), t('appActivity.page.devices'), t('appActivity.page.times')]}
              />
            </section>
            <section className="rounded-lg border border-border bg-card px-4 py-3">
              <h2 className="text-[13px] font-bold text-foreground">{t('appActivity.page.saved')}</h2>
              <Table
                empty={t('appActivity.empty')}
                rows={(data.top_picked ?? data.top_saved).map((u) => ({
                  key: u.institution_id,
                  label: u.name ?? t('appActivity.unknownUniversity'),
                  devices: u.devices,
                }))}
                head={[t('appActivity.page.university'), t('appActivity.page.devices')]}
              />
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">{t('appActivity.page.screens')}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{t('appActivity.page.screensNote')}</p>
            <Table
              empty={t('appActivity.empty')}
              rows={data.by_screen.map((s) => ({ key: s.screen, label: screenLabel(s.screen, t), devices: s.devices, n: s.n }))}
              head={[t('appActivity.page.screen'), t('appActivity.page.devices'), t('appActivity.page.times')]}
            />
          </section>

          <section className="rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">{t('appActivity.page.daily')}</h2>
            {data.daily.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted-foreground">{t('appActivity.empty')}</p>
            ) : (
              <div className="mt-3 flex h-32 items-end gap-1 overflow-x-auto">
                {data.daily.map((d, i) => (
                  <div key={d.day} className="flex min-w-[18px] flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{d.devices}</span>
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{ height: `${Math.max(4, (d.devices / maxDaily) * 88)}px` }}
                      title={`${dayLabel(d.day)}: ${d.devices}${d.new ? ` · ${t('appActivity.page.dailyNew')} ${d.new}` : ''}`}
                    />
                    {/* «22-okt»; with many bars, the day alone except under the first and a month's first day */}
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {data.daily.length <= 14 || i === 0 || d.day.endsWith('-01') ? dayLabel(d.day) : String(Number(d.day.slice(8)))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">{t('appActivity.page.actions')}</h2>
            <Table
              empty={t('appActivity.empty')}
              rows={data.by_event.map((e) => ({
                key: e.event,
                label: t(`appActivity.page.eventNames.${e.event}`, { defaultValue: registry[e.event] ?? e.event }),
                devices: e.devices,
                n: e.n,
              }))}
              head={[t('appActivity.page.action'), t('appActivity.page.devices'), t('appActivity.page.times')]}
            />
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub = [] }: { label: string; value: number; sub?: (string | null)[] }) {
  const lines = sub.filter((x): x is string => !!x);
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</p>
      {lines.map((line) => (
        <p key={line} className="text-[11px] leading-snug text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function Table({
  rows,
  head,
  empty,
}: {
  rows: { key: string; label: string; devices: number; n?: number }[];
  head: string[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="mt-2 text-[12.5px] text-muted-foreground">{empty}</p>;
  return (
    <table className="mt-2 w-full text-[12.5px]">
      <thead>
        <tr className="text-left text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={cn('pb-1 font-semibold', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="py-1 pr-2 text-foreground">{r.label}</td>
            <td className="py-1 text-right tabular-nums">{r.devices.toLocaleString()}</td>
            {r.n !== undefined && <td className="py-1 text-right tabular-nums">{r.n.toLocaleString()}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
