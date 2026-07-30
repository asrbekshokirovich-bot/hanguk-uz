import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvestorScreenHeader } from '@/components/investor/InvestorScreen';
import {
  CardHead,
  EmptyNote,
  InvestorCard,
  MetricRow,
  Money,
} from '@/components/investor/InvestorPrimitives';
import {
  ChartLegend,
  FunnelBars,
  GroupedBars,
  Sparkline,
  type ChartTone,
} from '@/components/investor/InvestorCharts';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import {
  useInvestorApplications,
  useInvestorFunnel,
  useInvestorMonthly,
  useInvestorPayouts,
  useInvestorPosition,
} from '@/hooks/useInvestor';
import { useInvestorExport } from '@/hooks/useInvestorExport';
import {
  HEADLINE_CURRENCY,
  compact,
  count,
  firstName,
  formatEquity,
  greeting,
  inCurrency,
  longDate,
  millions,
  moneyWithUnit,
  monthLabel,
  percent,
  quarterLabel,
  usd,
} from '@/lib/investorFormat';

/* ---------------------------------------------------------------------------
 * SCREENS.md 1 - Overview.
 *
 * Every figure is read from the v_investor_* views for the selected season.
 * There are no seeded numbers: where a season has no rows the card says so.
 *
 * Two deliberate departures from the prototype, both forced by real data:
 *
 *  - The prototype compares each headline against the previous season. Her
 *    visibility floor makes earlier seasons unreachable, not merely hidden, so
 *    a comparison is only drawn when an earlier season is itself inside her
 *    window. Usually it is not, and the delta pill is simply absent rather
 *    than showing a fabricated +34%.
 *  - A season can hold more than one currency and the database stores no
 *    exchange rate. UZS is the headline; anything else is a labelled line
 *    underneath. Nothing is summed across currencies.
 * ------------------------------------------------------------------------ */

const FUNNEL_TONES: ChartTone[] = ['royal', 'blue', 'blue', 'lime', 'lime', 'success'];

