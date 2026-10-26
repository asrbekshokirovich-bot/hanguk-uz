import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { screenLabel } from '@/components/crm/appActivity/describe';
import { plan } from './planUi';
import {
  ANSWER_QS,
  FUNNEL_STEPS,
  addDays,
  bandLabel,
  channelName,
  money,
  perOne,
  periodLabel,
  periodOf,
  setSpend,
  tashkentToday,
  useChannelNames,
  useMarketing,
  useRetention,
  useSegmentOptions,
  type ChannelRow,
  type Cohort,
  type Marketing,
  type PeriodKey,
  type Segment,
} from './marketing';
import { exportCsv, exportXlsx } from './marketingExport';
import Segments from './Segments';
import PeriodControls from './PeriodControls';

type T = (k: string, o?: Record<string, unknown>) => string;

/**
 * «CRM · Ilova analitikasi · Marketing» — the marketing plan's panel
 * (2026-10-22) with the owner's answers: three numbers (S11: new active
 * devices, requests from the app, app-involved contracts), the channel table
 * by the own answer to «Qayerdan topdingiz?» (S3) with spend (S9), then the
 * plan's blocks in its order — Voronka, Talab, To'xtash joylari, Qaytish,
 * Xarajat, Test filtri. A period and the one before it (S8); Excel and CSV.
 * Above the panel, the cuts (S4): every block then counts only those devices.
 */
export default function MarketingTab() {
  const { t } = useTranslation();
  const today = tashkentToday();
  const [period, setPeriod] = useState<PeriodKey>('7');
  const [range, setRange] = useState({ from: addDays(today, -6), to: today });
  const [includeTest, setIncludeTest] = useState(false);
  const [seg, setSeg] = useState<Segment>({});
  const p = periodOf(period, range, today);
  const { data, prev, loading, error, reload } = useMarketing(p.from, p.to, p.prevFrom, p.prevTo, includeTest, seg);
  const names = useChannelNames();
  const cohorts = useRetention(includeTest, seg);
  const options = useSegmentOptions(includeTest);
  const channelKeys = useMemo(() => [...Object.keys(names), 'unknown'], [names]);
  const label = periodLabel(p.from, p.to);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodControls
          period={period}
          onPeriod={setPeriod}
          range={range}
          onRange={setRange}
          today={today}
          compare={{ from: p.prevFrom, to: p.prevTo }}
        />
        <div className="ml-auto flex gap-1.5">
          <button type="button" className={plan.btn} disabled={!data} onClick={() => data && void exportXlsx(data, prev, names, cohorts ?? [], t)}>
            {t('marketing.excel')}
          </button>
          <button type="button" className={plan.btn} disabled={!data} onClick={() => data && exportCsv(data, names, t)}>
            CSV
          </button>
        </div>
      </div>
      <Segments seg={seg} onChange={setSeg} names={names} options={options} channels={channelKeys} t={t} />

      <section className={plan.frame}>
        <div className={plan.bar}>
          <span>{t('marketing.title')}</span>
          <span className={plan.badge}>{label.toUpperCase()}</span>
        </div>
        <div className={plan.body}>
          {loading && !data ? (
            <p className={plan.note}>{t('appActivity.loading')}</p>
          ) : error && !data ? (
            <p className={cn('text-[13px]', plan.bad)}>{t('appActivity.error')}</p>
          ) : data ? (
            <>
              <Kpis data={data} prev={prev} t={t} />
              <Channels data={data} names={names} t={t} />
            </>
          ) : null}
        </div>
      </section>

      {data && (
        <div className="space-y-3">
          <Funnel data={data} names={names} t={t} />
          <Demand data={data} t={t} />
          <Stops data={data} t={t} />
          <Return data={data} cohorts={cohorts} t={t} />
          <Spend data={data} names={names} onSaved={reload} t={t} />
          <TestFilter includeTest={includeTest} onChange={setIncludeTest} testDevices={data.kpi.test_devices} t={t} />
        </div>
      )}
    </div>
  );
}

