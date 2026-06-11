import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Home, 
  Zap, 
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  DollarSign
} from 'lucide-react';
import { useMonthlyPayments, MonthlyPaymentCategory } from '@/hooks/useMonthlyPayments';
import { useOperationalFund } from '@/hooks/useOperationalFund';
import { formatAmount } from '@/hooks/useStudentPlan';
import { AddMonthlyPaymentDialog } from './AddMonthlyPaymentDialog';
import { OperationalFundSettings } from './OperationalFundSettings';
import { FundDistributionPanel } from './FundDistributionPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const categoryIcons = {
  salary: Users,
  rent: Home,
  utilities: Zap,
  other: DollarSign,
};

const categoryColors = {
  salary: 'bg-info/10 text-info border-info/20',
  rent: 'bg-primary/10 text-primary border-primary/20',
  utilities: 'bg-warning/10 text-warning border-warning/20',
  other: 'bg-muted/10 text-muted-foreground border-border/20',
};

export function MonthlyPaymentsPanel() {
  const { t } = useTranslation();
  const { 
    categories, 
    loading, 
    totalMonthlyObligations,
    categoryBreakdown,
    toggleActive,
    deleteCategory,
    fetchCategories 
  } = useMonthlyPayments();
  const { settings, allocations, loading: settingsLoading, getMonthlyFundSummary, fetchAllocations } = useOperationalFund();
  
  const [editingCategory, setEditingCategory] = useState<MonthlyPaymentCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<MonthlyPaymentCategory | null>(null);
  const [fundSummary, setFundSummary] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      const summary = await getMonthlyFundSummary();
      if (!cancelled) setFundSummary(summary);
    };
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [getMonthlyFundSummary]);

  // Refresh monthly summary automatically after new payment allocations are created elsewhere
  useEffect(() => {
    const handler = async () => {
      await fetchAllocations();
      const summary = await getMonthlyFundSummary();
      setFundSummary(summary);
    };

    window.addEventListener('operational-fund-updated', handler);
    return () => window.removeEventListener('operational-fund-updated', handler);
  }, [fetchAllocations, getMonthlyFundSummary]);

  // Also refresh when allocations change (e.g., sync missing)
  useEffect(() => {
    const refresh = async () => {
      const summary = await getMonthlyFundSummary();
      setFundSummary(summary);
    };

    refresh();
  }, [allocations.length, getMonthlyFundSummary]);

  const handleDelete = async () => {
    if (deletingCategory) {
      await deleteCategory(deletingCategory.id);
      setDeletingCategory(null);
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <OperationalFundSettings />

      {/* Fund Distribution */}
      {fundSummary && <FundDistributionPanel summary={fundSummary} />}

      {/* Monthly Obligations Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Monthly</p>
                <p className="font-bold">{formatAmount(totalMonthlyObligations, 'UZS')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-info/10 rounded-lg">
                <Users className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Salaries</p>
                <p className="font-bold">{formatAmount(categoryBreakdown.salary, 'UZS')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Home className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rent</p>
                <p className="font-bold">{formatAmount(categoryBreakdown.rent, 'UZS')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Zap className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Utilities</p>
                <p className="font-bold">{formatAmount(categoryBreakdown.utilities, 'UZS')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Monthly Payment Categories</CardTitle>
          <AddMonthlyPaymentDialog 
            onSuccess={fetchCategories}
            editingCategory={editingCategory}
            onEditComplete={() => setEditingCategory(null)}
          />
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No monthly payments configured</p>
              <p className="text-sm">Add salaries, rent, or utilities to track operational costs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => {
                const Icon = categoryIcons[category.category_type];
                const percentage = totalMonthlyObligations > 0 
                  ? ((Number(category.amount) / totalMonthlyObligations) * 100).toFixed(1)
                  : '0';
                
                return (
                  <div 
                    key={category.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      category.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${categoryColors[category.category_type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        {category.recipient_name && (
                          <p className="text-xs text-muted-foreground">{category.recipient_name}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">{formatAmount(Number(category.amount), 'UZS')}</p>
                        <Badge variant="outline" className="text-xs">
                          {percentage}%
                        </Badge>
                      </div>
                      
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={(checked) => toggleActive(category.id, checked)}
                      />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingCategory(category)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Monthly Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingCategory?.name}" from your monthly payments.
              Any existing allocations will remain but won't receive future funds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
