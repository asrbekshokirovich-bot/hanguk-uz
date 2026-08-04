import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock } from 'lucide-react';
import { canConvert, missingQualification, MAX_MISSING_TO_CONVERT } from './qualification';
import type { LeadVM } from './types';

interface ConvertPanelProps {
  lead: LeadVM;
  onBook: (lead: LeadVM) => void;
  onConvert: (lead: LeadVM) => void;
  onLost: (lead: LeadVM) => void;
  busy: boolean;
}

/**
 * The three ways a lead leaves the worklist: booked into a consultation,
 * converted into a contract, or marked lost.
 *
 * Convert is gated on the qualification list. Rather than disable the button
 * and leave the operator guessing, the button is replaced by a note naming how
 * many fields are still missing — the block is only useful if it says what
 * would unblock it.
 */
export function ConvertPanel({ lead, onBook, onConvert, onLost, busy }: ConvertPanelProps) {
  const { t } = useTranslation();
  const missing = missingQualification(lead.lead);
  const ready = canConvert(lead.lead);

  return (
    <section className="flex flex-col gap-2 px-4 pb-7 pt-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => onBook(lead)}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-primary text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {t('leads.convertPanel.book')}
      </button>

      {ready ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConvert(lead)}
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-accent text-[13.5px] font-bold text-accent-foreground shadow-card transition-[filter] hover:brightness-105 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {t('leads.convertPanel.convert')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <p className="text-center text-[11.5px] text-muted-foreground">
            {t('leads.convertPanel.convertNote')}
          </p>
        </>
      ) : (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          {t('leads.convertPanel.blocked', {
            count: missing.length - MAX_MISSING_TO_CONVERT,
            fields: missing.map((key) => t(`leads.qualification.${key}`)).join(', '),
          })}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => onLost(lead)}
        className="h-11 rounded-md border border-border text-[12.5px] font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        {t('leads.convertPanel.lost')}
      </button>
    </section>
  );
}
