import { useMemo, useState } from 'react';
import { Download, Loader2, Lock } from 'lucide-react';
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
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';
import {
  useInvestorApplications,
  useInvestorFunnel,
  type InvestorApplicationRow,
} from '@/hooks/useInvestor';
import { useInvestorExport } from '@/hooks/useInvestorExport';
import { count, humanizeLineItem, percent, relativeTime } from '@/lib/investorFormat';

/* ---------------------------------------------------------------------------
 * SCREENS.md 3 - Applications.
 *
 * Student PII stops at name and plan. The view she reads exposes nothing else -
 * no passport number, no document, no contact detail - and the card footer says
 * so out loud rather than leaving her to wonder what is being withheld.
 *
 * The funnel keeps all six stages from the design. Documents Ready, Offer
 * Received and Visa Approved have no column behind them in `applications` yet,
 * so they read zero and the caption explains why. Showing the full shape means
 * the pipeline she sees today is the same pipeline she will see once the team
 * starts recording those stages.
 * ------------------------------------------------------------------------ */

const FUNNEL_TONES: ChartTone[] = ['royal', 'blue', 'blue', 'lime', 'lime', 'success'];
const UNTRACKED_STAGES = new Set(['Documents Ready', 'Offer Received', 'Visa Approved']);

const STATUS_TONE: Record<string, PillTone> = {
  completed: 'success',
  application_submitted: 'info',
  pending: 'neutral',
  rejected: 'danger',
};

const STUCK_DAYS = 14;

export default function InvestorApplications() {
  const { activeIntakeId } = useInvestorSeason();
  const exporter = useInvestorExport();
  const applications = useInvestorApplications(activeIntakeId);
  const funnel = useInvestorFunnel(activeIntakeId);
  const [filter, setFilter] = useState<'all' | 'stuck'>('all');

  const rows = applications.data ?? [];
  const submitted = rows.filter((a) => a.submitted_at);
  const universities = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of rows) {
      const key = a.university ?? 'University not set';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const stuck = rows.filter((a) => (a.days_since_movement ?? 0) >= STUCK_DAYS);
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
        title="Applications"
        subtitle={
          rows.length === 0
            ? 'No applications have been opened for this season yet.'
            : `${count(submitted.length)} application${submitted.length === 1 ? '' : 's'} submitted to ${count(uniqueUniversities)} Korean universit${uniqueUniversities === 1 ? 'y' : 'ies'} this season.`
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
            Export List
          </Button>
        }
      />

      {/* ------------------------------------------------------- funnel row */}
      {(funnel.data ?? []).length > 0 && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {(funnel.data ?? []).map((stage) => (
          <InvestorCard key={stage.stage} className="flex flex-col overflow-hidden p-0">
            <div className="p-4 pb-3">
              <div className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-foreground">
                {count(Number(stage.student_count))}
              </div>
              <div className="mt-1.5 text-[12px] font-semibold text-muted-foreground">
                {stage.stage}
              </div>
              {UNTRACKED_STAGES.has(stage.stage) && (
                <div className="mt-1 text-[11px] text-muted-foreground">Not recorded yet</div>
              )}
            </div>
            <div className="mt-auto">
              <ToneRule tone={FUNNEL_TONES[stage.stage_order - 1] ?? 'slate'} />
            </div>
          </InvestorCard>
        ))}
      </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* -------------------------------------------------- recent movement */}
        <InvestorCard className="overflow-hidden">
          <CardHead
            title="Recent Movement"
            subtitle="Latest status changes across the season"
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
                    {key}
                  </button>
                ))}
              </div>
            }
          />

          {visible.length === 0 ? (
            <EmptyNote>
              {filter === 'stuck'
                ? 'Nothing has stalled. Every application has moved in the last two weeks.'
                : 'No applications have been opened for this season yet.'}
            </EmptyNote>
          ) : (
            <div className="mt-4 px-5">
              <div className="grid grid-cols-[1.3fr_1.4fr_118px] gap-3 border-b border-border pb-2">
                <TableHeadCell>Student</TableHeadCell>
                <TableHeadCell>University / Level</TableHeadCell>
                <TableHeadCell className="text-right">Stage</TableHeadCell>
              </div>
              {visible.map((a) => (
                <ApplicationRow key={a.application_id} row={a} />
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-border bg-soft-surface px-5 py-3">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">
              Passports, transcripts and personal documents are not available in the investor view.
            </p>
          </div>
        </InvestorCard>

        <div className="space-y-4">
          <InvestorCard>
            <CardHead title="Where They Applied" subtitle="Applications by university" />
            {universities.length === 0 ? (
              <EmptyNote>No applications yet.</EmptyNote>
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
                      {count(universities.length - 7)} other universities
                    </span>
                    <Money className="text-muted-foreground">
                      {count(universities.slice(7).reduce((s, [, n]) => s + n, 0))}
                    </Money>
                  </div>
                )}
                <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Acceptance rates need an offer decision on each application, which the CRM does
                  not record yet.
                </p>
              </div>
            )}
          </InvestorCard>

          <InvestorCard>
            <CardHead title="Season Health" />
            <div className="mt-3">
              <MetricRow
                label="Submitted"
                hint="of all applications opened"
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
                label="Acceptance rate"
                hint="needs an offer decision per application"
                value={<NotTracked />}
              />
              <MetricRow
                label="Visa approval rate"
                hint="needs a visa stage per application"
                value={<NotTracked />}
              />
              <MetricRow
                label="Applications with no movement"
                hint={`Nothing touched in ${STUCK_DAYS} days`}
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
  const days = row.days_since_movement ?? 0;
  const isStuck = days >= STUCK_DAYS;

  return (
    <div className="grid grid-cols-[1.3fr_1.4fr_118px] items-center gap-3 border-b border-soft-line py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <InitialsAvatar name={row.student_name ?? '—'} size={30} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">
            {row.student_name ?? 'Name not set'}
          </div>
          <div
            className={`truncate text-[11px] ${isStuck ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
          >
            {isStuck
              ? `No movement · ${days}d`
              : [row.plan ? humanizeLineItem(row.plan) : null, relativeTime(row.updated_at)]
                  .filter(Boolean)
                  .join(' · ')}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] text-foreground">
          {row.university ?? 'University not set'}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {row.program ? humanizeLineItem(row.program) : 'Level not set'}
        </div>
      </div>
      <div className="flex justify-end">
        <StatusPill tone={isStuck ? 'danger' : (STATUS_TONE[row.status] ?? 'neutral')}>
          {isStuck ? 'Stuck' : humanizeLineItem(row.status)}
        </StatusPill>
      </div>
    </div>
  );
}
