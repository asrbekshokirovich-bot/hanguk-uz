import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Wallet, 
  FileText, 
  Plane, 
  Building, 
  GraduationCap, 
  Home, 
  FileCheck,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { StudentBudget, calculateBudgetSummary } from '@/hooks/useStudentBudgets';
import { 
  getPlanByValue, 
  formatAmount,
  getBudgetCategoriesForPlan,
  BUDGET_CATEGORIES 
} from '@/hooks/useStudentPlan';

interface StudentBudgetCardProps {
  student: Tables<'profiles'>;
  budgets: StudentBudget[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  document_preparation: FileText,
  document_delivery: Plane,
  bank_statement: Building,
  welcoming_delivery: Home,
  tuition_fees: GraduationCap,
  rental_application: Home,
  visa_processes: FileCheck,
};

export function StudentBudgetCard({ student, budgets }: StudentBudgetCardProps) {
  const { t } = useTranslation();
  const plan = getPlanByValue(student.payment_plan || '');
  
  const summary = useMemo(() => {
    if (budgets.length === 0) return null;
    return calculateBudgetSummary(budgets, BUDGET_CATEGORIES);
  }, [budgets]);

  if (!plan) {
    return (
      <Card className="opacity-60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{student.full_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">No plan assigned</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="border-dashed border-yellow-500/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="font-medium">{student.full_name || 'Unknown'}</p>
              <p className="text-sm text-yellow-600">Budget pending - awaiting payment completion</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallProgress = summary.totalAllocated > 0 
    ? (summary.totalSpent / summary.totalAllocated) * 100 
    : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{student.full_name || 'Unknown'}</CardTitle>
              <p className="text-sm text-muted-foreground">{student.phone || 'No phone'}</p>
            </div>
          </div>
          <Badge variant={plan.isVIP ? 'default' : 'secondary'}>
            {plan.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Budget Utilization</span>
            <span className="font-medium">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Spent: {formatAmount(summary.totalSpent, 'UZS')}</span>
            <span>Total: {formatAmount(summary.totalAllocated, 'UZS')}</span>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium text-muted-foreground">Budget Categories</p>
          {summary.categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.category] || FileText;
            const isFullySpent = cat.spent >= cat.allocated;
            
            return (
              <div 
                key={cat.category} 
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isFullySpent ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Remaining: {formatAmount(cat.remaining, 'UZS')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatAmount(cat.allocated, 'UZS')}</p>
                  {isFullySpent ? (
                    <Badge variant="outline" className="text-green-600 border-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Spent
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {Math.round(cat.progress)}% used
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Remaining Budget</span>
            <span className="text-lg font-bold text-primary">
              {formatAmount(summary.remaining, 'UZS')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
