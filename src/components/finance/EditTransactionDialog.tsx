import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatAmount } from '@/hooks/useStudentPlan';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  name: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
}

interface EditTransactionDialogProps {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EXPENSE_CATEGORIES = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'software', label: 'Software/Services' },
  { value: 'travel', label: 'Travel' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'gateway_fee', label: 'Gateway Fee' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'uzum', label: 'Uzum' },
  { value: 'payme', label: 'Payme' },
  { value: 'click', label: 'Click' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function EditTransactionDialog({ 
  transaction, 
  open, 
  onOpenChange, 
  onSuccess 
}: EditTransactionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    category: transaction.category,
    description: transaction.description,
    amount: String(transaction.amount),
    currency: transaction.currency,
    recipient: transaction.name,
    date: transaction.date.split('T')[0],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;

    setLoading(true);

    try {
      const amount = Number(form.amount);

      if (transaction.type === 'expense') {
        // Update expense
        const { error } = await supabase
          .from('expenses')
          .update({
            category: form.category,
            description: form.description,
            amount,
            currency: form.currency,
            recipient: form.recipient || null,
            expense_date: form.date,
          })
          .eq('id', transaction.id);

        if (error) throw error;
      } else {
        // For income (payment transactions), we can only update notes
        // The amount is tied to the payment record
        toast.info("To'lov tranzaksiyalarini to'liq tahrirlash mumkin emas");
      }

      toast.success('Tranzaksiya yangilandi');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const isExpense = transaction.type === 'expense';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Tranzaksiyani tahrirlash
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isExpense ? (
            <>
              {/* Category */}
              <div className="space-y-2">
                <Label>Kategoriya</Label>
                <Select 
                  value={form.category} 
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Tavsif</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Xarajat tavsifi..."
                  required
                />
              </div>

              {/* Recipient */}
              <div className="space-y-2">
                <Label>Qabul qiluvchi</Label>
                <Input
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  placeholder="Kompaniya yoki shaxs nomi"
                />
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Summa</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valyuta</Label>
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

              {/* Date */}
              <div className="space-y-2">
                <Label>Sana</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                To'lov tranzaksiyalarini tahrirlash uchun To'lovlar bo'limiga o'ting
              </p>
            </div>
          )}

          {/* Amount Preview */}
          {isExpense && form.amount && Number(form.amount) > 0 && (
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Xarajat:</p>
              <p className="text-xl font-bold text-destructive">
                -{formatAmount(Number(form.amount), form.currency)}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            {isExpense && (
              <Button type="submit" disabled={loading || !form.description || !form.amount}>
                {loading ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
