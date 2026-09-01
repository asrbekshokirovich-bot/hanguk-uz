import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { CreditCard, Calendar, DollarSign, Info, AlertCircle } from 'lucide-react';
import { getPlanByValue, formatPlanAmount, calculateDueDate, applyDiscount } from '@/hooks/useStudentPlan';
import { allocateOperationalFund } from '@/hooks/useOperationalFund';
import { distributeIncomeFromPayment } from '@/hooks/useIncomeDistribution';
import { allocateBudgetsForPayment } from '@/hooks/useStudentBudgets';
import { createBonusForPayment } from '@/hooks/useStaffBonuses';
import { calculateGatewayFee, getGatewayFeeRate, PAYMENT_METHODS_WITH_FEES } from '@/lib/paymentUtils';
import { MultiReceiptUpload } from '@/components/payments/MultiReceiptUpload';

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentPlan?: string | null;
  studentPaymentMode?: string | null;
  contractDate?: string | null;
  discountPercent?: number;
  existingPayments?: Array<{ payment_type: string; status: string }>;
  onSuccess: () => void;
}

const PAYMENT_TYPES = [
  { value: 'initial_deposit', label: 'Initial Deposit (1st Payment)' },
  { value: 'remaining_payment', label: 'Remaining Payment (2nd Payment)' },
  { value: 'other', label: 'Other' },
];

const CURRENCIES = [
  { value: 'UZS', label: 'UZS' },
  { value: 'USD', label: 'USD' },
];

