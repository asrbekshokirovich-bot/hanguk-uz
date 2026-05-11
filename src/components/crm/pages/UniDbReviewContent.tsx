import { useMemo, useState } from 'react';
import { useUniDbReviewer } from '@/hooks/useUniDbReviewer';
import {
  useReviewQueue,
  useReviewActions,
  ReviewQueueRow,
  REVIEW_REJECTION_REASONS,
  RejectionReason,
} from '@/hooks/useReviewQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, Loader2, ExternalLink, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PRIORITY_LABEL: Record<number, string> = {
  1: 'P1 — correction notice',
  2: 'P2 — attachment changed',
  3: 'P3 — diff (high)',
  4: 'P4 — diff (medium)',
  5: 'P5 — refresh',
};

const PRIORITY_BADGE_VARIANT: Record<number, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  1: 'destructive',
  2: 'destructive',
  3: 'default',
  4: 'secondary',
  5: 'outline',
};

const SLA_HOURS: Record<number, number> = { 1: 4, 2: 12, 3: 24, 4: 48, 5: 96 };

function formatRelative(dateIso: string): string {
  const created = new Date(dateIso).getTime();
  const diffMs = Date.now() - created;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) {
    const minutes = Math.max(0, Math.floor(diffMs / 60_000));
    return `${minutes}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function isOverdue(row: ReviewQueueRow): boolean {
  const slaHours = SLA_HOURS[row.priority] ?? 96;
  const ageHours = (Date.now() - new Date(row.created_at).getTime()) / 3_600_000;
  return ageHours > slaHours;
}

function ReasonOptionLabel({ value }: { value: RejectionReason }) {
  switch (value) {
    case 'wrong_year':
      return 'wrong_year — PDF is for a different academic year';
    case 'wrong_archetype':
      return 'wrong_archetype — applicant category misclassified';
    case 'hallucinated_field':
      return 'hallucinated_field — field not present in source';
    case 'ocr_garbled':
      return 'ocr_garbled — OCR output unusable';
    case 'source_404':
      return 'source_404 — original document no longer reachable';
    case 'other':
      return 'other — see notes';
  }
}

function Forbidden() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Reviewer access required</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          This page is for the uni_db HITL queue. You need <code className="px-1 py-0.5 bg-muted rounded">profiles.role</code>{' '}
          set to <code className="px-1 py-0.5 bg-muted rounded">uni_db_reviewer</code> or{' '}
          <code className="px-1 py-0.5 bg-muted rounded">admin</code>. Ask the workspace owner to grant access.
        </p>
      </CardContent>
    </Card>
  );
}

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: RejectionReason, detail: string) => void;
  pending: boolean;
}

function RejectDialog({ open, onOpenChange, onSubmit, pending }: RejectDialogProps) {
  const [reason, setReason] = useState<RejectionReason>('wrong_year');
  const [detail, setDetail] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this extraction</DialogTitle>
          <DialogDescription>
            The discovery worker will re-queue the source for re-extraction at the next crawl.
            The audit log records who rejected it and why.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason code</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as RejectionReason)}>
              <SelectTrigger id="reject-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    <ReasonOptionLabel value={r} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reject-detail">Detail (optional)</Label>
            <Textarea
              id="reject-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What specifically went wrong (helpful for the eng team)"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => onSubmit(reason, detail)}
          >
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditAcceptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPayload: unknown;
  onSubmit: (payload: Record<string, unknown>, notes: string) => void;
  pending: boolean;
}

function EditAcceptDialog({ open, onOpenChange, initialPayload, onSubmit, pending }: EditAcceptDialogProps) {
  const initialString = useMemo(
    () => JSON.stringify(initialPayload ?? {}, null, 2),
    [initialPayload],
  );
  const [text, setText] = useState(initialString);
  const [notes, setNotes] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(text || '{}') as Record<string, unknown>;
      if (Object.keys(parsed).length === 0) {
        setParseError('Corrected payload must be non-empty');
        return;
      }
      setParseError(null);
      onSubmit(parsed, notes);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'invalid JSON');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit and accept</DialogTitle>
          <DialogDescription>
            Adjust the JSON payload below. The diff against the original extraction lands in{' '}
            <code className="px-1 py-0.5 bg-muted rounded">review_decisions</code> as an immutable audit row.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-payload">Corrected payload (JSON)</Label>
            <Textarea
              id="edit-payload"
              className="font-mono text-xs"
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {parseError ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {parseError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Reviewer notes (optional)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What you changed and why"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Accept with edits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QueueItemCardProps {
  row: ReviewQueueRow;
  onAccept: (id: string) => void;
  onOpenEdit: (row: ReviewQueueRow) => void;
  onOpenReject: (row: ReviewQueueRow) => void;
  pendingId: string | null;
}

function QueueItemCard({ row, onAccept, onOpenEdit, onOpenReject, pendingId }: QueueItemCardProps) {
  const isThisPending = pendingId === row.id;
  const overdue = isOverdue(row);

  return (
    <Card className={overdue ? 'border-destructive/40' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={PRIORITY_BADGE_VARIANT[row.priority] ?? 'outline'}>
                {PRIORITY_LABEL[row.priority] ?? `P${row.priority}`}
              </Badge>
              {overdue ? (
                <Badge variant="destructive" className="gap-1">
                  <Clock className="h-3 w-3" /> overdue
                </Badge>
              ) : null}
              <Badge variant="outline">{row.reason}</Badge>
              {row.accuracy_self_score !== null ? (
                <Badge variant="outline">
                  conf {Math.round((row.accuracy_self_score ?? 0) * 100)}%
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-base truncate">
              {row.name_ko ?? row.name_en ?? <span className="text-muted-foreground">unknown institution</span>}
            </CardTitle>
            {row.name_ko && row.name_en ? (
              <p className="text-xs text-muted-foreground truncate">{row.name_en}</p>
            ) : null}
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            <div>{formatRelative(row.created_at)}</div>
            <div className="font-mono">{row.entity_type}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {row.source_url_ko ? (
          <a
            href={row.source_url_ko}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {row.source_url_ko}
          </a>
        ) : null}

        {row.parsed_output ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground select-none">
              extracted payload
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-auto max-h-64">
              {JSON.stringify(row.parsed_output, null, 2)}
            </pre>
          </details>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => onAccept(row.id)}
            disabled={isThisPending}
          >
            {isThisPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Accept
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onOpenEdit(row)}
            disabled={isThisPending}
          >
            Edit & accept
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onOpenReject(row)}
            disabled={isThisPending}
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UniDbReviewContent() {
  const { isUniDbReviewer, loading: roleLoading } = useUniDbReviewer();
  const queryEnabled = isUniDbReviewer && !roleLoading;
  const { data, isLoading, error, refetch, isFetching } = useReviewQueue(queryEnabled);
  const { accept, editAccept, reject } = useReviewActions();
  const { toast } = useToast();

  const [confirmAccept, setConfirmAccept] = useState<ReviewQueueRow | null>(null);
  const [editTarget, setEditTarget] = useState<ReviewQueueRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ReviewQueueRow | null>(null);

  if (roleLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isUniDbReviewer) {
    return <Forbidden />;
  }

  const rows = data ?? [];
  const overdueCount = rows.filter(isOverdue).length;
  const pendingMutationId =
    accept.isPending ? accept.variables?.queueItemId ?? null
    : editAccept.isPending ? editAccept.variables?.queueItemId ?? null
    : reject.isPending ? reject.variables?.queueItemId ?? null
    : null;

  const handleAccept = (id: string) => {
    accept.mutate(
      { queueItemId: id },
      {
        onSuccess: () => {
          toast({ title: 'Accepted', description: 'Audit row written to review_decisions.' });
          setConfirmAccept(null);
        },
        onError: (err) => {
          toast({ title: 'Accept failed', description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  const handleEditAccept = (payload: Record<string, unknown>, notes: string) => {
    if (!editTarget) return;
    editAccept.mutate(
      {
        queueItemId: editTarget.id,
        correctedPayload: payload,
        reviewerNotes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Accepted with edits', description: 'Diff captured in review_decisions.' });
          setEditTarget(null);
        },
        onError: (err) => {
          toast({ title: 'Edit-accept failed', description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  const handleReject = (reason: RejectionReason, detail: string) => {
    if (!rejectTarget) return;
    reject.mutate(
      {
        queueItemId: rejectTarget.id,
        reason,
        reasonDetail: detail || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Rejected', description: `Reason: ${reason}` });
          setRejectTarget(null);
        },
        onError: (err) => {
          toast({ title: 'Reject failed', description: err.message, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">uni_db review queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            HITL extraction queue. SLA priorities P1 (4h) → P5 (96h). See{' '}
            <code className="px-1 py-0.5 bg-muted rounded">docs/runbooks/reviewer-onboarding.md</code> for the playbook.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Open</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rows.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Overdue</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-destructive' : ''}`}>{overdueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">P1+P2</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rows.filter((r) => r.priority <= 2).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Avg confidence</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rows.length === 0
                ? '—'
                : `${Math.round(
                    (rows.reduce((acc, r) => acc + (r.accuracy_self_score ?? 0), 0) / rows.length) * 100,
                  )}%`}
            </div>
          </CardContent>
        </Card>
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
            <p className="text-sm">Queue is empty.</p>
            <p className="text-xs mt-1">
              Items appear here when the discovery worker promotes an extraction to <code>review_queue.status='open'</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((row) => (
            <QueueItemCard
              key={row.id}
              row={row}
              onAccept={(id) => setConfirmAccept(rows.find((r) => r.id === id) ?? null)}
              onOpenEdit={setEditTarget}
              onOpenReject={setRejectTarget}
              pendingId={pendingMutationId}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmAccept} onOpenChange={(o) => !o && setConfirmAccept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this extraction as-is?</AlertDialogTitle>
            <AlertDialogDescription>
              This promotes the row to its target table and writes an immutable audit row in{' '}
              <code>review_decisions</code>. You cannot undo a decision — file a P1 correction instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accept.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={accept.isPending}
              onClick={() => confirmAccept && handleAccept(confirmAccept.id)}
            >
              {accept.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditAcceptDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        initialPayload={editTarget?.parsed_output ?? {}}
        onSubmit={handleEditAccept}
        pending={editAccept.isPending}
      />

      <RejectDialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        onSubmit={handleReject}
        pending={reject.isPending}
      />
    </div>
  );
}
