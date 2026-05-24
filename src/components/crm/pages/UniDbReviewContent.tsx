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
import { ReviewParsedOutput } from './ReviewParsedOutput';
import { StructuredReviewEditor, DiffList } from './ReviewEditor';
import {
  itemConfidence,
  confidencePct,
  validateParsedOutput,
  diffParsedOutput,
} from './reviewLogic';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Eye,
  Save,
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

// One university = all open queue items that share an institution identity.
interface UniGroup {
  key: string;
  nameKo: string | null;
  nameEn: string | null;
  items: ReviewQueueRow[];
}

const SECTIONS: Array<{ group: string; title: string }> = [
  { group: 'calendar', title: 'Admission timeline & fees' },
  { group: 'requirements', title: 'Admission tracks (전형)' },
  { group: 'tuition', title: 'Tuition' },
  { group: 'scholarships', title: 'Scholarships' },
  { group: 'documents_required', title: 'Required documents' },
];

const SECTION_TITLE: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.group, s.title]),
);

function groupKey(row: ReviewQueueRow): string {
  const name = row.name_en?.trim() || row.name_ko?.trim();
  if (name) return `name:${name.toLowerCase()}`;
  if (row.guideline_document_id) return `doc:${row.guideline_document_id}`;
  return `item:${row.id}`;
}

function groupByUniversity(rows: ReviewQueueRow[]): UniGroup[] {
  const map = new Map<string, UniGroup>();
  for (const row of rows) {
    const key = groupKey(row);
    let g = map.get(key);
    if (!g) {
      g = { key, nameKo: row.name_ko, nameEn: row.name_en, items: [] };
      map.set(key, g);
    }
    g.items.push(row);
    if (!g.nameKo && row.name_ko) g.nameKo = row.name_ko;
    if (!g.nameEn && row.name_en) g.nameEn = row.name_en;
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    const pa = Math.min(...a.items.map((i) => i.priority));
    const pb = Math.min(...b.items.map((i) => i.priority));
    if (pa !== pb) return pa - pb;
    return (a.nameEn ?? a.nameKo ?? '').localeCompare(b.nameEn ?? b.nameKo ?? '');
  });
  return groups;
}

function uniTitle(g: UniGroup): string {
  return g.nameKo ?? g.nameEn ?? 'Unknown institution';
}

/** Lowest confidence across a group's items — surfaces the weakest extraction. */
function groupMinConfidence(items: ReviewQueueRow[]): number | null {
  const vals = items.map((i) => itemConfidence(i)).filter((v): v is number => v !== null);
  return vals.length ? Math.min(...vals) : null;
}

function shortStorageName(storagePath: string | null): string | null {
  if (!storagePath) return null;
  const base = storagePath.split('/').pop() ?? storagePath;
  return base.length > 18 ? `${base.slice(0, 10)}…${base.slice(-7)}` : base;
}

function UniversityListItem({
  group,
  selected,
  onSelect,
}: {
  group: UniGroup;
  selected: boolean;
  onSelect: () => void;
}) {
  const minPriority = Math.min(...group.items.map((i) => i.priority));
  const conf = confidencePct(groupMinConfidence(group.items));
  const sections = Array.from(new Set(group.items.map((i) => i.field_group ?? 'other')));
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <Badge variant={PRIORITY_BADGE_VARIANT[minPriority] ?? 'outline'}>P{minPriority}</Badge>
        <Badge variant="outline" className="font-normal">
          {group.items.length} item{group.items.length === 1 ? '' : 's'}
        </Badge>
        {conf ? (
          <Badge variant="outline" className="font-normal" title="Lowest row confidence">
            conf {conf}
          </Badge>
        ) : null}
      </div>
      <div className="font-medium text-sm truncate">{uniTitle(group)}</div>
      {group.nameKo && group.nameEn ? (
        <div className="text-xs text-muted-foreground truncate">{group.nameEn}</div>
      ) : null}
      <div className="text-xs text-muted-foreground mt-1 truncate">
        {sections.map((s) => SECTION_TITLE[s] ?? s).join(' · ')}
      </div>
    </button>
  );
}

