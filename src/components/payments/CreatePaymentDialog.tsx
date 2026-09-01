import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Info, Calendar } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { PAYMENT_PLANS, getPlanByValue, formatPlanAmount, calculateDueDate, applyDiscount, getPaymentAmount } from '@/hooks/useStudentPlan';

interface CreatePaymentDialogProps {
  students: (Tables<'profiles'> & {
    applications?: Tables<'applications'>[];
    contract_date?: string | null;
    discountPercent?: number;
  })[];
  onCreatePayment: (payment: {
    student_id: string;
    application_id?: string;
    payment_type: 'initial_deposit' | 'remaining_payment' | 'other';
    amount: number;
    listAmount?: number;
    currency?: string;
    due_date?: string;
    notes?: string;
  }) => Promise<{ error: any }>;
}

export function CreatePaymentDialog({ students, onCreatePayment }: CreatePaymentDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    application_id: '',
    payment_type: 'initial_deposit' as 'initial_deposit' | 'remaining_payment' | 'other',
    amount: '',
    currency: 'UZS',
    due_date: '',
    notes: '',
  });

  const selectedStudent = students.find(s => s.user_id === form.student_id);
  const studentPlan = getPlanByValue(selectedStudent?.payment_plan || '');
  const studentPaymentMode = selectedStudent?.payment_mode || 'one_time';
  const isInstallment = studentPaymentMode === 'installment';
  const contractDate = selectedStudent?.contract_date;
  const discountPercent = selectedStudent?.discountPercent || 0;

  // Auto-populate amount and due date when student or payment type changes
  useEffect(() => {
    if (studentPlan && selectedStudent) {
      let amount: number;

      if (isInstallment) {
        // Use correct split amounts
        if (form.payment_type === 'initial_deposit') {
          amount = applyDiscount(studentPlan.firstPayment, discountPercent);
        } else if (form.payment_type === 'remaining_payment') {
          amount = applyDiscount(studentPlan.secondPayment, discountPercent);
        } else {
          amount = 0;
        }
      } else {
        // For one-time, show full amount
        amount = applyDiscount(studentPlan.priceOneTime, discountPercent);
      }

      // Calculate due date based on contract date and payment type (7 working days)
      const dueDate = calculateDueDate(contractDate || null, form.payment_type, studentPaymentMode);
      
      setForm(prev => ({
        ...prev,
        amount: amount.toString(),
        currency: studentPlan.currency,
        due_date: dueDate,
      }));
    }
  }, [selectedStudent?.user_id, studentPlan, studentPaymentMode, form.payment_type, contractDate, isInstallment, discountPercent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id || !form.amount) return;

    setLoading(true);
    // Snapshot the undiscounted list price alongside a discounted amount, for
    // the investor P&L's informational "discounts given" line — computed via
    // the same helper with discount=0, so it can never drift from `amount`.
    const listAmount =
      discountPercent > 0 && studentPlan && form.payment_type !== 'other'
        ? getPaymentAmount(selectedStudent?.payment_plan || '', studentPaymentMode, form.payment_type, 0).amount
        : undefined;
    const { error } = await onCreatePayment({
      student_id: form.student_id,
      application_id: form.application_id || undefined,
      payment_type: form.payment_type,
      amount: parseFloat(form.amount),
      listAmount,
      currency: form.currency,
      due_date: form.due_date || undefined,
      notes: form.notes || undefined,
    });

    setLoading(false);
    if (!error) {
      setOpen(false);
      setForm({
        student_id: '',
        application_id: '',
        payment_type: 'initial_deposit',
        amount: '',
        currency: 'UZS',
        due_date: '',
        notes: '',
      });
    }
  };

  // Get expected (discounted) amounts for display
  const getExpectedAmounts = () => {
    if (!studentPlan) return null;

    if (isInstallment) {
      const firstPayment = applyDiscount(studentPlan.firstPayment, discountPercent);
      const secondPayment = applyDiscount(studentPlan.secondPayment, discountPercent);
      return {
        total: firstPayment + secondPayment,
        firstPayment,
        secondPayment,
        label: `${formatPlanAmount(firstPayment, studentPlan.currency)} + ${formatPlanAmount(secondPayment, studentPlan.currency)}`,
      };
    }

    const priceOneTime = applyDiscount(studentPlan.priceOneTime, discountPercent);
    return {
      total: priceOneTime,
      firstPayment: priceOneTime,
      secondPayment: 0,
      label: formatPlanAmount(priceOneTime, studentPlan.currency),
    };
  };

  const expectedAmounts = getExpectedAmounts();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('common.add')} {t('payments.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.add')} {t('payments.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('navigation.students')}</Label>
            <Select 
              value={form.student_id} 
              onValueChange={(v) => setForm({ ...form, student_id: v, application_id: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('common.select')} />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
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
                <span className="text-sm font-medium">Student Plan: {studentPlan.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {isInstallment ? '2 Installments' : 'One-time'}
                </Badge>
                {expectedAmounts && (
                  <Badge variant="secondary">{expectedAmounts.label}</Badge>
                )}
              </div>
              {contractDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Contract: {new Date(contractDate).toLocaleDateString()}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isInstallment
                  ? `1st: ${formatPlanAmount(expectedAmounts?.firstPayment || 0, studentPlan.currency)} | 2nd: ${formatPlanAmount(expectedAmounts?.secondPayment || 0, studentPlan.currency)}`
                  : `Total: ${formatPlanAmount(expectedAmounts?.total || 0, studentPlan.currency)}`
                }
                {discountPercent > 0 && ` (−${discountPercent}% applied)`}
              </p>
            </div>
          )}

          {selectedStudent?.applications && selectedStudent.applications.length > 0 && (
            <div className="space-y-2">
              <Label>{t('navigation.applications')} (Optional)</Label>
              <Select 
                value={form.application_id || 'none'} 
                onValueChange={(v) => setForm({ ...form, application_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {selectedStudent.applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      Application #{app.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('payments.title')} Type</Label>
            <Select 
              value={form.payment_type} 
              onValueChange={(v: any) => setForm({ ...form, payment_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="initial_deposit">{t('payments.initialPayment')}</SelectItem>
                <SelectItem value="remaining_payment">{t('payments.remainingPayment')}</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('payments.totalAmount')}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="KRW">KRW</SelectItem>
                  <SelectItem value="UZS">UZS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('payments.dueDate')}</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('common.notes')}</Label>
            <Textarea
              placeholder={t('common.notes')}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
