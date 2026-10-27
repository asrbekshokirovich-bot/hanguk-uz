import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  GroupedBars,
  ProgressBar,
  type ChartTone,
} from '@/components/investor/InvestorCharts';
import { intakeLabel, leadSourceLabel } from '@/components/investor/investorLabels';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import {
  useInvestorLeadMonthly,
  useInvestorLeadSources,
  useInvestorLeadSummary,
} from '@/hooks/useInvestor';
import { count, monthLabel, percent } from '@/lib/investorFormat';

/* ---------------------------------------------------------------------------
 * Leads - the top of the funnel, in counts.
 *
 * The investor asked to see leads. What she gets is how many, from where, and
 * how many of them convert; what she does not get is who they are. A lead row
 * carries a name, phone, email and (on this schema) a plaintext password, and
 * none of that reaches the client: v_investor_season_leads,
 * v_investor_lead_sources and v_investor_lead_monthly return aggregates only.
 * The footer note says this outright rather than leaving her to guess what is
 * missing, the same way the Applications screen does about passports.
 *
 * "Source" is a channel label the CRM writes (instagram, telegram, call,
 * manual, Public Registration), not a person, so it is safe to name.
 * ------------------------------------------------------------------------ */

// Labels are investor.leads.stage.<key>; known sources are investor.sources.*.
const STAGE_TONES: { key: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'; tone: ChartTone }[] = [
  { key: 'new', tone: 'royal' },
  { key: 'contacted', tone: 'blue' },
  { key: 'qualified', tone: 'lime' },
  { key: 'converted', tone: 'success' },
  { key: 'lost', tone: 'slate' },
];

