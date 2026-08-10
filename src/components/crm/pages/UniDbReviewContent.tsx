import { useMemo } from 'react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { CrawlTargetPanel } from './CrawlTargetPanel';
import { ReviewApprovalQueue } from './ReviewApprovalQueue';
import { useProposedSources } from '@/hooks/useProposedSources';
import { ProposedLinksView } from './uni-db-review/ProposedLinksView';
import { groupRows, matchesIntakeCycle } from './uni-db-review/reviewGroups';

/**
 * University-data review, redesigned per design_handoff/uni_db_review:
 * page header with a refresh action, the crawl-target bar, and a pill
 * segmented control switching between the approval queue (triage rail +
 * detail) and the "Havolalar" tab — the original guideline URLs the nightly
 * Routine could not fetch itself (Korean hosts block the crawler), handed to a
 * human to open by hand. The old read-only "E'tibor kerak" tab
 * (v_needs_attention) is gone: it listed already-published rows nobody could
 * act on from there.
 *
 * Auto-crawled guidelines are held for HUMAN APPROVAL — nothing publishes
 * until a staff member approves it in the queue (`v_review_queue_dashboard`,
 * actions via fn_review_*). Access control (useCanReviewUniDb), the query
 * keys, and the 60s refetch cadence are unchanged.
 */

export function UniDbReviewContent() {
  const { t } = useTranslation();
  const { canReview, loading } = useCanReviewUniDb();
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['uni_db'] });
  const { data: queueRows = [] } = useReviewQueue(canReview);
  const { data: linkRows = [] } = useProposedSources(canReview);
  const { activeIntake } = useActiveIntake();

  // Matches the queue tab's default view (current cycle only) so the badge
  // count doesn't imply more work is pending than what's actually shown.
  const pendingCount = useMemo(
    () => groupRows(queueRows.filter((r) => matchesIntakeCycle(r, activeIntake))).length,
    [queueRows, activeIntake],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canReview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t('uniReview.states.accessTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('uniReview.states.accessBody')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[23px] font-bold leading-tight tracking-[-0.02em]">
            {t('uniReview.title')}
          </h1>
          <p className="max-w-[600px] text-[13px] text-muted-foreground">
            {t('uniReview.subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => qc.invalidateQueries({ queryKey: ['uni_db'] })}
        >
          <RefreshCw className={cn('h-[15px] w-[15px]', fetching ? 'animate-spin' : '')} />
          {t('uniReview.refresh')}
        </Button>
      </div>

      <CrawlTargetPanel />

      <Tabs defaultValue="approval">
        <TabsList className="h-auto w-max gap-0.5 rounded-full bg-secondary p-1">
          <TabsTrigger
            value="approval"
            className="h-[34px] gap-2 rounded-full border-b-0 px-4 text-[13px] font-semibold hover:bg-transparent data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            {t('uniReview.tabs.queue')}
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {pendingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="links"
            className="h-[34px] gap-2 rounded-full border-b-0 px-4 text-[13px] font-semibold hover:bg-transparent data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            {t('uniReview.tabs.links')}
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-info/10 px-1.5 text-[11px] font-bold text-info">
              {linkRows.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="approval" className="mt-4">
          <ReviewApprovalQueue />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <ProposedLinksView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UniDbReviewContent;