function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function Kpis({ data, prev, t }: { data: Marketing; prev: Marketing | null; t: T }) {
  const k = data.kpi;
  const pk = prev?.kpi;
  const reqShare = share(k.requests, k.new_leads);
  const prevLine = (n: number | undefined) => (n == null ? null : t('marketing.prev', { n }));
  return (
    <div className={plan.mk3}>
      <div className={plan.mk}>
        <div className={plan.mkLabel}>{t('marketing.kpi.newActive')}</div>
        <div className={plan.mkValue}>{k.new_devices}</div>
        <div className={plan.mkSub}>{t(data.include_test ? 'marketing.kpi.withTest' : 'marketing.kpi.noTest')}</div>
        <div className={plan.mkSub}>{prevLine(pk?.new_devices)}</div>
      </div>
      <div className={plan.mk}>
        <div className={plan.mkLabel}>{t('marketing.kpi.requests')}</div>
        <div className={cn(plan.mkValue, k.requests === 0 && plan.mkBad)}>{k.requests}</div>
        <div className={plan.mkSub}>
          {t('marketing.kpi.requestsSub', { form: k.requests_form, tg: k.requests_telegram })}
          {reqShare != null ? ` · ${t('marketing.kpi.share', { pct: reqShare })}` : ''}
        </div>
        <div className={plan.mkSub}>{prevLine(pk?.requests)}</div>
      </div>
      <div className={plan.mk}>
        <div className={plan.mkLabel}>{t('marketing.kpi.contracts')}</div>
        <div className={plan.mkValue}>{k.app_contracts}</div>
        <div className={plan.mkSub}>{t('marketing.kpi.contractsSub', { n: k.contracts })}</div>
        <div className={plan.mkSub}>{prevLine(pk?.app_contracts)}</div>
      </div>
    </div>
  );
}

