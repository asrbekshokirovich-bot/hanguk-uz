import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCanReviewUniDb } from '@/hooks/useCanReviewUniDb';
import {
  useReviewQueue,
  useReviewActions,
  ReviewQueueRow,
  REVIEW_REJECTION_REASONS,
  RejectionReason,
} from '@/hooks/useReviewQueue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldAlert,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Check,
  Pencil,
  X,
  FileText,
  FileWarning,
} from 'lucide-react';

const PRIORITY_BADGE_VARIANT: Record<number, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  1: 'destructive',
  2: 'default',
  3: 'secondary',
  4: 'outline',
  5: 'outline',
};

const REJECTION_REASON_LABEL: Record<RejectionReason, string> = {
  wrong_year: 'wrong_year — PDF is for a different academic year',
  wrong_archetype: 'wrong_archetype — applicant category misclassified',
  hallucinated_field: 'hallucinated_field — field not present in source',
  ocr_garbled: 'ocr_garbled — OCR output unusable',
  source_404: 'source_404 — original document no longer reachable',
  other: 'other — see notes',
};

function institutionName(row: ReviewQueueRow): string {
  return row.name_ko ?? row.name_en ?? 'Unknown institution';
}

function confidenceLabel(score: number | null): string | null {
  if (score === null || score === undefined) return null;
  return `${Math.round(score * 100)}%`;
}

function QueueListItem({
  row,
  selected,
  onSelect,
}: {
  row: ReviewQueueRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const conf = confidenceLabel(row.accuracy_self_score);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <Badge variant={PRIORITY_BADGE_VARIANT[row.priority] ?? 'outline'}>P{row.priority}</Badge>
        <Badge variant="outline" className="font-normal">{row.reason}</Badge>
        {conf ? <Badge variant="outline" className="font-normal">conf {conf}</Badge> : null}
      </div>
      <div className="font-medium text-sm truncate">{institutionName(row)}</div>
      {row.name_ko && row.name_en ? (
        <div className="text-xs text-muted-foreground truncate">{row.name_en}</div>
      ) : null}
    </button>
  );
}

