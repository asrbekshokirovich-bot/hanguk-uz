import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PieChart, TrendingUp, Users, Home, Zap, DollarSign, ArrowRight } from 'lucide-react';
import { formatAmount } from '@/hooks/useStudentPlan';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface FundSummary {
  month: string;
  totalCollected: number;
  totalTarget: number;
  coveragePercent: number;
  categories: Array<{
    id: string;
    name: string;
    target: number;
    collected: number;
    category_type: string;
    coveragePercent: number;
  }>;
}

interface FundDistributionPanelProps {
  summary: FundSummary;
}

const categoryIcons: Record<string, typeof Users> = {
  salary: Users,
  rent: Home,
  utilities: Zap,
  other: DollarSign,
};

const categoryColors: Record<string, string> = {
  salary: 'text-blue-600',
  rent: 'text-purple-600',
  utilities: 'text-yellow-600',
  other: 'text-gray-600',
};

export function FundDistributionPanel({ summary }: FundDistributionPanelProps) {
  const { t } = useTranslation();
  const [manualTransferTotal, setManualTransferTotal] = useState(0);

  // Fetch manual transfer totals for this month
  useEffect(() => {
    const fetchManualTransfers = async () => {
      const { data } = await supabase
        .from('distribution_transfers')
        .select('total_amount')
        .eq('transfer_month', summary.month);
      
      if (data) {
        const total = data.reduce((sum, t) => sum + Number(t.total_amount), 0);
        setManualTransferTotal(total);
      }
    };

    fetchManualTransfers();

    // Listen for transfer events
    const handler = () => fetchManualTransfers();
    window.addEventListener('distribution-transfer-created', handler);
    return () => window.removeEventListener('distribution-transfer-created', handler);
  }, [summary.month]);

  const monthLabel = format(new Date(summary.month + '-01'), 'MMMM yyyy');
  const adjustedTotalCollected = summary.totalCollected + manualTransferTotal;
  const adjustedCoveragePercent = summary.totalTarget > 0 
    ? (adjustedTotalCollected / summary.totalTarget) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Fund Distribution - {monthLabel}
          </div>
          <Badge 
            variant={adjustedCoveragePercent >= 100 ? 'default' : 'secondary'}
            className={adjustedCoveragePercent >= 100 ? 'bg-green-500' : ''}
          >
            {adjustedCoveragePercent.toFixed(1)}% Covered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Collected</span>
            <span className="font-medium">
              {formatAmount(adjustedTotalCollected, 'UZS')} / {formatAmount(summary.totalTarget, 'UZS')}
            </span>
          </div>
          <Progress 
            value={Math.min(adjustedCoveragePercent, 100)} 
            className="h-3"
          />
          {manualTransferTotal > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>
                Avtomatik: {formatAmount(summary.totalCollected, 'UZS')} + 
                Qo'lda o'tkazilgan: {formatAmount(manualTransferTotal, 'UZS')}
              </span>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        {summary.categories.length > 0 ? (
          <div className="space-y-3 pt-2">
            {summary.categories.map((category) => {
              const Icon = categoryIcons[category.category_type] || DollarSign;
              const colorClass = categoryColors[category.category_type] || 'text-gray-600';
              
              return (
                <div key={category.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${colorClass}`} />
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatAmount(category.collected, 'UZS')} / {formatAmount(category.target, 'UZS')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(category.coveragePercent, 100)} 
                      className="h-2 flex-1"
                    />
                    <span className="text-xs w-12 text-right">
                      {category.coveragePercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No allocations this month yet</p>
            <p className="text-xs">Funds will be distributed when student payments are recorded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
