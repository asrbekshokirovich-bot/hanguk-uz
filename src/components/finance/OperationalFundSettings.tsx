import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Pencil, Check, X, Wallet, RefreshCw } from 'lucide-react';
import { useOperationalFund, syncMissingOperationalAllocations } from '@/hooks/useOperationalFund';
import { formatAmount } from '@/hooks/useStudentPlan';
import { toast } from 'sonner';

export function OperationalFundSettings() {
  const { t } = useTranslation();
  const { settings, updateAmountPerStudent, fetchAllocations } = useOperationalFund();
  
  const [editing, setEditing] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleEdit = () => {
    setNewAmount(String(settings?.amount_per_student || 2000000));
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setNewAmount('');
  };

  const handleSave = async () => {
    const amount = Number(newAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateAmountPerStudent(amount);
      if (error) throw error;
      toast.success('Operational fund amount updated');
      setEditing(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncMissing = async () => {
    const amount = settings?.amount_per_student || 0;
    if (amount <= 0) {
      toast.error('Set an amount per student first before syncing');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncMissingOperationalAllocations(amount);
      if (result.success) {
        if (result.count > 0) {
          toast.success(`Allocated operational funds for ${result.count} payment(s)`);
          fetchAllocations();
        } else {
          toast.info('All payments already have operational fund allocations');
        }
      } else {
        toast.error(result.error || 'Failed to sync allocations');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  if (!settings) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Operational Fund Settings
          </div>
          <Badge variant="outline" className="bg-background">
            Per Student
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Amount separated from each student payment
            </p>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-40"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">UZS</span>
              </div>
            ) : (
              <p className="text-3xl font-bold text-primary">
                {formatAmount(settings.amount_per_student, 'UZS')}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncMissing}
                  disabled={syncing || settings.amount_per_student <= 0}
                  title={settings.amount_per_student <= 0 ? 'Set an amount first' : 'Sync missing allocations'}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Missing'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEdit}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </>
            )}
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          This amount is automatically distributed to monthly payment categories 
          (salaries, rent, utilities) proportionally based on their share of total obligations.
          Use "Sync Missing" to allocate funds for past payments that weren't processed.
        </p>
      </CardContent>
    </Card>
  );
}
