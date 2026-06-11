import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  GraduationCap,
  FileText,
  Phone,
  MessageSquare,
  ClipboardList,
  DollarSign,
  Trophy,
  Plus,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { UzbekistanRegionalMap } from '@/components/crm/UzbekistanRegionalMap';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CRMDashboardProps {
  isAdmin: boolean;
  isOwner: boolean;
  isCallOperator: boolean;
  isDocumentHandler: boolean;
}

// Soft tooltip styling shared by every chart on the dashboard.
const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  boxShadow: '0 8px 24px hsl(217 62% 12% / 0.08)',
} as const;

const STAT_TONE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
};

const PRIORITY_VARIANT: Record<string, 'destructive' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'destructive',
  high: 'warning',
  normal: 'info',
  low: 'neutral',
};

export function CRMDashboard(_props: CRMDashboardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stats, loading } = useDashboardStats();

  // Humanised stage labels + chart palette for the "by stage" donut.
  const stageMeta: Record<string, { label: string; color: string }> = {
    pending: { label: t('status.pending', { defaultValue: 'Pending' }), color: 'hsl(var(--chart-5))' },
    submitted: { label: t('status.submitted', { defaultValue: 'Submitted' }), color: 'hsl(var(--chart-3))' },
    in_review: { label: t('status.inReview', { defaultValue: 'In review' }), color: 'hsl(var(--chart-1))' },
    completed: { label: t('status.completed', { defaultValue: 'Accepted' }), color: 'hsl(var(--success))' },
    rejected: { label: t('status.rejected', { defaultValue: 'Rejected' }), color: 'hsl(var(--destructive))' },
  };

  const statCards = [
    { label: t('navigation.students'), value: stats.totalStudents, icon: Users, tone: 'primary' },
    { label: t('dashboard.activeApps', { defaultValue: 'Active applications' }), value: stats.activeApplications, icon: GraduationCap, tone: 'info' },
    { label: t('dashboard.acceptances', { defaultValue: 'Acceptances' }), value: stats.completedApplications, icon: Trophy, tone: 'success' },
    { label: t('dashboard.pendingTasks', { defaultValue: 'Pending tasks' }), value: stats.pendingTasks, icon: ClipboardList, tone: 'warning' },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'application':
        return <GraduationCap className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'payment':
        return <DollarSign className="h-4 w-4" />;
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'task':
        return <ClipboardList className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const totalStaged = stats.applicationsByStatus.reduce((sum, s) => sum + s.count, 0);
  const months = stats.applicationsByMonth;

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('navigation.dashboard')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/tasks')}>
            <ClipboardList className="h-4 w-4" />
            {t('navigation.tasks')}
          </Button>
          <Button variant="highlight" onClick={() => navigate('/crm/students')}>
            <Plus className="h-4 w-4" />
            {t('dashboard.newStudent', { defaultValue: 'New Student' })}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-md', STAT_TONE[card.tone])}>
              <card.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-[28px] font-extrabold leading-none tracking-tight text-foreground">
              {card.value}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">{card.label}</div>
          </Card>
        ))}
      </div>

      {/* Charts row: trend + by stage */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.applicationsTrend')}</h2>
            <p className="text-sm text-muted-foreground">{t('dashboard.lastMonths', { defaultValue: 'Last 6 months' })}</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))', radius: 6 }} contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 3, 3]} maxBarSize={48}>
                  {months.map((_, i) => (
                    <Cell key={i} fill={i === months.length - 1 ? 'hsl(var(--accent))' : 'hsl(var(--chart-1))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-semibold text-foreground">{t('dashboard.applicationsByStatus')}</h2>
          <p className="text-sm text-muted-foreground">
            {totalStaged} {t('dashboard.activeApps', { defaultValue: 'Active applications' }).toLowerCase()}
          </p>
          {stats.applicationsByStatus.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('dashboard.noData', { defaultValue: 'No data yet' })}</p>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.applicationsByStatus} dataKey="count" nameKey="status" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                      {stats.applicationsByStatus.map((entry, i) => (
                        <Cell key={i} fill={stageMeta[entry.status]?.color || 'hsl(var(--chart-5))'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-foreground">{totalStaged}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {stats.applicationsByStatus.map((entry) => (
                  <div key={entry.status} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: stageMeta[entry.status]?.color || 'hsl(var(--chart-5))' }} />
                    <span className="flex-1 truncate text-muted-foreground">{stageMeta[entry.status]?.label || entry.status}</span>
                    <span className="font-semibold text-foreground">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity + tasks */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.recentActivity')}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/students')}>
              {t('common.viewAll', { defaultValue: 'View all' })}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {stats.recentActivity.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t('dashboard.noRecentActivity')}</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{activity.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{activity.description}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(activity.timestamp), 'MMM d')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t('navigation.tasks')}</h2>
            <Badge variant={stats.pendingTasks > 0 ? 'destructive' : 'neutral'}>
              {stats.pendingTasks} {t('dashboard.pending')}
            </Badge>
          </div>
          {stats.tasksByPriority.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.noData', { defaultValue: 'No open tasks' })}</p>
          ) : (
            <div className="space-y-1">
              {stats.tasksByPriority.map((task, i) => (
                <button
                  key={task.priority}
                  onClick={() => navigate('/crm/tasks')}
                  className={cn(
                    'flex w-full items-center gap-3 py-2.5 text-left',
                    i < stats.tasksByPriority.length - 1 && 'border-b border-border',
                  )}
                >
                  <span className="flex-1 text-sm font-medium capitalize text-foreground">
                    {t(`tasks.priority.${task.priority}`, { defaultValue: task.priority })}
                  </span>
                  <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'neutral'}>{task.count}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Calls this week */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('dashboard.callsThisWeek')}</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-chart-1" />
              {t('dashboard.incoming')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-chart-3" />
              {t('dashboard.outgoing')}
            </span>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.callsByDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis hide />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))', radius: 6 }} contentStyle={tooltipStyle} />
              <Bar dataKey="incoming" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} maxBarSize={24} name={t('dashboard.incoming')} />
              <Bar dataKey="outgoing" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} maxBarSize={24} name={t('dashboard.outgoing')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Regional analytics (live) */}
      <UzbekistanRegionalMap />
    </div>
  );
}
