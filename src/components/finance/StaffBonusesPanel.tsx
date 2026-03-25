import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Gift, 
  User, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Users,
  Calendar,
  Award,
  RefreshCw
} from 'lucide-react';
import { useStaffBonuses, BONUS_AMOUNTS, StaffBonus } from '@/hooks/useStaffBonuses';
import { useStaffManagement, StaffMember } from '@/hooks/useStaffManagement';
import { formatAmount } from '@/hooks/useStudentPlan';
import { Skeleton } from '@/components/ui/skeleton';

export function StaffBonusesPanel() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  
  const { 
    bonuses, 
    loading, 
    assignBonus, 
    markAsPaid, 
    markMonthlyBonusesAsPaid,
    getMonthlySummary,
    getUnassignedBonuses,
    getStats,
    syncMissingBonuses,
    refetch
  } = useStaffBonuses();
  
  const { staff, loading: staffLoading } = useStaffManagement();
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState('unassigned');
  const [syncing, setSyncing] = useState(false);

  const handleSyncBonuses = async () => {
    setSyncing(true);
    try {
      await syncMissingBonuses();
    } finally {
      setSyncing(false);
    }
  };

  // Filter staff to only admins and call operators (eligible for bonuses)
  const eligibleStaff = staff.filter(s => 
    s.roles.includes('admin') || s.roles.includes('call_operator')
  );

  const stats = getStats();
  const unassignedBonuses = getUnassignedBonuses();
  const monthlySummary = getMonthlySummary(selectedMonth);

  // Generate last 12 months for selection
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return format(date, 'yyyy-MM');
  });

  const handleAssignBonus = async (bonusId: string, staffUserId: string) => {
    await assignBonus(bonusId, staffUserId);
  };

  const handleMarkPaid = async (bonusId: string) => {
    await markAsPaid(bonusId);
  };

  const handlePayMonthlyBonuses = async (staffUserId: string) => {
    await markMonthlyBonusesAsPaid(staffUserId, selectedMonth);
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      standart: 'STANDART',
      premium: 'PREMIUM',
      no_risk: 'NO RISK',
    };
    return labels[plan] || plan.toUpperCase();
  };

  const getStatusBadge = (status: StaffBonus['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> {lang === 'uz' ? 'Kutilmoqda' : 'Pending'}</Badge>;
      case 'assigned':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><User className="h-3 w-3 mr-1" /> {lang === 'uz' ? 'Tayinlangan' : 'Assigned'}</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> {lang === 'uz' ? "To'langan" : 'Paid'}</Badge>;
    }
  };

  if (loading || staffLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === 'uz' ? 'Tayinlanmagan' : 'Unassigned'}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.unassignedCount}</p>
              </div>
              <Gift className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === 'uz' ? 'Tayinlangan' : 'Assigned'}</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.assignedCount}</p>
              </div>
              <User className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === 'uz' ? "To'langan" : 'Paid'}</p>
                <p className="text-2xl font-bold text-green-600">{stats.paidCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === 'uz' ? 'Bu oy jami' : 'This Month'}</p>
                <p className="text-2xl font-bold text-blue-600">{formatAmount(stats.currentMonthTotal, 'UZS')}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bonus Rates Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {lang === 'uz' ? 'Bonus Stavkalari' : 'Bonus Rates'}
            </div>
            <Button 
              onClick={handleSyncBonuses} 
              disabled={syncing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? (lang === 'uz' ? 'Sinxronlanmoqda...' : 'Syncing...') : (lang === 'uz' ? 'Sinxronlash' : 'Sync Bonuses')}
            </Button>
          </CardTitle>
          <CardDescription>
            {lang === 'uz' ? 'Har bir shartnoma uchun bonus miqdori' : 'Bonus amount per contract'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
              <Badge variant="secondary">STANDART</Badge>
              <span className="font-semibold">{formatAmount(BONUS_AMOUNTS.standart, 'UZS')}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
              <Badge className="bg-purple-500">PREMIUM</Badge>
              <span className="font-semibold">{formatAmount(BONUS_AMOUNTS.premium, 'UZS')}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
              <Badge className="bg-yellow-500 text-black">NO RISK</Badge>
              <span className="font-semibold">{formatAmount(BONUS_AMOUNTS.no_risk, 'UZS')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="unassigned" className="gap-2">
            <Gift className="h-4 w-4" />
            {lang === 'uz' ? 'Tayinlanmagan' : 'Unassigned'}
            {unassignedBonuses.length > 0 && (
              <Badge variant="destructive" className="ml-1">{unassignedBonuses.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar className="h-4 w-4" />
            {lang === 'uz' ? 'Oylik Hisobot' : 'Monthly Summary'}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <Users className="h-4 w-4" />
            {lang === 'uz' ? 'Barcha Bonuslar' : 'All Bonuses'}
          </TabsTrigger>
        </TabsList>

        {/* Unassigned Bonuses */}
        <TabsContent value="unassigned" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{lang === 'uz' ? 'Tayinlanmagan Bonuslar' : 'Unassigned Bonuses'}</CardTitle>
              <CardDescription>
                {lang === 'uz' 
                  ? 'Qaysi xodimga berishni tanlang' 
                  : 'Select which staff member should receive each bonus'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedBonuses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{lang === 'uz' ? 'Tayinlanmagan bonus yo\'q' : 'No unassigned bonuses'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === 'uz' ? 'Talaba' : 'Student'}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Reja' : 'Plan'}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Bonus' : 'Bonus'}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Sana' : 'Date'}</TableHead>
                      <TableHead>{lang === 'uz' ? 'Tayinlash' : 'Assign To'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unassignedBonuses.map((bonus) => (
                      <TableRow key={bonus.id}>
                        <TableCell className="font-medium">{bonus.student_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getPlanLabel(bonus.plan_type)}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatAmount(bonus.bonus_amount, bonus.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(bonus.created_at), 'dd.MM.yyyy')}
                        </TableCell>
                        <TableCell>
                          <Select onValueChange={(value) => handleAssignBonus(bonus.id, value)}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder={lang === 'uz' ? 'Xodimni tanlang' : 'Select staff'} />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleStaff.map((s) => (
                                <SelectItem key={s.user_id} value={s.user_id}>
                                  {s.full_name || 'Unknown'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Summary */}
        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{lang === 'uz' ? 'Oylik Bonus Hisoboti' : 'Monthly Bonus Report'}</CardTitle>
                  <CardDescription>
                    {lang === 'uz' ? 'Xodimlar bo\'yicha bonus jamlanmasi' : 'Bonus summary by staff member'}
                  </CardDescription>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {format(new Date(month + '-01'), 'MMMM yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {monthlySummary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{lang === 'uz' ? 'Bu oy uchun bonus topilmadi' : 'No bonuses found for this month'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{lang === 'uz' ? 'Xodim' : 'Staff Member'}</TableHead>
                      <TableHead className="text-center">{lang === 'uz' ? 'Shartnomalar' : 'Contracts'}</TableHead>
                      <TableHead className="text-center">{lang === 'uz' ? "To'langan" : 'Paid'}</TableHead>
                      <TableHead className="text-center">{lang === 'uz' ? 'Kutilmoqda' : 'Pending'}</TableHead>
                      <TableHead className="text-right">{lang === 'uz' ? 'Jami' : 'Total'}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlySummary.map((summary) => (
                      <TableRow key={summary.staff_user_id}>
                        <TableCell className="font-medium">{summary.staff_name}</TableCell>
                        <TableCell className="text-center">{summary.bonus_count}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default" className="bg-green-500">{summary.paid_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {summary.pending_count > 0 && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              {summary.pending_count}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatAmount(summary.total_amount, 'UZS')}
                        </TableCell>
                        <TableCell>
                          {summary.pending_count > 0 && (
                            <Button 
                              size="sm" 
                              onClick={() => handlePayMonthlyBonuses(summary.staff_user_id)}
                            >
                              {lang === 'uz' ? "To'lash" : 'Pay All'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Bonuses */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{lang === 'uz' ? 'Barcha Bonuslar' : 'All Bonuses'}</CardTitle>
              <CardDescription>
                {lang === 'uz' ? 'Barcha bonuslar tarixi' : 'Complete bonus history'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === 'uz' ? 'Talaba' : 'Student'}</TableHead>
                    <TableHead>{lang === 'uz' ? 'Reja' : 'Plan'}</TableHead>
                    <TableHead>{lang === 'uz' ? 'Bonus' : 'Bonus'}</TableHead>
                    <TableHead>{lang === 'uz' ? 'Xodim' : 'Staff'}</TableHead>
                    <TableHead>{lang === 'uz' ? 'Holat' : 'Status'}</TableHead>
                    <TableHead>{lang === 'uz' ? 'Oy' : 'Month'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonuses.slice(0, 50).map((bonus) => (
                    <TableRow key={bonus.id}>
                      <TableCell className="font-medium">{bonus.student_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getPlanLabel(bonus.plan_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatAmount(bonus.bonus_amount, bonus.currency)}
                      </TableCell>
                      <TableCell>
                        {bonus.staff_name || (
                          <span className="text-muted-foreground italic">
                            {lang === 'uz' ? 'Tayinlanmagan' : 'Unassigned'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(bonus.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {bonus.month_year}
                      </TableCell>
                      <TableCell>
                        {bonus.status === 'assigned' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMarkPaid(bonus.id)}
                          >
                            {lang === 'uz' ? "To'lash" : 'Mark Paid'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
