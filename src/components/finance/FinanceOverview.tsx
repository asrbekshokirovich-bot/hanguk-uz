import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, 
  Clock, 
  Calendar,
  AlertTriangle,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { usePayments } from '@/hooks/usePayments';
import { useCRMData } from '@/hooks/useCRMData';
import { useExpectedPayments } from '@/hooks/useExpectedPayments';
import { formatAmount } from '@/hooks/useStudentPlan';
import { PlannedIncomePanel } from './PlannedIncomePanel';
import { ManualTransactionDialog } from './ManualTransactionDialog';

export function FinanceOverview() {
  const { t } = useTranslation();
  const { payments, stats, loading: paymentsLoading, fetchPayments } = usePayments();
  const { students, loading: studentsLoading } = useCRMData();
  const { stats: expectedStats } = useExpectedPayments(students, payments);
  
  const loading = paymentsLoading || studentsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('navigation.payments')}</h1>
          <p className="text-muted-foreground">Complete finance overview and payment tracking</p>
        </div>
        <ManualTransactionDialog 
          students={students}
          onSuccess={fetchPayments}
        />
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('payments.paidAmount')}</p>
                <p className="text-2xl font-bold text-success">
                  {formatAmount(stats.totalCollected, 'UZS')}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-success">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {stats.completedCount} completed payments
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('payments.pending')}</p>
                <p className="text-2xl font-bold text-warning">
                  {formatAmount(stats.totalPending, 'UZS')}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10 text-warning">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-warning">
              <Calendar className="h-3 w-3 mr-1" />
              {expectedStats.dueThisWeekCount} due this week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('payments.overdue')}</p>
                <p className="text-2xl font-bold text-destructive">
                  {expectedStats.overdueCount}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-destructive">
              <ArrowDownRight className="h-3 w-3 mr-1" />
              Requires immediate attention
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-info">
                  {expectedStats.remainingUZS > 0
                    ? formatAmount(expectedStats.remainingUZS, 'UZS')
                    : expectedStats.totalPending}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-info/10 text-info">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-info">
              <Users className="h-3 w-3 mr-1" />
              {expectedStats.notStartedCount} not started, {expectedStats.partialCount} partial
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Planned Income Panel */}
      <PlannedIncomePanel 
        students={students} 
        payments={payments}
        loading={loading}
      />
    </div>
  );
}
