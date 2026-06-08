import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, DollarSign, Calendar, Info } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getPlanByValue, formatAmount, getPaymentAmount } from '@/hooks/useStudentPlan';
import { allocateOperationalFund } from '@/hooks/useOperationalFund';
import { distributeIncomeFromPayment } from '@/hooks/useIncomeDistribution';
import { allocateBudgetsForPayment } from '@/hooks/useStudentBudgets';

interface ManualTransactionDialogProps {
  students: Tables<'profiles'>[];
  onSuccess: () => void;
}

const PAYMENT_TYPES = [
  { value: 'initial_deposit', label: '1st Payment (Initial Deposit)' },
  { value: 'remaining_payment', label: '2nd Payment (After Admission)' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'uzum', label: 'Uzum' },
  { value: 'payme', label: 'Payme' },
  { value: 'click', label: 'Click' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function ManualTransactionDialog({ students, onSuccess }: ManualTransactionDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    student_id: '',
    payment_type: 'initial_deposit',
    amount: '',
    currency: 'UZS',
    payment_method: 'cash',
    gateway_fee: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const selectedStudent = students.find(s => s.user_id === form.student_id);
  const studentPlan = getPlanByValue(selectedStudent?.payment_plan || '');
  const studentPaymentMode = selectedStudent?.payment_mode || 'one_time';
  const isInstallment = studentPaymentMode === 'installment';

  // Auto-populate amount based on plan and payment type
  useEffect(() => {
    if (studentPlan && selectedStudent) {
      const paymentType = form.payment_type as 'initial_deposit' | 'remaining_payment' | 'other';
      
      if (paymentType !== 'other') {
        const { amount, currency } = getPaymentAmount(
          selectedStudent.payment_plan || '',
          studentPaymentMode,
          paymentType
        );
        
        setForm(prev => ({
          ...prev,
          amount: amount.toString(),
          currency,
        }));
      }
    }
  }, [selectedStudent?.user_id, form.payment_type, studentPlan, studentPaymentMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.amount) return;

    setLoading(true);

    try {
      const amount = Number(form.amount);
      const gatewayFee = Number(form.gateway_fee) || 0;

      // First, check if a payment record exists for this type
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', form.student_id)
        .eq('payment_type', form.payment_type)
        .single();

      if (existingPayment) {
        // Update existing payment
        const newPaidAmount = Number(existingPayment.paid_amount) + amount;
        const newStatus = newPaidAmount >= existingPayment.amount ? 'completed' : 'partial';
        const wasCompleted = Number(existingPayment.paid_amount) >= existingPayment.amount;
        const isNowCompleted = newPaidAmount >= existingPayment.amount;

        await supabase
          .from('payments')
          .update({
            paid_amount: newPaidAmount,
            status: newStatus,
            paid_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.id);

        // Create transaction record
        await supabase
          .from('payment_transactions')
          .insert({
            payment_id: existingPayment.id,
            amount,
            gateway_fee: gatewayFee,
            payment_method: form.payment_method,
            created_by: user?.id,
            notes: form.notes || null,
          });

        // ONLY allocate budgets and distributions when payment becomes FULLY COMPLETED
        if (!wasCompleted && isNowCompleted) {
          console.log('🎉 Payment fully completed! Triggering allocations...');
          
          // Auto-distribute operational fund (monthly salaries/rent/utilities)
          await allocateOperationalFund(existingPayment.id, form.student_id, newPaidAmount);
          
          // Auto-allocate student budgets if not already done
          if (selectedStudent?.payment_plan) {
            await allocateBudgetsForPayment(form.student_id, selectedStudent.payment_plan, existingPayment.id);
          }
          
          // Auto-distribute income to owners (after deducting operational fund + student budgets + bonus)
          await distributeIncomeFromPayment(existingPayment.id, newPaidAmount, form.student_id);
          
          window.dispatchEvent(new CustomEvent('operational-fund-updated'));
        } else if (!isNowCompleted) {
          console.log(`⏳ Payment still partial (${newPaidAmount}/${existingPayment.amount}). No allocations yet.`);
        }
      } else {
        // Create new payment record
        const { data: newPayment, error: paymentError } = await supabase
          .from('payments')
          .insert({
            student_id: form.student_id,
            payment_type: form.payment_type,
            amount: amount,
            paid_amount: amount,
            currency: form.currency,
            status: 'completed', // New payment with full amount = completed
            paid_at: new Date().toISOString(),
            notes: form.notes || null,
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Create transaction record
        if (newPayment) {
          await supabase
            .from('payment_transactions')
            .insert({
              payment_id: newPayment.id,
              amount,
              gateway_fee: gatewayFee,
              payment_method: form.payment_method,
              created_by: user?.id,
              notes: form.notes || null,
            });

          // Payment is complete (paid_amount = amount), trigger all allocations
          console.log('🎉 New payment fully completed! Triggering allocations...');
          
          // Auto-distribute operational fund (monthly salaries/rent/utilities)
          await allocateOperationalFund(newPayment.id, form.student_id, amount);
          
          // Auto-allocate student budgets
          if (selectedStudent?.payment_plan) {
            await allocateBudgetsForPayment(form.student_id, selectedStudent.payment_plan, newPayment.id);
          }
          
          // Auto-distribute income to owners (after deducting operational fund + student budgets + bonus)
          await distributeIncomeFromPayment(newPayment.id, amount, form.student_id);
          
          window.dispatchEvent(new CustomEvent('operational-fund-updated'));
        }
      }

      toast({
        title: 'Transaction recorded',
        description: `${formatAmount(amount, form.currency)} received from ${selectedStudent?.full_name}`,
      });

      setOpen(false);
      setForm({
        student_id: '',
        payment_type: 'initial_deposit',
        amount: '',
        currency: 'UZS',
        payment_method: 'cash',
        gateway_fee: '',
        transaction_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Failed to record transaction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const netAmount = (Number(form.amount) || 0) - (Number(form.gateway_fee) || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Record Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Record Manual Transaction
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Selection */}
          <div className="space-y-2">
            <Label>Student</Label>
            <Select 
              value={form.student_id} 
              onValueChange={(v) => setForm({ ...form, student_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students
                  .filter(s => s.payment_plan)
                  .map((student) => (
                    <SelectItem key={student.user_id} value={student.user_id}>
                      {student.full_name || student.user_id}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Plan Info */}
          {selectedStudent && studentPlan && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Plan: {studentPlan.label}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {isInstallment ? 'Split Payment' : 'One-time'}
                </Badge>
                <Badge variant="secondary">{studentPlan.currency}</Badge>
              </div>
            </div>
          )}

          {/* Payment Type */}
          <div className="space-y-2">
            <Label>Payment Type</Label>
            <Select 
              value={form.payment_type} 
              onValueChange={(v) => setForm({ ...form, payment_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select 
                value={form.currency} 
                onValueChange={(v) => setForm({ ...form, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Method and Gateway Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select 
                value={form.payment_method} 
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gateway Fee</Label>
              <Input
                type="number"
                value={form.gateway_fee}
                onChange={(e) => setForm({ ...form, gateway_fee: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label>Transaction Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          {/* Net Amount Preview */}
          {form.amount && Number(form.amount) > 0 && (
            <div className="p-3 bg-success/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Net Income:</p>
              <p className="text-xl font-bold text-success">
                {formatAmount(netAmount, form.currency)}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.student_id || !form.amount}>
              {loading ? 'Recording...' : 'Record Transaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
