import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  GraduationCap,
  Search,
  DollarSign,
  CreditCard
} from 'lucide-react';
import { useCRMData } from '@/hooks/useCRMData';
import { usePayments } from '@/hooks/usePayments';
import { useExpectedPayments, ExpectedPayment } from '@/hooks/useExpectedPayments';
import { formatAmount, getDaysUntilDue } from '@/hooks/useStudentPlan';

interface ScheduledPaymentsPanelProps {
  initialStatusFilter?: string;
}

export function ScheduledPaymentsPanel({ initialStatusFilter = 'all' }: ScheduledPaymentsPanelProps) {
  const { t } = useTranslation();
  const { students, loading: studentsLoading } = useCRMData();
  const { payments, loading: paymentsLoading } = usePayments();
  const { expectedPayments, stats } = useExpectedPayments(students, payments);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Update filter when prop changes
  useEffect(() => {
    if (initialStatusFilter !== statusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const loading = studentsLoading || paymentsLoading;

  // Helper to check if payment is overdue
  const isPaymentOverdue = (ep: ExpectedPayment) => {
    if (ep.status === 'completed') return false;
    if (!ep.due_date) return false;
    const dueInfo = getDaysUntilDue(ep.due_date);
    return dueInfo.isOverdue;
  };

  const filteredPayments = expectedPayments.filter(ep => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = ep.student_name?.toLowerCase().includes(query);
      const phoneMatch = ep.student_phone?.toLowerCase().includes(query);
      if (!nameMatch && !phoneMatch) return false;
    }

    // Status filter - special handling for "overdue"
    if (statusFilter === 'overdue') {
      if (!isPaymentOverdue(ep)) return false;
    } else if (statusFilter !== 'all' && ep.status !== statusFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all' && ep.payment_type !== typeFilter) {
      return false;
    }

    return true;
  });

  const getStatusIcon = (ep: ExpectedPayment) => {
    if (ep.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    if (ep.status === 'partial') {
      return <CreditCard className="h-4 w-4 text-info" />;
    }
    if (ep.payment_type === 'second_payment') {
      return <GraduationCap className="h-4 w-4 text-primary" />;
    }
    return <Calendar className="h-4 w-4 text-warning" />;
  };

  const getStatusBadge = (ep: ExpectedPayment) => {
    if (ep.status === 'completed') {
      return <Badge variant="default" className="bg-success">Completed</Badge>;
    }

    // Check if overdue
    if (ep.due_date) {
      const dueInfo = getDaysUntilDue(ep.due_date);
      if (dueInfo.isOverdue) {
        return <Badge variant="destructive">Overdue {dueInfo.days}d</Badge>;
      }
      if (dueInfo.days <= 3) {
        return <Badge variant="secondary" className="bg-warning/20 text-warning">Due Soon</Badge>;
      }
    }

    if (ep.status === 'partial') {
      return <Badge variant="default" className="bg-info">Partial</Badge>;
    }

    // Waiting for admission (second payment without due date)
    if (ep.payment_type === 'second_payment' && !ep.due_date) {
      return <Badge variant="outline" className="border-primary text-primary">Awaiting Admission</Badge>;
    }

    return <Badge variant="outline">Scheduled</Badge>;
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'full_payment': return 'Full Payment';
      case 'first_payment': return '1st Payment';
      case 'second_payment': return '2nd Payment';
      default: return type;
    }
  };

  const getProgressPercent = (ep: ExpectedPayment) => {
    if (ep.expected_amount === 0) return 0;
    return Math.min(100, (ep.paid_amount / ep.expected_amount) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{formatAmount(stats.remainingUZS, 'UZS')}</p>
                <p className="text-xs text-muted-foreground">Remaining (UZS)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{formatAmount(stats.remainingUSD, 'USD')}</p>
                <p className="text-xs text-muted-foreground">Remaining (USD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.overdueCount}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-info" />
              <div>
                <p className="text-2xl font-bold">{stats.notStartedCount}</p>
                <p className="text-xs text-muted-foreground">Not Started</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-4 w-4 text-warning" />
            <div>
              <p className="text-lg font-semibold">{stats.dueThisWeekCount}</p>
              <p className="text-xs text-muted-foreground">Due This Week</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-info" />
            <div>
              <p className="text-lg font-semibold">{stats.partialCount}</p>
              <p className="text-xs text-muted-foreground">Partial Payments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-4 w-4 text-success" />
            <div>
              <p className="text-lg font-semibold">{stats.completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Payment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="full_payment">Full Payment</SelectItem>
                  <SelectItem value="first_payment">1st Payment</SelectItem>
                  <SelectItem value="second_payment">2nd Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No scheduled payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((ep) => (
                      <TableRow key={ep.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(ep)}
                            <div>
                              <p className="font-medium">{ep.student_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{ep.student_phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium uppercase text-xs">{ep.payment_plan}</p>
                            <p className="text-xs text-muted-foreground">
                              {ep.payment_mode === 'installment' ? 'Split' : 'One-time'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getPaymentTypeLabel(ep.payment_type)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="w-24 space-y-1">
                            <Progress value={getProgressPercent(ep)} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                              {formatAmount(ep.paid_amount, ep.currency)} / {formatAmount(ep.expected_amount, ep.currency)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-destructive">
                            {formatAmount(ep.remaining_amount, ep.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {ep.due_date ? (
                            <div>
                              <p>{format(new Date(ep.due_date), 'MMM d, yyyy')}</p>
                              {ep.status !== 'completed' && (
                                <p className="text-xs text-muted-foreground">
                                  {getDaysUntilDue(ep.due_date).isOverdue
                                    ? `${getDaysUntilDue(ep.due_date).days} days overdue`
                                    : `In ${getDaysUntilDue(ep.due_date).days} days`
                                  }
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              {ep.payment_type === 'second_payment' ? 'Pending admission' : 'Not set'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(ep)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            About Expected Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This panel shows all expected payments based on each student's plan. 
            For split-payment students, the 2nd payment due date is set after university admission. 
            Partial payments show how much has been paid and what remains.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
