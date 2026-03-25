import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ArrowDownRight, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatAmount } from '@/hooks/useStudentPlan';

interface AddExpenseDialogProps {
  onSuccess: () => void;
  trigger?: React.ReactNode;
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
  { value: 'other', label: 'Other' },
  // Note: 'gateway_fee' is excluded as it's auto-generated when recording payments
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'uzum', label: 'Uzum' },
  { value: 'payme', label: 'Payme' },
  { value: 'click', label: 'Click' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function AddExpenseDialog({ onSuccess, trigger }: AddExpenseDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    category: 'other',
    description: '',
    amount: '',
    currency: 'UZS',
    payment_method: 'cash',
    recipient: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;

    setLoading(true);

    try {
      const amount = Number(form.amount);

      // Insert expense into expenses table
      const { error } = await supabase
        .from('expenses' as any)
        .insert({
          category: form.category,
          description: form.description,
          amount,
          currency: form.currency,
          payment_method: form.payment_method,
          recipient: form.recipient || null,
          expense_date: form.transaction_date,
          notes: form.notes || null,
          created_by: user?.id,
        } as any);

      if (error) throw error;

      toast.success(`Xarajat qo'shildi: ${formatAmount(amount, form.currency)}`);

      setOpen(false);
      setForm({
        category: 'other',
        description: '',
        amount: '',
        currency: 'UZS',
        payment_method: 'cash',
        recipient: '',
        transaction_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Xarajat qo\'shishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Xarajat qo'shish
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5 text-red-500" />
            Xarajat qo'shish
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>To'lov usuli</Label>
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

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label>Sana</Label>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label>Izohlar</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Qo'shimcha ma'lumotlar..."
              rows={2}
            />
          </div>

          {/* Amount Preview */}
          {form.amount && Number(form.amount) > 0 && (
            <div className="p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Xarajat:</p>
              <p className="text-xl font-bold text-red-600">
                -{formatAmount(Number(form.amount), form.currency)}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={loading || !form.description || !form.amount}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
