import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Flag, Loader2, Pencil, Split, X } from 'lucide-react';
import { StructuredReviewEditor } from '../ReviewEditor';
import { validateParsedOutput } from '../reviewLogic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  REVIEW_REJECTION_REASONS,
  type RejectionReason,
  type ReviewQueueRow,
} from '@/hooks/useReviewQueue';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { itemConfidence, confidencePct, isFailedExtraction } from '../reviewLogic';
import { parseReliability, type ReliabilityColor } from '../reliability';
import {
  firstNoteLine,
  isDegreeSplitFlag,
  isDocumentFlag,
  sectionIcon,
  sectionLabelKey,
  serverRejection,
  type DecidedInfo,
} from './reviewGroups';

/**
 * One section card (design §B): icon tile + title + reliability pill +
 * mono confidence, primary Tasdiqlash / outline Rad etish, the one-line
 * tinted reliability note (replaces the old <details><pre> dump), the inline
 * reject-reason strip (replaces per-card dialogs; keeps fn_flag_source_wrong
 * as the "Manba noto'g'ri" link), and the slim decided-state strips. The
 * field-group body renders through `children`.
 */

const REL_PILL: Record<ReliabilityColor, string> = {
  red: 'bg-destructive/10 text-destructive',
  amber: 'bg-warning/10 text-warning',
  green: 'bg-success/10 text-success',
};

export interface SectionCardHandlers {
  onApprove: (row: ReviewQueueRow) => void;
  onConfirmReject: (row: ReviewQueueRow, reason: RejectionReason) => void;
  onFlagSource: (row: ReviewQueueRow) => void;
  onSaveEdit: (row: ReviewQueueRow, corrected: Record<string, unknown>) => void;
  onConfirmEdit: (row: ReviewQueueRow, corrected: Record<string, unknown>) => void;
  onSplit: (row: ReviewQueueRow) => void;
}

/**
 * The source document's classified admission cycle (migration 20260714000000 +
 * backfill_document_cycle.py). Warning-tinted when the document describes an
 * OLDER cycle than the crawl target — the reviewer is looking at stale data.
 */
function CycleBadge({ row }: { row: ReviewQueueRow }) {
  const { t } = useTranslation();
  const { intakes } = useActiveIntake();
  const year = row.doc_academic_year;
  if (year == null) return null;
  const season =
    row.doc_semester === 'spring' || row.doc_semester === 'fall'
      ? t(`uniReview.crawl.${row.doc_semester}`)
      : null;
  const target = intakes.find((i) => i.is_default) ?? null;
  const stale =
    target != null &&
    (year < target.year ||
      (year === target.year && target.season === 'spring' && row.doc_semester === 'fall'));
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold',
        stale ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info',
      )}
      title={t(stale ? 'uniReview.cycle.staleTitle' : 'uniReview.cycle.title')}
    >
      {year}학년도{season ? ` · ${season}` : ''}
      {stale ? ` — ${t('uniReview.cycle.stale')}` : ''}
    </span>
  );
}

