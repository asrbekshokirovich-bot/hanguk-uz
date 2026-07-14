import { useMemo, useState } from 'react';
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
import { itemConfidence, confidencePct } from './reviewLogic';
import { useActiveIntake } from '@/contexts/IntakeContext';
import {
  parseReliability,
  rollupColor,
  reliabilityBadgeVariant,
  RELIABILITY_LABEL,
  type ReliabilityColor,
} from './reliability';

/**
 * The human-approval queue for auto-crawled university guidelines. Every crawled
 * guideline is queued `open` and NOTHING publishes until a staff member approves
 * it here. Each item shows the extracted data (ReviewParsedOutput), the
 * reliability gauntlet's verdict, the source PDF, and Approve / Reject / Flag
 * actions (wired to fn_review_accept / fn_review_reject / fn_flag_source_wrong).
 */

const SECTION_LABEL: Record<string, string> = {
  requirements: 'Admission tracks & eligibility (전형)',
  documents_required: 'Required documents',
  tuition: 'Tuition',
  scholarships: 'Scholarships',
  calendar: 'Timeline & deadlines',
  degree_split: 'Undergraduate + graduate split',
};

const REJECT_LABEL: Record<RejectionReason, string> = {
  wrong_year: 'Wrong year / cycle',
  wrong_archetype: 'Wrong document type',
  hallucinated_field: 'Hallucinated / wrong data',
  ocr_garbled: 'OCR garbled',
  source_404: 'Source unavailable',
  other: 'Other',
};

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
  return g.nameEn || g.nameKo || 'Unknown institution';
}

async function openPdf(guidelineDocId: string | null, storagePath: string | null) {
  const body = guidelineDocId
    ? { document_id: guidelineDocId, reason: 'review' }
    : storagePath
      ? { storage_path: storagePath, reason: 'review' }
      : null;
  if (!body) {
    toast.error('No stored PDF for this guideline yet.');
    return;
  }
  const { data, error } = await supabase.functions.invoke('get-pdf-url', { body });
  const signed = (data as { signed_url?: string } | null)?.signed_url;
  if (error || !signed) {
    toast.error(error?.message || 'Could not open the PDF.');
    return;
  }
  window.open(signed, '_blank', 'noopener,noreferrer');
}

function ReliabilityBadge({ color }: { color: ReliabilityColor | null }) {
  if (!color) return null;
  return <Badge variant={reliabilityBadgeVariant(color)}>{RELIABILITY_LABEL[color]}</Badge>;
}

/**
 * The source document's classified admission cycle (migration 20260714000000 +
 * backfill_document_cycle.py). Warning-tinted when the document describes an
 * OLDER cycle than the crawl target — the reviewer is looking at stale data.
 */
function CycleBadge({ row }: { row: ReviewQueueRow }) {
  const { intakes } = useActiveIntake();
  const year = row.doc_academic_year;
  if (year == null) return null;
  const term =
    row.doc_semester === 'spring' ? 'Spring' : row.doc_semester === 'fall' ? 'Fall' : null;
  const target = intakes.find((i) => i.is_default) ?? null;
  const stale =
    target != null &&
    (year < target.year ||
      (year === target.year && target.season === 'spring' && row.doc_semester === 'fall'));
  return (
    <Badge
      variant={stale ? 'warning' : 'info'}
      title={
        stale
          ? `Document describes the ${year} cycle — older than the crawl target`
          : 'Admission cycle this document describes'
      }
    >
      {year}학년도{term ? ` · ${term}` : ''}
      {stale ? ' — stale' : ''}
    </Badge>
  );
}

function SectionCard({ row }: { row: ReviewQueueRow }) {
  const { accept, reject, flagSourceWrong } = useReviewActions();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>('hallucinated_field');

  const rel = parseReliability(row.reviewer_notes, row.needs_attention);
  const conf = confidencePct(itemConfidence(row));
  const label = SECTION_LABEL[row.field_group ?? ''] ?? row.field_group ?? 'Section';
  const acting =
    (accept.isPending && accept.variables?.queueItemId === row.id) ||
    (reject.isPending && reject.variables?.queueItemId === row.id) ||
    (flagSourceWrong.isPending && flagSourceWrong.variables?.queueItemId === row.id);

  const onApprove = () =>
    accept.mutate(
      { queueItemId: row.id },
      {
        onSuccess: () => toast.success(`Approved — ${label}`),
        onError: (e) => toast.error(e.message),
      },
    );

  const onReject = () =>
    reject.mutate(
      { queueItemId: row.id, reason: rejectReason },
      {
        onSuccess: () => {
          toast.success(`Rejected — ${label}`);
          setRejecting(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );

  const onFlagSource = () =>
    flagSourceWrong.mutate(
      { queueItemId: row.id },
      {
        onSuccess: (n) => toast.success(`Flagged source — rejected ${n} item(s) from this PDF`),
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <ReliabilityBadge color={rel.color} />
        <CycleBadge row={row} />
        {conf ? <Badge variant="neutral">confidence {conf}</Badge> : null}
      </div>

      {rel.detail ? (
        <details className="mb-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Reliability checks</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">
            {rel.detail}
          </pre>
        </details>
      ) : null}

      <ReviewParsedOutput fieldGroup={row.field_group} parsedOutput={row.parsed_output} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {acting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <Button size="sm" onClick={onApprove} disabled={acting}>
          <ThumbsUp className="h-3.5 w-3.5" /> Approve &amp; publish
        </Button>
        {rejecting ? (
          <>
            <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as RejectionReason)}>
              <SelectTrigger className="h-8 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REJECT_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="destructive" onClick={onReject} disabled={acting}>
              Confirm reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={acting}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={acting}>
            Reject
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
          <Flag className="h-3 w-3" /> Wrong source — reject every section from this PDF
        </button>
      ) : null}
    </div>
  );
}

function GuidelineCard({ group }: { group: GuidelineGroup }) {
  const color = rollupColor(
    group.rows.map((r) => parseReliability(r.reviewer_notes, r.needs_attention).color),
  );
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{institutionName(group)}</span>
              <ReliabilityBadge color={color} />
              <Badge variant="secondary">{group.rows.length} section(s)</Badge>
            </div>
            {group.nameKo && group.nameEn ? (
              <div className="text-xs text-muted-foreground">{group.nameKo}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {group.sourceUrl ? (
              <a
                href={group.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Source page
              </a>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => openPdf(group.guidelineDocId, group.storagePath)}
              disabled={!group.guidelineDocId && !group.storagePath}
            >
              <FileText className="h-3.5 w-3.5" /> View PDF
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
          Could not load the approval queue: {error.message}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Guidelines awaiting approval</h2>
          <p className="text-sm text-muted-foreground">
            Auto-crawled guidelines are held here until you approve them. Nothing reaches applicants
            until you click Approve. Red = the reliability checks flagged something; open the PDF to
            verify.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <h3 className="font-medium">Nothing awaiting approval</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The crawl hasn&rsquo;t queued any new guidelines, or everything has been reviewed.
            </p>
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
