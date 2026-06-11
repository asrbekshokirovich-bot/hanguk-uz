import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Target,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Payment } from '@/hooks/usePayments';
import { 
  getPlanByValue, 
  formatAmount,
  getPlanPrice,
  PAYMENT_PLANS,
  isPaymentOverdue
} from '@/hooks/useStudentPlan';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

interface FinanceReportsProps {
  students: Tables<'profiles'>[];
  payments: Payment[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function FinanceReports({ students, payments }: FinanceReportsProps) {
  const { t } = useTranslation();

  // Monthly income trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 5);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthPayments = payments.filter(p => {
        if (!p.paid_at) return false;
        const paidDate = new Date(p.paid_at);
        return paidDate >= monthStart && paidDate <= monthEnd;
      });

      const uzsTotal = monthPayments
        .filter(p => p.currency === 'UZS')
        .reduce((sum, p) => sum + Number(p.paid_amount), 0);
      
      const usdTotal = monthPayments
        .filter(p => p.currency === 'USD')
        .reduce((sum, p) => sum + Number(p.paid_amount), 0);

      return {
        month: format(month, 'MMM'),
        uzs: uzsTotal / 1000000, // In millions
        usd: usdTotal,
      };
    });
  }, [payments]);

  // Plan distribution
  const planDistribution = useMemo(() => {
    const studentsWithPlans = students.filter(s => s.payment_plan);
    
    return PAYMENT_PLANS.map(plan => {
      const count = studentsWithPlans.filter(
        s => s.payment_plan?.toLowerCase() === plan.value
      ).length;
      
      return {
        name: plan.label,
        value: count,
        isVIP: plan.isVIP,
      };
    }).filter(d => d.value > 0);
  }, [students]);

  // Collection rate by plan
  const collectionRates = useMemo(() => {
    const studentsWithPlans = students.filter(s => s.payment_plan);
    
    return PAYMENT_PLANS.map(plan => {
      const planStudents = studentsWithPlans.filter(
        s => s.payment_plan?.toLowerCase() === plan.value
      );

      let expected = 0;
      let collected = 0;

      planStudents.forEach(student => {
        const mode = student.payment_mode || 'one_time';
        const { amount } = getPlanPrice(plan.value, mode);
        expected += amount;

        const studentPayments = payments.filter(p => p.student_id === student.user_id);
        const paid = studentPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
        collected += paid;
      });

      const rate = expected > 0 ? (collected / expected) * 100 : 0;

      return {
        plan: plan.label,
        expected,
        collected,
        rate: Math.round(rate),
        currency: plan.currency,
      };
    });
  }, [students, payments]);

  // Overdue payments list
  const overduePayments = useMemo(() => {
    return payments
      .filter(p => {
        if (p.status === 'completed') return false;
        return isPaymentOverdue(p.due_date, p.status);
      })
      .sort((a, b) => {
        if (!a.due_date || !b.due_date) return 0;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      })
      .slice(0, 10);
  }, [payments]);

  // Payment status distribution
  const statusDistribution = useMemo(() => {
    const completed = payments.filter(p => p.status === 'completed').length;
    const partial = payments.filter(p => p.status === 'partial').length;
    const pending = payments.filter(p => p.status === 'pending').length;
    const overdue = payments.filter(p => p.status === 'overdue' || 
      (p.status !== 'completed' && isPaymentOverdue(p.due_date, p.status))).length;

    return [
      { name: 'Completed', value: completed, color: '#10b981' },
      { name: 'Partial', value: partial, color: '#f59e0b' },
      { name: 'Pending', value: pending, color: '#6b7280' },
      { name: 'Overdue', value: overdue, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [payments]);

  return (
    <div className="space-y-6">
      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Income Trend
          </CardTitle>
          <CardDescription>Payment collections over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'uzs' ? `${value.toFixed(1)}M UZS` : `$${value} USD`,
                    name === 'uzs' ? 'UZS' : 'USD'
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="uzs" name="UZS (Millions)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="usd" name="USD" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Students by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {planDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection Rates by Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Collection Rate by Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {collectionRates.map(({ plan, expected, collected, rate, currency }) => (
              <div key={plan} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{plan}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatAmount(collected, currency)} / {formatAmount(expected, currency)}
                    </span>
                  </div>
                  <span className="font-medium">{rate}%</span>
                </div>
                <Progress value={rate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Payments */}
      {overduePayments.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Overdue Payments ({overduePayments.length})
            </CardTitle>
            <CardDescription>
              Payments that require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overduePayments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between p-3 bg-destructive/10 dark:bg-destructive/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{payment.student?.full_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {payment.due_date ? format(new Date(payment.due_date), 'MMM d, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-destructive">
                      {formatAmount(Number(payment.amount) - Number(payment.paid_amount), payment.currency)}
                    </p>
                    <Badge variant="destructive" className="text-xs">Overdue</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
