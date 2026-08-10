import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActiveIntake } from '@/contexts/IntakeContext';
import {
  useReviewQueue,
  useReviewActions,
  type ReviewQueueRow,
  type RejectionReason,
} from '@/hooks/useReviewQueue';
import {
  groupRows,
  sortGroups,
  mergeWithDecided,
  matchesIntakeCycle,
  openRollup,
  shortName,
  sectionLabelKey,
  type DecidedMap,
  type GuidelineGroup,
} from './uni-db-review/reviewGroups';
import { ReviewTriageRail } from './uni-db-review/ReviewTriageRail';
import { ReviewGuidelineDetail } from './uni-db-review/ReviewGuidelineDetail';
import { type SectionCardHandlers } from './uni-db-review/ReviewSectionCard';

/**
 * The human-approval queue for auto-crawled university guidelines, redesigned
 * per design_handoff/uni_db_review: a left triage rail (one card per
 * guideline, red → amber → green → done) and a right detail panel (header card
 * with progress + one section card per queue row). Every crawled guideline is
 * queued `open` and NOTHING publishes until a staff member approves it here —
 * actions stay wired to fn_review_accept / fn_review_reject /
 * fn_flag_source_wrong through useReviewActions, and the queue/query keys,
 * grouping by guideline_document_id, and 60s refetch are unchanged.
 *
 * Local UI state only (design §State Management): selected guideline, the
 * row being rejected + its reason, and the session's decided rows (kept as
 * snapshots so result strips survive the post-mutation query invalidation).
 */

