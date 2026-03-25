import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Heart,
  TrendingUp,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  PieChart,
  RefreshCw,
  Loader2,
  Wallet,
  ArrowRight,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { useIncomeDistribution, MonthlyDistributionSummary, syncMissingDistributions } from '@/hooks/useIncomeDistribution';
import { useStaffBonuses } from '@/hooks/useStaffBonuses';
import { useDistributionTransfers } from '@/hooks/useDistributionTransfers';
import { formatAmount } from '@/hooks/useStudentPlan';
import { format, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WithdrawDialog } from './WithdrawDialog';
import { TransferToMonthlyDialog } from './TransferToMonthlyDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const recipientIcons: Record<string, typeof Users> = {
  owner: Users,
  charity: Heart,
  other: TrendingUp,
};

const recipientColors: Record<string, string> = {
  owner: 'text-blue-600 bg-blue-500/10 border-blue-500/20',
  charity: 'text-pink-600 bg-pink-500/10 border-pink-500/20',
  other: 'text-gray-600 bg-gray-500/10 border-gray-500/20',
};

export function IncomeDistributionPanel() {
  const { t } = useTranslation();
  const { 
    settings,
    loading, 
    getMonthlyDistributionSummary,
    markAsPaid
  } = useIncomeDistribution();

  const { syncMissingBonuses } = useStaffBonuses();
  const { 
    transfers, 
    loading: transfersLoading, 
    fetchTransfers, 
    getTotalTransfersForMonth,
    getTransferDeductionsByRecipient,
    deleteTransfer 
  } = useDistributionTransfers();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [summary, setSummary] = useState<MonthlyDistributionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingBonuses, setSyncingBonuses] = useState(false);
  const [totalTransfers, setTotalTransfers] = useState(0);
  const [transferDeductions, setTransferDeductions] = useState<Record<string, number>>({});
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState<{
    open: boolean;
    recipientName: string;
    pendingAmount: number;
    paidAmount: number;
    totalAmount: number;
  }>({ open: false, recipientName: '', pendingAmount: 0, paidAmount: 0, totalAmount: 0 });

  const loadSummary = async () => {
    setLoadingSummary(true);
    const month = format(selectedMonth, 'yyyy-MM');
    const [data, transferTotal, deductions] = await Promise.all([
      getMonthlyDistributionSummary(month),
      getTotalTransfersForMonth(month),
      getTransferDeductionsByRecipient(month),
    ]);
    setSummary(data);
    setTotalTransfers(transferTotal);
    setTransferDeductions(deductions);
    setLoadingSummary(false);
  };

  const loadTransfers = async () => {
    const month = format(selectedMonth, 'yyyy-MM');
    await fetchTransfers(month);
  };

  useEffect(() => {
    loadSummary();
    loadTransfers();
  }, [selectedMonth]);

  // Auto-refresh when distributions or transfers are updated
  useEffect(() => {
    const handler = () => {
      loadSummary();
      loadTransfers();
    };
    window.addEventListener('income-distribution-updated', handler);
    window.addEventListener('distribution-transfer-created', handler);
    return () => {
      window.removeEventListener('income-distribution-updated', handler);
      window.removeEventListener('distribution-transfer-created', handler);
    };
  }, [selectedMonth]);

  const handlePrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  const handleOpenWithdraw = (dist: {
    recipient_name: string;
    pending_amount: number;
    paid_amount: number;
    total_amount: number;
  }) => {
    setWithdrawDialog({
      open: true,
      recipientName: dist.recipient_name,
      pendingAmount: dist.pending_amount,
      paidAmount: dist.paid_amount,
      totalAmount: dist.total_amount,
    });
  };

  const handleSyncDistributions = async () => {
    setSyncing(true);
    try {
      const result = await syncMissingDistributions();
      if (result.skipped > 0) {
        toast.success(`${result.processed} ta taqsimot sinxronlandi, ${result.skipped} ta qisman to'lov o'tkazib yuborildi`);
      } else {
        toast.success(`${result.processed} ta taqsimot sinxronlandi`);
      }
      await loadSummary();
    } catch (err) {
      toast.error('Sinxronlash xatosi');
    }
    setSyncing(false);
  };

  const handleSyncBonuses = async () => {
    setSyncingBonuses(true);
    try {
      const result = await syncMissingBonuses();
      toast.success(`${result.created} ta bonus yaratildi`);
    } catch (err) {
      toast.error('Bonus sinxronlash xatosi');
    }
    setSyncingBonuses(false);
  };

  if (loading || loadingSummary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const monthLabel = format(selectedMonth, 'MMMM yyyy');
  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  // Fixed distribution percentages
  const fixedDistributions = [
    { name: 'Asrbek', percentage: 47.5, type: 'owner' },
    { name: 'Mukhsin', percentage: 47.5, type: 'owner' },
    { name: 'Charity', percentage: 5, type: 'charity' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Month Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5" />
              Daromad Taqsimoti
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center font-medium">{monthLabel}</span>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNextMonth}
                disabled={isCurrentMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Talabalar to'lovlaridan operatsion xarajatlar, budjetlar va xodim bonuslari ajratilgandan keyin qolgan sof daromad avtomatik taqsimlanadi.
          </div>

          {/* Sync Actions */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSyncBonuses}
              disabled={syncingBonuses}
            >
              {syncingBonuses ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Bonuslarni sinxronlash
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSyncDistributions}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Taqsimotlarni sinxronlash
            </Button>
          </div>
          
          {/* Distribution Percentages */}
          <div className="flex gap-4 flex-wrap">
            {fixedDistributions.map((dist) => {
              const Icon = recipientIcons[dist.type];
              const colorClass = recipientColors[dist.type];
              return (
                <div 
                  key={dist.name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{dist.name}</span>
                  <Badge variant="secondary" className="ml-1">
                    {dist.percentage}%
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Total Distributable Income */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Jami taqsimlanadigan daromad</p>
              <p className="text-3xl font-bold text-primary">
                {formatAmount((summary?.totalBaseAmount || 0) - totalTransfers, 'UZS')}
              </p>
            </div>
            
            {/* Transfer to Monthly Button */}
            {(summary?.totalBaseAmount || 0) - totalTransfers > 0 && (
              <TransferToMonthlyDialog
                availableBalance={(summary?.totalBaseAmount || 0) - totalTransfers}
                month={format(selectedMonth, 'yyyy-MM')}
                onSuccess={loadSummary}
                trigger={
                  <Button variant="outline" size="sm">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Oylik xarajatlarga o'tkazish
                  </Button>
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transfer History */}
      {transfers.length > 0 && (
        <Collapsible open={transferHistoryOpen} onOpenChange={setTransferHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Oylikka o'tkazishlar tarixi
                    <Badge variant="secondary">{transfers.length}</Badge>
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${transferHistoryOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {transfers.map((transfer) => (
                  <div key={transfer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                    <div>
                      <p className="font-medium">{formatAmount(transfer.total_amount, 'UZS')}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transfer.created_at), 'dd.MM.yyyy HH:mm')}
                        {transfer.notes && ` • ${transfer.notes}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        const result = await deleteTransfer(transfer.id);
                        if (result.success) {
                          toast.success("O'tkazish o'chirildi");
                          loadSummary();
                        } else {
                          toast.error(result.error || "Xatolik yuz berdi");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Individual Distributions */}
      {summary && summary.distributions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {summary.distributions.map((dist) => {
            const Icon = recipientIcons[dist.recipient_type as keyof typeof recipientIcons] || Users;
            const colorClass = recipientColors[dist.recipient_type as keyof typeof recipientColors] || recipientColors.other;
            
            // Calculate adjusted amounts after transfer deductions
            const recipientDeduction = transferDeductions[dist.recipient_name] || 0;
            const adjustedTotal = Math.max(0, dist.total_amount - recipientDeduction);
            const adjustedPending = Math.max(0, dist.pending_amount - recipientDeduction);
            const adjustedPaid = Math.min(dist.paid_amount, adjustedTotal);
            
            const paidPercent = adjustedTotal > 0 ? (adjustedPaid / adjustedTotal) * 100 : 0;
            
            return (
              <Card key={dist.recipient_name} className="overflow-hidden">
                <div className={`h-1.5 ${dist.recipient_type === 'owner' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {dist.recipient_name}
                    <Badge variant="outline" className="ml-auto">{dist.percentage}%</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formatAmount(adjustedTotal, 'UZS')}</p>
                  </div>
                  
                  <Progress value={paidPercent} className="h-2" />
                  
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      {formatAmount(adjustedPaid, 'UZS')}
                    </span>
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Clock className="h-3 w-3" />
                      {formatAmount(adjustedPending, 'UZS')}
                    </span>
                  </div>
                  
                  {/* Withdraw/Edit Button - always visible */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={() => handleOpenWithdraw({
                      ...dist,
                      total_amount: adjustedTotal,
                      pending_amount: adjustedPending,
                      paid_amount: adjustedPaid,
                    })}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Pul yechish / Tahrirlash
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Bu oy uchun daromad taqsimoti yo'q</p>
            <p className="text-sm mt-1">
              Talabalar to'lovlari qayd etilganda daromad avtomatik taqsimlanadi
            </p>
          </CardContent>
        </Card>
      )}

      {/* Withdraw Dialog */}
      <WithdrawDialog
        open={withdrawDialog.open}
        onOpenChange={(open) => setWithdrawDialog(prev => ({ ...prev, open }))}
        recipientName={withdrawDialog.recipientName}
        month={format(selectedMonth, 'yyyy-MM')}
        pendingAmount={withdrawDialog.pendingAmount}
        paidAmount={withdrawDialog.paidAmount}
        totalAmount={withdrawDialog.totalAmount}
        onSuccess={loadSummary}
      />
    </div>
  );
}