function UniversityDetail({
  group,
  allRows,
  onResolved,
}: {
  group: UniGroup;
  allRows: ReviewQueueRow[];
  onResolved: () => void;
}) {
  const sameSourceCount = (row: ReviewQueueRow): number => {
    const key = row.guideline_document_id ?? row.source_url_ko;
    if (!key) return 1;
    return allRows.filter((r) => (r.guideline_document_id ?? r.source_url_ko) === key).length;
  };

  const knownGroups = new Set(SECTIONS.map((s) => s.group));
  const extraGroups = Array.from(
    new Set(group.items.map((i) => i.field_group ?? 'other').filter((g) => !knownGroups.has(g))),
  );

  const renderSectionItems = (fieldGroup: string) => {
    const items = group.items.filter((i) => (i.field_group ?? 'other') === fieldGroup);
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground italic rounded-lg border border-dashed p-3">
          Not extracted yet for this university.
        </p>
      );
    }
    const multiple = items.length > 1;
    return (
      <div className="space-y-4">
        {multiple ? (
          <p className="text-xs text-muted-foreground">
            {items.length} separate extractions for this section (different source documents) —
            review each on its own.
          </p>
        ) : null}
        {items.map((item, idx) => (
          <div key={item.id}>
            {multiple ? (
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Source {idx + 1} of {items.length}
                {shortStorageName(item.storage_path) ? ` · ${shortStorageName(item.storage_path)}` : ''}
              </div>
            ) : null}
            <DetailPane row={item} sameSourceCount={sameSourceCount(item)} onResolved={onResolved} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{uniTitle(group)}</h2>
        {group.nameKo && group.nameEn ? (
          <p className="text-sm text-muted-foreground">{group.nameEn}</p>
        ) : null}
      </div>

      {SECTIONS.map((section) => (
        <section key={section.group} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
            {section.title}
          </h3>
          {renderSectionItems(section.group)}
        </section>
      ))}

      {extraGroups.map((fieldGroup) => (
        <section key={fieldGroup} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
            {fieldGroup}
          </h3>
          {renderSectionItems(fieldGroup)}
        </section>
      ))}
    </div>
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

  const initialParsed = useMemo<Record<string, unknown>>(() => {
    const p = row.parsed_output;
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  }, [row.parsed_output]);

  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Record<string, unknown>>(initialParsed);
  const [showDiff, setShowDiff] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason | ''>('');
  const [rejectDetail, setRejectDetail] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [confirmSourceWrong, setConfirmSourceWrong] = useState(false);
  const [sourceWrongDetail, setSourceWrongDetail] = useState('');

  // Reset local editing state whenever a different item is selected.
  useEffect(() => {
    setEditing(false);
    setEdited(initialParsed);
    setShowDiff(false);
    setRejecting(false);
    setRejectReason('');
    setRejectDetail('');
    setConfirmSourceWrong(false);
    setSourceWrongDetail('');
  }, [row.id, initialParsed]);

  const pending =
    accept.isPending || editAccept.isPending || reject.isPending || flagSourceWrong.isPending;
  const conf = confidencePct(itemConfidence(row));

  const validation = useMemo(
    () => validateParsedOutput(row.field_group, edited),
    [row.field_group, edited],
  );
  const diff = useMemo(
    () => diffParsedOutput(initialParsed, edited),
    [initialParsed, edited],
  );

  const handleOpenPdf = async () => {
    if (!row.storage_path) return;
    setPdfLoading(true);
    try {
      // Sign a fresh short-lived URL per click (signed URLs expire in ~15 min).
      // Send both identifiers so this works whether get-pdf-url keys off the
      // storage path or the document id.
      const { data, error } = await supabase.functions.invoke('get-pdf-url', {
        body: {
          storage_path: row.storage_path,
          document_id: row.guideline_document_id,
          reason: 'open_original',
        },
      });
      const signedUrl = (data as { signed_url?: string } | null)?.signed_url;
      if (error || !signedUrl) throw error ?? new Error('No signed URL returned');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('Could not open source PDF', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleFlagSourceWrong = () => {
    flagSourceWrong.mutate(
      { queueItemId: row.id, detail: sourceWrongDetail },
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

  const handleSaveEditsClick = () => {
    if (!validation.ok) {
      setEditing(true);
      toast.error('Cannot save', {
        description: 'Fix the highlighted validation errors first.',
      });
      return;
    }
    setShowDiff(true);
  };

  const confirmSaveEdits = () => {
    editAccept.mutate(
      { queueItemId: row.id, correctedPayload: edited },
      {
        onSuccess: () => {
          toast.success('Accepted with edits', { description: institutionName(row) });
          setShowDiff(false);
          onResolved();
        },
        onError: (err) => toast.error('Edit + accept failed', { description: err.message }),
      },
    );
  };

  const handleReject = () => {
    if (rejectReason === '') return;
    reject.mutate(
      { queueItemId: row.id, reason: rejectReason, reasonDetail: rejectDetail || undefined },
      {
        onSuccess: () => {
          toast.success('Rejected', { description: `Reason: ${rejectReason}` });
          setRejecting(false);
          onResolved();
        },
        onError: (err) => toast.error('Reject failed', { description: err.message }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={PRIORITY_BADGE_VARIANT[row.priority] ?? 'outline'}>P{row.priority}</Badge>
          <Badge variant="outline" className="font-normal">{row.reason}</Badge>
          {conf ? (
            <Badge variant="outline" className="font-normal" title="Lowest per-row confidence">
              lowest row conf {conf}
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal">confidence n/a</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {row.storage_path ? (
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
          {!row.source_url_ko && !row.storage_path ? (
            <p className="text-sm text-muted-foreground">No source on file.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Extracted data</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditing((v) => !v)}
            disabled={pending}
          >
            {editing ? (
              <>
                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit data
              </>
            )}
          </Button>
        </div>

        {editing ? (
          <StructuredReviewEditor
            fieldGroup={row.field_group}
            value={edited}
            onChange={setEdited}
            disabled={pending}
          />
        ) : (
          <ReviewParsedOutput fieldGroup={row.field_group} parsedOutput={row.parsed_output} />
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={handleAccept} disabled={pending}>
          {accept.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1.5" />
          )}
          Accept as-is
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSaveEditsClick}
          disabled={pending || diff.length === 0}
          title={diff.length === 0 ? 'No edits yet — use Edit data first' : undefined}
        >
          {editAccept.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save edits + accept
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setRejecting(true)} disabled={pending}>
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

      {/* Diff confirmation before committing edits */}
      <Dialog open={showDiff} onOpenChange={(o) => !o && setShowDiff(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review your changes</DialogTitle>
            <DialogDescription>
              These fields will be saved as the corrected extraction for {institutionName(row)}, then
              accepted.
            </DialogDescription>
          </DialogHeader>
          <DiffList entries={diff} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiff(false)} disabled={editAccept.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmSaveEdits} disabled={editAccept.isPending || !validation.ok}>
              {editAccept.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Save &amp; accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject — confirmation + required reason */}
      <AlertDialog open={rejecting} onOpenChange={(o) => !o && setRejecting(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this extraction?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from the queue without publishing it. Pick the reason it’s being
              rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">
                Rejection reason <span className="text-destructive">*</span>
              </Label>
              <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as RejectionReason)}>
                <SelectTrigger id="reject-reason">
                  <SelectValue placeholder="Select a reason…" />
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
                disabled={reject.isPending}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reject.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReject();
              }}
              disabled={reject.isPending || rejectReason === ''}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Confirm reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Source is wrong — confirmation + required note */}
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
            <Label htmlFor="source-wrong-detail">
              Reason <span className="text-destructive">*</span>
            </Label>
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
              disabled={flagSourceWrong.isPending || sourceWrongDetail.trim() === ''}
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

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const rows = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => groupByUniversity(rows), [rows]);
  const selectedGroup = groups.find((g) => g.key === selectedKey) ?? null;

  // Drop the selection only if the selected university leaves the queue (e.g.
  // after all its items are resolved) — never on an in-panel click.
  useEffect(() => {
    if (selectedKey && !groups.some((g) => g.key === selectedKey)) {
      setSelectedKey(null);
    }
  }, [groups, selectedKey]);

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
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-4 items-start">
          <Card className="lg:sticky lg:top-24">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-2 px-1">
                {groups.length} universit{groups.length === 1 ? 'y' : 'ies'} · {rows.length} item
                {rows.length === 1 ? '' : 's'} waiting
              </div>
              <ScrollArea className="h-[calc(100vh-22rem)] min-h-[300px] pr-2">
                <div className="space-y-2">
                  {groups.map((group) => (
                    <UniversityListItem
                      key={group.key}
                      group={group}
                      selected={group.key === selectedKey}
                      onSelect={() => setSelectedKey(group.key)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Stop in-panel clicks from bubbling so selection never resets. */}
          <Card onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              {selectedGroup ? (
                <UniversityDetail
                  key={selectedGroup.key}
                  group={selectedGroup}
                  allRows={rows}
                  onResolved={handleResolved}
                />
              ) : (
                <div className="h-full min-h-[300px] flex items-center justify-center text-center text-muted-foreground text-sm p-8">
                  Select a university to review its extracted data.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