export function ReviewApprovalQueue() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading, error, refetch } = useReviewQueue();
  const { accept, reject, flagSourceWrong } = useReviewActions();
  const { activeIntake } = useActiveIntake();

  const [decided, setDecided] = useState<DecidedMap>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rejectingRowId, setRejectingRowId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<RejectionReason>('hallucinated_field');
  const [showAllCycles, setShowAllCycles] = useState(false);

  const merged = useMemo(() => mergeWithDecided(rows, decided), [rows, decided]);
  // The global season/year switcher (top bar) is meant to scope the whole app —
  // by default only show queue rows whose classified cycle matches it, so a
  // 2027 selection doesn't drown in backlog from 2026 and earlier cycles.
  const cycleFiltered = useMemo(
    () => (showAllCycles ? merged : merged.filter((r) => matchesIntakeCycle(r, activeIntake))),
    [merged, showAllCycles, activeIntake],
  );
  const hiddenByCycleCount = merged.length - cycleFiltered.length;

  const sorted = useMemo(
    () => sortGroups(groupRows(cycleFiltered), decided),
    [cycleFiltered, decided],
  );

  // Pin the default selection (first after sort) once data arrives — a
  // per-render fallback would make the focused university jump when a
  // decision re-sorts the rail.
  useEffect(() => {
    if (!selectedKey && sorted.length > 0) setSelectedKey(sorted[0].key);
  }, [selectedKey, sorted]);

  const selected: GuidelineGroup | null = useMemo(() => {
    if (sorted.length === 0) return null;
    return sorted.find((g) => g.key === selectedKey) ?? sorted[0];
  }, [sorted, selectedKey]);

  const nextPending = useMemo(
    () =>
      selected
        ? sorted.find((g) => g.key !== selected.key && !openRollup(g, decided).done) ?? null
        : null,
    [sorted, selected, decided],
  );

  const groupOf = (row: ReviewQueueRow): GuidelineGroup | undefined =>
    sorted.find((g) => g.rows.some((r) => r.id === row.id));

  const markDecided = (
    row: ReviewQueueRow,
    status: 'approved' | 'rejected',
    reasonLabel?: string,
  ) =>
    setDecided((d) => ({ ...d, [row.id]: { status, reasonLabel, row } }));

  const handlers: SectionCardHandlers = {
    onApprove: (row) =>
      accept.mutate(
        { queueItemId: row.id },
        {
          onSuccess: () => {
            markDecided(row, 'approved');
            const g = groupOf(row);
            toast.success(
              t('uniReview.toast.approved', {
                uni: g ? shortName(g) : '—',
                section: t(sectionLabelKey(row.field_group)),
              }),
            );
          },
          onError: (e) => toast.error(e.message),
        },
      ),
    onConfirmReject: (row, reason) =>
      reject.mutate(
        { queueItemId: row.id, reason },
        {
          onSuccess: () => {
            markDecided(row, 'rejected', t(`uniReview.reasons.${reason}`));
            setRejectingRowId(null);
            const g = groupOf(row);
            toast.success(
              t('uniReview.toast.rejected', {
                uni: g ? shortName(g) : '—',
                section: t(sectionLabelKey(row.field_group)),
              }),
            );
          },
          onError: (e) => toast.error(e.message),
        },
      ),
    onFlagSource: (row) =>
      flagSourceWrong.mutate(
        { queueItemId: row.id },
        {
          onSuccess: (n) => {
            // The RPC rejects every open item sharing the source PDF — mirror
            // that locally so all of the guideline's cards collapse at once.
            const g = groupOf(row);
            const reasonLabel = t('uniReview.decided.sourceWrong');
            setDecided((d) => {
              const next = { ...d };
              for (const r of g?.rows ?? [row]) {
                if (!next[r.id]) next[r.id] = { status: 'rejected', reasonLabel, row: r };
              }
              return next;
            });
            setRejectingRowId(null);
            toast.success(t('uniReview.toast.flagged', { n }));
          },
          onError: (e) => toast.error(e.message),
        },
      ),
  };

  const actingRowId =
    (accept.isPending && accept.variables?.queueItemId) ||
    (reject.isPending && reject.variables?.queueItemId) ||
    (flagSourceWrong.isPending && flagSourceWrong.variables?.queueItemId) ||
    null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {t('uniReview.states.error', { message: error.message })}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t('uniReview.states.retry')}
        </Button>
      </div>
    );
  }

  const cycleToggle = (count: number) => (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" />
        {showAllCycles
          ? t('uniReview.cycleFilter.showingAll')
          : t('uniReview.cycleFilter.hiddenCount', { n: count })}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[12.5px]"
        onClick={() => setShowAllCycles((v) => !v)}
      >
        {showAllCycles ? t('uniReview.cycleFilter.currentOnly') : t('uniReview.cycleFilter.showAll')}
      </Button>
    </div>
  );

  if (sorted.length === 0) {
    if (hiddenByCycleCount > 0 && !showAllCycles) {
      return (
        <div>
          {cycleToggle(hiddenByCycleCount)}
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
              <h3 className="font-medium">{t('uniReview.cycleFilter.emptyCurrentCycleTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('uniReview.cycleFilter.emptyOtherCycles', { n: hiddenByCycleCount })}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
          <h3 className="font-medium">{t('uniReview.states.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('uniReview.states.emptyBody')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {hiddenByCycleCount > 0 || showAllCycles ? cycleToggle(hiddenByCycleCount) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[318px_minmax(0,1fr)]">
        <ReviewTriageRail
          groups={sorted}
          decided={decided}
          selectedKey={selected?.key ?? null}
          onSelect={(key) => {
            setSelectedKey(key);
            setRejectingRowId(null);
          }}
        />
        {selected ? (
          <ReviewGuidelineDetail
            group={selected}
            decided={decided}
            rejectingRowId={rejectingRowId}
            rejectReason={rejectReason}
            onReasonChange={setRejectReason}
            onStartReject={(row) => setRejectingRowId(row.id)}
            onCancelReject={() => setRejectingRowId(null)}
            handlers={handlers}
            actingRowId={actingRowId || null}
            hasNext={!!nextPending}
            onNext={() => {
              if (nextPending) {
                setSelectedKey(nextPending.key);
                setRejectingRowId(null);
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default ReviewApprovalQueue;
