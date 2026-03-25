import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus, Users, Home, Zap, DollarSign } from 'lucide-react';
import { useMonthlyPayments, MonthlyPaymentCategory } from '@/hooks/useMonthlyPayments';
import { toast } from 'sonner';

interface AddMonthlyPaymentDialogProps {
  onSuccess: () => void;
  editingCategory?: MonthlyPaymentCategory | null;
  onEditComplete?: () => void;
}

const categoryTypes = [
  { value: 'salary', label: 'Salary', icon: Users },
  { value: 'rent', label: 'Rent', icon: Home },
  { value: 'utilities', label: 'Utilities', icon: Zap },
  { value: 'other', label: 'Other', icon: DollarSign },
] as const;

export function AddMonthlyPaymentDialog({ 
  onSuccess, 
  editingCategory, 
  onEditComplete 
}: AddMonthlyPaymentDialogProps) {
  const { t } = useTranslation();
  const { createCategory, updateCategory } = useMonthlyPayments();
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category_type: 'salary' as 'salary' | 'rent' | 'utilities' | 'other',
    amount: '',
    recipient_name: '',
    notes: '',
  });

  // Handle editing mode
  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        category_type: editingCategory.category_type,
        amount: String(editingCategory.amount),
        recipient_name: editingCategory.recipient_name || '',
        notes: editingCategory.notes || '',
      });
      setOpen(true);
    }
  }, [editingCategory]);

  const handleClose = () => {
    setOpen(false);
    setFormData({
      name: '',
      category_type: 'salary',
      amount: '',
      recipient_name: '',
      notes: '',
    });
    onEditComplete?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    
    try {
      if (editingCategory) {
        const { error } = await updateCategory(editingCategory.id, {
          name: formData.name,
          category_type: formData.category_type,
          amount: Number(formData.amount),
          recipient_name: formData.recipient_name || null,
          notes: formData.notes || null,
        });
        
        if (error) throw error;
        toast.success('Monthly payment updated');
      } else {
        const { error } = await createCategory({
          name: formData.name,
          category_type: formData.category_type,
          amount: Number(formData.amount),
          recipient_name: formData.recipient_name || undefined,
          notes: formData.notes || undefined,
        });
        
        if (error) throw error;
        toast.success('Monthly payment added');
      }
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? 'Edit Monthly Payment' : 'Add Monthly Payment'}
          </DialogTitle>
          <DialogDescription>
            Add a recurring monthly expense like salary, rent, or utilities.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Ahmad - Monthly Salary"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={formData.category_type}
              onValueChange={(value: any) => setFormData({ ...formData, category_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (UZS) *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="10000000"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Monthly payment amount in Uzbek Som
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Name</Label>
            <Input
              id="recipient"
              placeholder="e.g., Ahmad Karimov"
              value={formData.recipient_name}
              onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : editingCategory ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
