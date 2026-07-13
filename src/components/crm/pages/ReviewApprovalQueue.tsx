import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  ThumbsUp,
  Flag,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useReviewQueue,
  useReviewActions,
  REVIEW_REJECTION_REASONS,
  type ReviewQueueRow,
  type RejectionReason,
} from '@/hooks/useReviewQueue';
import { ReviewParsedOutput } from './ReviewParsedOutput';
import { itemConfidence } from './reviewLogic';
import { canonicalSection, presentSections } from './reviewFriendly';
import {
  ConfidenceLight,
  ReliabilityChecklist,
  SummaryBlock,
  CompletenessStrip,
} from './ReviewFriendly';
import {
  parseReliability,
  rollupColor,
  reliabilityBadgeVariant,
  type ReliabilityColor,
} from './reliability';

/**
 * The human-approval queue for auto-crawled university guidelines. Every crawled
 * guideline is queued `open` and NOTHING publishes until a staff member approves
 * it here. Each item shows the extractor's plain-language summary (when the
 * payload carries one), the extracted data (ReviewParsedOutput), the reliability
 * gauntlet's verdict as a plain pass/fail list, the source PDF, and
 * Approve / Reject / Flag actions (wired to fn_review_accept / fn_review_reject /
 * fn_flag_source_wrong). All static text goes through the app i18n (uz/en).
 */

function sectionLabel(t: TFunction, fieldGroup: string | null): string {
  const canonical = canonicalSection(fieldGroup);
  if (canonical) return t(`uniReview.section.${canonical}`);
  return fieldGroup ?? t('uniReview.section.unknown');
}

interface GuidelineGroup {
  key: string;
  nameKo: string | null;
  nameEn: string | null;
  sourceUrl: string | null;
  storagePath: string | null;
  guidelineDocId: string | null;
  rows: ReviewQueueRow[];
}

const COLOR_RANK: Record<ReliabilityColor, number> = { red: 0, amber: 1, green: 2 };

function groupColorRank(g: GuidelineGroup): number {
  const c = rollupColor(
    g.rows.map((r) => parseReliability(r.reviewer_notes, r.needs_attention).color),
  );
  return c ? COLOR_RANK[c] : 3; // unscored last
}

function groupRows(rows: ReviewQueueRow[]): GuidelineGroup[] {
  const map = new Map<string, GuidelineGroup>();
  for (const row of rows) {
    const key = row.guideline_document_id ?? row.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        nameKo: row.name_ko,
        nameEn: row.name_en,
        sourceUrl: row.source_url_ko,
        storagePath: row.storage_path,
        guidelineDocId: row.guideline_document_id,
        rows: [],
      };
      map.set(key, g);
    }
    g.rows.push(row);
  }
  // Red first, then amber, then green/unscored — so the guidelines a reviewer
  // is told to triage first sort to the top. Array.sort is stable, so within a
  // colour the view's own order (priority asc, then created_at) is preserved.
  return [...map.values()].sort((a, b) => groupColorRank(a) - groupColorRank(b));
}

function institutionName(g: GuidelineGroup): string {
  return g.nameEn || g.nameKo || '—';
}

async function openPdf(
  t: TFunction,
  guidelineDocId: string | null,
  storagePath: string | null,
) {
  const body = guidelineDocId
    ? { document_id: guidelineDocId, reason: 'review' }
    : storagePath
      ? { storage_path: storagePath, reason: 'review' }
      : null;
  if (!body) {
    toast.error(t('uniReview.noPdf'));
    return;
  }
  const { data, error } = await supabase.functions.invoke('get-pdf-url', { body });
  const signed = (data as { signed_url?: string } | null)?.signed_url;
  if (error || !signed) {
    toast.error(error?.message || t('uniReview.pdfError'));
    return;
  }
  window.open(signed, '_blank', 'noopener,noreferrer');
}

function ReliabilityBadge({ color }: { color: ReliabilityColor | null }) {
  const { t } = useTranslation();
  if (!color) return null;
  return (
    <Badge variant={reliabilityBadgeVariant(color)}>
      {t(`uniReview.reliability.badge.${color}`)}
    </Badge>
  );
}

