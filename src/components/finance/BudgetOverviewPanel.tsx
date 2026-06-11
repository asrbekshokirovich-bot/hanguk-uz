import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp,
  Users,
  PieChart,
  FileText,
  Plane,
  Building,
  Home,
  GraduationCap,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import { useAllStudentBudgets, allocateMissingBudgets } from '@/hooks/useStudentBudgets';
import { formatAmount, BUDGET_CATEGORIES } from '@/hooks/useStudentPlan';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  document_preparation: FileText,
  document_delivery: Plane,
  bank_statement: Building,
  welcoming_delivery: Home,
  tuition_fees: GraduationCap,
  rental_application: Home,
  visa_processes: FileCheck,
};

export function BudgetOverviewPanel() {
  const { t } = useTranslation();
  const { budgets, loading, fetchAllBudgets, getCategorySummary } = useAllStudentBudgets();
  const [allocating, setAllocating] = useState(false);

  const handleAllocateMissing = async () => {
    setAllocating(true);
    try {
      const result = await allocateMissingBudgets();
      if (result.success) {
        const allocatedCount = result.results.filter(r => r.status.includes('allocated')).length;
        if (allocatedCount > 0) {
          toast.success(`Allocated budgets for ${allocatedCount} student(s)`);
          fetchAllBudgets();
        } else {
          toast.info('All students already have budgets allocated');
        }
      }
    } catch (error) {
      toast.error('Failed to allocate budgets');
    } finally {
      setAllocating(false);
    }
  };

  const stats = useMemo(() => {
    const totalAllocated = budgets.reduce((sum, b) => sum + Number(b.allocated_amount), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0);
    const uniqueStudents = new Set(budgets.map(b => b.student_id)).size;
    
    return {
      totalAllocated,
      totalSpent,
      remaining: totalAllocated - totalSpent,
      utilizationRate: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
      studentCount: uniqueStudents,
    };
  }, [budgets]);

  const categorySummary = useMemo(() => {
    const summary = getCategorySummary();
    const categoryLabels = new Map(BUDGET_CATEGORIES.map(c => [c.id, c.label]));
    
    return Object.entries(summary).map(([category, data]) => ({
      category,
      label: categoryLabels.get(category) || category,
      ...data,
      progress: data.allocated > 0 ? (data.spent / data.allocated) * 100 : 0,
    })).sort((a, b) => b.allocated - a.allocated);
  }, [getCategorySummary]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Allocated</p>
                <p className="text-2xl font-bold text-primary">
                  {formatAmount(stats.totalAllocated, 'UZS')}
                </p>
              </div>
              <div className="p-2 bg-primary/20 rounded-lg">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-success">
                  {formatAmount(stats.totalSpent, 'UZS')}
                </p>
              </div>
              <div className="p-2 bg-success/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-info">
                  {formatAmount(stats.remaining, 'UZS')}
                </p>
              </div>
              <div className="p-2 bg-info/20 rounded-lg">
                <PieChart className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="text-2xl font-bold text-primary">
                  {stats.studentCount}
                </p>
              </div>
              <div className="p-2 bg-primary/20 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Utilization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Overall Budget Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatAmount(stats.totalSpent, 'UZS')} of {formatAmount(stats.totalAllocated, 'UZS')}
              </span>
              <span className="font-medium">{Math.round(stats.utilizationRate)}%</span>
            </div>
            <Progress value={stats.utilizationRate} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Budget by Category</span>
          <Button 
            onClick={handleAllocateMissing} 
            disabled={allocating}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${allocating ? 'animate-spin' : ''}`} />
            {allocating ? 'Syncing...' : 'Sync Budgets'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {categorySummary.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              No budget allocations yet. Click "Sync Budgets" to allocate budgets for students with completed payments.
            </p>
          </div>
          ) : (
            <div className="space-y-4">
              {categorySummary.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.category] || FileText;
                
                return (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cat.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {cat.count} students
                        </Badge>
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-muted-foreground">
                          {formatAmount(cat.spent, 'UZS')}
                        </span>
                        <span className="mx-1">/</span>
                        <span className="font-medium">
                          {formatAmount(cat.allocated, 'UZS')}
                        </span>
                      </div>
                    </div>
                    <Progress value={cat.progress} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
