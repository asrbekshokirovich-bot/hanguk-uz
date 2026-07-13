import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { CrawlTargetPanel } from './CrawlTargetPanel';
import { ReviewApprovalQueue } from './ReviewApprovalQueue';
import { canonicalSection } from './reviewFriendly';

/**
 * University-data review. Auto-crawled guidelines are held for HUMAN APPROVAL —
 * nothing publishes until a staff member approves it in the "Awaiting approval"
 * tab (the queue is `v_review_queue_dashboard`, actions via fn_review_*).
 *
 * A second, read-only "Auto-published flags" tab surfaces any rows that were
 * auto-published (when the pipeline runs with require-approval off) but flagged
 * for low confidence, grouped by institution, for spot-checking.
 *
 * The crawl-target panel at the top shows (and lets owners/admins change) which
 * admission cycle the nightly crawl targets.
 *
 * All static text goes through the app i18n (uz/en, following the CRM's
 * language switcher).
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

function institutionName(g: UniGroup): string {
  return g.nameEn || g.nameKo || '—';
}

function NeedsAttentionView() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading, error, refetch, isRefetching } = useNeedsAttention();
  const [search, setSearch] = useState('');

  const sectionLabel = (section: string): string => {
    const canonical = canonicalSection(section);
    return canonical ? t(`uniReview.section.${canonical}`) : section;
  };

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
          {t('uniReview.loadError', { message: error.message })}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t('uniReview.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {t('uniReview.flagsTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('uniReview.flagsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('uniReview.filterPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <h3 className="font-medium">{t('uniReview.emptyFlagsTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? t('uniReview.emptyFlagsFiltered') : t('uniReview.emptyFlagsBody')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-22rem)]">
          <div className="space-y-4 pr-3">
            {groups.map((g) => (
              <Card key={g.key}>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{institutionName(g)}</div>
                      {g.nameKo && g.nameEn ? (
                        <div className="text-xs text-muted-foreground" lang="ko">{g.nameKo}</div>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {t('uniReview.flaggedCount', { n: g.rows.length })}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {g.rows.map((r) => (
                      <div
                        key={`${r.section}:${r.id}`}
                        className="flex items-start gap-3 rounded-md border border-border/60 p-2.5"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{sectionLabel(r.section)}</div>
                          {r.attention_reason ? (
                            <div className="break-words text-xs text-muted-foreground">
                              {r.attention_reason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function UniDbReviewContent() {
  const { t } = useTranslation();
  const { canReview, loading } = useCanReviewUniDb();

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
        <h2 className="text-lg font-semibold">{t('uniReview.accessRestricted')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('uniReview.accessRestrictedBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CrawlTargetPanel />
      <Tabs defaultValue="approval">
        <TabsList>
          <TabsTrigger value="approval">{t('uniReview.tabApproval')}</TabsTrigger>
          <TabsTrigger value="flags">{t('uniReview.tabFlags')}</TabsTrigger>
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
