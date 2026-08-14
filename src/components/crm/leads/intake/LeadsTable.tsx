import { useTranslation } from 'react-i18next';
import type { Lead } from '@/contexts/LeadsContext';
import { cn } from '@/lib/utils';
import { describeDate, initialsOf, isLeadComplete, splitName } from './intakeForm';
import { useRelativeDate } from './useRelativeDate';

interface LeadsTableProps {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  now: Date;
}

/** Column widths, kept in one place so the header and the rows cannot drift. */
const GRID = 'grid-cols-[2.1fr_1.2fr_1fr_0.9fr_1fr_0.9fr_1fr_0.6fr_0.6fr_1fr]';

/** A dash reads as "not answered"; an empty cell reads as a rendering bug. */
const Cell = ({ value, className }: { value: string | null; className?: string }) => (
  <div className={cn('truncate text-muted-foreground', className)}>{value || '—'}</div>
);

/**
 * The leads list: one row per lead, and a status chip saying whether the record
 * is fully answered.
 *
 * The chip is the point of the screen. Rows are sorted so the unfinished ones
 * come first — the list exists to get records completed, and burying the
 * incomplete ones under the finished ones would defeat that.
 */
export const LeadsTable = ({ leads, onOpen, now }: LeadsTableProps) => {
  const { t } = useTranslation();
  const relative = useRelativeDate(now);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <div className="min-w-[1180px]">
        <div
          className={cn(
            'grid gap-3.5 border-b border-border bg-muted/60 px-5 py-3.5',
            'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground',
            GRID,
          )}
        >
          <div>{t('leads.intake.columns.student')}</div>
          <div>{t('leads.intake.columns.phone')}</div>
          <div>{t('leads.intake.columns.channel')}</div>
          <div>{t('leads.intake.columns.city')}</div>
          <div>{t('leads.intake.columns.source')}</div>
          <div>{t('leads.intake.columns.level')}</div>
          <div>{t('leads.intake.columns.semester')}</div>
          <div>{t('leads.intake.columns.cert')}</div>
          <div>{t('leads.intake.columns.age')}</div>
          <div>{t('leads.intake.columns.status')}</div>
        </div>

        {leads.map((lead) => {
          const complete = isLeadComplete(lead);
          const followUp = describeDate(lead.next_follow_up ?? '', now);
          const { firstName } = splitName(lead.full_name);
          return (
            <button
              key={lead.id}
              type="button"
              onClick={() => onOpen(lead)}
              aria-label={t('leads.intake.openRow', { name: lead.full_name || firstName })}
              className={cn(
                'grid w-full items-center gap-3.5 border-b border-border/60 px-5 py-3.5 text-left text-sm',
                'transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                GRID,
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 flex-none place-items-center rounded-full bg-muted text-xs font-bold text-primary"
                >
                  {initialsOf(lead.full_name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">
                    {lead.full_name}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {relative.addedLabel(lead.created_at)}
                  </span>
                  {followUp && (
                    <span className="mt-0.5 block text-xs font-semibold text-[hsl(var(--spring))]">
                      {t('leads.intake.followUpPrefix', { when: relative.label(followUp) })}
                    </span>
                  )}
                </span>
              </div>

              <div className="truncate tabular-nums text-foreground">{lead.phone || '—'}</div>

              <div>
                {lead.contact_channel ? (
                  <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {lead.contact_channel}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <Cell value={lead.city} />
              <Cell value={lead.how_heard} className="text-[13px]" />
              <Cell value={lead.education_level} />
              <Cell value={lead.target_intake} className="whitespace-nowrap" />
              <Cell value={lead.cert_level} />
              <Cell value={lead.age == null ? null : String(lead.age)} className="tabular-nums" />

              <div>
                <span
                  className={cn(
                    'inline-block rounded-full px-3 py-1 text-xs font-bold',
                    complete
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted font-semibold text-muted-foreground',
                  )}
                >
                  {complete
                    ? t('leads.intake.status.complete')
                    : t('leads.intake.status.incomplete')}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
