import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvestorSeason } from '@/contexts/InvestorSeasonContext';

/**
 * Season selector for the investor topbar.
 *
 * Not SeasonSwitcher: that one steps through years off public.intakes, which an
 * investor session cannot read, and it would offer seasons below her visibility
 * floor. This lists exactly what v_investor_intakes returns.
 */
export function InvestorSeasonSwitcher({ className }: { className?: string }) {
  const { intakes, activeIntake, setActiveIntakeId, isLoading } = useInvestorSeason();

  if (isLoading && !activeIntake) {
    return <Skeleton className={cn('h-11 w-[190px] rounded-md', className)} />;
  }
  if (!activeIntake) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn('h-11 gap-2 px-3 text-[13px] font-semibold', className)}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeIntake.label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {intakes.map((intake) => {
          const selected = intake.intake_id === activeIntake.intake_id;
          return (
            <DropdownMenuItem
              key={intake.intake_id}
              onSelect={() => setActiveIntakeId(intake.intake_id)}
              className="gap-2 text-[13px] font-medium"
            >
              <Check className={cn('h-4 w-4 shrink-0', !selected && 'opacity-0')} />
              <span className="flex-1 truncate">{intake.label}</span>
              {intake.is_open && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Open
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
