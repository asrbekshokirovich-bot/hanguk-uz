import { useTranslation } from 'react-i18next';
import { Check, RotateCcw, X } from 'lucide-react';
import type { Lead } from '@/contexts/LeadsContext';
import { cn } from '@/lib/utils';
import { describeDate, initialsOf, isLeadComplete, splitName } from './intakeForm';
import { canConvertLead, leadOutcome } from './outcome';
import { useRelativeDate } from './useRelativeDate';

interface LeadsTableProps {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  /** Turn the lead into a student. */
  onConvert: (lead: Lead) => void;
  /** Mark the lead as no longer worth working. */
  onReject: (lead: Lead) => void;
  /** Put a rejected lead back into the active list. */
  onRestore: (lead: Lead) => void;
  /** A write is in flight; the actions are held so none of them fires twice. */
  busy: boolean;
  now: Date;
}

/** Column widths, kept in one place so the header and the rows cannot drift. */
const GRID = 'grid-cols-[2.1fr_1.2fr_1fr_0.9fr_1fr_0.9fr_1fr_0.6fr_0.6fr_1fr_1.4fr]';

/** A dash reads as "not answered"; an empty cell reads as a rendering bug. */
const Cell = ({ value, className }: { value: string | null; className?: string }) => (
  <div className={cn('truncate text-muted-foreground', className)}>{value || '—'}</div>
);

const actionClass =
  'inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-semibold ' +
  'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

/**
 * The leads list: one row per lead, a status chip saying where the record
 * stands, and the two actions that take it off the list.
 *
 * Rows are sorted so the unfinished ones come first — the list exists to get
 * records completed, and burying the incomplete ones under the finished ones
 * would defeat that.
 *
 * The row itself is a plain container with a full-bleed overlay button rather
 * than a `<button>` wrapper, because the action buttons cannot legally nest
 * inside one; the overlay keeps "click anywhere to open" working while the
 * actions sit above it.
 */
export const LeadsTable = ({
  leads,
  onOpen,
  onConvert,
  onReject,
  onRestore,
  busy,
  now,
}: LeadsTableProps) => {
  const { t } = useTranslation();
  const relative = useRelativeDate(now);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <div className="min-w-[1360px]">
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
          <div>{t('leads.intake.columns.actions')}</div>
        </div>

        {leads.map((lead) => {
          const complete = isLeadComplete(lead);
          const outcome = leadOutcome(lead);
          const convertible = canConvertLead(lead);
          const followUp = describeDate(lead.next_follow_up ?? '', now);
          const { firstName } = splitName(lead.full_name);
          return (
            <div
              key={lead.id}
              className={cn(
                'relative grid w-full items-center gap-3.5 border-b border-border/60 px-5 py-3.5 text-left text-sm',
                'transition-colors hover:bg-muted/50 focus-within:bg-muted/50',
                outcome === 'rejected' && 'opacity-70',
                GRID,
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(lead)}
                aria-label={t('leads.intake.openRow', { name: lead.full_name || firstName })}
                className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              />

              <div className="pointer-events-none flex min-w-0 items-center gap-3">
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
                  {followUp && outcome === 'active' && (
                    <span className="mt-0.5 block text-xs font-semibold text-[hsl(var(--spring))]">
                      {t('leads.intake.followUpPrefix', { when: relative.label(followUp) })}
                    </span>
                  )}
                </span>
              </div>

              <div className="pointer-events-none truncate tabular-nums text-foreground">
                {lead.phone || '—'}
              </div>

              <div className="pointer-events-none">
                {lead.contact_channel ? (
                  <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {lead.contact_channel}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div className="pointer-events-none contents">
                <Cell value={lead.city} />
                <Cell value={lead.how_heard} className="text-[13px]" />
                <Cell value={lead.education_level} />
                <Cell value={lead.target_intake} className="whitespace-nowrap" />
                <Cell value={lead.cert_level} />
                <Cell value={lead.age == null ? null : String(lead.age)} className="tabular-nums" />
              </div>

              <div className="pointer-events-none">
                <span
                  className={cn(
                    'inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold',
                    outcome === 'converted' && 'bg-primary text-primary-foreground',
                    outcome === 'rejected' && 'bg-destructive/15 text-destructive',
                    outcome === 'active' &&
                      (complete
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted font-semibold text-muted-foreground'),
                  )}
                >
                  {outcome === 'converted'
                    ? t('leads.intake.status.converted')
                    : outcome === 'rejected'
                      ? t('leads.intake.status.rejected')
                      : complete
                        ? t('leads.intake.status.complete')
                        : t('leads.intake.status.incomplete')}
                </span>
              </div>

              {/* Above the row overlay, so the actions are clickable. */}
              <div className="relative z-10 flex flex-wrap items-center gap-2">
                {outcome === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onConvert(lead)}
                      disabled={busy || !convertible}
                      title={convertible ? undefined : t('leads.intake.convert.needsComplete')}
                      className={cn(
                        actionClass,
                        'border-primary/40 text-primary hover:bg-primary/10 disabled:hover:bg-transparent',
                      )}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      {t('leads.intake.convert.action')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(lead)}
                      disabled={busy}
                      className={cn(
                        actionClass,
                        'border-border text-muted-foreground hover:border-destructive hover:text-destructive',
                      )}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      {t('leads.intake.reject.action')}
                    </button>
                  </>
                )}

                {outcome === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => onRestore(lead)}
                    disabled={busy}
                    className={cn(actionClass, 'border-border text-muted-foreground hover:bg-muted')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    {t('leads.intake.restore.action')}
                  </button>
                )}

                {outcome === 'converted' && (
                  <span className="text-xs text-muted-foreground">
                    {t('leads.intake.convert.done')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
