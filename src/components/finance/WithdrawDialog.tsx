import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatAmount } from '@/hooks/useStudentPlan';
import { Wallet, ArrowDownToLine, RotateCcw, DollarSign } from 'lucide-react';

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName: string;
  month: string;
  pendingAmount: number;
  paidAmount: number;
  totalAmount: number;
  onSuccess: () => void;
}

export function WithdrawDialog({
  open,
  onOpenChange,
  recipientName,
  month,
  pendingAmount,
  paidAmount,
  totalAmount,
  onSuccess,
}: WithdrawDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'withdraw' | 'revert'>('withdraw');

  useEffect(() => {
    if (open) {
      // Default to full pending amount for withdrawal
      setWithdrawAmount(pendingAmount.toString());
      setNotes('');
      setMode(pendingAmount > 0 ? 'withdraw' : 'revert');
    }
  }, [open, pendingAmount]);

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (amount <= 0 || amount > pendingAmount) {
      toast.error('Noto\'g\'ri summa');
      return;
    }

    setLoading(true);
    try {
      // Get pending distributions for this recipient/month
      const { data: pendingDists, error: fetchError } = await supabase
        .from('income_distributions')
        .select('id, distributed_amount')
        .eq('distribution_month', month)
        .eq('recipient_name', recipientName)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      if (!pendingDists || pendingDists.length === 0) {
        toast.error('Kutilayotgan taqsimotlar topilmadi');
        return;
      }

      // Mark distributions as paid until we reach the withdraw amount
      let remainingToMark = amount;
      const idsToMarkFull: string[] = [];
      
      for (const dist of pendingDists) {
        if (remainingToMark <= 0) break;
        
        const distAmount = Number(dist.distributed_amount);
        if (distAmount <= remainingToMark) {
          idsToMarkFull.push(dist.id);
          remainingToMark -= distAmount;
        } else {
          // Partial - mark all as paid for simplicity
          idsToMarkFull.push(dist.id);
          remainingToMark = 0;
        }
      }

      if (idsToMarkFull.length > 0) {
        const { error: updateError } = await supabase
          .from('income_distributions')
          .update({ 
            status: 'paid', 
            paid_at: new Date().toISOString() 
          })
          .in('id', idsToMarkFull);

        if (updateError) throw updateError;
      }

      toast.success(`${formatAmount(amount, 'UZS')} muvaffaqiyatli yechib olindi`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Withdraw error:', error);
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async () => {
    setLoading(true);
    try {
      // Get paid distributions for this recipient/month
      const { data: paidDists, error: fetchError } = await supabase
        .from('income_distributions')
        .select('id')
        .eq('distribution_month', month)
        .eq('recipient_name', recipientName)
        .eq('status', 'paid');

      if (fetchError) throw fetchError;
      if (!paidDists || paidDists.length === 0) {
        toast.error('To\'langan taqsimotlar topilmadi');
        return;
      }

      const { error: updateError } = await supabase
        .from('income_distributions')
        .update({ 
          status: 'pending', 
          paid_at: null 
        })
        .in('id', paidDists.map(d => d.id));

      if (updateError) throw updateError;

      toast.success(`${recipientName} uchun ${formatAmount(paidAmount, 'UZS')} qaytarildi`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Revert error:', error);
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {recipientName} - Pul yechish
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jami:</span>
              <span className="font-medium">{formatAmount(totalAmount, 'UZS')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Yechilgan:</span>
              <span className="font-medium text-success">{formatAmount(paidAmount, 'UZS')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kutilmoqda:</span>
              <span className="font-medium text-warning">{formatAmount(pendingAmount, 'UZS')}</span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'withdraw' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('withdraw')}
              disabled={pendingAmount <= 0}
            >
              <ArrowDownToLine className="h-4 w-4 mr-1" />
              Yechish
            </Button>
            <Button
              type="button"
              variant={mode === 'revert' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('revert')}
              disabled={paidAmount <= 0}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Qaytarish
            </Button>
          </div>

          {mode === 'withdraw' ? (
            <>
              {/* Withdraw Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Yechish summasi</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0"
                    className="pl-9"
                    max={pendingAmount}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Maksimal: {formatAmount(pendingAmount, 'UZS')}
                </p>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWithdrawAmount(pendingAmount.toString())}
                >
                  Barchasini
                </Button>
                {pendingAmount >= 1000000 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWithdrawAmount('1000000')}
                  >
                    1M
                  </Button>
                )}
                {pendingAmount >= 500000 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWithdrawAmount('500000')}
                  >
                    500K
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-warning dark:text-warning">
                Bu amal {formatAmount(paidAmount, 'UZS')} summasini "Kutilmoqda" holatiga qaytaradi.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          {mode === 'withdraw' ? (
            <Button 
              onClick={handleWithdraw} 
              disabled={loading || Number(withdrawAmount) <= 0}
            >
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              {loading ? 'Yuklanmoqda...' : 'Yechish'}
            </Button>
          ) : (
            <Button 
              variant="destructive"
              onClick={handleRevert} 
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {loading ? 'Yuklanmoqda...' : 'Qaytarish'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
