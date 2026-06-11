import { useTranslation } from 'react-i18next';
import { Sun, Leaf, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveIntake, type Season } from '@/contexts/IntakeContext';

const SEASONS: Season[] = ['spring', 'fall'];

/**
 * Global season (intake) switcher for the CRM top bar.
 * Segmented Spring | Fall (one click switches) + a compact year stepper.
 * Spring = lime sun, Fall = amber leaf. Seasons that don't exist for the
 * shown year are disabled. Selecting re-scopes the entire app via IntakeContext.
 */
export function SeasonSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { activeIntake, availableYears, selectSeasonYear, intakeFor, isLoading } = useActiveIntake();

  if (isLoading && !activeIntake) {
    return <Skeleton className={cn('h-9 w-[180px] rounded-md', className)} />;
  }
  if (!activeIntake) return null;

  const shownYear = activeIntake.year;
  const idx = availableYears.indexOf(shownYear);
  const prevYear = idx > 0 ? availableYears[idx - 1] : null;
  const nextYear = idx >= 0 && idx < availableYears.length - 1 ? availableYears[idx + 1] : null;

  const stepYear = (dir: -1 | 1) => {
    const target = dir === -1 ? prevYear : nextYear;
    if (target == null) return;
    // Prefer the same season in the new year; otherwise jump to whichever exists.
    const same = activeIntake.season as Season;
    if (intakeFor(same, target)) selectSeasonYear(same, target);
    else if (intakeFor('spring', target)) selectSeasonYear('spring', target);
    else if (intakeFor('fall', target)) selectSeasonYear('fall', target);
  };

  return (
    <div
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-1',
        className,
      )}
      role="group"
      aria-label={t('intake.label')}
    >
      {/* Segmented Spring | Fall — one click switches */}
      <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
        {SEASONS.map((s) => {
          const exists = !!intakeFor(s, shownYear);
          const on = activeIntake.season === s && activeIntake.year === shownYear;
          const Icon = s === 'spring' ? Sun : Leaf;
          return (
            <button
              key={s}
              type="button"
              disabled={!exists}
              onClick={() => selectSeasonYear(s, shownYear)}
              title={`${t(`intake.season.${s}`)} ${shownYear}`}
              aria-pressed={on}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold transition-colors',
                on
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                !exists && 'cursor-not-allowed opacity-40 hover:text-muted-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  on ? (s === 'spring' ? 'text-spring' : 'text-fall') : 'text-muted-foreground',
                )}
              />
              <span className="hidden sm:inline">{t(`intake.season.${s}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Year stepper */}
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => stepYear(-1)}
          disabled={prevYear == null}
          aria-label={t('intake.previousYear')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[2.25rem] text-center font-mono text-[13px] font-bold tabular-nums text-foreground">
          {shownYear}
        </span>
        <button
          type="button"
          onClick={() => stepYear(1)}
          disabled={nextYear == null}
          aria-label={t('intake.nextYear')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default SeasonSwitcher;