function SectionCard({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const { accept, reject, flagSourceWrong } = useReviewActions();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>('hallucinated_field');
  const [rejectDetail, setRejectDetail] = useState('');

  const rel = parseReliability(row.reviewer_notes, row.needs_attention);
  const label = sectionLabel(t, row.field_group);
  const acting =
    (accept.isPending && accept.variables?.queueItemId === row.id) ||
    (reject.isPending && reject.variables?.queueItemId === row.id) ||
    (flagSourceWrong.isPending && flagSourceWrong.variables?.queueItemId === row.id);

  const onApprove = () =>
    accept.mutate(
      { queueItemId: row.id },
      {
        onSuccess: () => toast.success(t('uniReview.approveDone', { section: label })),
        onError: (e) => toast.error(e.message),
      },
    );

  const onReject = () =>
    reject.mutate(
      {
        queueItemId: row.id,
        reason: rejectReason,
        reasonDetail: rejectDetail.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('uniReview.rejectDone', { section: label }));
          setRejecting(false);
          setRejectDetail('');
        },
        onError: (e) => toast.error(e.message),
      },
    );

  const onFlagSource = () =>
    flagSourceWrong.mutate(
      { queueItemId: row.id },
      {
        onSuccess: (n) => toast.success(t('uniReview.flagSourceDone', { n })),
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <ReliabilityBadge color={rel.color} />
        <ConfidenceLight score={itemConfidence(row)} />
      </div>

      <ReliabilityChecklist detail={rel.detail} />

      <SummaryBlock parsedOutput={row.parsed_output} />

      <ReviewParsedOutput fieldGroup={row.field_group} parsedOutput={row.parsed_output} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {acting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <Button size="sm" onClick={onApprove} disabled={acting}>
          <ThumbsUp className="h-3.5 w-3.5" /> {t('uniReview.approve')}
        </Button>
        {rejecting ? (
          <>
            <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as RejectionReason)}>
              <SelectTrigger className="h-8 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`uniReview.rejectReason.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={rejectDetail}
              onChange={(e) => setRejectDetail(e.target.value)}
              placeholder={t('uniReview.rejectDetailPlaceholder')}
              className="h-8 w-[200px]"
            />
            <Button size="sm" variant="destructive" onClick={onReject} disabled={acting}>
              {t('uniReview.confirmReject')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={acting}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={acting}>
            {t('uniReview.reject')}
          </Button>
        )}
      </div>

      {rejecting ? (
        <button
          type="button"
          onClick={onFlagSource}
          disabled={acting}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
        >
          <Flag className="h-3 w-3" /> {t('uniReview.flagSource')}
        </button>
      ) : null}
    </div>
  );
}

function GuidelineCard({ group }: { group: GuidelineGroup }) {
  const { t } = useTranslation();
  const color = rollupColor(
    group.rows.map((r) => parseReliability(r.reviewer_notes, r.needs_attention).color),
  );
  const present = presentSections(group.rows.map((r) => r.field_group));
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">{institutionName(group)}</span>
              <ReliabilityBadge color={color} />
              <Badge variant="secondary">
                {t('uniReview.sectionCount', { n: group.rows.length })}
              </Badge>
            </div>
            {group.nameKo && group.nameEn ? (
              <div className="text-xs text-muted-foreground" lang="ko">{group.nameKo}</div>
            ) : null}
            <CompletenessStrip present={present} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {group.sourceUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={group.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> {t('uniReview.sourcePage')}
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPdf(t, group.guidelineDocId, group.storagePath)}
              disabled={!group.guidelineDocId && !group.storagePath}
            >
              <FileText className="h-3.5 w-3.5" /> {t('uniReview.viewPdf')}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {group.rows.map((row) => (
            <SectionCard key={row.id} row={row} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewApprovalQueue() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading, error, refetch, isRefetching } = useReviewQueue();
  const groups = useMemo(() => groupRows(rows), [rows]);

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
          <h2 className="text-lg font-semibold">{t('uniReview.queueTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('uniReview.queueSubtitle')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <h3 className="font-medium">{t('uniReview.emptyQueueTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('uniReview.emptyQueueBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-19rem)]">
          <div className="space-y-4 pr-3">
            {groups.map((g) => (
              <GuidelineCard key={g.key} group={g} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default ReviewApprovalQueue;
