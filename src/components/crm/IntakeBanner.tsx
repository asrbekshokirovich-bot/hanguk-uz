import { useTranslation } from 'react-i18next';
import { Sun, Leaf, CalendarRange } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useActiveIntake } from '@/contexts/IntakeContext';

/**
 * The active-intake banner shown on the Dashboard and Applications pages.
 * Names the season, shows Open/Planning, and reminds staff that data is
 * separated per intake. Spring = lime, Fall = amber (semantic tokens).
 */
export function IntakeBanner({
  onManage,
  className,
}: {
  onManage?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { activeIntake, isLoading } = useActiveIntake();

  if (isLoading && !activeIntake) {
    return <Skeleton className={cn('h-[88px] w-full rounded-md', className)} />;
  }
  if (!activeIntake) return null;

  const isSpring = activeIntake.season === 'spring';
  const seasonLabel = t(`intake.season.${activeIntake.season}`);
  // Literal class strings (per branch) so Tailwind keeps the season utilities.
  const tone = isSpring
    ? { wrap: 'border-spring/30 bg-spring/10', tile: 'bg-spring/20 text-spring', Icon: Sun }
    : { wrap: 'border-fall/30 bg-fall/10', tile: 'bg-fall/20 text-fall', Icon: Leaf };

  return (
    <div className={cn('flex flex-wrap items-center gap-4 rounded-md border p-4', tone.wrap, className)}>
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-md', tone.tile)}>
        <tone.Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            {t('intake.banner.title', { season: seasonLabel, year: activeIntake.year })}
          </span>
          <Badge variant={activeIntake.is_open ? 'successSoft' : 'neutral'}>
            {t(activeIntake.is_open ? 'intake.status.open' : 'intake.status.planning')}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('intake.banner.subtitle')}</p>
      </div>
      {onManage && (
        <Button variant="outline" size="sm" onClick={onManage} className="shrink-0">
          <CalendarRange className="h-4 w-4" />
          {t('intake.manage')}
        </Button>
      )}
    </div>
  );
}

export default IntakeBanner;
