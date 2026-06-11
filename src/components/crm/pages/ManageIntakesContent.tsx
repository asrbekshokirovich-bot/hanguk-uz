import { useTranslation } from 'react-i18next';
import { Sun, Leaf, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useActiveIntake } from '@/contexts/IntakeContext';

/**
 * Manage intakes — Phase 2 read-only view: list every season with its
 * Open/Planning + Default status and let staff make one the active intake.
 * Open/close, set-default and "create next year" land in a later phase.
 */
export default function ManageIntakesContent() {
  const { t } = useTranslation();
  const { intakes, activeIntakeId, setActiveIntakeId, isLoading } = useActiveIntake();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('intake.manage')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('intake.banner.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intakes.map((intake) => {
            const isSpring = intake.season === 'spring';
            const on = intake.id === activeIntakeId;
            const Icon = isSpring ? Sun : Leaf;
            return (
              <button
                key={intake.id}
                type="button"
                onClick={() => setActiveIntakeId(intake.id)}
                aria-pressed={on}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                  on ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted/50',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                    isSpring ? 'bg-spring/15 text-spring' : 'bg-fall/15 text-fall',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">
                    {t(`intake.season.${intake.season}`)} {intake.year}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant={intake.is_open ? 'successSoft' : 'neutral'}>
                      {t(intake.is_open ? 'intake.status.open' : 'intake.status.planning')}
                    </Badge>
                    {intake.is_default ? <Badge variant="info">{t('intake.default')}</Badge> : null}
                  </div>
                </div>
                {on ? <Check className="h-5 w-5 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('intake.manageHint')}</p>
    </div>
  );
}
