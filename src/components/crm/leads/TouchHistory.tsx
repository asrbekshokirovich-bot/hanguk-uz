import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import type { LeadVM } from './types';

/**
 * Every touch on the lead, newest first — calls, messages, walk-ins, and the
 * notes the worklist itself writes when a disposition is logged or the AI
 * re-plans the next call. It is the audit trail for both.
 */
export function TouchHistory({ lead }: { lead: LeadVM }) {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border px-4 py-4">
      <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {t('leads.detail.historyTitle')}
      </h3>

      {lead.history.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{t('leads.detail.historyEmpty')}</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {lead.history.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-muted-foreground">{entry.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                  {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