function Channels({ data, names, t }: { data: Marketing; names: Record<string, string>; t: T }) {
  return (
    <div className={plan.tscroll}>
      <table className={plan.table}>
        <thead>
          <tr>
            <th className={plan.th}>{t('marketing.cols.channel')}</th>
            <th className={cn(plan.th, plan.num)}>{t('marketing.cols.newDevices')}</th>
            <th className={cn(plan.th, plan.num)}>{t('marketing.cols.active')}</th>
            <th className={cn(plan.th, plan.num)}>{t('marketing.cols.requests')}</th>
            <th className={cn(plan.th, plan.num)}>{t('marketing.cols.contracts')}</th>
            <th className={cn(plan.th, plan.num)}>{t('marketing.cols.spend')}</th>
            <th className={cn(plan.th, plan.num)}>{t('marketing.cols.perRequest')}</th>
          </tr>
        </thead>
        <tbody>
          {data.channels.map((c: ChannelRow) => {
            const unknown = c.key === 'unknown';
            const empty = !unknown && !c.new_devices && !c.requests && !c.contracts && !money(c.spend);
            return (
              <tr key={c.key} className={cn(unknown && plan.rowUnknown, empty && plan.rowDim)}>
                <td className={plan.td}>{unknown ? <b>{channelName(c.key, names, t)}</b> : channelName(c.key, names, t)}</td>
                <td className={cn(plan.td, plan.num)}>{unknown ? <b>{c.new_devices}</b> : c.new_devices}</td>
                <td className={cn(plan.td, plan.num)}>{c.active}</td>
                <td className={cn(plan.td, plan.num, unknown && c.requests === 0 && plan.bad)}>
                  {unknown ? <b>{c.requests}</b> : c.requests}
                </td>
                <td className={cn(plan.td, plan.num)}>{c.contracts}</td>
                <td className={cn(plan.td, plan.num)}>{money(c.spend) ?? '—'}</td>
                <td className={cn(plan.td, plan.num)}>{perOne(c.spend, c.requests) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Block({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className={plan.tile}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={plan.tileTitle}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Funnel({ data, names, t }: { data: Marketing; names: Record<string, string>; t: T }) {
  const [channel, setChannel] = useState('all');
  const steps = data.funnel[channel] ?? [0, 0, 0, 0, 0, 0, 0, 0];
  const top = steps[0] || 0;
  const keys = ['all', ...data.channels.filter((c) => data.funnel[c.key]).map((c) => c.key)];
  return (
    <Block
      title={t('marketing.blocks.funnel')}
      right={
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-[12.5px]"
          aria-label={t('marketing.cols.channel')}
        >
          {keys.map((k) => (
            <option key={k} value={k}>
              {k === 'all' ? t('marketing.allChannels') : channelName(k, names, t)}
            </option>
          ))}
        </select>
      }
    >
      <p className={cn('text-[13.5px]', plan.muted)}>{t('marketing.funnelNote')}</p>
      <ol className="mt-1 space-y-1.5">
        {FUNNEL_STEPS.map((s, i) => {
          const n = steps[i] ?? 0;
          const pct = top ? Math.round((n / top) * 100) : 0;
          return (
            <li key={s} className="grid grid-cols-[10.5rem_minmax(0,1fr)_3.5rem_3rem] items-center gap-2 text-[13px] max-[560px]:grid-cols-[8rem_minmax(0,1fr)_3rem]">
              <span>{t(`marketing.steps.${s}`)}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-[#E3E9FB] dark:bg-[#17235F]">
                <span className="block h-full rounded-full bg-[#2447D6] dark:bg-[#93A7FF]" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{n}</span>
              <span className={cn('text-right tabular-nums max-[560px]:hidden', plan.muted)}>{top ? `${pct}%` : '—'}</span>
            </li>
          );
        })}
      </ol>
    </Block>
  );
}

function Demand({ data, t }: { data: Marketing; t: T }) {
  const groups = ['field', 'regions', 'degree'].map((f) => ({
    f,
    rows: data.demand.filters.filter((x) => x.field === f).slice(0, 6),
  }));
  const answers = ANSWER_QS.map((q) => ({
    q,
    rows: data.demand.answers.filter((a) => a.q === q).sort((a, b) => b.devices - a.devices),
  })).filter((x) => x.rows.length);
  return (
    <Block title={t('marketing.blocks.demand')}>
      <div className={plan.grid3}>
        {groups.map((g) => (
          <div key={g.f}>
            <p className={plan.subTitle}>{t(`marketing.demand.${g.f}`)}</p>
            {g.rows.length ? (
              <ul className="space-y-1 text-[13px]">
                {g.rows.map((r) => (
                  <li key={r.value} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{r.value}</span>
                    <span className="tabular-nums">{r.devices}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={plan.note}>—</p>
            )}
          </div>
        ))}
      </div>
      {answers.length > 0 && (
        <div className="mt-2">
          <p className={plan.subTitle}>{t('marketing.demand.answers')}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-[820px]:grid-cols-1">
            {answers.map((a) => (
              <div key={a.q} className="text-[13px]">
                <span className="font-semibold">{t(`marketing.questions.${a.q}`)}: </span>
                {a.rows.map((r) => `${bandLabel(a.q, r.band, t)} — ${r.devices}`).join(' · ')}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2">
        <p className={plan.subTitle}>{t('marketing.demand.universities')}</p>
        {data.demand.universities.length ? (
          <div className={plan.tscroll}>
            <table className={plan.table}>
              <thead>
                <tr>
                  <th className={plan.th}>{t('marketing.demand.university')}</th>
                  <th className={cn(plan.th, plan.num)}>{t('marketing.demand.devices')}</th>
                  <th className={cn(plan.th, plan.num)}>{t('marketing.demand.opens')}</th>
                  <th className={cn(plan.th, plan.num)}>{t('marketing.demand.position')}</th>
                  <th className={cn(plan.th, plan.num)}>{t('marketing.demand.seen')}</th>
                </tr>
              </thead>
              <tbody>
                {data.demand.universities.map((u) => (
                  <tr key={u.institution_id}>
                    <td className={plan.td}>{u.name_en || u.name_ko || u.institution_id}</td>
                    <td className={cn(plan.td, plan.num)}>{u.devices}</td>
                    <td className={cn(plan.td, plan.num)}>{u.opens}</td>
                    <td className={cn(plan.td, plan.num)}>{u.avg_position ?? '—'}</td>
                    <td className={cn(plan.td, plan.num)}>{u.seen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={plan.note}>—</p>
        )}
      </div>
    </Block>
  );
}

function Stops({ data, t }: { data: Marketing; t: T }) {
  const s = data.stops;
  const tab = (k: string) => s.locked_tabs.find((x) => x.tab === k)?.devices ?? 0;
  return (
    <Block title={t('marketing.blocks.stops')}>
      <ul className="space-y-1 text-[13.5px]">
        <li>{t('marketing.stops.language', { n: s.language_exits })}</li>
        <li>{t('marketing.stops.clientCode', { left: s.client_code_left, seen: s.client_code_seen })}</li>
        <li>{t('marketing.stops.locked', { prepare: tab('prepare'), application: tab('application'), documents: tab('documents') })}</li>
        <li>
          {t('marketing.stops.form', {
            opened: s.lead_form.opened,
            errors: s.lead_form.field_error,
            sent: s.lead_form.submitted,
          })}
        </li>
      </ul>
      <p className={cn(plan.subTitle, 'mt-2')}>{t('marketing.stops.exitScreens')}</p>
      {s.exit_screens.length ? (
        <ul className="space-y-1 text-[13px]">
          {s.exit_screens.map((x) => (
            <li key={x.screen} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{screenLabel(x.screen, t) || x.screen}</span>
              <span className="tabular-nums">{x.sessions}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={plan.note}>—</p>
      )}
    </Block>
  );
}

function Return({ data, cohorts, t }: { data: Marketing; cohorts: Cohort[] | null; t: T }) {
  const pct = (n: number | null, of: number) => (n == null ? '—' : of ? `${Math.round((n / of) * 100)}% (${n})` : '—');
  return (
    <Block title={t('marketing.blocks.return')}>
      <p className="text-[13.5px]">
        {t('marketing.return.period', { active: data.returning.active, fresh: data.returning.new, back: data.returning.returning })}
      </p>
      {cohorts && cohorts.length > 0 && (
        <div className={plan.tscroll}>
          <table className={plan.table}>
            <thead>
              <tr>
                <th className={plan.th}>{t('marketing.return.week')}</th>
                <th className={cn(plan.th, plan.num)}>{t('marketing.return.devices')}</th>
                <th className={cn(plan.th, plan.num)}>{t('marketing.return.d1')}</th>
                <th className={cn(plan.th, plan.num)}>{t('marketing.return.d7')}</th>
                <th className={cn(plan.th, plan.num)}>{t('marketing.return.d30')}</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <td className={plan.td}>{periodLabel(c.week, addDays(c.week, 6))}</td>
                  <td className={cn(plan.td, plan.num)}>{c.devices}</td>
                  <td className={cn(plan.td, plan.num)}>{pct(c.d1, c.devices)}</td>
                  <td className={cn(plan.td, plan.num)}>{pct(c.d7, c.devices)}</td>
                  <td className={cn(plan.td, plan.num)}>{pct(c.d30, c.devices)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
  );
}

function Spend({ data, names, onSaved, t }: { data: Marketing; names: Record<string, string>; onSaved: () => void; t: T }) {
  const { isAdmin } = useUserRole();
  const [week, setWeek] = useState(tashkentToday());
  const [channel, setChannel] = useState('instagram');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'UZS'>('USD');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of data.spend) by[r.currency] = (by[r.currency] ?? 0) + Number(r.amount);
    return by;
  }, [data.spend]);

  const save = async () => {
    setBusy(true);
    const res = await setSpend(week, channel, amount ? Number(amount) : null, currency, note);
    setBusy(false);
    const status = res.data?.status;
    if (res.error || !status || (status !== 'ok' && status !== 'removed')) toast.error(t('marketing.spend.failed'));
    else {
      toast.success(t(status === 'ok' ? 'marketing.spend.saved' : 'marketing.spend.removed'));
      setAmount('');
      setNote('');
      onSaved();
    }
  };

  return (
    <Block title={t('marketing.blocks.spend')}>
      <p className="text-[13.5px]">
        {t('marketing.spend.summary', {
          total: money(total) ?? '—',
          perRequest: perOne(total, data.kpi.requests) ?? '—',
          perContract: perOne(total, data.kpi.app_contracts) ?? '—',
        })}
      </p>
      <p className={plan.note}>{t('marketing.spend.note')}</p>
      {data.spend.length > 0 && (
        <div className={plan.tscroll}>
          <table className={plan.table}>
            <thead>
              <tr>
                <th className={plan.th}>{t('marketing.spend.week')}</th>
                <th className={plan.th}>{t('marketing.cols.channel')}</th>
                <th className={cn(plan.th, plan.num)}>{t('marketing.spend.amount')}</th>
                <th className={plan.th}>{t('marketing.spend.comment')}</th>
              </tr>
            </thead>
            <tbody>
              {data.spend.map((r) => (
                <tr key={`${r.week}-${r.channel}-${r.currency}`}>
                  <td className={plan.td}>{periodLabel(r.week, addDays(r.week, 6))}</td>
                  <td className={plan.td}>{channelName(r.channel, names, t)}</td>
                  <td className={cn(plan.td, plan.num)}>{money({ [r.currency]: Number(r.amount) })}</td>
                  <td className={plan.td}>{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && (
        <form
          className="mt-1 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="grid gap-0.5 text-[12px] text-muted-foreground">
            {t('marketing.spend.week')}
            <Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className="h-8 w-[150px] text-[13px]" />
          </label>
          <label className="grid gap-0.5 text-[12px] text-muted-foreground">
            {t('marketing.cols.channel')}
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground">
              {Object.entries(names).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5 text-[12px] text-muted-foreground">
            {t('marketing.spend.amount')}
            <Input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-[130px] text-[13px]" />
          </label>
          <label className="grid gap-0.5 text-[12px] text-muted-foreground">
            {t('marketing.spend.currency')}
            <select value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'UZS')} className="h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground">
              <option value="USD">USD</option>
              <option value="UZS">{t('marketing.spend.uzs')}</option>
            </select>
          </label>
          <label className="grid gap-0.5 text-[12px] text-muted-foreground">
            {t('marketing.spend.comment')}
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8 w-[180px] text-[13px]" />
          </label>
          <button type="submit" className={plan.btnPrimary} disabled={busy}>
            {t('marketing.spend.save')}
          </button>
        </form>
      )}
    </Block>
  );
}

function TestFilter({ includeTest, onChange, testDevices, t }: { includeTest: boolean; onChange: (v: boolean) => void; testDevices: number; t: T }) {
  return (
    <Block title={t('marketing.blocks.test')}>
      <label className="flex items-center gap-2 text-[13.5px]">
        <input type="checkbox" checked={includeTest} onChange={(e) => onChange(e.target.checked)} />
        {t('marketing.test.show')}
      </label>
      <p className={plan.note}>{t('marketing.test.note', { n: testDevices })}</p>
    </Block>
  );
}
