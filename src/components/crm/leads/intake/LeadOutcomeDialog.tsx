import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Lead } from '@/contexts/LeadsContext';
import { REJECT_REASONS } from './outcome';

export type OutcomeMode = 'convert' | 'reject' | 'delete';

interface LeadOutcomeDialogProps {
  mode: OutcomeMode;
  lead: Lead;
  busy: boolean;
  onCancel: () => void;
  /** `reason` and `detail` are empty for a conversion. */
  onConfirm: (reason: string, detail: string) => void;
}

const fieldClass =
  'h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm text-foreground ' +
  'outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/35';

/**
 * The confirmation step for the two ways a lead leaves the list.
 *
 * Both are hard to walk back — converting opens a student account, rejecting
 * takes the record out of everyone's working list — so neither happens on a
 * single stray click. Rejection asks for a reason because a dropped lead with
 * no reason teaches the office nothing about why leads are dropped.
 */
export const LeadOutcomeDialog = ({
  mode,
  lead,
  busy,
  onCancel,
  onConfirm,
}: LeadOutcomeDialogProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [detail, setDetail] = useState('');

  // A fresh decision every time the dialog is opened on a different lead.
  useEffect(() => {
    setReason(REJECT_REASONS[0]);
    setDetail('');
  }, [lead.id, mode]);

  const converting = mode === 'convert';
  const deleting = mode === 'delete';
  // Only rejection collects a reason; the other two are a plain yes/no.
  const asking = mode === 'reject';

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {converting
              ? t('leads.intake.convert.title')
              : deleting
                ? t('leads.intake.delete.title')
                : t('leads.intake.reject.title')}
          </DialogTitle>
          <DialogDescription>
            {converting
              ? t('leads.intake.convert.body', { name: lead.full_name })
              : deleting
                ? t('leads.intake.delete.body', { name: lead.full_name })
                : t('leads.intake.reject.body', { name: lead.full_name })}
          </DialogDescription>
        </DialogHeader>

        {/* A name or phone that already belongs to a student. Warned rather than
            blocked: the match is fuzzy, so refusing outright would strand the
            namesakes — but converting anyway opens a second account. */}
        {converting && lead.isAlreadyStudent && (
          <p className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
            {t('leads.intake.convert.duplicate')}
          </p>
        )}

        {asking && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="reject-reason" className="text-[13px] font-semibold">
                {t('leads.intake.reject.reason')}
              </label>
              <select
                id="reject-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={fieldClass}
              >
                {REJECT_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reject-detail" className="text-[13px] font-semibold">
                {t('leads.intake.reject.detail')}{' '}
                <span className="font-medium text-muted-foreground">
                  {t('leads.intake.optional')}
                </span>
              </label>
              <textarea
                id="reject-detail"
                rows={3}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder={t('leads.intake.reject.detailPlaceholder')}
                className={cn(fieldClass, 'h-auto resize-y py-2.5 leading-relaxed')}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 rounded-[10px] border border-input px-5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(asking ? reason : '', asking ? detail : '')}
            disabled={busy}
            className={cn(
              'min-h-11 rounded-[10px] px-6 text-sm font-bold transition hover:opacity-90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
              converting
                ? 'bg-primary text-primary-foreground'
                : 'bg-destructive text-destructive-foreground',
            )}
          >
            {busy
              ? t('leads.intake.working')
              : converting
                ? t('leads.intake.convert.confirm')
                : deleting
                  ? t('leads.intake.delete.confirm')
                  : t('leads.intake.reject.confirm')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