export default function InvestorOverview() {
  const { activeIntakeId, activeIntake, intakes } = useInvestorSeason();
  const exporter = useInvestorExport();

  const position = useInvestorPosition(activeIntakeId);
  const monthly = useInvestorMonthly(activeIntakeId);
  const funnel = useInvestorFunnel(activeIntakeId);
  const applications = useInvestorApplications(activeIntakeId);
  const payouts = useInvestorPayouts();

  const identity = position.data?.[0] ?? null;
  const equity = identity?.equity_percent ?? null;

  const uzs = inCurrency(position.data, HEADLINE_CURRENCY)[0] ?? null;
  const otherRows = (position.data ?? []).filter((r) => r.currency !== HEADLINE_CURRENCY);

  const months = useMemo(
    () => inCurrency(monthly.data, HEADLINE_CURRENCY),
    [monthly.data],
  );

  // The season immediately before this one, and only if it is inside her
  // window too. Almost always undefined: her visibility floor makes earlier
  // seasons unreachable, which is why no headline carries a delta pill.
  const previous = useMemo(
    () => (activeIntake ? intakes.find((i) => i.sort_key < activeIntake.sort_key) ?? null : null),
    [activeIntake, intakes],
  );

  const signed = funnel.data?.find((r) => r.stage_order === 1)?.student_count ?? null;
  const departed = funnel.data?.find((r) => r.stage_order === 6)?.student_count ?? null;

  const bestMonth = useMemo(() => {
    if (months.length === 0) return '—';
    const best = months.reduce((a, b) => (Number(a.revenue) > Number(b.revenue) ? a : b));
    return `${monthLabel(best.month)} · ${compact(Number(best.revenue))}`;
  }, [months]);

  const marginPct =
    uzs && uzs.season_revenue > 0 ? (uzs.season_net_profit * 100) / uzs.season_revenue : null;

  const distributed = (payouts.data ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount_uzs), 0);
  const accruing = (payouts.data ?? []).find((p) => p.status !== 'paid') ?? null;

  const stuck = (applications.data ?? [])
    .filter((a) => (a.days_since_movement ?? 0) >= 14)
    .sort((a, b) => (b.days_since_movement ?? 0) - (a.days_since_movement ?? 0));
  const unsubmitted = (applications.data ?? []).filter((a) => !a.submitted_at);

  // Track what the Watchlist actually rendered, so the empty state fires when
  // no row qualifies rather than only when the season has no revenue.
  const showExpenseNote = !!uzs && uzs.season_expenses === 0 && uzs.season_revenue > 0;
  const hasWatchRows = stuck.length > 0 || unsubmitted.length > 0 || showExpenseNote;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <InvestorScreenHeader
        title={identity ? `${greeting()}, ${firstName(identity.full_name)}` : greeting()}
        subtitle={
          previous
            ? `Comparing against ${previous.label}. Here is where your stake stands.`
            : 'Here is where your stake stands.'
        }
        actions={
          <Button
            variant="outline"
            className="h-11 min-h-[44px] gap-2"
            onClick={() => exporter.run('season-report-pdf')}
            disabled={exporter.isBusy}
          >
            {exporter.isPending('season-report-pdf') ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Season Report
          </Button>
        }
      />

      {/* ---------------------------------------------------------- stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InvestorCard className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">Season Revenue</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
              {uzs ? compact(uzs.season_revenue) : '—'}
            </span>
            <span className="text-[14px] font-bold text-muted-foreground">UZS</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {activeIntake
              ? `${activeIntake.label} · ${months.length} month${months.length === 1 ? '' : 's'} recorded`
              : '—'}
          </p>
          {otherRows.length > 0 && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {otherRows
                .map((r) => `${moneyWithUnit(r.season_revenue, r.currency)} also collected`)
                .join(' · ')}
            </p>
          )}
          <div className="mt-auto pt-3">
            <Sparkline values={months.map((m) => Number(m.revenue))} tone="royal" />
          </div>
        </InvestorCard>

        <InvestorCard className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">Net Profit</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
              {uzs ? compact(uzs.season_net_profit) : '—'}
            </span>
            <span className="text-[14px] font-bold text-muted-foreground">UZS</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {marginPct != null ? `${percent(marginPct)} margin` : 'No revenue recorded yet'}
          </p>
          {otherRows.length > 0 && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {otherRows
                .map((r) => `${moneyWithUnit(r.season_net_profit, r.currency)} net`)
                .join(' · ')}
            </p>
          )}
          <div className="mt-auto pt-3">
            <Sparkline values={months.map((m) => Number(m.net))} tone="lime" />
          </div>
        </InvestorCard>

        {/* The royal-blue share card. Equity is data - the label reads it too. */}
        <InvestorCard className="flex flex-col border-transparent bg-primary p-5 text-primary-foreground shadow-blue">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-primary-foreground/75">
              {equity != null ? `Your ${formatEquity(equity)}% Share` : 'Your Share'}
            </span>
            <span className="inline-flex h-6 items-center rounded-pill bg-accent px-2.5 text-[12px] font-semibold text-accent-foreground">
              Equity
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em]">
              {uzs ? compact(uzs.profit_share) : '—'}
            </span>
            <span className="text-[14px] font-bold text-primary-foreground/70">UZS</span>
          </div>
          <p className="mt-1.5 text-[12px] text-primary-foreground/75">
            Share of season net profit
          </p>
          {otherRows.length > 0 && (
            <p className="mt-1 text-[12px] text-primary-foreground/75">
              {otherRows.map((r) => moneyWithUnit(r.profit_share, r.currency)).join(' · ')}
            </p>
          )}
          <div className="mt-auto border-t border-primary-foreground/15 pt-3 text-[12px] text-primary-foreground/75">
            Distributed to date{' '}
            <Money className="ml-1 text-primary-foreground">
              {distributed > 0 ? compact(distributed) : '0'}
            </Money>
          </div>
        </InvestorCard>

        <InvestorCard className="flex flex-col p-5">
          <span className="text-[13px] font-semibold text-muted-foreground">Students Signed</span>
          <div className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
            {signed != null ? count(signed) : '—'}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {departed != null && departed > 0
              ? `${count(departed)} already departed for Korea`
              : 'None departed for Korea yet'}
          </p>
          <div className="mt-auto pt-3 text-[12px] text-muted-foreground">
            {activeIntake?.starts_on && activeIntake?.ends_on
              ? `${longDate(activeIntake.starts_on)} — ${longDate(activeIntake.ends_on)}`
              : null}
          </div>
        </InvestorCard>
      </div>

      {/* ------------------------------------------------------------- row 2 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <InvestorCard className="flex flex-col">
          <CardHead
            title="Revenue & Profit by Month"
            subtitle={`${activeIntake?.label ?? 'Season'} · million UZS`}
            action={
              <ChartLegend
                series={[
                  { label: 'Revenue', tone: 'royal' },
                  { label: 'Net profit', tone: 'lime' },
                ]}
              />
            }
          />
          {months.length === 0 ? (
            <EmptyNote>No payments have been recorded for this season yet.</EmptyNote>
          ) : (
            <>
              <div className="px-5 pt-4">
                <GroupedBars
                  groups={months.map((m) => ({
                    label: monthLabel(m.month),
                    values: [Number(m.revenue), Number(m.net)],
                  }))}
                  series={[
                    { label: 'Revenue', tone: 'royal' },
                    { label: 'Net profit', tone: 'lime' },
                  ]}
                  formatValue={(n) => millions(n, 1)}
                />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-soft-line px-5 py-4 sm:grid-cols-3">
                <FooterStat label="Best month" value={bestMonth} />
                <FooterStat
                  label="Avg. revenue / student"
                  value={
                    signed && signed > 0 && uzs ? `${compact(uzs.season_revenue / signed)} UZS` : '—'
                  }
                />
                <FooterStat label="Months recorded" value={count(months.length)} />
              </div>
            </>
          )}
        </InvestorCard>

        <InvestorCard className="flex flex-col">
          <CardHead
            title="Your Position"
            subtitle={identity ? `Since ${longDate(identity.invested_at)}` : undefined}
          />
          <div className="mt-3">
            <MetricRow
              label="Equity held"
              value={
                <span className="text-[15px] font-bold text-foreground">
                  {equity != null ? `${formatEquity(equity)}%` : '—'}
                </span>
              }
            />
            <MetricRow
              label="Invested"
              value={<Money className="text-[15px] font-bold">{usd(identity?.invested_amount_usd)}</Money>}
            />
            <MetricRow
              label="Distributed to date"
              value={
                <Money className="text-[15px] font-bold">
                  {distributed > 0 ? `${compact(distributed)} UZS` : '—'}
                </Money>
              }
            />
            <MetricRow
              label={`Accruing (${quarterLabel()})`}
              value={
                accruing ? (
                  <Money className="text-[15px] font-bold text-success">
                    +{compact(Number(accruing.amount_uzs))} UZS
                  </Money>
                ) : (
                  <span className="text-[13px] text-muted-foreground">No distribution scheduled</span>
                )
              }
            />
          </div>
          <div className="p-5 pt-4">
            {accruing ? (
              <div className="flex items-center gap-3 rounded-md bg-tint-lime p-3">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-accent">
                  <Clock className="h-4 w-4 text-accent-foreground" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-foreground">
                    Next payout · {longDate(accruing.due_date)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {accruing.period_label} distribution
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-md bg-muted p-3 text-[12px] text-muted-foreground">
                No distributions have been recorded yet. They will appear here and in Finance as
                soon as the finance team schedules one.
              </p>
            )}
          </div>
        </InvestorCard>
      </div>

      {/* ------------------------------------------------------------- row 3 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <InvestorCard className="flex flex-col pb-5">
          <CardHead
            title="Season Pipeline"
            subtitle={
              signed != null
                ? `${count(signed)} signed · ${count(applications.data?.length ?? 0)} applications`
                : undefined
            }
            action={
              <Link
                to="/crm/investor/applications"
                className="inline-flex items-center text-[13px] font-semibold text-primary hover:underline"
              >
                All applications →
              </Link>
            }
          />
          <div className="px-5 pt-4">
            {(funnel.data ?? []).length === 0 ? (
              <EmptyNote>No students have been signed to this season yet.</EmptyNote>
            ) : (
              <FunnelBars
                rows={(funnel.data ?? []).map((r) => ({
                  stage: r.stage,
                  value: Number(r.student_count),
                  tone: FUNNEL_TONES[r.stage_order - 1] ?? 'slate',
                }))}
              />
            )}
          </div>
          <p className="mt-4 px-5 text-[11px] leading-relaxed text-muted-foreground">
            Documents Ready, Offer Received and Visa Approved are not recorded in the CRM yet, so
            they read zero until the team starts setting them.
          </p>
        </InvestorCard>

        <InvestorCard className="flex flex-col">
          <CardHead title="Watchlist" subtitle="Things worth a question" />
          <div className="space-y-2 px-5 pt-4">
            {stuck.length > 0 && (
              <WatchRow
                tone="danger"
                title={`${count(stuck.length)} application${stuck.length === 1 ? '' : 's'} stuck ${stuck[0].days_since_movement ?? 0} days`}
                detail={`${stuck[0].student_name} · ${stuck[0].university ?? 'University not set'}`}
              />
            )}
            {unsubmitted.length > 0 && (
              <WatchRow
                tone="warning"
                title={`${count(unsubmitted.length)} application${unsubmitted.length === 1 ? '' : 's'} not yet submitted`}
                detail="Signed students without a submission on file"
              />
            )}
            {showExpenseNote && (
              <WatchRow
                tone="neutral"
                title="No expenses booked against this season"
                detail="Net profit currently equals revenue"
              />
            )}
            {!hasWatchRows && (
              <EmptyNote className="px-0">Nothing needs your attention in this season.</EmptyNote>
            )}
          </div>
          <div className="mt-auto p-5 pt-4">
            <Link
              to="/crm/investor/messages"
              className="text-[13px] font-semibold text-primary hover:underline"
            >
              Ask the team about this →
            </Link>
          </div>
        </InvestorCard>
      </div>
    </div>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] font-bold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

const WATCH_TONE = {
  danger: 'bg-soft-danger',
  warning: 'bg-soft-warning',
  neutral: 'bg-muted',
} as const;

const WATCH_DOT = {
  danger: 'bg-destructive',
  warning: 'bg-warning',
  neutral: 'bg-muted-foreground',
} as const;

function WatchRow({
  tone,
  title,
  detail,
}: {
  tone: keyof typeof WATCH_TONE;
  title: string;
  detail: string;
}) {
  return (
    <div className={`flex gap-3 rounded-md p-3 ${WATCH_TONE[tone]}`}>
      <span className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-pill ${WATCH_DOT[tone]}`} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}
