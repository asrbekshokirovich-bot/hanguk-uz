import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { CrawlTargetPanel } from './CrawlTargetPanel';
import { ReviewApprovalQueue } from './ReviewApprovalQueue';
import { groupRows, sectionLabelKey, fmtDateKST } from './uni-db-review/reviewGroups';

/**
 * University-data review, redesigned per design_handoff/uni_db_review:
 * page header with a refresh action, the crawl-target bar, and a pill
 * segmented control switching between the approval queue (triage rail +
 * detail) and the read-only "E'tibor kerak" (auto-published flags) tab.
 *
 * Auto-crawled guidelines are held for HUMAN APPROVAL — nothing publishes
 * until a staff member approves it in the queue (`v_review_queue_dashboard`,
 * actions via fn_review_*). Access control (useCanReviewUniDb), the query
 * keys, and the 60s refetch cadence are unchanged.
 */

interface NeedsAttentionRow {
  section: string;
  id: string;
  institution_id: string;
  name_ko: string | null;
  name_en: string | null;
  attention_reason: string | null;
  created_at: string;
}

const NEEDS_ATTENTION_KEY = ['uni_db', 'needs_attention'] as const;

function useNeedsAttention() {
  return useQuery<NeedsAttentionRow[], Error>({
    queryKey: NEEDS_ATTENTION_KEY,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_needs_attention')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NeedsAttentionRow[];
    },
  });
}

interface UniGroup {
  key: string;
  nameKo: string | null;
  nameEn: string | null;
  rows: NeedsAttentionRow[];
}

function groupByInstitution(rows: NeedsAttentionRow[]): UniGroup[] {
  const map = new Map<string, UniGroup>();
  for (const row of rows) {
    const key = row.institution_id;
    let g = map.get(key);
    if (!g) {
      g = { key, nameKo: row.name_ko, nameEn: row.name_en, rows: [] };
      map.set(key, g);
    }
    g.rows.push(row);
  }
  return [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
}

function NeedsAttentionView() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading, error, refetch } = useNeedsAttention();
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            (r.name_en ?? '').toLowerCase().includes(q) ||
            (r.name_ko ?? '').toLowerCase().includes(q) ||
            r.section.toLowerCase().includes(q) ||
            (r.attention_reason ?? '').toLowerCase().includes(q),
        )
      : rows;
    return groupByInstitution(filtered);
  }, [rows, search]);

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

  return (
    <div className="flex max-w-[880px] flex-col gap-3">
      <div className="flex items-start gap-2 rounded-[10px] bg-warning/10 p-3 px-3.5">
        <AlertTriangle className="mt-0.5 h-[15px] w-[15px] shrink-0 text-warning" />
        <span className="text-[12.5px] font-medium leading-relaxed text-warning">
          {t('uniReview.flags.banner')}
        </span>
      </div>

      <Input
        placeholder={t('uniReview.flags.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <h3 className="font-medium">{t('uniReview.flags.emptyTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? t('uniReview.flags.emptyFiltered') : t('uniReview.flags.emptyBody')}
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <div
            key={g.key}
            className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4 px-[18px] shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold">{g.nameEn || g.nameKo || '—'}</span>
              {g.nameKo && g.nameEn ? (
                <span className="text-[12.5px] text-muted-foreground/80" lang="ko">
                  {g.nameKo}
                </span>
              ) : null}
              <span className="flex-1" />
              <span className="inline-flex h-[22px] items-center rounded-full bg-warning/10 px-2.5 text-[11.5px] font-semibold text-warning">
                {t('uniReview.flags.count', { n: g.rows.length })}
              </span>
            </div>
            <div className="flex flex-col">
              {g.rows.map((r) => (
                <div
                  key={`${r.section}:${r.id}`}
                  className="flex items-start gap-2.5 border-t border-border/60 px-0.5 py-[9px]"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold">
                      {t(sectionLabelKey(r.section))}
                    </span>
                    {r.attention_reason ? (
                      <span className="break-words text-[12.5px] text-muted-foreground">
                        {r.attention_reason}
                      </span>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap font-mono text-[11.5px] text-muted-foreground/80">
                    {fmtDateKST(r.created_at)?.split(' · ')[0] ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function UniDbReviewContent() {
  const { t } = useTranslation();
  const { canReview, loading } = useCanReviewUniDb();
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['uni_db'] });
  const { data: queueRows = [] } = useReviewQueue(canReview);
  const { data: flagRows = [] } = useNeedsAttention();

  const pendingCount = useMemo(() => groupRows(queueRows).length, [queueRows]);

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
            value="flags"
            className="h-[34px] gap-2 rounded-full border-b-0 px-4 text-[13px] font-semibold hover:bg-transparent data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            {t('uniReview.tabs.flags')}
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning/10 px-1.5 text-[11px] font-bold text-warning">
              {flagRows.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="approval" className="mt-4">
          <ReviewApprovalQueue />
        </TabsContent>
        <TabsContent value="flags" className="mt-4">
          <NeedsAttentionView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UniDbReviewContent;
