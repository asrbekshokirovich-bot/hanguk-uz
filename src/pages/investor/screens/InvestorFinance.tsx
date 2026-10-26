import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvestorScreenHeader } from '@/components/investor/InvestorScreen';
import {
  CardHead,
  EmptyNote,
  InvestorCard,
  Money,
  StatusPill,
  TableHeadCell,
  type PillTone,
} from '@/components/investor/InvestorPrimitives';
import {
  intakeLabel,
  lineItemLabel,
  payoutStatusLabel,
  staffRoleLabel,
} from '@/components/investor/investorLabels';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import {
  useInvestorMonthly,
  useInvestorPayouts,
  useInvestorPnl,
  useInvestorPosition,
  useInvestorStaffDirectory,
  type InvestorPnlRow,
} from '@/hooks/useInvestor';
import { useInvestorExport } from '@/hooks/useInvestorExport';
import {
  HEADLINE_CURRENCY,
  compact,
  formatEquity,
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
 * SCREENS.md 2 - Finance.
 *
 * The P&L, month table and KPI tiles are all UZS, with the unit in the column
 * header and the figures in millions, exactly as TOKENS.md specifies. Any other
 * currency the season carries is shown as its own labelled line rather than
 * being converted - the database holds no exchange rate, and inventing one
 * would put a number in front of an investor that nobody in the company signed
 * off on.
 * ------------------------------------------------------------------------ */

const PAYOUT_TONE: Record<string, PillTone> = {
  paid: 'success',
  accruing: 'warning',
  scheduled: 'info',
  cancelled: 'danger',
};

export default function InvestorFinance() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { activeIntake, activeIntakeId } = useInvestorSeason();
  const seasonName = intakeLabel(t, activeIntake);
  const exporter = useInvestorExport();

  const position = useInvestorPosition(activeIntakeId);
  const pnl = useInvestorPnl(activeIntakeId);
  const monthly = useInvestorMonthly(activeIntakeId);
  const payouts = useInvestorPayouts();
  const staff = useInvestorStaffDirectory();

  const identity = position.data?.[0] ?? null;
  const equity = identity?.equity_percent ?? null;

  const uzs = inCurrency(position.data, HEADLINE_CURRENCY)[0] ?? null;
  const otherPositions = (position.data ?? []).filter((r) => r.currency !== HEADLINE_CURRENCY);

  const months = useMemo(() => inCurrency(monthly.data, HEADLINE_CURRENCY), [monthly.data]);
  const lines = useMemo(() => inCurrency(pnl.data, HEADLINE_CURRENCY), [pnl.data]);

  const revenueLines = lines.filter((l) => l.side === 'revenue');
  const expenseLines = lines.filter((l) => l.side === 'expense');
  const revenueTotal = revenueLines.reduce((s, l) => s + Number(l.amount), 0);
  const expenseTotal = expenseLines.reduce((s, l) => s + Number(l.amount), 0);
  const netTotal = revenueTotal - expenseTotal;
  const marginPct = revenueTotal > 0 ? (netTotal * 100) / revenueTotal : null;
  const expensePct = revenueTotal > 0 ? (expenseTotal * 100) / revenueTotal : null;

  const paid = (payouts.data ?? []).filter((p) => p.status === 'paid');
  const totalDistributed = paid.reduce((s, p) => s + Number(p.amount_uzs), 0);
  const accruing = (payouts.data ?? []).find((p) => p.status !== 'paid') ?? null;

  // The prototype names the finance lead. That is a person, not a string, so it
  // is read from the staff directory and the sentence degrades gracefully when
  // nobody holds the role.
  const financeLead =
    (staff.data ?? []).find((s) => /finance|accountant/i.test(s.role)) ??
    (staff.data ?? []).find((s) => /owner|admin/i.test(s.role)) ??
    null;

  const seasonRange =
    activeIntake?.starts_on && activeIntake?.ends_on
      ? `${monthLabel(activeIntake.starts_on, lang)} – ${monthLabel(activeIntake.ends_on, lang)}`
      : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <InvestorScreenHeader
        title={t('investor.nav.finance')}
        subtitle={t('investor.finance.subtitle', {
          season: seasonName || t('investor.common.seasonLower'),
        })}
        actions={
          <>
            <Button
              variant="outline"
              className="h-11 min-h-[44px] gap-2"
              onClick={() => exporter.run('pnl-xlsx')}
              disabled={exporter.isBusy}
            >
              {exporter.isPending('pnl-xlsx') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel
            </Button>
            <Button
              className="h-11 min-h-[44px] gap-2"
              onClick={() => exporter.run('pnl-pdf')}
              disabled={exporter.isBusy}
            >
              {exporter.isPending('pnl-pdf') ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('investor.finance.exportPdf')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ------------------------------------------------------ left column */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiTile
              label={t('investor.common.revenue')}
              value={compact(revenueTotal)}
              hint="UZS · 100%"
            />
            <KpiTile
              label={t('investor.common.expenses')}
              value={compact(expenseTotal)}
              hint={
                expensePct != null
                  ? `UZS · ${t('investor.finance.ofRevenue', { pct: percent(expensePct) })}`
                  : 'UZS'
              }
            />
            <KpiTile
              label={t('investor.common.netProfit')}
              value={compact(netTotal)}
              hint={
                marginPct != null
                  ? `UZS · ${t('investor.common.margin', { pct: percent(marginPct) })}`
                  : 'UZS'
              }
              valueClassName={
                netTotal > 0 ? 'text-success' : netTotal < 0 ? 'text-destructive' : undefined
              }
            />
          </div>

          <InvestorCard>
            <CardHead
              title={t('investor.finance.pnl')}
              subtitle={[seasonName, seasonRange, t('investor.common.millionUzs')]
                .filter(Boolean)
                .join(' · ')}
            />
            {lines.length === 0 ? (
              <EmptyNote>{t('investor.finance.noBooked')}</EmptyNote>
            ) : (
              <div className="mt-4 px-5 pb-5">
                <PnlSection
                  heading={t('investor.common.revenue')}
                  rows={revenueLines}
                  total={revenueTotal}
                  totalLabel={t('investor.finance.totalRevenue')}
                  totalPct={revenueTotal > 0 ? 100 : null}
                />
                <PnlSection
                  heading={t('investor.finance.operatingExpenses')}
                  rows={expenseLines}
                  total={expenseTotal}
                  totalLabel={t('investor.finance.totalExpenses')}
                  totalPct={expensePct}
                  emptyNote={t('investor.finance.noOpex')}
                />
                <div className="mt-4 flex items-center justify-between gap-4 rounded-md bg-tint-blue p-4">
                  <span className="text-[15px] font-bold text-primary">
                    {t('investor.common.netProfit')}
                  </span>
                  <div className="flex items-baseline gap-4">
                    <Money className="text-[17px] font-extrabold text-primary">
                      {millions(netTotal, 1)}
                    </Money>
                    <span className="text-[14px] font-bold text-info">
                      {marginPct != null ? percent(marginPct) : '—'}
                    </span>
                  </div>
                </div>
                {otherPositions.length > 0 && (
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    {t('investor.finance.otherCurrencies', {
                      list: otherPositions
                        .map((r) =>
                          t('investor.finance.ofRevenueAmount', {
                            amount: moneyWithUnit(r.season_revenue, r.currency),
                          }),
                        )
                        .join(t('investor.finance.and')),
                    })}
                  </p>
                )}
              </div>
            )}
          </InvestorCard>

          <InvestorCard>
            <CardHead
              title={t('investor.finance.monthByMonth')}
              subtitle={t('investor.common.millionUzs')}
            />
            {months.length === 0 ? (
              <EmptyNote>{t('investor.finance.noMonths')}</EmptyNote>
            ) : (
              <div className="mt-4 px-5 pb-5">
                <div className="grid grid-cols-[1fr_90px_90px_90px_70px] gap-2 border-b border-border pb-2">
                  <TableHeadCell>{t('investor.finance.month')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('investor.common.revenue')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('investor.common.expenses')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('investor.finance.profit')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('investor.finance.marginCol')}</TableHeadCell>
                </div>
                {months.map((m) => (
                  <div
                    key={m.month}
                    className="grid grid-cols-[1fr_90px_90px_90px_70px] items-center gap-2 border-b border-soft-line py-2.5 last:border-b-0"
                  >
                    <div className="text-[13px] font-medium text-foreground">
                      {monthLabel(m.month, lang)}
                    </div>
                    <Money className="text-right">{millions(Number(m.revenue), 1)}</Money>
                    <Money className="text-right">{millions(Number(m.expenses), 1)}</Money>
                    <Money className="text-right font-semibold">{millions(Number(m.net), 1)}</Money>
                    <Money className="text-right">
                      {m.margin_pct != null ? percent(Number(m.margin_pct)) : '—'}
                    </Money>
                  </div>
                ))}
              </div>
            )}
          </InvestorCard>
        </div>

        {/* ----------------------------------------------------- right column */}
        <div className="space-y-4">
          <InvestorCard className="border-transparent bg-primary p-[22px] text-primary-foreground shadow-blue">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-primary-foreground/75">
                {equity != null
                  ? t('investor.common.yourShareN', { pct: formatEquity(equity) })
                  : t('investor.common.yourShare')}
              </span>
              {identity && (
                <span className="inline-flex h-6 items-center rounded-pill bg-accent px-2.5 text-[12px] font-semibold text-accent-foreground">
                  {identity.full_name}
                </span>
              )}
            </div>
            <p className="mt-3 text-[13px] text-primary-foreground/75">
              {t('investor.finance.shareOfThisSeason')}
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em]">
                {uzs ? compact(uzs.profit_share) : '—'}
              </span>
              <span className="text-[14px] font-bold text-primary-foreground/70">UZS</span>
            </div>
            {otherPositions.length > 0 && (
              <p className="mt-1.5 text-[12px] text-primary-foreground/75">
                {otherPositions.map((r) => moneyWithUnit(r.profit_share, r.currency)).join(' · ')}
              </p>
            )}
            <div className="mt-5 space-y-2.5 border-t border-primary-foreground/15 pt-4 text-[13px]">
              <ShareRow
                label={t('investor.finance.paidOutSoFar')}
                value={totalDistributed > 0 ? `${compact(totalDistributed)} UZS` : '—'}
              />
              <ShareRow
                label={t('investor.common.accruing', { quarter: quarterLabel() })}
                value={accruing ? `${compact(Number(accruing.amount_uzs))} UZS` : '—'}
              />
              <ShareRow
                label={
                  identity
                    ? t('investor.finance.investedOn', { date: longDate(identity.invested_at, lang) })
                    : t('investor.common.invested')
                }
                value={usd(identity?.invested_amount_usd)}
              />
            </div>
          </InvestorCard>

          <InvestorCard>
            <CardHead
              title={t('investor.finance.payoutHistory')}
              subtitle={t('investor.finance.quarterly')}
            />
            {(payouts.data ?? []).length === 0 ? (
              <EmptyNote>
                {t('investor.finance.noPayouts')}
              </EmptyNote>
            ) : (
              <>
                <div className="mt-3">
                  {(payouts.data ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 border-b border-soft-line px-5 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-foreground">
                          {p.period_label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.paid_at
                            ? t('investor.finance.paidOn', { date: longDate(p.paid_at, lang) })
                            : p.due_date
                              ? t('investor.finance.dueOn', { date: longDate(p.due_date, lang) })
                              : t('investor.finance.dateNotSet')}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Money>{compact(Number(p.amount_uzs))}</Money>
                        <StatusPill tone={PAYOUT_TONE[p.status] ?? 'neutral'}>
                          {payoutStatusLabel(t, p.status)}
                        </StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="m-5 mt-4 flex items-center justify-between rounded-md bg-muted px-4 py-3">
                  <span className="text-[13px] font-semibold text-foreground">
                    {t('investor.finance.totalDistributed')}
                  </span>
                  <Money className="text-[14px] font-bold">
                    {compact(totalDistributed)} UZS
                  </Money>
                </div>
              </>
            )}
          </InvestorCard>

          <InvestorCard className="bg-soft-surface p-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {t('investor.finance.closedNote', {
                  who: financeLead
                    ? t('investor.finance.closedBy', {
                        name: financeLead.full_name,
                        role: staffRoleLabel(t, financeLead.role),
                      })
                    : t('investor.finance.financeTeam'),
                })}{' '}
                <Link
                  to="/crm/investor/messages"
                  className="font-semibold text-primary hover:underline"
                >
                  {financeLead
                    ? t('investor.finance.messageName', { name: financeLead.full_name.split(' ')[0] })
                    : t('investor.finance.messageTeam')}
                </Link>
                .
              </p>
            </div>
          </InvestorCard>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <InvestorCard className="p-[18px]">
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div
        className={`mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.03em] ${valueClassName ?? 'text-foreground'}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{hint}</div>
    </InvestorCard>
  );
}

function ShareRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-primary-foreground/75">{label}</span>
      <Money className="font-semibold">{value}</Money>
    </div>
  );
}

function PnlSection({
  heading,
  rows,
  total,
  totalLabel,
  totalPct,
  emptyNote,
}: {
  heading: string;
  rows: InvestorPnlRow[];
  total: number;
  totalLabel: string;
  totalPct: number | null;
  emptyNote?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-5 last:mb-0">
      <div className="grid grid-cols-[1fr_100px_74px] gap-2 border-b border-border pb-2">
        <TableHeadCell>{heading}</TableHeadCell>
        <TableHeadCell className="text-right">{t('investor.finance.amount')}</TableHeadCell>
        <TableHeadCell className="text-right">{t('investor.finance.pctRev')}</TableHeadCell>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">{emptyNote ?? t('investor.finance.nothingRecorded')}</p>
      ) : (
        rows.map((l) => (
          <div
            key={`${l.side}-${l.line_item}`}
            className="grid grid-cols-[1fr_100px_74px] items-center gap-2 border-b border-soft-line py-2.5"
          >
            <div className="text-[13px] text-foreground">{lineItemLabel(t, l.line_item)}</div>
            <Money className="text-right">{millions(Number(l.amount), 1)}</Money>
            <Money className="text-right text-muted-foreground">
              {l.pct_of_revenue != null ? percent(Number(l.pct_of_revenue)) : '—'}
            </Money>
          </div>
        ))
      )}
      <div className="grid grid-cols-[1fr_100px_74px] items-center gap-2 py-2.5">
        <div className="text-[13px] font-bold text-foreground">{totalLabel}</div>
        <Money className="text-right font-bold">{millions(total, 1)}</Money>
        <Money className="text-right font-bold">
          {totalPct != null ? percent(totalPct) : '—'}
        </Money>
      </div>
    </div>
  );
}