function DetailPane({
  row,
  sameSourceCount,
  onResolved,
}: {
  row: ReviewQueueRow;
  sameSourceCount: number;
  onResolved: () => void;
}) {
  const { accept, editAccept, reject, flagSourceWrong } = useReviewActions();

  const initialJson = useMemo(
    () => JSON.stringify(row.parsed_output ?? {}, null, 2),
    [row.parsed_output],
  );
  const [jsonText, setJsonText] = useState(initialJson);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>('wrong_year');
  const [rejectDetail, setRejectDetail] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [confirmSourceWrong, setConfirmSourceWrong] = useState(false);
  const [sourceWrongDetail, setSourceWrongDetail] = useState('');

  // Reset local editing state whenever a different item is selected.
  useEffect(() => {
    setJsonText(initialJson);
    setParseError(null);
    setRejecting(false);
    setRejectReason('wrong_year');
    setRejectDetail('');
    setConfirmSourceWrong(false);
    setSourceWrongDetail('');
  }, [row.id, initialJson]);

  const pending =
    accept.isPending || editAccept.isPending || reject.isPending || flagSourceWrong.isPending;
  const conf = confidenceLabel(row.accuracy_self_score);

  const handleOpenPdf = async () => {
    if (!row.guideline_document_id) return;
    setPdfLoading(true);
    try {
      // Signed URLs expire in ~15 min, so always fetch a fresh one per click.
      const { data, error } = await supabase.functions.invoke('get-pdf-url', {
        body: { document_id: row.guideline_document_id },
      });
      const signedUrl = (data as { signed_url?: string } | null)?.signed_url;
      if (error || !signedUrl) {
        throw error ?? new Error('No signed URL returned');
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      if (row.source_url_ko) {
        window.open(row.source_url_ko, '_blank', 'noopener,noreferrer');
        toast.message('Cached PDF unavailable', {
          description: 'Opened the live source page instead.',
        });
      } else {
        toast.error('Could not open source PDF', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handleFlagSourceWrong = () => {
    flagSourceWrong.mutate(
      { queueItemId: row.id, detail: sourceWrongDetail || undefined },
      {
        onSuccess: (count) => {
          toast.success('Source flagged', { description: `${count} item(s) rejected` });
          setConfirmSourceWrong(false);
          onResolved();
        },
        onError: (err) => toast.error('Flag source failed', { description: err.message }),
      },
    );
  };

  const handleAccept = () => {
    accept.mutate(
      { queueItemId: row.id },
      {
        onSuccess: () => {
          toast.success('Accepted', { description: institutionName(row) });
          onResolved();
        },
        onError: (err) => toast.error('Accept failed', { description: err.message }),
      },
    );
  };

  const handleEditAccept = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText || '{}');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
      setParseError('Corrected payload must be a non-empty JSON object');
      return;
    }
    setParseError(null);
    editAccept.mutate(
      { queueItemId: row.id, correctedPayload: parsed },
      {
        onSuccess: () => {
          toast.success('Accepted with edits', { description: institutionName(row) });
          onResolved();
        },
        onError: (err) => toast.error('Edit + accept failed', { description: err.message }),
      },
    );
  };

  const handleReject = () => {
    reject.mutate(
      { queueItemId: row.id, reason: rejectReason, reasonDetail: rejectDetail || undefined },
      {
        onSuccess: () => {
          toast.success('Rejected', { description: `Reason: ${rejectReason}` });
          onResolved();
        },
        onError: (err) => toast.error('Reject failed', { description: err.message }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{institutionName(row)}</h2>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <Badge variant={PRIORITY_BADGE_VARIANT[row.priority] ?? 'outline'}>P{row.priority}</Badge>
          <Badge variant="outline" className="font-normal">{row.reason}</Badge>
          {conf ? (
            <Badge variant="outline" className="font-normal">self-confidence {conf}</Badge>
          ) : (
            <Badge variant="outline" className="font-normal">self-confidence n/a</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {row.source_url_ko ? (
            <a
              href={row.source_url_ko}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View source page
            </a>
          ) : null}
          {row.guideline_document_id ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPdf}
              disabled={pdfLoading || pending}
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1.5" />
              )}
              Open source PDF
            </Button>
          ) : null}
          {!row.source_url_ko && !row.guideline_document_id ? (
            <p className="text-sm text-muted-foreground">No source on file.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="parsed-output">Extracted data (editable JSON)</Label>
        <Textarea
          id="parsed-output"
          className="font-mono text-xs"
          rows={16}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          disabled={pending}
        />
        {parseError ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {parseError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Verify the AI's extraction. Use "Accept as-is" if correct, or edit the JSON and "Save edits + accept".
          </p>
        )}
      </div>

      {rejecting ? (
        <div className="space-y-3 rounded-lg border border-destructive/40 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Rejection reason</Label>
            <Select
              value={rejectReason}
              onValueChange={(v) => setRejectReason(v as RejectionReason)}
            >
              <SelectTrigger id="reject-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REJECTION_REASON_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reject-detail">Detail (optional)</Label>
            <Textarea
              id="reject-detail"
              rows={3}
              value={rejectDetail}
              onChange={(e) => setRejectDetail(e.target.value)}
              placeholder="What specifically went wrong"
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleReject} disabled={pending}>
              {reject.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Confirm reject
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={handleAccept} disabled={pending}>
            {accept.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            Accept as-is
          </Button>
          <Button size="sm" variant="secondary" onClick={handleEditAccept} disabled={pending}>
            {editAccept.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4 mr-1.5" />
            )}
            Save edits + accept
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRejecting(true)}
            disabled={pending}
          >
            <X className="h-4 w-4 mr-1.5" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setConfirmSourceWrong(true)}
            disabled={pending}
          >
            <FileWarning className="h-4 w-4 mr-1.5" />
            Source is wrong
          </Button>
        </div>
      )}

      <AlertDialog open={confirmSourceWrong} onOpenChange={(o) => !o && setConfirmSourceWrong(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flag this source as wrong?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this when the source document itself is wrong (wrong file, outdated, or
              mislabeled). This rejects every open item from this source —{' '}
              {sameSourceCount} item{sameSourceCount === 1 ? '' : 's'}. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="source-wrong-detail">Note (optional)</Label>
            <Textarea
              id="source-wrong-detail"
              rows={3}
              value={sourceWrongDetail}
              onChange={(e) => setSourceWrongDetail(e.target.value)}
              placeholder="Why the source is wrong"
              disabled={flagSourceWrong.isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={flagSourceWrong.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleFlagSourceWrong();
              }}
              disabled={flagSourceWrong.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {flagSourceWrong.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              Flag source &amp; reject all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function UniDbReviewContent() {
  const { canReview, loading: gateLoading } = useCanReviewUniDb();
  const queryEnabled = canReview && !gateLoading;
  const { data, isLoading, error, refetch, isFetching } = useReviewQueue(queryEnabled);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;

  // How many open items share the selected item's source — used to warn the
  // reviewer before flagging the whole source as wrong.
  const sameSourceCount = useMemo(() => {
    if (!selectedRow) return 0;
    const key = selectedRow.guideline_document_id ?? selectedRow.source_url_ko;
    if (!key) return 1;
    return rows.filter((r) => (r.guideline_document_id ?? r.source_url_ko) === key).length;
  }, [rows, selectedRow]);

  // Drop the selection if the selected item leaves the queue (e.g. after an action).
  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [rows, selectedId]);

  if (gateLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!canReview) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Staff only</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            The university data review queue is only available to staff. Contact an
            administrator if you believe you should have access.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleResolved = () => {
    setSelectedId(null);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">University data review</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Human-in-the-loop queue for AI-extracted Korean university admission data. Approve,
            correct, or reject each extraction before it reaches students.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Failed to load review queue</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Queue is empty — nothing to review.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-2 px-1">
                {rows.length} item{rows.length === 1 ? '' : 's'} waiting
              </div>
              <ScrollArea className="h-[calc(100vh-22rem)] min-h-[300px] pr-2">
                <div className="space-y-2">
                  {rows.map((row) => (
                    <QueueListItem
                      key={row.id}
                      row={row}
                      selected={row.id === selectedId}
                      onSelect={() => setSelectedId(row.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              {selectedRow ? (
                <DetailPane
                  key={selectedRow.id}
                  row={selectedRow}
                  sameSourceCount={sameSourceCount}
                  onResolved={handleResolved}
                />
              ) : (
                <div className="h-full min-h-[300px] flex items-center justify-center text-center text-muted-foreground text-sm p-8">
                  Select an item from the queue to review its extracted data.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
