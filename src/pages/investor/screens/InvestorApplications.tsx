import { useMemo, useState } from 'react';
import { Download, Loader2, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { InvestorScreenHeader } from '@/components/investor/InvestorScreen';
import {
  CardHead,
  EmptyNote,
  InitialsAvatar,
  InvestorCard,
  MetricRow,
  Money,
  NotTracked,
  StatusPill,
  TableHeadCell,
  type PillTone,
} from '@/components/investor/InvestorPrimitives';
import { ProgressBar, ToneRule, type ChartTone } from '@/components/investor/InvestorCharts';
import {
  applicationStatusLabel,
  degreeLabel,
  planLabel,
  stageLabel,
} from '@/components/investor/investorLabels';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import {
  useInvestorApplications,
  useInvestorFunnel,
  type InvestorApplicationRow,
} from '@/hooks/useInvestor';
import { useInvestorExport } from '@/hooks/useInvestorExport';
import { count, percent, relativeTime } from '@/lib/investorFormat';
import { FINAL_STATUSES, STUCK_DAYS, acceptanceRate, isSubmitted, stuckApplications, visaRate } from '@/lib/investorPipeline';

/* ---------------------------------------------------------------------------
 * SCREENS.md 3 - Applications.
 *
 * Student PII stops at name and plan. The view she reads exposes nothing else -
 * no passport number, no document, no contact detail - and the card footer says
 * so out loud rather than leaving her to wonder what is being withheld.
 *
 * The funnel keeps all six stages from the design. Since migration
 * 20261026180000 every stage is counted from real CRM data: application
 * statuses for Documents Ready / Submitted / Offer Received, and the
 * student_intakes visa_approved_at / departed_at dates for the last two.
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
// Every stage is recorded since migration 20261026180000.
const UNTRACKED_STAGES = new Set<string>();

const STATUS_TONE: Record<string, PillTone> = {
  chosen: 'neutral',
  online: 'info',
  offline: 'info',
  interview: 'info',
  accepted: 'success',
  final: 'success',
  visa_process: 'success',
  visa_waiting: 'success',
  visa_received: 'success',
  rejected: 'danger',
};


export default function InvestorApplications() {
  const { t } = useTranslation();
  const { activeIntakeId } = useInvestorSeason();
  const exporter = useInvestorExport();
  const applications = useInvestorApplications(activeIntakeId);
  const funnel = useInvestorFunnel(activeIntakeId);
  const [filter, setFilter] = useState<'all' | 'stuck'>('all');

  const rows = applications.data ?? [];
  // Sent online or on paper (v_investor_applications status).
  const submitted = rows.filter((a) => isSubmitted(a.status));
  const universities = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of rows) {
      const key = a.university ?? t('investor.common.universityNotSet');
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, t]);

  const stuck = stuckApplications(rows);
  const visible = filter === 'stuck' ? stuck : rows;

  // Counted across the submitted set only, because that is what the subtitle
  // sentence claims ("n applications submitted to m universities").
  const uniqueUniversities = useMemo(
    () =>
      new Set(
        submitted.map((a) => a.university).filter((u): u is string => !!u),
      ).size,
    [submitted],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <InvestorScreenHeader
        title={t('investor.nav.applications')}
        subtitle={
          rows.length === 0
            ? t('investor.applications.noneOpened')
            : t('investor.applications.subtitle', {
                apps: t('investor.applications.appsSubmitted', {
                  count: submitted.length,
                  n: count(submitted.length),
                }),
                unis: t('investor.applications.koreanUnis', {
                  count: uniqueUniversities,
                  n: count(uniqueUniversities),
                }),
              })
        }
        actions={
          <Button
            variant="outline"
            className="h-11 min-h-[44px] gap-2"
            onClick={() => exporter.run('applications-xlsx')}
            disabled={exporter.isBusy}
          >
            {exporter.isPending('applications-xlsx') ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('investor.applications.exportList')}
          </Button>
        }
      />

      {/* ------------------------------------------------------- funnel row */}
      {(funnel.data ?? []).length > 0 && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        {(funnel.data ?? []).map((stage) => (
          <InvestorCard key={stage.stage} className="flex flex-col overflow-hidden p-0">
            <div className="p-4 pb-3">
              <div className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
                {count(Number(stage.student_count))}
              </div>
              <div className="mt-1.5 text-[12px] font-semibold text-muted-foreground">
                {stageLabel(t, stage.stage_order, stage.stage)}
              </div>
              {UNTRACKED_STAGES.has(stage.stage) && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t('investor.applications.notRecordedYet')}
                </div>
              )}
            </div>
            <div className="mt-auto">
              <ToneRule tone={FUNNEL_TONES[stage.stage_order] ?? 'slate'} />
            </div>
          </InvestorCard>
        ))}
      </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* -------------------------------------------------- recent movement */}
        <InvestorCard className="overflow-hidden">
          <CardHead
            title={t('investor.applications.recentMovement')}
            subtitle={t('investor.applications.recentMovementSubtitle')}
            action={
              <div className="inline-flex rounded-md bg-muted p-1">
                {(['all', 'stuck'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`h-11 min-h-[44px] min-w-0 rounded-sm px-4 text-[12px] font-semibold capitalize transition-colors ${
                      filter === key
                        ? 'bg-card text-foreground shadow-card'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {t(`investor.applications.filter.${key}`)}
                  </button>
                ))}
              </div>
            }
          />

          {visible.length === 0 ? (
            <EmptyNote>
              {filter === 'stuck'
                ? t('investor.applications.nothingStalled')
                : t('investor.applications.noneOpened')}
            </EmptyNote>
          ) : (
            <div className="mt-4 px-5">
              <div className="grid grid-cols-[1.3fr_1.4fr_118px] gap-3 border-b border-border pb-2">
                <TableHeadCell>{t('investor.applications.student')}</TableHeadCell>
                <TableHeadCell>{t('investor.applications.universityLevel')}</TableHeadCell>
                <TableHeadCell className="text-right">{t('investor.applications.stage')}</TableHeadCell>
              </div>
              {visible.map((a) => (
                <ApplicationRow key={a.application_id} row={a} />
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-border bg-soft-surface px-5 py-3">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">
              {t('investor.applications.docsNote')}
            </p>
          </div>
        </InvestorCard>

        <div className="space-y-4">
          <InvestorCard>
            <CardHead
              title={t('investor.applications.whereApplied')}
              subtitle={t('investor.applications.byUniversity')}
            />
            {universities.length === 0 ? (
              <EmptyNote>{t('investor.applications.noAppsYet')}</EmptyNote>
            ) : (
              <div className="mt-4 space-y-3 px-5 pb-5">
                {universities.slice(0, 7).map(([name, n], i) => (
                  <div key={name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-semibold text-foreground">
                        {name}
                      </span>
                      <Money className="shrink-0 text-muted-foreground">
                        {count(n)} · {percent((n * 100) / rows.length, 0)}
                      </Money>
                    </div>
                    <ProgressBar
                      className="mt-1.5 h-1.5"
                      pct={(n / (universities[0]?.[1] ?? 1)) * 100}
                      tone={i === 0 ? 'lime' : 'royal'}
                    />
                  </div>
                ))}
                {universities.length > 7 && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-soft-line pt-3">
                    <span className="text-[13px] text-muted-foreground">
                      {t('investor.applications.otherUnis', {
                        count: universities.length - 7,
                        n: count(universities.length - 7),
                      })}
                    </span>
                    <Money className="text-muted-foreground">
                      {count(universities.slice(7).reduce((s, [, n]) => s + n, 0))}
                    </Money>
                  </div>
                )}
                <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t('investor.applications.acceptanceNote')}
                </p>
              </div>
            )}
          </InvestorCard>

          <InvestorCard>
            <CardHead title={t('investor.applications.seasonHealth')} />
            <div className="mt-3">
              <MetricRow
                label={t('investor.applications.submitted')}
                hint={t('investor.applications.ofAllOpened')}
                value={
                  rows.length > 0 ? (
                    <Money className="text-[15px] font-bold">
                      {percent((submitted.length * 100) / rows.length, 0)}
                    </Money>
                  ) : (
                    <NotTracked />
                  )
                }
              />
              <MetricRow
                label={t('investor.applications.acceptanceRate')}
                hint={t('investor.applications.needsOffer')}
                value={
                  acceptanceRate(rows) == null ? (
                    <NotTracked />
                  ) : (
                    <Money className="text-[15px] font-bold">{percent(acceptanceRate(rows)!, 0)}</Money>
                  )
                }
              />
              <MetricRow
                label={t('investor.applications.visaRate')}
                hint={t('investor.applications.needsVisa')}
                value={
                  visaRate(rows) == null ? (
                    <NotTracked />
                  ) : (
                    <Money className="text-[15px] font-bold">{percent(visaRate(rows)!, 0)}</Money>
                  )
                }
              />
              <MetricRow
                label={t('investor.applications.noMovement')}
                hint={t('investor.applications.nothingTouched', { days: STUCK_DAYS })}
                value={
                  <Money
                    className={`text-[15px] font-bold ${stuck.length > 0 ? 'text-destructive' : ''}`}
                  >
                    {count(stuck.length)}
                  </Money>
                }
              />
            </div>
          </InvestorCard>
        </div>
      </div>
    </div>
  );
}

function ApplicationRow({ row }: { row: InvestorApplicationRow }) {
  const { t, i18n } = useTranslation();
  const days = row.days_since_movement ?? 0;
  const isStuck = days >= STUCK_DAYS && !FINAL_STATUSES.has(row.status);

  return (
    <div className="grid grid-cols-[1.3fr_1.4fr_118px] items-center gap-3 border-b border-soft-line py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={row.student_name ?? '—'} size={30} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">
            {row.student_name ?? t('investor.applications.nameNotSet')}
          </div>
          <div
            className={`truncate text-[11px] ${isStuck ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
          >
            {isStuck
              ? t('investor.applications.noMovementDays', { days })
              : [planLabel(t, row.plan), relativeTime(row.updated_at, i18n.language)]
                  .filter(Boolean)
                  .join(' · ')}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] text-foreground">
          {row.university ?? t('investor.common.universityNotSet')}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {row.program ? degreeLabel(t, row.program) : t('investor.applications.levelNotSet')}
        </div>
      </div>
      <div className="flex justify-end">
        <StatusPill tone={isStuck ? 'danger' : (STATUS_TONE[row.status] ?? 'neutral')}>
          {isStuck ? t('investor.applications.filter.stuck') : applicationStatusLabel(t, row.status)}
        </StatusPill>
      </div>
    </div>
  );
}
