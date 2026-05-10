import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface ReportData {
  students: {
    total: number;
    byMonth: { month: string; count: number }[];
    byLanguage: { language: string; count: number }[];
  };
  applications: {
    total: number;
    byStatus: { status: string; count: number }[];
    byUniversity: { university: string; count: number }[];
    byMonth: { month: string; submitted: number; completed: number }[];
    successRate: number;
  };
  payments: {
    totalRevenue: number;
    totalPending: number;
    byType: { type: string; amount: number; count: number }[];
    byMonth: { month: string; revenue: number; count: number }[];
    byStatus: { status: string; amount: number; count: number }[];
  };
  calls: {
    total: number;
    byDirection: { direction: string; count: number }[];
    byStatus: { status: string; count: number }[];
    totalDuration: number;
    avgDuration: number;
  };
  tasks: {
    total: number;
    completed: number;
    byPriority: { priority: string; count: number }[];
    byStatus: { status: string; count: number }[];
    completionRate: number;
  };
}

export interface DateRange {
  from: Date;
  to: Date;
}

export function useReports() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  const fetchReports = async (dateRange: DateRange) => {
    setLoading(true);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch all data in parallel
      const [
        profilesRes,
        applicationsRes,
        paymentsRes,
        callsRes,
        tasksRes,
        universitiesRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('applications').select('*, university:institutions(name_en, name_ko)'),
        supabase.from('payments').select('*').gte('created_at', fromDate).lte('created_at', toDate),
        supabase.from('calls').select('*').gte('started_at', fromDate).lte('started_at', toDate),
        supabase.from('tasks').select('*'),
        supabase.from('institutions').select('id, name_en, name_ko'),
      ]);

      const profiles = profilesRes.data || [];
      const applications = applicationsRes.data || [];
      const payments = paymentsRes.data || [];
      const calls = callsRes.data || [];
      const tasks = tasksRes.data || [];

      // Process students data
      const studentsByMonth: Record<string, number> = {};
      const studentsByLanguage: Record<string, number> = {};
      
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        studentsByMonth[format(d, 'MMM yyyy')] = 0;
      }

      profiles.forEach((p) => {
        const monthKey = format(new Date(p.created_at), 'MMM yyyy');
        if (studentsByMonth[monthKey] !== undefined) {
          studentsByMonth[monthKey]++;
        }
        const lang = p.preferred_language || 'uz';
        studentsByLanguage[lang] = (studentsByLanguage[lang] || 0) + 1;
      });

      // Process applications data
      const appsByStatus: Record<string, number> = {};
      const appsByUniversity: Record<string, number> = {};
      const appsByMonth: Record<string, { submitted: number; completed: number }> = {};

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        appsByMonth[format(d, 'MMM yyyy')] = { submitted: 0, completed: 0 };
      }

      applications.forEach((a) => {
        appsByStatus[a.status] = (appsByStatus[a.status] || 0) + 1;
        
        const uniName = (a.university as any)?.name_en || (a.university as any)?.name_uz || 'Unknown';
        appsByUniversity[uniName] = (appsByUniversity[uniName] || 0) + 1;

        const monthKey = format(new Date(a.created_at), 'MMM yyyy');
        if (appsByMonth[monthKey]) {
          appsByMonth[monthKey].submitted++;
          if (a.status === 'completed') {
            appsByMonth[monthKey].completed++;
          }
        }
      });

      const completedApps = applications.filter((a) => a.status === 'completed').length;
      const successRate = applications.length > 0 ? (completedApps / applications.length) * 100 : 0;

      // Process payments data
      const paymentsByType: Record<string, { amount: number; count: number }> = {};
      const paymentsByMonth: Record<string, { revenue: number; count: number }> = {};
      const paymentsByStatus: Record<string, { amount: number; count: number }> = {};

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        paymentsByMonth[format(d, 'MMM yyyy')] = { revenue: 0, count: 0 };
      }

      let totalRevenue = 0;
      let totalPending = 0;

      payments.forEach((p) => {
        // By type
        if (!paymentsByType[p.payment_type]) {
          paymentsByType[p.payment_type] = { amount: 0, count: 0 };
        }
        paymentsByType[p.payment_type].amount += Number(p.paid_amount);
        paymentsByType[p.payment_type].count++;

        // By status
        if (!paymentsByStatus[p.status]) {
          paymentsByStatus[p.status] = { amount: 0, count: 0 };
        }
        paymentsByStatus[p.status].amount += Number(p.amount);
        paymentsByStatus[p.status].count++;

        // By month
        const monthKey = format(new Date(p.created_at), 'MMM yyyy');
        if (paymentsByMonth[monthKey]) {
          paymentsByMonth[monthKey].revenue += Number(p.paid_amount);
          paymentsByMonth[monthKey].count++;
        }

        // Totals
        totalRevenue += Number(p.paid_amount);
        if (p.status === 'pending' || p.status === 'partial') {
          totalPending += Number(p.amount) - Number(p.paid_amount);
        }
      });

      // Process calls data
      const callsByDirection: Record<string, number> = { incoming: 0, outgoing: 0 };
      const callsByStatus: Record<string, number> = {};
      let totalDuration = 0;

      calls.forEach((c) => {
        callsByDirection[c.direction] = (callsByDirection[c.direction] || 0) + 1;
        callsByStatus[c.status] = (callsByStatus[c.status] || 0) + 1;
        totalDuration += c.duration || 0;
      });

      // Process tasks data
      const tasksByPriority: Record<string, number> = {};
      const tasksByStatus: Record<string, number> = {};
      let completedTasks = 0;

      tasks.forEach((t) => {
        tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
        tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
        if (t.status === 'completed') completedTasks++;
      });

      const reportData: ReportData = {
        students: {
          total: profiles.length,
          byMonth: Object.entries(studentsByMonth).map(([month, count]) => ({ month, count })),
          byLanguage: Object.entries(studentsByLanguage).map(([language, count]) => ({ language, count })),
        },
        applications: {
          total: applications.length,
          byStatus: Object.entries(appsByStatus).map(([status, count]) => ({ status, count })),
          byUniversity: Object.entries(appsByUniversity)
            .map(([university, count]) => ({ university, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          byMonth: Object.entries(appsByMonth).map(([month, data]) => ({ month, ...data })),
          successRate,
        },
        payments: {
          totalRevenue,
          totalPending,
          byType: Object.entries(paymentsByType).map(([type, data]) => ({ type, ...data })),
          byMonth: Object.entries(paymentsByMonth).map(([month, data]) => ({ month, ...data })),
          byStatus: Object.entries(paymentsByStatus).map(([status, data]) => ({ status, ...data })),
        },
        calls: {
          total: calls.length,
          byDirection: Object.entries(callsByDirection).map(([direction, count]) => ({ direction, count })),
          byStatus: Object.entries(callsByStatus).map(([status, count]) => ({ status, count })),
          totalDuration,
          avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          byPriority: Object.entries(tasksByPriority).map(([priority, count]) => ({ priority, count })),
          byStatus: Object.entries(tasksByStatus).map(([status, count]) => ({ status, count })),
          completionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
        },
      };

      setData(reportData);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch report data',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const exportToCSV = (reportType: string) => {
    if (!data) return;

    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'students':
        filename = 'students_report.csv';
        csvContent = 'Month,Count\n';
        data.students.byMonth.forEach((row) => {
          csvContent += `${row.month},${row.count}\n`;
        });
        csvContent += '\nLanguage,Count\n';
        data.students.byLanguage.forEach((row) => {
          csvContent += `${row.language},${row.count}\n`;
        });
        break;

      case 'applications':
        filename = 'applications_report.csv';
        csvContent = 'Status,Count\n';
        data.applications.byStatus.forEach((row) => {
          csvContent += `${row.status},${row.count}\n`;
        });
        csvContent += '\nUniversity,Count\n';
        data.applications.byUniversity.forEach((row) => {
          csvContent += `"${row.university}",${row.count}\n`;
        });
        csvContent += '\nMonth,Submitted,Completed\n';
        data.applications.byMonth.forEach((row) => {
          csvContent += `${row.month},${row.submitted},${row.completed}\n`;
        });
        break;

      case 'payments':
        filename = 'payments_report.csv';
        csvContent = `Total Revenue,$${data.payments.totalRevenue.toFixed(2)}\n`;
        csvContent += `Total Pending,$${data.payments.totalPending.toFixed(2)}\n\n`;
        csvContent += 'Payment Type,Amount,Count\n';
        data.payments.byType.forEach((row) => {
          csvContent += `${row.type},$${row.amount.toFixed(2)},${row.count}\n`;
        });
        csvContent += '\nMonth,Revenue,Count\n';
        data.payments.byMonth.forEach((row) => {
          csvContent += `${row.month},$${row.revenue.toFixed(2)},${row.count}\n`;
        });
        break;

      case 'calls':
        filename = 'calls_report.csv';
        csvContent = `Total Calls,${data.calls.total}\n`;
        csvContent += `Total Duration (min),${Math.round(data.calls.totalDuration / 60)}\n`;
        csvContent += `Avg Duration (sec),${data.calls.avgDuration}\n\n`;
        csvContent += 'Direction,Count\n';
        data.calls.byDirection.forEach((row) => {
          csvContent += `${row.direction},${row.count}\n`;
        });
        csvContent += '\nStatus,Count\n';
        data.calls.byStatus.forEach((row) => {
          csvContent += `${row.status},${row.count}\n`;
        });
        break;

      case 'tasks':
        filename = 'tasks_report.csv';
        csvContent = `Total Tasks,${data.tasks.total}\n`;
        csvContent += `Completed,${data.tasks.completed}\n`;
        csvContent += `Completion Rate,${data.tasks.completionRate.toFixed(1)}%\n\n`;
        csvContent += 'Priority,Count\n';
        data.tasks.byPriority.forEach((row) => {
          csvContent += `${row.priority},${row.count}\n`;
        });
        csvContent += '\nStatus,Count\n';
        data.tasks.byStatus.forEach((row) => {
          csvContent += `${row.status},${row.count}\n`;
        });
        break;

      default:
        return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    toast({
      title: 'Success',
      description: `${filename} downloaded successfully`,
    });
  };

  return {
    data,
    loading,
    fetchReports,
    exportToCSV,
  };
}