export function ReviewSectionCard({
  row,
  decided,
  isRejecting,
  rejectReason,
  onReasonChange,
  onStartReject,
  onCancelReject,
  isEditing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  handlers,
  acting,
  children,
}: {
  row: ReviewQueueRow;
  decided: DecidedInfo | undefined;
  isRejecting: boolean;
  rejectReason: RejectionReason;
  onReasonChange: (r: RejectionReason) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  isEditing: boolean;
  editDraft: Record<string, unknown>;
  onEditDraftChange: (v: Record<string, unknown>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  handlers: SectionCardHandlers;
  acting: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  // Save is only offered when the payload actually validates.
  const editValid = validateParsedOutput(row.field_group ?? null, editDraft).ok;
  const rel = parseReliability(row.reviewer_notes, row.needs_attention);
  const Icon = sectionIcon(row);
  // A row the queue is showing again because it was rejected earlier, not
  // decided in this session. The buttons stay live: approving is how a wrong
  // rejection gets reversed.
  const rejected = decided ? null : serverRejection(row);
  // Failed lane → "extraction failed" pill, never "confidence 0%" (Phase 3:
  // itemConfidence returns null for a failed lane).
  const laneFailed = isFailedExtraction(row.parsed_output);
  const conf = confidencePct(itemConfidence(row));
  // On a document flag the notes ARE the explanation, and the body renders
  // them in full — repeating the first line above it would say it twice.
  const note =
    !isDocumentFlag(row) && (rel.color === 'red' || rel.color === 'amber')
      ? firstNoteLine(rel.detail)
      : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 px-[18px] shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-secondary text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[14.5px] font-semibold">{t(sectionLabelKey(row))}</span>
        {rel.color ? (
          <span
            className={cn(
              'inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold',
              REL_PILL[rel.color],
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t(`uniReview.rel.${rel.color}`)}
          </span>
        ) : null}
        {rejected ? (
          <span
            className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 text-[11.5px] font-semibold text-destructive"
            title={t('uniReview.rejected.badgeTitle')}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
            {t('uniReview.rejected.badge')}
          </span>
        ) : null}
        <CycleBadge row={row} />
        {laneFailed ? (
          <span
            className="inline-flex h-[22px] items-center rounded-full bg-destructive/10 px-2.5 text-[11.5px] font-semibold text-destructive"
            title={t('uniReview.laneFailedTitle')}
          >
            {t('uniReview.laneFailed')}
          </span>
        ) : conf ? (
          <span className="font-mono text-[11px] text-muted-foreground/80">
            {t('uniReview.confidence', { p: conf })}
          </span>
        ) : null}
        <span className="flex-1" />
        {acting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        {!decided && !isRejecting && !isEditing ? (
          <>
            {isDegreeSplitFlag(row) ? (
              <Button
                size="sm"
                className="h-8"
                onClick={() => handlers.onSplit(row)}
                disabled={acting}
                title={t('uniReview.docFlag.splitActionTitle')}
              >
                <Split className="h-3.5 w-3.5" />
                {t('uniReview.docFlag.splitAction')}
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8"
                onClick={() => handlers.onApprove(row)}
                disabled={acting}
                title={t('uniReview.actions.approveTitle')}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                {t('uniReview.actions.approve')}
              </Button>
            )}
            {!isDocumentFlag(row) ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-muted-foreground"
                onClick={onStartEdit}
                disabled={acting}
                title={t('uniReview.actions.editTitle')}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('uniReview.actions.edit')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-muted-foreground hover:border-transparent hover:bg-destructive/10 hover:text-destructive"
              onClick={onStartReject}
              disabled={acting}
            >
              {t('uniReview.actions.reject')}
            </Button>
          </>
        ) : null}
      </div>

      {/* A correction is saved but nobody has approved it yet. Without this
          the card looks identical to an untouched one, and the reviewer who
          comes back tomorrow cannot tell that the work is already done. */}
      {!isEditing && !decided && row.reviewer_decision ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-info/30 bg-info/10 px-3.5 py-2 text-[12.5px] text-info">
          <Check className="h-3.5 w-3.5 shrink-0" />
          {t('uniReview.actions.savedNotApproved')}
        </div>
      ) : null}

      {isEditing && !decided ? (
        <div className="flex animate-fade-up flex-col gap-2 rounded-[10px] bg-secondary/60 p-3 px-3.5">
          <span className="text-[12.5px] font-semibold">{t('uniReview.actions.editTitle')}</span>
          {/* Was a raw JSON textarea. The people who approve these cards do
              not write JSON, and a stray comma silently blocked the save. */}
          <StructuredReviewEditor
            fieldGroup={row.field_group ?? null}
            value={editDraft}
            onChange={onEditDraftChange}
            disabled={acting}
          />
          <div className="flex items-center gap-2">
            {/* Save and approve are separate on purpose. The single
                "Saqlash va tasdiqlash" button published the card the instant a
                correction was typed, with no chance to re-read it against the
                PDF first. */}
            {/* Disabled while the payload does not validate. It used to be
                clickable, so a reviewer could press Save on a card the schema
                rejects and get a server error for something the screen had
                already told them. */}
            <Button
              size="sm"
              className="h-[30px]"
              onClick={() => handlers.onSaveEdit(row, editDraft)}
              disabled={acting || !editValid}
              title={editValid ? undefined : t('uniReview.edit.invalid')}
            >
              {t('uniReview.actions.saveEdit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-[30px] w-[30px] p-0 text-muted-foreground"
              onClick={onCancelEdit}
              disabled={acting}
              title={t('uniReview.actions.cancel')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {isRejecting && !decided ? (
        <div className="flex animate-fade-up flex-col gap-2 rounded-[10px] bg-destructive/10 p-3 px-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-destructive">
              {t('uniReview.actions.rejectReason')}
            </span>
            <Select value={rejectReason} onValueChange={(v) => onReasonChange(v as RejectionReason)}>
              <SelectTrigger className="h-[30px] w-[210px] bg-card text-[12.5px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`uniReview.reasons.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="destructive"
              className="h-[30px]"
              onClick={() => handlers.onConfirmReject(row, rejectReason)}
              disabled={acting}
            >
              {t('uniReview.actions.confirmReject')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-[30px] w-[30px] p-0 text-muted-foreground"
              onClick={onCancelReject}
              disabled={acting}
              title={t('uniReview.actions.cancel')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => handlers.onFlagSource(row)}
            disabled={acting}
            className="inline-flex items-center gap-1.5 self-start text-[11.5px] font-medium text-muted-foreground/80 hover:text-destructive"
          >
            <Flag className="h-3 w-3" />
            {t('uniReview.actions.flagSource')}
          </button>
        </div>
      ) : null}

      {decided?.status === 'approved' ? (
        <div className="flex animate-fade-up items-center gap-2.5 rounded-[10px] bg-success/10 p-2.5 px-3.5">
          <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
          <span className="flex-1 text-[13px] font-semibold text-success">
            {t('uniReview.decided.approved')}
          </span>
        </div>
      ) : null}

      {decided?.status === 'rejected' ? (
        <div className="flex animate-fade-up items-center gap-2.5 rounded-[10px] bg-destructive/10 p-2.5 px-3.5">
          <X className="h-4 w-4 shrink-0 text-destructive" strokeWidth={2.5} />
          <span className="flex-1 text-[13px] font-semibold text-destructive">
            {t('uniReview.decided.rejected', { reason: decided.reasonLabel ?? '—' })}
          </span>
        </div>
      ) : null}

      {!decided ? (
        <>
          {rejected ? (
            <div className="flex items-start gap-2 rounded-[10px] bg-destructive/10 p-2.5 px-3.5 text-destructive">
              <X className="mt-0.5 h-[15px] w-[15px] shrink-0" strokeWidth={2.5} />
              <span className="min-w-0 break-words text-[12.5px] font-medium leading-normal">
                {t('uniReview.rejected.note', {
                  reason: rejected.reasonKey
                    ? t(`uniReview.reasons.${rejected.reasonKey}`)
                    : t('uniReview.reasons.other'),
                })}
                {rejected.detail ? ` — ${rejected.detail}` : ''}
              </span>
            </div>
          ) : null}
          {note ? (
            <div
              className={cn(
                'flex items-start gap-2 rounded-[10px] p-2.5 px-3.5',
                rel.color === 'red'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning',
              )}
            >
              <AlertTriangle className="mt-0.5 h-[15px] w-[15px] shrink-0" />
              <span className="min-w-0 break-words text-[12.5px] font-medium leading-normal">
                {note}
              </span>
            </div>
          ) : null}
          {children}
        </>
      ) : null}
    </div>
  );
}
