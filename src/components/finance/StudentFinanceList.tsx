import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Users } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { Payment } from '@/hooks/usePayments';
import { StudentFinanceCard } from './StudentFinanceCard';
import { AddPaymentDialog } from '@/components/crm/AddPaymentDialog';
import { PAYMENT_PLANS } from '@/hooks/useStudentPlan';

interface StudentFinanceListProps {
  students: (Tables<'profiles'> & {
    applications?: (Tables<'applications'> & {
      university?: Tables<'universities'>;
    })[];
    discountPercent?: number;
  })[];
  payments: Payment[];
  onRefresh: () => void;
}

export function StudentFinanceList({ 
  students, 
  payments,
  onRefresh 
}: StudentFinanceListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'profiles'> | null>(null);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // Only show students with payment plans
      if (!student.payment_plan) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = student.full_name?.toLowerCase().includes(query);
        const phoneMatch = student.phone?.toLowerCase().includes(query);
        if (!nameMatch && !phoneMatch) return false;
      }

      // Plan filter
      if (planFilter !== 'all' && student.payment_plan?.toLowerCase() !== planFilter) {
        return false;
      }

      // Mode filter
      if (modeFilter !== 'all') {
        const mode = student.payment_mode || 'one_time';
        if (mode !== modeFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const studentPayments = payments.filter(p => p.student_id === student.user_id);
        const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
        const hasOverdue = studentPayments.some(p => p.status === 'overdue');
        const hasPartial = studentPayments.some(p => p.status === 'partial');
        const allCompleted = studentPayments.length > 0 && 
          studentPayments.every(p => p.status === 'completed');

        if (statusFilter === 'completed' && !allCompleted) return false;
        if (statusFilter === 'partial' && !hasPartial) return false;
        if (statusFilter === 'overdue' && !hasOverdue) return false;
        if (statusFilter === 'pending' && (allCompleted || hasPartial || hasOverdue)) return false;
      }

      return true;
    });
  }, [students, payments, searchQuery, planFilter, modeFilter, statusFilter]);

  const handleRecordPayment = (student: Tables<'profiles'>) => {
    setSelectedStudent(student);
    setPaymentDialogOpen(true);
  };

  // Get existing payments for the selected student
  const selectedStudentPayments = selectedStudent 
    ? payments
        .filter(p => p.student_id === selectedStudent.user_id)
        .map(p => ({ payment_type: p.payment_type, status: p.status }))
    : [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {PAYMENT_PLANS.map(plan => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="installment">Split</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{filteredStudents.length} students found</span>
        {(planFilter !== 'all' || modeFilter !== 'all' || statusFilter !== 'all') && (
          <Badge variant="outline" className="ml-2">Filtered</Badge>
        )}
      </div>

      {/* Student Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.map(student => (
          <StudentFinanceCard
            key={student.id}
            student={student}
            payments={payments.filter(p => p.student_id === student.user_id)}
            onRecordPayment={() => handleRecordPayment(student)}
          />
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No students found matching your criteria
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Payment Dialog */}
      {selectedStudent && (
        <AddPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          studentId={selectedStudent.user_id}
          studentPlan={selectedStudent.payment_plan}
          studentPaymentMode={selectedStudent.payment_mode}
          contractDate={selectedStudent.contract_date}
          existingPayments={selectedStudentPayments}
          onSuccess={() => {
            onRefresh();
            setPaymentDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
