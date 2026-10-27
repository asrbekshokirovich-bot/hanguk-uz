import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { intakeLabel, stageLabel } from '@/components/investor/investorLabels';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import {
  useInvestorApplications,
  useInvestorFunnel,
  useInvestorLeadSummary,
  useInvestorMonthly,
  useInvestorPayouts,
  useInvestorPlanRevenue,
  useInvestorPosition,
} from '@/hooks/useInvestor';
import { useInvestorExport } from '@/hooks/useInvestorExport';
import { fillSeasonMonths } from '@/lib/seasonMonths';
import {
  stuckApplications,
  studentsNotSubmitted,
  studentsWithoutApplication,
} from '@/lib/investorPipeline';
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

// Keyed by stage_order, not by position: the funnel view added a stage 0
// (Leads) and an array index would have shifted every colour by one.
const FUNNEL_TONES: Record<number, ChartTone> = {
  0: 'slate',
  1: 'royal',
  2: 'blue',
  3: 'blue',
  4: 'lime',
  5: 'lime',
  6: 'success',
};

export default function InvestorOverview() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { activeIntakeId, activeIntake, intakes } = useInvestorSeason();
  const seasonName = intakeLabel(t, activeIntake);
  const exporter = useInvestorExport();

  const position = useInvestorPosition(activeIntakeId);
  const monthly = useInvestorMonthly(activeIntakeId);
  const funnel = useInvestorFunnel(activeIntakeId);
  const leads = useInvestorLeadSummary(activeIntakeId);
  const applications = useInvestorApplications(activeIntakeId);
  const payouts = useInvestorPayouts();
  const planRevenue = useInvestorPlanRevenue(activeIntakeId);

  // The "No Risk" card: that tariff's money, one line per currency (it is
  // billed in USD, but nothing here assumes so).
  const noRisk = (planRevenue.data ?? [])
    .filter((r) => r.plan === 'no_risk')
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const noRiskHead = noRisk[0] ?? null;
  const noRiskStudents = noRisk.reduce((n, r) => n + Number(r.students), 0);

  // This season's UZS money from active contracts, per active student who paid
  // it. Cancelled contracts are left out of both sides.
  const avgPerStudent = useMemo(() => {
    const rows = (planRevenue.data ?? []).filter((r) => r.currency === HEADLINE_CURRENCY);
    const money = rows.reduce((n, r) => n + Number(r.active_collected ?? 0), 0);
    const people = rows.reduce((n, r) => n + Number(r.active_students ?? 0), 0);
    return people > 0 ? money / people : null;
  }, [planRevenue.data]);

  const identity = position.data?.[0] ?? null;
  const equity = identity?.equity_percent ?? null;

  const uzs = inCurrency(position.data, HEADLINE_CURRENCY)[0] ?? null;
  const otherRows = (position.data ?? []).filter((r) => r.currency !== HEADLINE_CURRENCY);

  const months = useMemo(
    () => inCurrency(monthly.data, HEADLINE_CURRENCY),
    [monthly.data],
  );
  // The chart shows every month of the season so far, quiet ones as zero.
  const chartMonths = useMemo(
    () => fillSeasonMonths(months, activeIntake?.starts_on, activeIntake?.ends_on),
    [months, activeIntake?.starts_on, activeIntake?.ends_on],
  );

  // The season immediately before this one, and only if it is inside her
  // window too. Almost always undefined: her visibility floor makes earlier
  // seasons unreachable, which is why no headline carries a delta pill.
  const previous = useMemo(
    () => (activeIntake ? intakes.find((i) => i.sort_key < activeIntake.sort_key) ?? null : null),
    [activeIntake, intakes],
  );

  const signed = funnel.data?.find((r) => r.stage_order === 1)?.student_count ?? null;
  const leadTotal = leads.data ? Number(leads.data.total_leads) : null;

  const bestMonth = useMemo(() => {
    if (months.length === 0) return '—';
    const best = months.reduce((a, b) => (Number(a.revenue) > Number(b.revenue) ? a : b));
    return `${monthLabel(best.month, lang)} · ${compact(Number(best.revenue))}`;
  }, [months, lang]);

  const marginPct =
    uzs && uzs.season_revenue > 0 ? (uzs.season_net_profit * 100) / uzs.season_revenue : null;

  const distributed = (payouts.data ?? [])
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount_uzs), 0);
  const accruing = (payouts.data ?? []).find((p) => p.status !== 'paid') ?? null;

  // Open applications only: a "completed" one (visa applied) is finished, not
  // stuck. Cancelled contracts are already out of the view.
  const stuck = stuckApplications(applications.data ?? []);
  // Students, not applications: one student can hold several.
  const notSubmitted = studentsNotSubmitted(applications.data ?? []);
  const withoutApplication = studentsWithoutApplication(signed, applications.data ?? []);

  // Track what the Watchlist actually rendered, so the empty state fires when
  // no row qualifies rather than only when the season has no revenue.
  const showExpenseNote = !!uzs && uzs.season_expenses === 0 && uzs.season_revenue > 0;
  const hasWatchRows =
    stuck.length > 0 || notSubmitted > 0 || withoutApplication > 0 || showExpenseNote;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <InvestorScreenHeader
        title={
          identity
            ? `${greeting(new Date(), lang)}, ${firstName(identity.full_name)}`
            : greeting(new Date(), lang)
        }
        subtitle={
          previous
            ? t('investor.overview.subtitleCompare', { season: intakeLabel(t, previous) })
            : t('investor.overview.subtitle')
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
            {t('investor.overview.seasonReport')}
          </Button>
        }
      />

      {/* ---------------------------------------------------------- stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InvestorCard className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">
              {t('investor.overview.seasonRevenue')}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
              {uzs ? compact(uzs.season_revenue) : '—'}
            </span>
            <span className="text-[14px] font-bold text-muted-foreground">UZS</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {activeIntake
              ? t('investor.overview.monthsRecorded', { season: seasonName, count: months.length })
              : '—'}
          </p>
          {otherRows.length > 0 && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {otherRows
                .map((r) =>
                  t('investor.overview.alsoCollected', {
                    amount: moneyWithUnit(r.season_revenue, r.currency),
                  }),
                )
                .join(' · ')}
            </p>
          )}
          <div className="mt-auto pt-3">
            <Sparkline values={months.map((m) => Number(m.revenue))} tone="royal" />
          </div>
        </InvestorCard>

        {/* No Risk tariff, as its own block (Asrbek, 2026-10-26). */}
        <InvestorCard className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">
              {t('investor.lineItems.no_risk')}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
              {noRiskHead
                ? noRiskHead.currency === 'USD'
                  ? usd(Number(noRiskHead.collected))
                  : compact(Number(noRiskHead.collected))
                : '—'}
            </span>
            {noRiskHead && noRiskHead.currency !== 'USD' && (
              <span className="text-[14px] font-bold text-muted-foreground">{noRiskHead.currency}</span>
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {noRiskHead
              ? t('investor.overview.noRiskPaid', { count: noRiskStudents, n: count(noRiskStudents) })
              : t('investor.overview.noRiskNone')}
          </p>
          {noRisk.slice(1).map((r) => (
            <p key={r.currency} className="mt-1 text-[12px] text-muted-foreground">
              {t('investor.overview.alsoCollected', {
                amount: moneyWithUnit(Number(r.collected), r.currency),
              })}
            </p>
          ))}
          <div className="mt-auto pt-3 text-[12px] text-muted-foreground">
            {noRisk.length > 0
              ? t('investor.overview.outstanding', {
                  amounts: noRisk
                    .map((r) => moneyWithUnit(Number(r.outstanding), r.currency))
                    .join(' · '),
                })
              : null}
          </div>
        </InvestorCard>

        <InvestorCard className="flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">
              {t('investor.common.netProfit')}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
              {uzs ? compact(uzs.season_net_profit) : '—'}
            </span>
            <span className="text-[14px] font-bold text-muted-foreground">UZS</span>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {marginPct != null
              ? t('investor.common.margin', { pct: percent(marginPct) })
              : t('investor.overview.noRevenueYet')}
          </p>
          {otherRows.length > 0 && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {otherRows
                .map((r) =>
                  t('investor.overview.netAmount', {
                    amount: moneyWithUnit(r.season_net_profit, r.currency),
                  }),
                )
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
              {equity != null
                ? t('investor.common.yourShareN', { pct: formatEquity(equity) })
                : t('investor.common.yourShare')}
            </span>
            <span className="inline-flex h-6 items-center rounded-pill bg-accent px-2.5 text-[12px] font-semibold text-accent-foreground">
              {t('investor.overview.equity')}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em]">
              {uzs ? compact(uzs.profit_share) : '—'}
            </span>
            <span className="text-[14px] font-bold text-primary-foreground/70">UZS</span>
          </div>
          <p className="mt-1.5 text-[12px] text-primary-foreground/75">
            {t('investor.overview.shareOfNet')}
          </p>
          {otherRows.length > 0 && (
            <p className="mt-1 text-[12px] text-primary-foreground/75">
              {otherRows.map((r) => moneyWithUnit(r.profit_share, r.currency)).join(' · ')}
            </p>
          )}
          <div className="mt-auto border-t border-primary-foreground/15 pt-3 text-[12px] text-primary-foreground/75">
            {t('investor.overview.distributedToDate')}{' '}
            <Money className="ml-1 text-primary-foreground">
              {distributed > 0 ? `${compact(distributed)} UZS` : '—'}
            </Money>
          </div>
        </InvestorCard>

        <InvestorCard className="flex flex-col p-5">
          <span className="text-[13px] font-semibold text-muted-foreground">
            {t('investor.overview.studentsSigned')}
          </span>
          <div className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
            {signed != null ? count(signed) : '—'}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {leads.data
              ? `${t('investor.overview.fromLeads', {
                  count: Number(leads.data.total_leads),
                  n: count(Number(leads.data.total_leads)),
                })}${
                  leads.data.conversion_pct != null
                    ? ` · ${t('investor.overview.convertedPct', {
                        pct: percent(Number(leads.data.conversion_pct), 1),
                      })}`
                    : ''
                }`
              : t('investor.overview.departuresNotRecorded')}
          </p>
          <div className="mt-auto pt-3 text-[12px] text-muted-foreground">
            {activeIntake?.starts_on && activeIntake?.ends_on
              ? `${longDate(activeIntake.starts_on, lang)} — ${longDate(activeIntake.ends_on, lang)}`
              : null}
          </div>
        </InvestorCard>
      </div>

      {/* ------------------------------------------------------------- row 2 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <InvestorCard className="flex flex-col">
          <CardHead
            title={t('investor.overview.byMonthTitle')}
            subtitle={`${seasonName || t('investor.common.season')} · ${t('investor.common.millionUzs')}`}
            action={
              <ChartLegend
                series={[
                  { label: t('investor.common.revenue'), tone: 'royal' },
                  { label: t('investor.common.netProfit'), tone: 'lime' },
                ]}
              />
            }
          />
          {months.length === 0 ? (
            <EmptyNote>{t('investor.overview.noPayments')}</EmptyNote>
          ) : (
            <>
              <div className="px-5 pt-4">
                <GroupedBars
                  groups={chartMonths.map((m) => ({
                    label: monthLabel(m.month, lang),
                    values: [Number(m.revenue), Number(m.net)],
                  }))}
                  series={[
                    { label: t('investor.common.revenue'), tone: 'royal' },
                    { label: t('investor.common.netProfit'), tone: 'lime' },
                  ]}
                  formatValue={(n) => millions(n, 1)}
                />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-soft-line px-5 py-4 sm:grid-cols-3">
                <FooterStat label={t('investor.overview.bestMonth')} value={bestMonth} />
                <FooterStat
                  label={t('investor.overview.avgPerStudent')}
                  value={
                    avgPerStudent != null ? `${compact(avgPerStudent)} UZS` : '—'
                  }
                />
                <FooterStat
                  label={t('investor.overview.monthsRecordedLabel')}
                  value={count(months.length)}
                />
              </div>
            </>
          )}
        </InvestorCard>

        <InvestorCard className="flex flex-col">
          <CardHead
            title={t('investor.overview.yourPosition')}
            subtitle={
              identity
                ? t('investor.overview.since', { date: longDate(identity.invested_at, lang) })
                : undefined
            }
          />
          <div className="mt-3">
            <MetricRow
              label={t('investor.overview.equityHeld')}
              value={
                <span className="text-[15px] font-bold text-foreground">
                  {equity != null ? `${formatEquity(equity)}%` : '—'}
                </span>
              }
            />
            <MetricRow
              label={t('investor.common.invested')}
              value={<Money className="text-[15px] font-bold">{usd(identity?.invested_amount_usd)}</Money>}
            />
            <MetricRow
              label={t('investor.overview.distributedToDate')}
              value={
                <Money className="text-[15px] font-bold">
                  {distributed > 0 ? `${compact(distributed)} UZS` : '—'}
                </Money>
              }
            />
            <MetricRow
              label={t('investor.common.accruing', { quarter: quarterLabel() })}
              value={
                accruing ? (
                  <Money className="text-[15px] font-bold text-success">
                    +{compact(Number(accruing.amount_uzs))} UZS
                  </Money>
                ) : (
                  <span className="text-[13px] text-muted-foreground">
                    {t('investor.overview.noDistributionScheduled')}
                  </span>
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
                    {t('investor.overview.nextPayout', { date: longDate(accruing.due_date, lang) })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('investor.overview.periodDistribution', { period: accruing.period_label })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-md bg-muted p-3 text-[12px] text-muted-foreground">
                {t('investor.overview.noDistributions')}
              </p>
            )}
          </div>
        </InvestorCard>
      </div>

      {/* ------------------------------------------------------------- row 3 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <InvestorCard className="flex flex-col pb-5">
          <CardHead
            title={t('investor.overview.seasonPipeline')}
            subtitle={
              signed != null
                ? [
                    leadTotal != null
                      ? t('investor.overview.leadsN', { count: leadTotal, n: count(leadTotal) })
                      : null,
                    t('investor.overview.signedN', { count: signed, n: count(signed) }),
                    t('investor.overview.applicationsN', {
                      count: applications.data?.length ?? 0,
                      n: count(applications.data?.length ?? 0),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : undefined
            }
            action={
              <Link
                to="/crm/investor/applications"
                className="inline-flex items-center text-[13px] font-semibold text-primary hover:underline"
              >
                {t('investor.overview.allApplications')}
              </Link>
            }
          />
          <div className="px-5 pt-4">
            {(funnel.data ?? []).length === 0 ? (
              <EmptyNote>{t('investor.overview.noSigned')}</EmptyNote>
            ) : (
              <FunnelBars
                rows={(funnel.data ?? []).map((r) => ({
                  stage: stageLabel(t, r.stage_order, r.stage),
                  value: Number(r.student_count),
                  tone: FUNNEL_TONES[r.stage_order] ?? 'slate',
                }))}
              />
            )}
          </div>
          <p className="mt-4 px-5 text-[11px] leading-relaxed text-muted-foreground">
            {t('investor.overview.pipelineNote')}
          </p>
        </InvestorCard>

        <InvestorCard className="flex flex-col">
          <CardHead
            title={t('investor.overview.watchlist')}
            subtitle={t('investor.overview.watchlistSubtitle')}
          />
          <div className="space-y-2 px-5 pt-4">
            {stuck.length > 0 && (
              <WatchRow
                tone="danger"
                title={t('investor.overview.stuck', {
                  count: stuck.length,
                  n: count(stuck.length),
                  days: stuck[0].days_since_movement ?? 0,
                })}
                detail={`${stuck[0].student_name} · ${stuck[0].university ?? t('investor.common.universityNotSet')}`}
              />
            )}
            {withoutApplication > 0 && (
              <WatchRow
                tone="warning"
                title={t('investor.overview.withoutApp', {
                  count: withoutApplication,
                  n: count(withoutApplication),
                })}
                detail={t('investor.overview.withoutAppDetail')}
              />
            )}
            {notSubmitted > 0 && (
              <WatchRow
                tone="warning"
                title={t('investor.overview.notSubmitted', {
                  count: notSubmitted,
                  n: count(notSubmitted),
                })}
                detail={t('investor.overview.notSubmittedDetail')}
              />
            )}
            {showExpenseNote && (
              <WatchRow
                tone="neutral"
                title={t('investor.overview.noExpenses')}
                detail={t('investor.overview.noExpensesDetail')}
              />
            )}
            {!hasWatchRows && (
              <EmptyNote className="px-0">{t('investor.overview.nothingNeedsAttention')}</EmptyNote>
            )}
          </div>
          <div className="mt-auto p-5 pt-4">
            <Link
              to="/crm/investor/messages"
              className="text-[13px] font-semibold text-primary hover:underline"
            >
              {t('investor.common.askTeam')}
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
