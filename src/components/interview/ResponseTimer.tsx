import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Timer, AlertTriangle } from 'lucide-react';

interface ResponseTimerProps {
  timeRemaining: number;
  timeLimit: number;
  isActive: boolean;
}

export function ResponseTimer({ timeRemaining, timeLimit, isActive }: ResponseTimerProps) {
  const { t } = useTranslation();
  
  if (!isActive) return null;
  
  const percentage = (timeRemaining / timeLimit) * 100;
  
  const getColor = () => {
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const getTextColor = () => {
    if (percentage > 50) return 'text-green-600 dark:text-green-400';
    if (percentage > 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="w-full space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {percentage <= 25 ? (
            <AlertTriangle className={cn("h-4 w-4", getTextColor())} />
          ) : (
            <Timer className={cn("h-4 w-4", getTextColor())} />
          )}
          <span className={cn("font-medium", getTextColor())}>
            {t('interview.responseTime', 'Response Time')}
          </span>
        </div>
        <span className={cn("font-mono font-bold tabular-nums", getTextColor())}>
          {timeRemaining}s
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000 ease-linear rounded-full", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
