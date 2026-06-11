import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  DollarSign,
  Users,
  Target,
  Calendar
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Payment } from '@/hooks/usePayments';
import { 
  getPlanByValue, 
  formatAmount,
  getPlanPrice,
  PAYMENT_PLANS,
  normalizePlanName
} from '@/hooks/useStudentPlan';

interface PlannedIncomePanelProps {
  students: (Tables<'profiles'> & { 
    applications?: Tables<'applications'>[]; 
  })[];
  payments: Payment[];
  loading: boolean;
}

export function PlannedIncomePanel({ students, payments, loading }: PlannedIncomePanelProps) {
  const { t } = useTranslation();

  const incomeStats = useMemo(() => {
    // Students with payment plans
    const studentsWithPlans = students.filter(s => s.payment_plan);

    // Group by plan - use centralized normalizePlanName from useStudentPlan
    const byPlan = PAYMENT_PLANS.map(plan => {
      const planStudents = studentsWithPlans.filter(
        s => normalizePlanName(s.payment_plan) === plan.value
      );
      
      // Calculate expected income
      let expectedTotal = 0;
      planStudents.forEach(student => {
        const mode = student.payment_mode || 'one_time';
        const { amount } = getPlanPrice(plan.value, mode);
        expectedTotal += amount;
      });

      // Calculate collected
      let collectedTotal = 0;
      planStudents.forEach(student => {
        const studentPayments = payments.filter(p => p.student_id === student.user_id);
        const paid = studentPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
        collectedTotal += paid;
      });

      const progress = expectedTotal > 0 ? (collectedTotal / expectedTotal) * 100 : 0;

      return {
        plan,
        studentCount: planStudents.length,
        expectedTotal,
        collectedTotal,
        progress: Math.min(progress, 100),
        remaining: expectedTotal - collectedTotal,
      };
    });

    // Total across all plans
    const totalExpected = byPlan.reduce((sum, p) => sum + p.expectedTotal, 0);
    const totalCollected = byPlan.reduce((sum, p) => sum + p.collectedTotal, 0);

    // Split by currency
    const uzsData = byPlan.filter(p => p.plan.currency === 'UZS');
    const usdData = byPlan.filter(p => p.plan.currency === 'USD');

    const uzsExpected = uzsData.reduce((sum, p) => sum + p.expectedTotal, 0);
    const uzsCollected = uzsData.reduce((sum, p) => sum + p.collectedTotal, 0);
    const usdExpected = usdData.reduce((sum, p) => sum + p.expectedTotal, 0);
    const usdCollected = usdData.reduce((sum, p) => sum + p.collectedTotal, 0);

    // Students by payment mode
    const oneTimeStudents = studentsWithPlans.filter(s => s.payment_mode !== 'installment');
    const installmentStudents = studentsWithPlans.filter(s => s.payment_mode === 'installment');

    return {
      byPlan,
      totalExpected,
      totalCollected,
      uzsExpected,
      uzsCollected,
      usdExpected,
      usdCollected,
      studentsWithPlans: studentsWithPlans.length,
      oneTimeCount: oneTimeStudents.length,
      installmentCount: installmentStudents.length,
    };
  }, [students, payments]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-40 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* UZS Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              UZS Income
            </CardTitle>
            <CardDescription>FREE, STANDART & PREMIUM plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Collected</p>
                  <p className="text-2xl font-bold">{formatAmount(incomeStats.uzsCollected, 'UZS')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Expected</p>
                  <p className="text-lg font-medium">{formatAmount(incomeStats.uzsExpected, 'UZS')}</p>
                </div>
              </div>
              <Progress 
                value={incomeStats.uzsExpected > 0 
                  ? (incomeStats.uzsCollected / incomeStats.uzsExpected) * 100 
                  : 0
                } 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {incomeStats.uzsExpected > 0 
                  ? `${Math.round((incomeStats.uzsCollected / incomeStats.uzsExpected) * 100)}% collected`
                  : 'No UZS payments expected'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* USD Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              USD Income
            </CardTitle>
            <CardDescription>NO RISK plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Collected</p>
                  <p className="text-2xl font-bold">{formatAmount(incomeStats.usdCollected, 'USD')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Expected</p>
                  <p className="text-lg font-medium">{formatAmount(incomeStats.usdExpected, 'USD')}</p>
                </div>
              </div>
              <Progress 
                value={incomeStats.usdExpected > 0 
                  ? (incomeStats.usdCollected / incomeStats.usdExpected) * 100 
                  : 0
                } 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {incomeStats.usdExpected > 0 
                  ? `${Math.round((incomeStats.usdCollected / incomeStats.usdExpected) * 100)}% collected`
                  : 'No USD payments expected'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Plan Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Income by Plan
          </CardTitle>
          <CardDescription>
            Collection progress for each payment plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {incomeStats.byPlan.map(({ plan, studentCount, expectedTotal, collectedTotal, progress, remaining }) => (
              <div key={plan.value} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={plan.isVIP ? 'default' : 'secondary'}>
                      {plan.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {studentCount} students
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatAmount(collectedTotal, plan.currency)}</span>
                    <span className="text-muted-foreground"> / {formatAmount(expectedTotal, plan.currency)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={progress} className="flex-1 h-2" />
                  <span className="text-sm font-medium w-12 text-right">{Math.round(progress)}%</span>
                </div>
                {remaining > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Remaining: {formatAmount(remaining, plan.currency)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Mode Distribution */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{incomeStats.studentsWithPlans}</p>
                <p className="text-sm text-muted-foreground">Total Students with Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{incomeStats.oneTimeCount}</p>
                <p className="text-sm text-muted-foreground">One-time Payment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-info/10 rounded-lg">
                <Calendar className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{incomeStats.installmentCount}</p>
                <p className="text-sm text-muted-foreground">Split Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
