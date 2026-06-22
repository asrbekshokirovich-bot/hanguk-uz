import { useState } from 'react';
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
import { Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { formatAmount } from '@/hooks/useStudentPlan';
import { usePlannedTransactions } from '@/hooks/usePlannedTransactions';

const INCOME_CATEGORIES = [
  { value: 'tuition', label: "To'lov (Tuition)" },
  { value: 'grant', label: 'Grant' },
  { value: 'sponsorship', label: 'Homiylik' },
  { value: 'service', label: 'Xizmat' },
  { value: 'other_income', label: 'Boshqa daromad' },
];

const EXPENSE_CATEGORIES = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'salary', label: 'Ish haqi' },
  { value: 'rent', label: 'Ijara' },
  { value: 'utilities', label: 'Kommunal' },
  { value: 'equipment', label: 'Jihozlar' },
  { value: 'software', label: 'Dasturiy ta\'minot' },
  { value: 'travel', label: 'Safar' },
  { value: 'office', label: 'Ofis xarajatlari' },
  { value: 'other', label: 'Boshqa' },
];

interface Props {
  onCreate: ReturnType<typeof usePlannedTransactions>['create'];
  trigger?: React.ReactNode;
}

export function AddPlannedTransactionDialog({ onCreate, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');

  const [form, setForm] = useState({
    category: 'other',
    description: '',
    amount: '',
    currency: 'UZS',
    expected_date: '',
    recurrence: '' as string,
    notes: '',
  });

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const resetForm = () => {
    setForm({
      category: 'other',
      description: '',
      amount: '',
      currency: 'UZS',
      expected_date: '',
      recurrence: '',
      notes: '',
    });
    setType('expense');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description || !form.expected_date) return;

    setLoading(true);
    try {
      await onCreate({
        type,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        currency: form.currency,
        expected_date: form.expected_date,
        recurrence: (form.recurrence || null) as any,
        notes: form.notes || null,
      });
      const label = type === 'income' ? 'Kutilayotgan daromad' : 'Kutilayotgan xarajat';
      toast.success(`${label} qo'shildi: ${formatAmount(Number(form.amount), form.currency)}`);
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Rejalashtirish
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kutilayotgan tranzaksiya qo'shish</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === 'income' ? 'default' : 'outline'}
              className={type === 'income' ? 'bg-success hover:bg-success/90 text-white' : ''}
              onClick={() => { setType('income'); setForm({ ...form, category: 'tuition' }); }}
            >
              Daromad
            </Button>
            <Button
              type="button"
              variant={type === 'expense' ? 'default' : 'outline'}
              className={type === 'expense' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''}
              onClick={() => { setType('expense'); setForm({ ...form, category: 'other' }); }}
            >
              Xarajat
            </Button>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategoriya</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
              placeholder="Tranzaksiya tavsifi..."
              required
            />
          </div>

          {/* Amount + Currency */}
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
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">UZS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expected date */}
          <div className="space-y-2">
            <Label>Kutilayotgan sana</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={form.expected_date}
                onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label>Takrorlanish</Label>
            <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
              <SelectTrigger><SelectValue placeholder="Bir martalik" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bir martalik</SelectItem>
                <SelectItem value="monthly">Har oy</SelectItem>
                <SelectItem value="quarterly">Har chorak</SelectItem>
                <SelectItem value="yearly">Har yil</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Preview */}
          {form.amount && Number(form.amount) > 0 && (
            <div className={`p-3 rounded-lg ${type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <p className="text-sm text-muted-foreground">
                {type === 'income' ? 'Kutilayotgan daromad:' : 'Kutilayotgan xarajat:'}
              </p>
              <p className={`text-xl font-bold ${type === 'income' ? 'text-success' : 'text-destructive'}`}>
                {type === 'income' ? '+' : '-'}{formatAmount(Number(form.amount), form.currency)}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={loading || !form.description || !form.amount || !form.expected_date}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
