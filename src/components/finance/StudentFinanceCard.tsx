import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  CreditCard,
  GraduationCap
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Payment } from '@/hooks/usePayments';
import { 
  getPlanByValue, 
  formatAmount,
  getPaymentSchedule,
  isPaymentOverdue,
  getDaysUntilDue,
  calculateFirstPaymentDueDate
} from '@/hooks/useStudentPlan';
import { format } from 'date-fns';

interface StudentFinanceCardProps {
  student: Tables<'profiles'> & {
    applications?: (Tables<'applications'> & {
      university?: Tables<'universities'>;
    })[];
  };
  payments: Payment[];
  onRecordPayment?: () => void;
  onViewDetails?: () => void;
}

export function StudentFinanceCard({ 
  student, 
  payments,
  onRecordPayment,
  onViewDetails 
}: StudentFinanceCardProps) {
  const { t } = useTranslation();
  const plan = getPlanByValue(student.payment_plan || '');
  const paymentMode = student.payment_mode || 'one_time';
  const isInstallment = paymentMode === 'installment';

  const financeData = useMemo(() => {
    if (!plan) return null;

    const schedule = getPaymentSchedule(student.payment_plan || '', paymentMode, student.contract_date);
    if (!schedule) return null;

    // Get actual payments for this student
    const studentPayments = payments.filter(p => p.student_id === student.user_id);
    const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
    const totalGatewayFees = studentPayments.reduce((sum) => {
      // Assuming 2% average gateway fee if not tracked
      return sum;
    }, 0);

    // Check payment status
    const firstPayment = studentPayments.find(p => 
      p.payment_type === 'initial_deposit'
    );
    const secondPayment = studentPayments.find(p => 
      p.payment_type === 'remaining_payment'
    );

    const firstPaymentStatus = firstPayment?.status || 'pending';
    const secondPaymentStatus = secondPayment?.status || (isInstallment ? 'waiting' : 'not_applicable');

    // Check if student has been admitted
    const hasAdmission = student.applications?.some(
      app => app.status === 'university_response' || 
             app.status === 'admission_letter' ||
             app.status === 'visa_documents' ||
             app.status === 'completed'
    );

    return {
      schedule,
      totalExpected: schedule.totalAmount,
      totalPaid,
      netIncome: totalPaid - totalGatewayFees,
      progress: schedule.totalAmount > 0 ? (totalPaid / schedule.totalAmount) * 100 : 0,
      remaining: schedule.totalAmount - totalPaid,
      firstPaymentStatus,
      secondPaymentStatus,
      firstPayment,
      secondPayment,
      hasAdmission,
    };
  }, [student, payments, plan, paymentMode, isInstallment]);

  if (!plan || !financeData) {
    return (
      <Card className="opacity-60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{student.full_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">No payment plan assigned</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'waiting':
        return <GraduationCap className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge variant="default" className="bg-green-500">Paid</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Partial</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'waiting':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Waiting Admission</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{student.full_name || 'Unknown'}</CardTitle>
              <p className="text-sm text-muted-foreground">{student.phone || 'No phone'}</p>
            </div>
          </div>
          <Badge variant={plan.isVIP ? 'default' : 'secondary'}>
            {plan.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Payment Mode */}
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className={isInstallment ? 'text-blue-600' : ''}>
            {isInstallment ? 'Split Payment (2 payments)' : 'One-time Payment'}
          </span>
        </div>

        {/* Contract Date */}
        {student.contract_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Contract: {format(new Date(student.contract_date), 'MMM d, yyyy')}</span>
          </div>
        )}
        {student.contract_date && financeData && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={isPaymentOverdue(calculateFirstPaymentDueDate(student.contract_date), financeData.firstPaymentStatus) ? 'text-red-600 font-medium' : ''}>
              Payment Due: {format(new Date(calculateFirstPaymentDueDate(student.contract_date)), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Payment Schedule */}
        <div className="space-y-3 pt-2 border-t">
          {financeData.schedule.payments.map((payment, index) => {
            const actualPayment = index === 0 ? financeData.firstPayment : financeData.secondPayment;
            const status = index === 0 ? financeData.firstPaymentStatus : financeData.secondPaymentStatus;
            const isOverdue = actualPayment?.due_date && isPaymentOverdue(actualPayment.due_date, status);
            const dueInfo = payment.dueDate ? getDaysUntilDue(payment.dueDate) : null;

            return (
              <div key={payment.type} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(isOverdue ? 'overdue' : status)}
                  <div>
                    <p className="text-sm font-medium">{payment.label}</p>
                    {payment.dueDate ? (
                      <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {isOverdue 
                          ? `${dueInfo?.days} days overdue`
                          : `Due: ${format(new Date(payment.dueDate), 'MMM d, yyyy')}`
                        }
                      </p>
                    ) : payment.triggerDescription ? (
                      <p className="text-xs text-blue-600">{payment.triggerDescription}</p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatAmount(payment.amount, financeData.schedule.currency)}</p>
                  {getStatusBadge(isOverdue ? 'overdue' : status)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Progress</span>
            <span className="font-medium">{Math.round(financeData.progress)}%</span>
          </div>
          <Progress value={financeData.progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paid: {formatAmount(financeData.totalPaid, financeData.schedule.currency)}</span>
            <span>Total: {formatAmount(financeData.totalExpected, financeData.schedule.currency)}</span>
          </div>
        </div>

        {/* Admission Status for Split Payments */}
        {isInstallment && (
          <div className={`p-2 rounded-lg text-sm ${financeData.hasAdmission ? 'bg-green-500/10 text-green-700' : 'bg-muted'}`}>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              {financeData.hasAdmission 
                ? 'Student admitted - 2nd payment activated'
                : 'Waiting for university admission'
              }
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onRecordPayment && financeData.remaining > 0 && (
            <Button size="sm" onClick={onRecordPayment} className="flex-1">
              <DollarSign className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
          )}
          {onViewDetails && (
            <Button size="sm" variant="outline" onClick={onViewDetails} className="flex-1">
              View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
