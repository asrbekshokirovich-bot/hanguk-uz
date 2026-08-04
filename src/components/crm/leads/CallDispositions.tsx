import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { DISPOSITIONS } from './dispositions';
import type { Disposition, LeadVM } from './types';

interface CallDispositionsProps {
  lead: LeadVM;
  onLog: (lead: LeadVM, disposition: Disposition) => void;
  busy: boolean;
}

/**
 * The four call dispositions.
 *
 * Each one bumps the attempt counter, moves the stage, writes to the touch
 * history and triggers a fresh AI plan — so logging the call is the only
 * action an operator has to remember after hanging up.
 *
 * "Reached" is the filled button because it is the outcome the shift is for.
 * "Wrong number" is styled apart and turns destructive on hover: it removes
 * the lead from the worklist, and a destructive action should never sit
 * flush with three routine ones.
 */
export function CallDispositions({ lead, onLog, busy }: CallDispositionsProps) {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border px-4 py-4">
      <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {t('leads.dispositions.title')}
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {DISPOSITIONS.map((disposition) => (
          <button
            key={disposition}
            type="button"
            disabled={busy}
            onClick={() => onLog(lead, disposition)}
            className={cn(
              'h-11 rounded-md text-[12.5px] font-semibold transition-colors disabled:opacity-60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              disposition === 'reached'
                ? 'bg-primary text-primary-foreground hover:brightness-110'
                : disposition === 'wrong_number'
                  ? 'border border-border text-muted-foreground hover:border-destructive hover:text-destructive'
                  : 'border border-border text-foreground hover:bg-muted',
            )}
          >
            {t(`leads.dispositions.${disposition}`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-muted-foreground">
        {t('leads.dispositions.attemptsNote', {
          count: lead.attempts,
          owner: lead.owner ?? t('leads.unassigned'),
        })}
      </p>
    </section>
  );
}
