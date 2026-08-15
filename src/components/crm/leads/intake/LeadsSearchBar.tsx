import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CERTIFICATES,
  CHANNELS,
  CITIES,
  LEVELS,
  SOURCES,
  semesterOptions,
} from './options';
import {
  type Completeness,
  type FollowUpWindow,
  type LeadFilters,
  EMPTY_FILTERS,
  activeFilterCount,
  hasActiveSearch,
} from './leadSearch';

interface LeadsSearchBarProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  /** Whether the filter drawer is open — lifted so it survives a re-render. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many leads survived, for the summary line. */
  resultCount: number;
  now: Date;
}

const selectClass =
  'h-10 w-full rounded-[10px] border border-input bg-background px-2.5 text-[13px] text-foreground ' +
  'outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/35';

const Picker = ({
  id,
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  anyLabel: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-[12px] font-semibold text-muted-foreground">
      {label}
    </label>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(selectClass, value && 'border-primary/50 font-semibold')}
    >
      <option value="">{anyLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

/**
 * Search and filters for the leads list.
 *
 * The text box is always visible because it answers the common question — *is
 * this person already in here?* — while the pickers, which answer the planning
 * questions, stay folded away behind a toggle that carries a count of how many
 * are narrowing the list. A filter that is hidden *and* silent is how an
 * operator ends up staring at an list that looks empty.
 *
 * Filtering runs over the already-loaded leads rather than re-querying: the
 * page holds the whole intake in memory anyway, and a round trip per keystroke
 * would make the box feel broken on an office connection.
 */
export const LeadsSearchBar = ({
  filters,
  onChange,
  open,
  onOpenChange,
  resultCount,
  now,
}: LeadsSearchBarProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const semesters = useMemo(() => semesterOptions(now), [now]);
  const count = activeFilterCount(filters);
  const searching = hasActiveSearch(filters);

  // "/" jumps to the box, the way every list this operator uses already works.
  // Ignored while they are typing somewhere else, so it cannot eat a slash.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const set = <K extends keyof LeadFilters>(key: K) => (value: LeadFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={filters.query}
            onChange={(event) => set('query')(event.target.value)}
            placeholder={t('leads.intake.search.placeholder')}
            aria-label={t('leads.intake.search.label')}
            className="h-11 w-full rounded-[10px] border border-input bg-background pl-9 pr-9 text-[15px] outline-none transition focus:border-accent focus:ring-[3px] focus:ring-accent/35"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => set('query')('')}
              aria-label={t('leads.intake.search.clearQuery')}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls="leads-filter-panel"
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-4 text-[13px] font-semibold transition',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            count > 0
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input text-muted-foreground hover:bg-muted',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {t('leads.intake.search.filters')}
          {count > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </button>

        {searching && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="min-h-11 rounded-[10px] px-3 text-[13px] font-semibold text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('leads.intake.search.clearAll')}
          </button>
        )}
      </div>

      {open && (
        <div
          id="leads-filter-panel"
          className="grid gap-4 rounded-[14px] border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Picker
            id="filter-city"
            label={t('leads.intake.columns.city')}
            value={filters.city}
            options={CITIES}
            anyLabel={t('leads.intake.search.any')}
            onChange={set('city')}
          />
          <Picker
            id="filter-channel"
            label={t('leads.intake.columns.channel')}
            value={filters.channel}
            options={CHANNELS}
            anyLabel={t('leads.intake.search.any')}
            onChange={set('channel')}
          />
          <Picker
            id="filter-source"
            label={t('leads.intake.columns.source')}
            value={filters.source}
            options={SOURCES}
            anyLabel={t('leads.intake.search.any')}
            onChange={set('source')}
          />
          <Picker
            id="filter-level"
            label={t('leads.intake.columns.level')}
            value={filters.level}
            options={LEVELS}
            anyLabel={t('leads.intake.search.any')}
            onChange={set('level')}
          />
          <Picker
            id="filter-semester"
            label={t('leads.intake.columns.semester')}
            value={filters.semester}
            options={semesters}
            anyLabel={t('leads.intake.search.any')}
            onChange={set('semester')}
          />
          <Picker
            id="filter-cert"
            label={t('leads.intake.columns.cert')}
            value={filters.cert}
            options={CERTIFICATES}
            anyLabel={t('leads.intake.search.any')}
            onChange={set('cert')}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="filter-completeness"
              className="text-[12px] font-semibold text-muted-foreground"
            >
              {t('leads.intake.columns.status')}
            </label>
            <select
              id="filter-completeness"
              value={filters.completeness}
              onChange={(event) => set('completeness')(event.target.value as Completeness)}
              className={cn(
                selectClass,
                filters.completeness !== 'any' && 'border-primary/50 font-semibold',
              )}
            >
              <option value="any">{t('leads.intake.search.any')}</option>
              <option value="complete">{t('leads.intake.status.complete')}</option>
              <option value="incomplete">{t('leads.intake.status.incomplete')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="filter-follow-up"
              className="text-[12px] font-semibold text-muted-foreground"
            >
              {t('leads.intake.fields.followUp')}
            </label>
            <select
              id="filter-follow-up"
              value={filters.followUp}
              onChange={(event) => set('followUp')(event.target.value as FollowUpWindow)}
              className={cn(
                selectClass,
                filters.followUp !== 'any' && 'border-primary/50 font-semibold',
              )}
            >
              <option value="any">{t('leads.intake.search.any')}</option>
              <option value="overdue">{t('leads.intake.search.followUp.overdue')}</option>
              <option value="today">{t('leads.intake.search.followUp.today')}</option>
              <option value="week">{t('leads.intake.search.followUp.week')}</option>
              <option value="none">{t('leads.intake.search.followUp.none')}</option>
            </select>
          </div>

          <p className="text-[12px] leading-relaxed text-muted-foreground sm:col-span-2 lg:col-span-4">
            {t('leads.intake.search.hint')}
          </p>
        </div>
      )}

      {searching && (
        <p role="status" className="text-[13px] text-muted-foreground">
          {t('leads.intake.search.results', { count: resultCount })}
        </p>
      )}
    </div>
  );
};
