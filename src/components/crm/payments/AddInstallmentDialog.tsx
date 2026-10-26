import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateField } from '@/components/ui/date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { MultiReceiptUpload } from '@/components/payments/MultiReceiptUpload';
import { calculateGatewayFee, PAYMENT_METHODS_WITH_FEES } from '@/lib/paymentUtils';
import { formatAmount } from '@/hooks/useStudentPlan';
import { recordInstallment } from '@/lib/recordInstallment';

export interface InstallmentTarget {
  id: string;
  student_id: string;
  amount: number;
  paid_amount: number;
  currency: string;
}

interface AddInstallmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: InstallmentTarget | null;
  studentPlan?: string | null;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

/**
 * Add one transfer (bo'lak) to an existing payment account: amount, method,
 * the date it was paid (from the receipt) and 1–10 receipt images. It never
 * opens a new account, so splitting a payment no longer creates a second debt.
 */
export function AddInstallmentDialog({
  open,
  onOpenChange,
  payment,
  studentPlan,
  onSuccess,
}: AddInstallmentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeIntakeId } = useActiveIntake();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState('cash');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [receipts, setReceipts] = useState<string[]>([]);

  const left = payment ? Math.max(Number(payment.amount) - Number(payment.paid_amount), 0) : 0;

  // A fresh form each time it opens, pre-filled with what is still owed.
  useEffect(() => {
    if (!open || !payment) return;
    setAmount(left > 0 ? String(left) : '');
    setPaidOn(today());
    setMethod('cash');
    setFee('');
    setNotes('');
    setReceipts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  useEffect(() => {
    const value = Number(amount) || 0;
    setFee(value > 0 ? String(calculateGatewayFee(value, method)) : '');
  }, [amount, method]);

  if (!payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      toast({ title: t('common.error'), description: t('payments.installment.amountRequired'), variant: 'destructive' });
      return;
    }
    if (!paidOn) {
      toast({ title: t('common.error'), description: t('payments.installment.dateRequired'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await recordInstallment({
        paymentId: payment.id,
        studentId: payment.student_id,
        amount: value,
        paidOn,
        method,
        gatewayFee: Number(fee) || 0,
        currency: payment.currency,
        notes,
        receiptUrls: receipts,
        plan: studentPlan,
        intakeId: activeIntakeId,
      });
      toast({
        title: t('common.success'),
        description: result.completedNow
          ? t('payments.installment.savedCompleted')
          : t('payments.installment.saved', {
              left: formatAmount(Math.max(result.amount - result.paidAmount, 0), payment.currency),
            }),
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('payments.installment.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-lg bg-muted p-3 text-sm">
            {t('payments.balanceLine', {
              total: formatAmount(Number(payment.amount), payment.currency),
              paid: formatAmount(Number(payment.paid_amount), payment.currency),
              left: formatAmount(left, payment.currency),
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="installment-amount">
                {t('payments.installment.amount')} ({payment.currency})
              </Label>
              <Input
                id="installment-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment-date">{t('payments.installment.paidOn')}</Label>
              <DateField id="installment-date" value={paidOn} onChange={setPaidOn} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('payments.installment.method')}</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS_WITH_FEES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                      {m.feeRate > 0 && ` (${(m.feeRate * 100).toFixed(1)}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="installment-fee">{t('payments.installment.fee')}</Label>
              <Input
                id="installment-fee"
                type="number"
                min="0"
                step="any"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
          </div>

          <MultiReceiptUpload value={receipts} onChange={setReceipts} studentId={payment.student_id} maxFiles={10} />

          <div className="space-y-2">
            <Label htmlFor="installment-notes">{t('common.notes')}</Label>
            <Textarea id="installment-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.loading') : t('payments.installment.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
