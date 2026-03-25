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
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('payments.paidAmount')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatAmount(stats.totalCollected, 'UZS')}
                </p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {stats.completedCount} completed payments
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('payments.pending')}</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatAmount(stats.totalPending, 'UZS')}
                </p>
              </div>
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-yellow-600">
              <Calendar className="h-3 w-3 mr-1" />
              {expectedStats.dueThisWeekCount} due this week
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('payments.overdue')}</p>
                <p className="text-2xl font-bold text-red-600">
                  {expectedStats.overdueCount}
                </p>
              </div>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-red-600">
              <ArrowDownRight className="h-3 w-3 mr-1" />
              Requires immediate attention
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-blue-600">
                  {expectedStats.remainingUZS > 0 
                    ? formatAmount(expectedStats.remainingUZS, 'UZS')
                    : expectedStats.totalPending}
                </p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-blue-600">
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