export default function InvestorLeads() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { activeIntakeId, activeIntake } = useInvestorSeason();
  const seasonName = intakeLabel(t, activeIntake);
  const sourceLabel = (source: string) => leadSourceLabel(t, source);
  const summary = useInvestorLeadSummary(activeIntakeId);
  const sources = useInvestorLeadSources(activeIntakeId);
  const monthly = useInvestorLeadMonthly(activeIntakeId);

  const s = summary.data ?? null;
  const total = Number(s?.total_leads ?? 0);

  const stages = useMemo(
    () =>
      STAGE_TONES.map((stage) => ({
        ...stage,
        label: t(`investor.leads.stage.${stage.key}`),
        value: Number(
          s
            ? ({
                new: s.new_leads,
                contacted: s.contacted_leads,
                qualified: s.qualified_leads,
                converted: s.converted_leads,
                lost: s.lost_leads,
              }[stage.key] ?? 0)
            : 0,
        ),
      })),
    [s, t],
  );

  const sourceRows = sources.data ?? [];
  const topSource = sourceRows[0] ?? null;
  const months = monthly.data ?? [];

  // Still in play: everything that has neither converted nor been lost. This is
  // the number worth a question, so it leads the header sentence.
  const open = stages
    .filter((st) => st.key !== 'converted' && st.key !== 'lost')
    .reduce((sum, st) => sum + st.value, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <InvestorScreenHeader
        title={t('investor.nav.leads')}
        subtitle={
          total === 0
            ? t('investor.leads.noEnquiries')
            : t('investor.leads.subtitle', {
                total: count(total),
                open: count(open),
                converted: count(Number(s?.converted_leads ?? 0)),
              })
        }
      />

      {/* ---------------------------------------------------------- stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('investor.leads.totalLeads')}
          value={count(total)}
          note={activeIntake ? seasonName : '—'}
        />
        <StatCard
          label={t('investor.leads.newLast30')}
          value={count(Number(s?.leads_last_30_days ?? 0))}
          note={
            total > 0
              ? t('investor.leads.ofSeasonLeads', {
                  pct: percent((Number(s?.leads_last_30_days ?? 0) * 100) / total, 0),
                })
              : t('investor.leads.nothingRecorded')
          }
        />
        <StatCard
          label={t('investor.leads.stage.converted')}
          value={count(Number(s?.converted_leads ?? 0))}
          note={t('investor.leads.convertedNote')}
        />
        <StatCard
          label={t('investor.leads.conversionRate')}
          value={s?.conversion_pct != null ? percent(Number(s.conversion_pct), 1) : '—'}
          note={
            s?.conversion_pct != null
              ? t('investor.leads.conversionNote')
              : t('investor.leads.noLeadsToMeasure')
          }
        />
      </div>

      {/* ------------------------------------------------------------- row 2 */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        <InvestorCard className="flex flex-col">
          <CardHead
            title={t('investor.leads.byMonth')}
            subtitle={`${seasonName || t('investor.common.season')} · ${t('investor.leads.byMonthSubtitle')}`}
            action={
              <ChartLegend
                series={[
                  { label: t('investor.nav.leads'), tone: 'royal' },
                  { label: t('investor.leads.stage.converted'), tone: 'lime' },
                ]}
              />
            }
          />
          {months.length === 0 ? (
            <EmptyNote>{t('investor.leads.noEnquiries')}</EmptyNote>
          ) : (
            <div className="px-5 pb-5 pt-4">
              <GroupedBars
                groups={months.map((m) => ({
                  label: monthLabel(m.month, lang),
                  values: [Number(m.lead_count), Number(m.converted_count)],
                }))}
                series={[
                  { label: t('investor.nav.leads'), tone: 'royal' },
                  { label: t('investor.leads.stage.converted'), tone: 'lime' },
                ]}
                formatValue={(n) => count(n)}
              />
            </div>
          )}
        </InvestorCard>

        <InvestorCard className="flex flex-col">
          <CardHead
            title={t('investor.leads.pipelineStatus')}
            subtitle={t('investor.leads.pipelineStatusSubtitle')}
          />
          {total === 0 ? (
            <EmptyNote>{t('investor.leads.nothingUntilFirst')}</EmptyNote>
          ) : (
            <div className="mt-4 space-y-3 px-5 pb-5">
              {stages.map((stage) => (
                <div key={stage.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold text-foreground">{stage.label}</span>
                    <Money className="shrink-0 text-muted-foreground">
                      {count(stage.value)} · {percent((stage.value * 100) / total, 0)}
                    </Money>
                  </div>
                  <ProgressBar
                    className="mt-1.5 h-1.5"
                    pct={(stage.value * 100) / total}
                    tone={stage.tone}
                  />
                </div>
              ))}
            </div>
          )}
        </InvestorCard>
      </div>

      {/* ------------------------------------------------------------- row 3 */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        <InvestorCard className="overflow-hidden">
          <CardHead
            title={t('investor.leads.whereFrom')}
            subtitle={t('investor.leads.whereFromSubtitle')}
          />
          {sourceRows.length === 0 ? (
            <EmptyNote>{t('investor.leads.noEnquiries')}</EmptyNote>
          ) : (
            <div className="mt-4 space-y-3 px-5">
              {sourceRows.map((row, i) => (
                <div key={row.source}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {sourceLabel(row.source)}
                    </span>
                    <Money className="shrink-0 text-muted-foreground">
                      {t('investor.leads.sourceLine', {
                        leads: count(Number(row.lead_count)),
                        converted: count(Number(row.converted_count)),
                      })}
                      {row.converted_pct != null
                        ? ` · ${percent(Number(row.converted_pct), 0)}`
                        : ''}
                    </Money>
                  </div>
                  <ProgressBar
                    className="mt-1.5 h-1.5"
                    pct={
                      (Number(row.lead_count) / Number(topSource?.lead_count ?? 1)) * 100
                    }
                    tone={i === 0 ? 'lime' : 'royal'}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 border-t border-border bg-soft-surface px-5 py-3">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">
              {t('investor.leads.piiNote')}
            </p>
          </div>
        </InvestorCard>

        <InvestorCard className="flex flex-col">
          <CardHead title={t('investor.leads.funnelHealth')} />
          <div className="mt-3">
            <MetricRow
              label={t('investor.leads.stillOpen')}
              hint={t('investor.leads.stillOpenHint')}
              value={<Money className="text-[15px] font-bold">{count(open)}</Money>}
            />
            <MetricRow
              label={t('investor.leads.stage.lost')}
              hint={t('investor.leads.lostHint')}
              value={
                <Money className="text-[15px] font-bold">
                  {count(Number(s?.lost_leads ?? 0))}
                  {total > 0 ? ` · ${percent((Number(s?.lost_leads ?? 0) * 100) / total, 0)}` : ''}
                </Money>
              }
            />
            <MetricRow
              label={t('investor.leads.bestChannel')}
              hint={t('investor.leads.byVolume')}
              value={
                topSource ? (
                  <span className="text-[15px] font-bold text-foreground">
                    {sourceLabel(topSource.source)}
                  </span>
                ) : (
                  <span className="text-[13px] text-muted-foreground">—</span>
                )
              }
            />
            <MetricRow
              label={t('investor.leads.channelsActive')}
              value={<Money className="text-[15px] font-bold">{count(sourceRows.length)}</Money>}
            />
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

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <InvestorCard className="flex flex-col p-5">
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <div className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
        {value}
      </div>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{note}</p>
    </InvestorCard>
  );
}
