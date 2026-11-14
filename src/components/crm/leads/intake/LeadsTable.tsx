import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, Check, Pencil, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Lead } from '@/contexts/LeadsContext';
import { cn } from '@/lib/utils';
import {
  describeDate,
  followUpParts,
  formatPhoneForList,
  initialsOf,
  isKgLead,
  isLeadComplete,
  splitName,
} from './intakeForm';
import { canConvertLead, leadOutcome } from './outcome';
import { useRelativeDate } from './useRelativeDate';
import { CALL_RESULTS, channelLabel } from './options';
import { formatCountdown, newLeadCountdown } from './sla';

interface LeadsTableProps {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  /** Open the full profile: every channel in one feed, plus the AI reading. */
  onOpenProfile: (lead: Lead) => void;
  /** Turn the lead into a student. */
  onConvert: (lead: Lead) => void;
  /** Mark the lead as no longer worth working. */
  onReject: (lead: Lead) => void;
  /** Put a rejected lead back into the active list. */
  onRestore: (lead: Lead) => void;
  /** Update call result for a lead. */
  onCallResult: (lead: Lead, result: string) => void;
  /** A write is in flight; the actions are held so none of them fires twice. */
  busy: boolean;
  now: Date;
  /** Show the "Yangi lid" 10-minute countdown on rows that carry one. */
  showCountdown?: boolean;
  /**
   * Which list this is (tab, view, search…). When it changes the table goes
   * back to its first page; while it stays the same, rows already shown stay
   * shown as the list is worked through.
   */
  listKey?: string;
  /**
   * Row checkboxes for moving several leads at once (Lidlar arxivi,
   * 2026-11-14). Left out, the table has no checkboxes.
   */
  selection?: {
    selected: Set<string>;
    onToggle: (id: string) => void;
    /** Select (true) or clear (false) every lead drawn on the page. */
    onToggleAll: (ids: string[], on: boolean) => void;
  };
  /** One-row archive action. Left out, no archive button. */
  onArchive?: (lead: Lead) => void;
  /** The rows are in the archive: the button restores instead of archiving. */
  archived?: boolean;
}

/**
 * Rows drawn at once. The season's working list has over 700 leads, and with
 * every row on the page it was 31 000 elements and more than a second of the
 * browser doing nothing else, on each opening and each change. The list is
 * sorted with today's calls first, so the top is what is being worked; the
 * rest is one press away («Yana … ta ko‘rsatish», as in Xabarlar) and the
 * search still looks through all of them.
 */
export const LEADS_PAGE = 120;

/**
 * Column widths, kept in one place so the header and the rows cannot drift.
 *
 * Fixed widths sized to what each column actually holds — a full phone number,
 * the longest call result ("Telefon ko'tarmadi") — so nothing in them is cut
 * off. Only "Manba" (free text) flexes. The table is wider than the CRM content
 * area on most screens, so the first column (who) and the last (what to do)
 * stay pinned while the middle scrolls: the operator never loses the name or
 * the actions, which used to sit off-screen to the right.
 */
const GRID =
  'grid-cols-[280px_140px_88px_76px_minmax(80px,1fr)_88px_92px_72px_36px_152px_96px_176px]';

/** Pinned cells take the row's own (opaque) background so the middle scrolls under them. */
const PIN_LEFT = 'sticky left-0 z-[1] self-stretch bg-inherit pl-3';
const PIN_RIGHT =
  'sticky right-0 z-10 self-stretch bg-inherit pl-3 pr-3 shadow-[-8px_0_8px_-8px_hsl(var(--foreground)/0.15)]';

/** A dash reads as "not answered"; an empty cell reads as a rendering bug. */
const Cell = ({ value, className }: { value: string | null; className?: string }) => (
  <div className={cn('truncate text-muted-foreground', className)}>{value || '—'}</div>
);

/**
 * Icon buttons: the label is the tooltip and the accessible name. 32px, not the
 * global 44px touch minimum — this is a mouse-driven desktop table, and three
 * 44px buttons would push the row's actions back off the edge.
 */