export function AddPaymentDialog({ 
  open, 
  onOpenChange, 
  studentId,
  studentPlan: planValue,
  studentPaymentMode = 'one_time',
  contractDate,
  discountPercent: discountPercentProp,
  existingPayments = [],
  onSuccess
}: AddPaymentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeIntakeId } = useActiveIntake();
  const [loading, setLoading] = useState(false);
  const [fetchedPlan, setFetchedPlan] = useState<string | null>(null);
  const [fetchedDiscount, setFetchedDiscount] = useState<number | null>(null);

  // Fallback: fetch plan + discount from the database if the props weren't
  // provided (some callers only pass studentId). The discount lives on the
  // active season's student_intakes row, same grain as is_free_reapplication.
  useEffect(() => {
    if (!studentId || !open) return;
    if (!planValue) {
      supabase
        .from('profiles')
        .select('payment_plan, payment_mode')
        .eq('user_id', studentId)
        .single()
        .then(({ data }) => {
          if (data?.payment_plan) {
            setFetchedPlan(data.payment_plan);
          }
        });
    }
    if (discountPercentProp === undefined && activeIntakeId) {
      supabase
        .from('student_intakes')
        .select('discount_percent')
        .eq('student_id', studentId)
        .eq('intake_id', activeIntakeId)
        .maybeSingle()
        .then(({ data }) => {
          setFetchedDiscount(Number(data?.discount_percent) || 0);
        });
    }
  }, [planValue, studentId, open, discountPercentProp, activeIntakeId]);

  // Use fetched plan/discount as fallback
  const effectivePlan = planValue || fetchedPlan;
  const discountPercent = discountPercentProp ?? fetchedDiscount ?? 0;

  const planInfo = getPlanByValue(effectivePlan || '');
  const isInstallment = studentPaymentMode === 'installment';
  
  // Check which payments already exist
  const hasInitialDeposit = existingPayments.some(p => p.payment_type === 'initial_deposit');
  const hasRemainingPayment = existingPayments.some(p => p.payment_type === 'remaining_payment');

  // Determine default payment type based on existing payments
  const getDefaultPaymentType = () => {
    if (!hasInitialDeposit) return 'initial_deposit';
    if (isInstallment && !hasRemainingPayment) return 'remaining_payment';
    return 'other';
  };

  // Calculate initial expected amount based on plan (discounted)
  const getInitialAmount = () => {
    if (!planInfo) return '';
    const paymentType = getDefaultPaymentType();
    if (isInstallment) {
      if (paymentType === 'initial_deposit') return applyDiscount(planInfo.firstPayment, discountPercent).toString();
      if (paymentType === 'remaining_payment') return applyDiscount(planInfo.secondPayment, discountPercent).toString();
      return '';
    }
    return applyDiscount(planInfo.priceOneTime, discountPercent).toString();
  };

  const [formData, setFormData] = useState({
    paymentType: getDefaultPaymentType(),
    amount: getInitialAmount(),
    paidAmount: '',
    currency: planInfo?.currency || 'UZS',
    paymentMethod: 'cash',
    gatewayFee: '',
    dueDate: '',
    notes: '',
    receiptUrls: [] as string[],
  });

  // Auto-calculate gateway fee when paid amount or payment method changes
  useEffect(() => {
    const paidAmount = Number(formData.paidAmount) || 0;
    if (paidAmount > 0) {
      const calculatedFee = calculateGatewayFee(paidAmount, formData.paymentMethod);
      setFormData(prev => ({
        ...prev,
        gatewayFee: calculatedFee.toString(),
      }));
    }
  }, [formData.paidAmount, formData.paymentMethod]);

  // Auto-populate amount and due date based on student's plan and payment type
  useEffect(() => {
    if (!open) return;
    
    const paymentType = formData.paymentType as 'initial_deposit' | 'remaining_payment' | 'other';
    
    let amount = 0;
    if (planInfo) {
      if (isInstallment) {
        if (paymentType === 'initial_deposit') {
          amount = applyDiscount(planInfo.firstPayment, discountPercent);
        } else if (paymentType === 'remaining_payment') {
          amount = applyDiscount(planInfo.secondPayment, discountPercent);
        }
      } else {
        // For one-time, initial deposit is full amount
        if (paymentType === 'initial_deposit') {
          amount = applyDiscount(planInfo.priceOneTime, discountPercent);
        }
      }
    }

    // Calculate due date based on contract date (7 working days)
    const dueDate = calculateDueDate(contractDate || null, paymentType, studentPaymentMode);

    setFormData(prev => ({
      ...prev,
      amount: amount > 0 ? amount.toString() : prev.amount,
      currency: planInfo?.currency || prev.currency,
      dueDate,
    }));
  }, [planInfo, studentPaymentMode, open, formData.paymentType, contractDate, isInstallment, discountPercent]);

  // Re-apply the correct default payment type when the dialog opens or once the
  // existing payments finish loading. The initial useState value is computed on mount,
  // when `existingPayments` may still be empty, which previously left the type stuck on
  // 'initial_deposit' even though one already existed.
  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, paymentType: getDefaultPaymentType() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasInitialDeposit, hasRemainingPayment]);

  // Update amount when payment type changes
  const handlePaymentTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, paymentType: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || Number(formData.amount) <= 0) {
      toast({
        title: t('common.error'),
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const amount = Number(formData.amount);
      const paidAmount = Number(formData.paidAmount) || 0;
      const gatewayFee = Number(formData.gatewayFee) || 0;

      // Create the payment record.
      // NOTE: a DB trigger (payments_idempotent_initial_deposit) silently swallows
      // duplicate `initial_deposit` inserts (it updates the existing row and RETURNs NULL),
      // so the INSERT can legitimately return 0 rows. Use maybeSingle() to avoid the
      // PGRST116 "Cannot coerce the result to a single JSON object" error, then fall back
      // to fetching the existing payment row so we can still attach the receipt/transaction.
      const { data: insertedPayment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          student_id: studentId,
          payment_type: formData.paymentType,
          amount,
          paid_amount: paidAmount,
          currency: formData.currency,
          status: paidAmount >= amount ? 'completed' : paidAmount > 0 ? 'partial' : 'pending',
          due_date: formData.dueDate || null,
          paid_at: paidAmount > 0 ? new Date().toISOString() : null,
          notes: formData.notes || null,
          intake_id: activeIntakeId,
        })
        .select()
        .maybeSingle();

      if (paymentError) throw paymentError;

      let payment = insertedPayment;

      // Idempotent trigger updated an existing initial_deposit instead of inserting:
      // re-fetch that row so the rest of the flow (transaction, receipt, allocations) works.
      if (!payment) {
        const { data: existingPayment, error: existingError } = await supabase
          .from('payments')
          .select()
          .eq('student_id', studentId)
          .eq('payment_type', formData.paymentType)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingError) throw existingError;
        payment = existingPayment;
      }

      if (!payment) {
        throw new Error('Could not create or locate the payment record');
      }

      // If there's a paid amount, create a transaction record
      if (paidAmount > 0 && payment) {
        const { data: txData, error: txError } = await supabase
          .from('payment_transactions')
          .insert({
            payment_id: payment.id,
            amount: paidAmount,
            gateway_fee: gatewayFee,
            payment_method: formData.paymentMethod,
            created_by: user?.id,
            notes: formData.notes || null,
            receipt_url: formData.receiptUrls[0] || null,
            receipt_urls: formData.receiptUrls,
          })
          .select()
          .single();

        if (txError) {
          console.error('Failed to create transaction:', txError);
        }

        // Auto-create gateway fee expense for fee-based payment methods
        if (!txError && txData && gatewayFee > 0) {
          const methodLabel = formData.paymentMethod === 'payme' ? 'PayMe' :
                              formData.paymentMethod === 'click' ? 'Click' :
                              formData.paymentMethod === 'uzum' ? 'Uzum' : 
                              formData.paymentMethod;
          
          const { error: expenseError } = await supabase
            .from('expenses')
            .insert({
              category: 'gateway_fee',
              description: `${methodLabel} to'lov komissiyasi`,
              amount: gatewayFee,
              currency: formData.currency,
              payment_method: formData.paymentMethod,
              recipient: methodLabel,
              expense_date: new Date().toISOString().split('T')[0],
              notes: `Auto-generated fee for transaction ${txData.id}`,
              linked_transaction_id: txData.id,
            });

          if (expenseError) {
            console.error('Failed to create gateway fee expense:', expenseError);
          }
        }

        // ONLY allocate budgets and distributions when payment is FULLY COMPLETED
        const isFullyCompleted = paidAmount >= amount;
        // Cap the allocation input at the expected amount, matching usePayments.ts —
        // an overpayment beyond what was owed should not inflate the distributed base.
        const allocationAmount = Math.min(paidAmount, amount);

        if (isFullyCompleted) {
          console.log('🎉 Payment fully completed! Triggering allocations...');

          // Auto-distribute operational fund (monthly salaries/rent/utilities)
          await allocateOperationalFund(payment.id, studentId, allocationAmount);

          // Auto-allocate student budgets
          if (effectivePlan) {
            await allocateBudgetsForPayment(studentId, effectivePlan, payment.id, activeIntakeId);
          }

          // Auto-create staff bonus for this student (if not already exists)
          if (effectivePlan) {
            await createBonusForPayment(studentId, effectivePlan);
          }

          // Auto-distribute income to owners (after deducting operational fund + student budgets + bonus)
          await distributeIncomeFromPayment(payment.id, allocationAmount, studentId);

          window.dispatchEvent(new CustomEvent('operational-fund-updated'));
        } else {
          console.log(`⏳ Payment still partial (${paidAmount}/${amount}). No allocations yet.`);
        }
      }

      toast({
        title: t('common.success'),
        description: 'Payment recorded successfully',
      });

      // Reset form
      setFormData({
        paymentType: 'initial_deposit',
        amount: '',
        paidAmount: '',
        currency: 'UZS',
        paymentMethod: 'cash',
        gatewayFee: '',
        dueDate: '',
        notes: '',
        receiptUrls: [],
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to record payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const netIncome = (Number(formData.paidAmount) || 0) - (Number(formData.gatewayFee) || 0);

  // Get expected (discounted) amounts for display
  const getExpectedAmounts = () => {
    if (!planInfo) return null;

    if (isInstallment) {
      const firstPayment = applyDiscount(planInfo.firstPayment, discountPercent);
      const secondPayment = applyDiscount(planInfo.secondPayment, discountPercent);
      return {
        total: firstPayment + secondPayment,
        firstPayment,
        secondPayment,
        label: `${formatPlanAmount(firstPayment, planInfo.currency)} + ${formatPlanAmount(secondPayment, planInfo.currency)} = ${formatPlanAmount(firstPayment + secondPayment, planInfo.currency)}`,
      };
    }

    const priceOneTime = applyDiscount(planInfo.priceOneTime, discountPercent);
    return {
      total: priceOneTime,
      firstPayment: priceOneTime,
      secondPayment: 0,
      label: formatPlanAmount(priceOneTime, planInfo.currency),
    };
  };

  const expectedAmounts = getExpectedAmounts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Add Payment
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">

        {/* Plan Info Banner */}
        {planInfo && (
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Student Plan: {planInfo.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{isInstallment ? '2 Installments' : 'One-time'}</Badge>
              {expectedAmounts && (
                <Badge variant="secondary">{expectedAmounts.label}</Badge>
              )}
              {discountPercent > 0 && (
                <Badge variant="default" className="bg-success/20 text-success-foreground border-0">−{discountPercent}% discount applied</Badge>
              )}
            </div>
            {contractDate && (
              <p className="text-xs text-muted-foreground">
                Contract Date: {new Date(contractDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Payment Progress for Installments */}
        {isInstallment && (
          <div className="flex gap-2">
            <div className={`flex-1 p-2 rounded-lg border ${hasInitialDeposit ? 'bg-success/10 border-success' : 'bg-muted'}`}>
              <p className="text-xs font-medium">1st Payment</p>
              <p className={`text-xs ${hasInitialDeposit ? 'text-success' : 'text-muted-foreground'}`}>
                {hasInitialDeposit ? '✓ Recorded' : 'Pending'}
              </p>
            </div>
            <div className={`flex-1 p-2 rounded-lg border ${hasRemainingPayment ? 'bg-success/10 border-success' : 'bg-muted'}`}>
              <p className="text-xs font-medium">2nd Payment</p>
              <p className={`text-xs ${hasRemainingPayment ? 'text-success' : 'text-muted-foreground'}`}>
                {hasRemainingPayment ? '✓ Recorded' : 'Pending'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select
                value={formData.paymentType}
                onValueChange={handlePaymentTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((type) => (
                    <SelectItem 
                      key={type.value} 
                      value={type.value}
                      disabled={
                        (type.value === 'initial_deposit' && hasInitialDeposit) ||
                        (type.value === 'remaining_payment' && hasRemainingPayment)
                      }
                    >
                      {type.label}
                      {type.value === 'initial_deposit' && hasInitialDeposit && ' (Done)'}
                      {type.value === 'remaining_payment' && hasRemainingPayment && ' (Done)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Expected Amount *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="5,000,000"
                  className="pl-9"
                  required
                />
              </div>
              {planInfo && formData.amount && (
                <p className="text-xs text-muted-foreground">
                  = {formatPlanAmount(Number(formData.amount), formData.currency)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidAmount">Paid Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="paidAmount"
                  type="number"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                  placeholder="Enter if paid now"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS_WITH_FEES.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label} {method.feeRate > 0 && `(${(method.feeRate * 100).toFixed(1)}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Fee: {getGatewayFeeRate(formData.paymentMethod)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gatewayFee">Gateway Fee</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="gatewayFee"
                  type="number"
                  value={formData.gatewayFee}
                  onChange={(e) => setFormData({ ...formData, gatewayFee: e.target.value })}
                  placeholder="30,000"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="pl-9"
              />
            </div>
            {contractDate && (
              <p className="text-xs text-muted-foreground">
                Auto-calculated from contract date
              </p>
            )}
          </div>

          {/* Net Income Preview */}
          {formData.paidAmount && Number(formData.paidAmount) > 0 && (
            <div className="bg-success/20 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Net Income (You Will Receive):</p>
              <p className="text-xl font-bold text-success">
                {netIncome.toLocaleString()} {formData.currency}
              </p>
            </div>
          )}

          {/* Receipt Upload - Multiple Files */}
          <MultiReceiptUpload
            value={formData.receiptUrls}
            onChange={(urls) => setFormData({ ...formData, receiptUrls: urls })}
            studentId={studentId}
          />

          <div className="space-y-2">
            <Label htmlFor="notes">{t('common.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add notes about this payment..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('common.loading') : 'Record Payment'}
            </Button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}