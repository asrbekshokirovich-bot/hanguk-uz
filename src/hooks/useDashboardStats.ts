import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';

interface DashboardStats {
  totalStudents: number;
  activeApplications: number;
  pendingDocuments: number;
  completedApplications: number;
  totalCalls: number;
  unreadMessages: number;
  pendingTasks: number;
  pendingPayments: number;
  recentActivity: ActivityItem[];
  applicationsByStatus: { status: string; count: number }[];
  applicationsByMonth: { month: string; count: number }[];
  callsByDay: { day: string; incoming: number; outgoing: number }[];
  tasksByPriority: { priority: string; count: number }[];
}

interface ActivityItem {
  id: string;
  type: 'application' | 'document' | 'payment' | 'message' | 'call' | 'task';
  title: string;
  description: string;
  timestamp: string;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeApplications: 0,
    pendingDocuments: 0,
    completedApplications: 0,
    totalCalls: 0,
    unreadMessages: 0,
    pendingTasks: 0,
    pendingPayments: 0,
    recentActivity: [],
    applicationsByStatus: [],
    applicationsByMonth: [],
    callsByDay: [],
    tasksByPriority: [],
  });
  const [loading, setLoading] = useState(true);
  const { activeIntakeId } = useActiveIntake();

  const fetchStats = async () => {
    // Wait until the active intake has resolved, so the dashboard never shows
    // another season's numbers in the gap before the intake loads.
    if (!activeIntakeId) return;
    setLoading(true);

    try {
      // Fetch all data in parallel — intake-scoped wherever the table carries
      // an intake_id (applications, documents, tasks, payments). Calls and
      // messages are agency-wide ops and stay global.
      const [
        applicationsRes,
        pendingDocsRes,
        callsRes,
        unreadMsgRes,
        pendingTasksRes,
        pendingPaymentsRes,
        completedAppsRes,
        // Status-based application counts (avoids 1000-row limit)
        appsPendingCount,
        appsSubmittedCount,
        appsInReviewCount,
        appsRejectedCount,
        // Priority-based task counts
        taskHighCount,
        taskNormalCount,
        taskLowCount,
        taskUrgentCount,
        // Per-intake roster = explicit membership (role-independent), plus staff
        // ids so we can exclude them.
        membersRes,
        staffRolesRes,
      ] = await Promise.all([
        applyIntake(supabase.from('applications').select('id, status, created_at, student_id'), activeIntakeId),
        applyIntake(supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'uploaded'), activeIntakeId),
        supabase.from('calls').select('*').order('started_at', { ascending: false }).limit(100),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'unread').eq('direction', 'incoming'),
        applyIntake(supabase.from('tasks').select('id, title, priority, status, created_at, due_date').neq('status', 'completed').neq('status', 'cancelled'), activeIntakeId),
        applyIntake(supabase.from('payments').select('id', { count: 'exact', head: true }).in('status', ['pending', 'partial']), activeIntakeId),
        applyIntake(supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'completed'), activeIntakeId),
        applyIntake(supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'), activeIntakeId),
        applyIntake(supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'), activeIntakeId),
        applyIntake(supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'in_review'), activeIntakeId),
        applyIntake(supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'), activeIntakeId),
        applyIntake(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'high').neq('status', 'completed').neq('status', 'cancelled'), activeIntakeId),
        applyIntake(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'normal').neq('status', 'completed').neq('status', 'cancelled'), activeIntakeId),
        applyIntake(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'low').neq('status', 'completed').neq('status', 'cancelled'), activeIntakeId),
        applyIntake(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'completed').neq('status', 'cancelled'), activeIntakeId),
        supabase.from('student_intakes').select('student_id').eq('intake_id', activeIntakeId),
        supabase.from('user_roles').select('user_id'),
      ]);

      const applications = applicationsRes.data || [];
      const calls = callsRes.data || [];
      const tasks = pendingTasksRes.data || [];

      // Per-intake student count = members of this season, excluding staff.
      const staffIds = new Set((staffRolesRes.data || []).map((r) => r.user_id));
      const studentIds = new Set<string>();
      for (const m of (membersRes.data || [])) {
        if (m.student_id && !staffIds.has(m.student_id)) studentIds.add(m.student_id);
      }
      const totalStudents = studentIds.size;
      const activeApplications = applications.filter(
        (a) => !['completed', 'rejected'].includes(a.status)
      ).length;
      const pendingDocuments = pendingDocsRes.count || 0;
      const completedApplications = completedAppsRes.count || 0;
      const totalCalls = calls.length;
      const unreadMessages = unreadMsgRes.count || 0;
      const pendingTasks = tasks.length;
      const pendingPayments = pendingPaymentsRes.count || 0;

      // Applications by status (using accurate head counts for large datasets)
      const applicationsByStatus = [
        { status: 'pending', count: appsPendingCount.count || 0 },
        { status: 'submitted', count: appsSubmittedCount.count || 0 },
        { status: 'in_review', count: appsInReviewCount.count || 0 },
        { status: 'completed', count: completedApplications },
        { status: 'rejected', count: appsRejectedCount.count || 0 },
      ].filter(s => s.count > 0);

      // Applications by month (last 6 months)
      const monthCounts: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthCounts[key] = 0;
      }
      applications.forEach((a) => {
        const d = new Date(a.created_at);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthCounts[key] !== undefined) {
          monthCounts[key]++;
        }
      });
      const applicationsByMonth = Object.entries(monthCounts).map(([month, count]) => ({
        month,
        count,
      }));

      // Calls by day (last 7 days)
      const dayCalls: Record<string, { incoming: number; outgoing: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-US', { weekday: 'short' });
        dayCalls[key] = { incoming: 0, outgoing: 0 };
      }
      calls.forEach((c) => {
        const d = new Date(c.started_at);
        const key = d.toLocaleDateString('en-US', { weekday: 'short' });
        if (dayCalls[key]) {
          if (c.direction === 'incoming') dayCalls[key].incoming++;
          else dayCalls[key].outgoing++;
        }
      });
      const callsByDay = Object.entries(dayCalls).map(([day, counts]) => ({
        day,
        ...counts,
      }));

      // Tasks by priority (using accurate head counts)
      const tasksByPriority = [
        { priority: 'urgent', count: taskUrgentCount.count || 0 },
        { priority: 'high', count: taskHighCount.count || 0 },
        { priority: 'normal', count: taskNormalCount.count || 0 },
        { priority: 'low', count: taskLowCount.count || 0 },
      ].filter(t => t.count > 0);

      // Recent activity (mock for now - combine recent items)
      const recentActivity: ActivityItem[] = [];

      // Add recent applications
      applications.slice(0, 3).forEach((a) => {
        recentActivity.push({
          id: a.id,
          type: 'application',
          title: 'New Application',
          description: `Application status: ${a.status}`,
          timestamp: a.created_at,
        });
      });

      // Add recent tasks
      tasks.slice(0, 2).forEach((t) => {
        recentActivity.push({
          id: t.id,
          type: 'task',
          title: t.title,
          description: `Priority: ${t.priority}`,
          timestamp: t.created_at,
        });
      });

      // Sort by timestamp
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        totalStudents,
        activeApplications,
        pendingDocuments,
        completedApplications,
        totalCalls,
        unreadMessages,
        pendingTasks,
        pendingPayments,
        recentActivity: recentActivity.slice(0, 5),
        applicationsByStatus,
        applicationsByMonth,
        callsByDay,
        tasksByPriority,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntakeId]);

  return { stats, loading, refetch: fetchStats };
}
