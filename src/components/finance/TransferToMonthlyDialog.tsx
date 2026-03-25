import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Users, Heart, Loader2 } from 'lucide-react';
import { formatAmount } from '@/hooks/useStudentPlan';
import { useDistributionTransfers, calculateTransferPreview } from '@/hooks/useDistributionTransfers';
import { toast } from 'sonner';

interface TransferToMonthlyDialogProps {
  availableBalance: number;
  month: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function TransferToMonthlyDialog({
  availableBalance,
  month,
  onSuccess,
  trigger,
}: TransferToMonthlyDialogProps) {
  const { t } = useTranslation();
  const { createTransfer } = useDistributionTransfers();
  
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; percentage: number; deduction: number }[]>([]);

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    setPreview(calculateTransferPreview(numAmount));
  }, [amount]);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    
    if (!numAmount || numAmount <= 0) {
      toast.error('Summani kiriting');
      return;
    }

    if (numAmount > availableBalance) {
      toast.error('Mavjud balansdan ko\'p summa kirita olmaysiz');
      return;
    }

    setLoading(true);
    const result = await createTransfer(numAmount, month, notes || undefined);
    setLoading(false);

    if (result.success) {
      toast.success(`${formatAmount(numAmount, 'UZS')} oylik operatsiyalarga o'tkazildi`);
      setOpen(false);
      setAmount('');
      setNotes('');
      onSuccess?.();
    } else {
      toast.error(result.error || 'Xatolik yuz berdi');
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount > 0 && numAmount <= availableBalance;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ArrowRight className="h-4 w-4 mr-2" />
            Oylikka o'tkazish
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Taqsimotdan oylik xarajatlarga o'tkazish</DialogTitle>
          <DialogDescription>
            Bu summa aktsionerlar ulushidan proporsional ravishda ayiriladi va oylik operatsion xarajatlarga qo'shiladi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Available balance */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Mavjud taqsimot balansi</p>
            <p className="text-xl font-bold text-primary">{formatAmount(availableBalance, 'UZS')}</p>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="amount">O'tkazish summasi (UZS)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Masalan: 10000000"
              min={0}
              max={availableBalance}
            />
          </div>

          {/* Preview of shareholder deductions */}
          {numAmount > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-muted-foreground">Aktsionerlardan ayirmalar:</Label>
                <div className="space-y-2">
                  {preview.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        {item.name === 'Charity' ? (
                          <Heart className="h-4 w-4 text-pink-500" />
                        ) : (
                          <Users className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.percentage}%
                        </Badge>
                      </div>
                      <span className="font-mono text-destructive">
                        -{formatAmount(item.deduction, 'UZS')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <span className="font-medium">Oylikka qo'shiladi:</span>
                <span className="font-bold text-primary">
                  +{formatAmount(numAmount, 'UZS')}
                </span>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Izoh (ixtiyoriy)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O'tkazish sababi..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            O'tkazish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
