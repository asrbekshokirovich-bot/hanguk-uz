import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Pencil } from 'lucide-react';
import { calculateGatewayFee, getGatewayFeeRate, PAYMENT_METHODS_WITH_FEES } from '@/lib/paymentUtils';

export interface EditablePayment {
  id: string;
  amount: number;
  paid_amount: number;
  payment_type: string;
  status: string;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  transactions?: {
    id: string;
    amount: number;
    gateway_fee: number;
    payment_method: string | null;
    created_at: string;
  }[];
}

interface EditPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: EditablePayment | null;
  onSuccess: () => void;
}

/**
 * Correct an existing payment (amount / paid amount / method / fee / notes).
 *
 * Deliberately narrow: it updates the payment, its transaction and the linked
 * gateway-fee expense, but does NOT re-run the allocation chain (operational
 * fund, student budgets, staff bonus, owner income split) that AddPaymentDialog
 * fires on creation — re-running those would double-count. The dialog warns the
 * operator to re-check Finance after changing an amount.
 */
export function EditPaymentDialog({ open, onOpenChange, payment, onSuccess }: EditPaymentDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    amount: '',
    paidAmount: '',
    paymentMethod: 'cash',
    gatewayFee: '0',
    notes: '',
  });

  const tx = payment?.transactions?.[0];

  useEffect(() => {
    if (open && payment) {
      setForm({
        amount: String(payment.amount ?? ''),
        paidAmount: String(payment.paid_amount ?? ''),
        paymentMethod: payment.transactions?.[0]?.payment_method || 'cash',
        gatewayFee: String(payment.transactions?.[0]?.gateway_fee ?? 0),
        notes: payment.notes || '',
      });
    }
  }, [open, payment]);

  const feeFor = (paidAmount: string, method: string) =>
    String(calculateGatewayFee(Number(paidAmount) || 0, method));

  const total = Number(form.amount) || 0;
  const paid = Number(form.paidAmount) || 0;
  const fee = Number(form.gatewayFee) || 0;
  const netIncome = paid - fee;
  const nextStatus = total > 0 && paid >= total ? 'completed' : paid > 0 ? 'partial' : 'pending';

  const handleSave = async () => {
    if (!payment) return;
    if (total <= 0) {
      toast({ title: t('common.error'), description: "Jami summa 0 dan katta bo'lishi kerak", variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error: payErr } = await supabase
        .from('payments')
        .update({
          amount: total,
          paid_amount: paid,
          status: nextStatus,
          notes: form.notes || null,
          paid_at: paid > 0 ? payment.paid_at ?? new Date().toISOString() : null,
        })
        .eq('id', payment.id);
      if (payErr) throw payErr;

      if (tx) {
        const { error: txErr } = await supabase
          .from('payment_transactions')
          .update({ amount: paid, gateway_fee: fee, payment_method: form.paymentMethod })
          .eq('id', tx.id);
        if (txErr) throw txErr;

        // Keep the auto-generated gateway-fee expense aligned with the new fee.
        await supabase.from('expenses').update({ amount: fee }).eq('linked_transaction_id', tx.id);
      }

      toast({ title: t('common.success', { defaultValue: 'Saqlandi' }) });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Saqlashda xatolik',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            To'lovni tahrirlash
          </DialogTitle>
          <DialogDescription>
            Summani to'g'irlang — gateway fee to'lov turiga qarab avtomatik hisoblanadi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-total">Jami summa</Label>
              <Input
                id="edit-total"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-paid">To'langan summa</Label>
              <Input
                id="edit-paid"
                type="number"
                value={form.paidAmount}
                onChange={(e) =>
                  setForm({ ...form, paidAmount: e.target.value, gatewayFee: feeFor(e.target.value, form.paymentMethod) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>To'lov turi</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) => setForm({ ...form, paymentMethod: v, gatewayFee: feeFor(form.paidAmount, v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS_WITH_FEES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} ({getGatewayFeeRate(m.value)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fee">Gateway fee</Label>
              <Input
                id="edit-fee"
                type="number"
                value={form.gatewayFee}
                onChange={(e) => setForm({ ...form, gatewayFee: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg bg-success/10 p-3">
            <p className="text-sm text-muted-foreground">Sof daromad (siz olasiz):</p>
            <p className="text-xl font-bold text-success">
              {netIncome.toLocaleString()} {payment?.currency}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Holat: {nextStatus}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Izoh</Label>
            <Textarea
              id="edit-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              Summa o'zgarsa, avval hisoblangan daromad taqsimoti / byudjet / bonus qayta hisoblanmaydi — Moliya
              sahifasidagi raqamlarni tekshirib chiqing.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
