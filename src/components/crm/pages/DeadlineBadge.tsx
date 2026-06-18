import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle2, CalendarClock } from 'lucide-react';

export type DeadlineStatus = 'closing-soon' | 'open' | 'upcoming' | 'closed' | 'unknown';

export interface DeadlineInfo {
  status: DeadlineStatus;
  daysLeft: number | null;
  label: string;
}

export function getDeadlineInfo(
  applicationStart: string | null | undefined,
  applicationEnd: string | null | undefined,
): DeadlineInfo {
  if (!applicationEnd) {
    return { status: 'unknown', daysLeft: null, label: "Ma'lumot yo'q" };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(applicationEnd);
  end.setHours(0, 0, 0, 0);
  const start = applicationStart ? new Date(applicationStart) : null;
  if (start) start.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { status: 'closed', daysLeft, label: 'Yopilgan' };
  }

  if (start && now < start) {
    const daysUntilOpen = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const startStr = applicationStart!.slice(5, 10).replace('-', '/');
    return { status: 'upcoming', daysLeft: daysUntilOpen, label: `${startStr} da ochiladi` };
  }

  if (daysLeft <= 7) {
    return { status: 'closing-soon', daysLeft, label: `${daysLeft} kun qoldi!` };
  }

  if (daysLeft <= 30) {
    return { status: 'open', daysLeft, label: `${daysLeft} kun qoldi` };
  }

  return { status: 'open', daysLeft, label: `${daysLeft} kun qoldi` };
}

const statusConfig: Record<DeadlineStatus, { variant: string; icon: typeof Clock; className: string }> = {
  'closing-soon': {
    variant: 'destructive',
    icon: AlertTriangle,
    className: 'animate-pulse',
  },
  'open': {
    variant: 'default',
    icon: Clock,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  'upcoming': {
    variant: 'default',
    icon: CalendarClock,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  'closed': {
    variant: 'secondary',
    icon: CheckCircle2,
    className: 'opacity-60',
  },
  'unknown': {
    variant: 'outline',
    icon: Clock,
    className: 'opacity-40',
  },
};

export function DeadlineBadge({ info }: { info: DeadlineInfo }) {
  const config = statusConfig[info.status];
  const Icon = config.icon;

  if (info.status === 'closing-soon') {
    return (
      <Badge variant="destructive" className={`text-[10px] gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {info.label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  );
}