const actionClass =
  'grid h-8 min-h-0 w-8 min-w-0 flex-none place-items-center rounded-[8px] border ' +
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
  onOpenProfile,
  onConvert,
  onReject,
  onRestore,
  onCallResult,
  busy,
  now,
  showCountdown = false,
  listKey = '',
  selection,
  onArchive,
  archived = false,
}: LeadsTableProps) => {
  const { t } = useTranslation();
  const relative = useRelativeDate(now);
  const [limit, setLimit] = useState(LEADS_PAGE);
  useEffect(() => setLimit(LEADS_PAGE), [listKey]);
  const shown = leads.length > limit ? leads.slice(0, limit) : leads;
  const shownIds = shown.map((l) => l.id);
  const allOn = !!selection && shownIds.length > 0 && shownIds.every((id) => selection.selected.has(id));
  const checkboxClass = 'h-4 w-4 flex-none cursor-pointer accent-[hsl(var(--primary))]';

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <div className="min-w-[1464px]">
        <div
          className={cn(
            'grid items-center gap-x-2 border-b border-border bg-muted py-3',
            'text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground',
            GRID,
          )}
        >
          <div className={cn(PIN_LEFT, 'flex items-center gap-2.5')}>
            {selection && (
              <input
                type="checkbox"
                className={checkboxClass}
                checked={allOn}
                onChange={(e) => selection.onToggleAll(shownIds, e.target.checked)}
                aria-label={t('leads.intake.archive.selectAll')}
              />
            )}
            {t('leads.intake.columns.student')}
          </div>
          <div>{t('leads.intake.columns.phone')}</div>
          <div>{t('leads.intake.columns.channel')}</div>
          <div>{t('leads.intake.columns.city')}</div>
          <div>{t('leads.intake.columns.source')}</div>
          <div>{t('leads.intake.columns.level')}</div>
          <div>{t('leads.intake.columns.semester')}</div>
          <div>{t('leads.intake.columns.cert')}</div>
          <div>{t('leads.intake.columns.age')}</div>
          <div>{t('leads.intake.columns.callResult')}</div>
          <div>{t('leads.intake.columns.status')}</div>
          <div className={PIN_RIGHT}>{t('leads.intake.columns.actions')}</div>
        </div>

        {shown.map((lead) => {
          const complete = isLeadComplete(lead);
          const outcome = leadOutcome(lead);
          const convertible = canConvertLead(lead);
          const followUp = describeDate(lead.next_follow_up ?? '', now);
          const countdown = showCountdown ? newLeadCountdown(lead, now) : null;
          const { firstName } = splitName(lead.full_name);
          return (
            <div
              key={lead.id}
              className={cn(
                // Opaque backgrounds only: the pinned cells inherit this colour,
                // and a see-through one would show the scrolled columns behind them.
                'relative grid w-full items-center gap-x-2 border-b border-border/60 bg-card py-2.5 text-left text-[13px]',
                'transition-colors hover:bg-muted focus-within:bg-muted',
                outcome === 'rejected' && 'text-muted-foreground',
                countdown?.urgent &&
                  'border-l-2 border-l-destructive bg-[color-mix(in_srgb,hsl(var(--destructive))_6%,hsl(var(--card)))]',
                GRID,
              )}
            >
              <button
                type="button"
                onClick={() => onOpenProfile(lead)}
                aria-label={t('leads.intake.openRow', { name: lead.full_name || firstName })}
                className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              />

              <div className={cn('pointer-events-none flex min-w-0 items-center gap-2.5', PIN_LEFT)}>
                {selection && (
                  <input
                    type="checkbox"
                    className={cn(checkboxClass, 'pointer-events-auto relative z-[2]')}
                    checked={selection.selected.has(lead.id)}
                    onChange={() => selection.onToggle(lead.id)}
                    aria-label={`${t('leads.intake.archive.selectRow')}: ${lead.full_name || firstName}`}
                  />
                )}
                <span
                  aria-hidden
                  className="grid h-8 w-8 flex-none place-items-center rounded-full bg-muted text-[11px] font-bold text-primary"
                >
                  {initialsOf(lead.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-semibold text-foreground"
                    title={lead.full_name}
                  >
                    {lead.full_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {relative.addedLabel(lead.created_at)}
                  </span>
                  {followUp && outcome === 'active' && (
                    <span className="block text-xs font-semibold leading-tight text-[hsl(var(--spring))]">
                      {t('leads.intake.followUpPrefix', {
                        when: [relative.label(followUp), followUpParts(lead.next_follow_up).time].filter(Boolean).join(' · '),
                      })}
                    </span>
                  )}
                  {countdown && (
                    <span
                      className={cn(
                        'block truncate text-xs font-semibold tabular-nums',
                        countdown.urgent ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {countdown.waiting
                        ? t('leads.intake.countdownWaiting')
                        : countdown.secondsLeft >= 0
                          ? t('leads.intake.countdownLeft', { time: formatCountdown(countdown.secondsLeft) })
                          : t('leads.intake.countdownOverdue', { time: formatCountdown(countdown.secondsLeft) })}
                    </span>
                  )}
                </span>
                {/* The row opens the profile, so editing needs a handle of its
                    own; it sits by the name, where the eye already is. */}
                <button
                  type="button"
                  onClick={() => onOpen(lead)}
                  aria-label={t('leads.intake.editRow')}
                  title={t('leads.intake.editRow')}
                  className="pointer-events-auto relative z-10 grid h-8 min-h-0 w-8 min-w-0 flex-none place-items-center rounded-[8px] border border-border bg-card text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              {/* Never truncated: the number is what the operator dials. A
                  field holding two numbers wraps onto a second line instead. */}
              <div
                className="pointer-events-none break-words leading-snug tabular-nums text-foreground"
                title={lead.phone ?? undefined}
              >
                {formatPhoneForList(lead.phone) || '—'}
                {isKgLead(lead) && (
                  <span
                    title={t('leads.intake.kgBadgeTitle')}
                    className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 align-middle text-[10px] font-bold text-muted-foreground"
                  >
                    KG
                  </span>
                )}
              </div>

              <div className="pointer-events-none">
                {lead.contact_channel ? (
                  <span className="inline-block whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {channelLabel(lead.contact_channel)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div className="pointer-events-none contents">
                <Cell value={lead.city} />
                <Cell value={lead.how_heard} />
                <Cell value={lead.education_level} />
                <Cell value={lead.target_intake} className="whitespace-nowrap" />
                <Cell value={lead.cert_level} />
                <Cell value={lead.age == null ? null : String(lead.age)} className="tabular-nums" />
              </div>

              <div className="relative z-10">
                <select
                  value={lead.call_result ?? ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    onCallResult(lead, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full cursor-pointer rounded-md border border-input px-1.5 py-1.5 text-xs font-semibold transition',
                    'bg-card focus:outline-none focus:ring-2 focus:ring-ring',
                    !lead.call_result && 'text-muted-foreground',
                  )}
                >
                  <option value="">—</option>
                  {CALL_RESULTS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="pointer-events-none">
                <span
                  className={cn(
                    'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold',
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

              {/* Above the row overlay, so the actions are clickable; pinned to
                  the right edge so they are on screen without scrolling. */}
              <div className={cn('flex items-center justify-end gap-1.5', PIN_RIGHT)}>
                {/* The profile is a read, not an edit, so it sits apart from
                    the convert/reject decisions and never blocks on `busy`. */}
                <button
                  type="button"
                  onClick={() => onOpenProfile(lead)}
                  aria-label={t('leads.intake.openProfile')}
                  title={t('leads.intake.openProfile')}
                  className={cn(actionClass, 'border-border text-muted-foreground hover:bg-muted')}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                </button>
                {onArchive && (
                  <button
                    type="button"
                    onClick={() => onArchive(lead)}
                    disabled={busy}
                    aria-label={archived ? t('leads.intake.archive.restore') : t('leads.intake.archive.action')}
                    title={archived ? t('leads.intake.archive.restore') : t('leads.intake.archive.action')}
                    className={cn(actionClass, 'border-border text-muted-foreground hover:bg-muted')}
                  >
                    {archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                  </button>
                )}
                {outcome === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onConvert(lead)}
                      disabled={busy || !convertible}
                      aria-label={t('leads.intake.convert.action')}
                      title={
                        convertible
                          ? t('leads.intake.convert.action')
                          : t('leads.intake.convert.needsComplete')
                      }
                      className={cn(
                        actionClass,
                        'border-primary/40 text-primary hover:bg-primary/10 disabled:hover:bg-transparent',
                      )}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(lead)}
                      disabled={busy}
                      aria-label={t('leads.intake.reject.action')}
                      title={t('leads.intake.reject.action')}
                      className={cn(
                        actionClass,
                        'border-border text-muted-foreground hover:border-destructive hover:text-destructive',
                      )}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                )}

                {outcome === 'rejected' && (
                  <button
                    type="button"
                    onClick={() => onRestore(lead)}
                    disabled={busy}
                    aria-label={t('leads.intake.restore.action')}
                    title={t('leads.intake.restore.action')}
                    className={cn(actionClass, 'border-border text-muted-foreground hover:bg-muted')}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </button>
                )}

                {outcome === 'converted' && (
                  <span className="text-xs leading-tight text-muted-foreground">
                    {t('leads.intake.convert.done')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {leads.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + LEADS_PAGE)}
          className="sticky left-0 flex w-full items-center justify-center border-t border-border px-3 py-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {t('leads.intake.showMore', { count: leads.length - shown.length })}
        </button>
      )}
    </div>
  );
};
