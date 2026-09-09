import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { edgeFunctionErrorMessage } from '@/lib/edgeFunctionError';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import type { RejectionReason, ReviewQueueRow } from '@/hooks/useReviewQueue';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { parseReliability } from '../reliability';
import { confidencePct, minLaneConfidence } from '../reviewLogic';
import {
  documentCycleLabel,
  institutionName,
  type DecidedMap,
  type GuidelineGroup,
} from './reviewGroups';
import { ReviewSectionCard, type SectionCardHandlers } from './ReviewSectionCard';
import { SectionBody } from './ReviewSectionBodies';

/**
 * Right detail panel (design §B): university header card (name + intake pill,
 * Manba sahifa / PDF ochish, progress bar, all-done banner with Keyingisi) and
 * one ReviewSectionCard per queue row. PDF opening keeps the existing
 * signed-URL edge-function flow.
 */

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
    toast.error(t('uniReview.detail.noPdf'));
    return;
  }
  const { data, error } = await supabase.functions.invoke('get-pdf-url', { body });
  const signed = (data as { signed_url?: string } | null)?.signed_url;
  if (error || !signed) {
    toast.error(await edgeFunctionErrorMessage(error, t('uniReview.detail.pdfError')));
    return;
  }
  window.open(signed, '_blank', 'noopener,noreferrer');
}

/** "Bahor 2027 · 2027학년도" from the default (crawl-target) intake. */
function useIntakePill(): string | null {
  const { t } = useTranslation();
  const { intakes } = useActiveIntake();
  const target = intakes.find((i) => i.is_default);
  if (!target) return null;
  const season = t(`uniReview.crawl.${target.season === 'spring' ? 'spring' : 'fall'}`);
  return `${season} ${target.year} · ${target.year}학년도`;
}

export function ReviewGuidelineDetail({
  group,
  decided,
  rejectingRowId,
  rejectReason,
  onReasonChange,
  onStartReject,
  onCancelReject,
  editingRowId,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  handlers,
  actingRowId,
  hasNext,
  onNext,
}: {
  group: GuidelineGroup;
  decided: DecidedMap;
  rejectingRowId: string | null;
  rejectReason: RejectionReason;
  onReasonChange: (r: RejectionReason) => void;
  onStartReject: (row: ReviewQueueRow) => void;
  onCancelReject: () => void;
  editingRowId: string | null;
  editDraft: Record<string, unknown>;
  onEditDraftChange: (v: Record<string, unknown>) => void;
  onStartEdit: (row: ReviewQueueRow) => void;
  onCancelEdit: () => void;
  handlers: SectionCardHandlers;
  actingRowId: string | null;
  hasNext: boolean;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const intakePill = useIntakePill();
  // Min confidence across this guideline's SUCCEEDED lanes only — a failed
  // lane must not drag the number to 0% (Phase 3).
  const minConf = confidencePct(minLaneConfidence(group.rows));
  const multiDoc = group.documents.length > 1;

  const decidedN = group.rows.filter((r) => decided[r.id]).length;
  const totalN = group.rows.length;
  const allDone = totalN > 0 && decidedN === totalN;
  const progress = totalN > 0 ? Math.round((decidedN / totalN) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-[18px] shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold leading-tight tracking-[-0.01em]">
                {institutionName(group)}
              </span>
              {/* The pill names the crawl target's cycle, which is only ever
                  true of the whole panel when one document is on show. With
                  several it would assert one intake over documents that may
                  belong to different ones — each strip below carries its own. */}
              {intakePill && !multiDoc ? (
                <span className="inline-flex h-[22px] items-center rounded-full bg-info/10 px-2.5 text-[11.5px] font-semibold text-info">
                  {intakePill}
                </span>
              ) : null}
              {minConf ? (
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  {t('uniReview.minConfidence', { p: minConf })}
                </span>
              ) : null}
            </div>
            {group.nameKo && group.nameEn ? (
              <span className="text-[13px] text-muted-foreground" lang="ko">
                {group.nameKo}
              </span>
            ) : null}
          </div>
          {/* Same reasoning: these point at one document, so they only belong
              in the header when there is one. Otherwise each strip carries its
              own pair. */}
          <div className={cn('flex items-center gap-2', multiDoc && 'hidden')}>
            {group.sourceUrl ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href={group.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('uniReview.detail.sourcePage')}
                </a>
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => openPdf(t, group.guidelineDocId, group.storagePath)}
              disabled={!group.guidelineDocId && !group.storagePath}
            >
              <FileText className="h-3.5 w-3.5" />
              {t('uniReview.detail.openPdf')}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-300 ease-out',
                allDone ? 'bg-success' : 'bg-info',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
            {t('uniReview.detail.progress', { decided: decidedN, total: totalN })}
          </span>
        </div>

        {allDone ? (
          <div className="flex animate-fade-up items-center gap-2.5 rounded-[10px] bg-success/10 p-3 px-3.5">
            <Check className="h-[17px] w-[17px] shrink-0 text-success" strokeWidth={2.5} />
            <span className="flex-1 text-[13px] font-semibold text-success">
              {t('uniReview.detail.allDone')}
            </span>
            {hasNext ? (
              <Button size="sm" className="h-[30px]" onClick={onNext}>
                {t('uniReview.detail.next')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {group.documents.map((doc) => {
        // With one document the strip would just repeat the header, so the
        // common case looks exactly as it did before. With several, each
        // document announces its own cycle and source — the sections below a
        // strip belong to that document and no other.
        const multi = group.documents.length > 1;
        const cycle = documentCycleLabel(doc, t);
        return (
          <div key={doc.key} className="flex min-w-0 flex-col gap-3">
            {multi ? (
              <div className="mt-1 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border/60 bg-secondary/40 px-3.5 py-2">
                <FileText className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
                <span className="text-[12.5px] font-semibold">
                  {cycle ?? t('uniReview.detail.docUnclassified')}
                </span>
                <span className="text-[11.5px] text-muted-foreground/80">
                  {t('uniReview.detail.docSections', { n: doc.rows.length })}
                </span>
                <span className="flex-1" />
                {doc.sourceUrl ? (
                  <Button size="sm" variant="ghost" className="h-7 text-muted-foreground hover:text-foreground" asChild>
                    <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('uniReview.detail.sourcePage')}
                    </a>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => openPdf(t, doc.guidelineDocId, doc.storagePath)}
                  disabled={!doc.guidelineDocId && !doc.storagePath}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('uniReview.detail.openPdf')}
                </Button>
              </div>
            ) : null}

            {doc.rows.map((row) => (
              <ReviewSectionCard
                key={row.id}
                row={row}
                decided={decided[row.id]}
                isRejecting={rejectingRowId === row.id}
                rejectReason={rejectReason}
                onReasonChange={onReasonChange}
                onStartReject={() => onStartReject(row)}
                onCancelReject={onCancelReject}
                isEditing={editingRowId === row.id}
                editDraft={editDraft}
                onEditDraftChange={onEditDraftChange}
                onStartEdit={() => onStartEdit(row)}
                onCancelEdit={onCancelEdit}
                handlers={handlers}
                acting={actingRowId === row.id}
              >
                <SectionBody
                  row={row}
                  noteDetail={parseReliability(row.reviewer_notes, row.needs_attention).detail}
                />
              </ReviewSectionCard>
            ))}
          </div>
        );
      })}
    </div>
  );
}
