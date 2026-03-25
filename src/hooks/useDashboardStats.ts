import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchStats = async () => {
    setLoading(true);

    try {
      // First, get all staff user IDs (users with roles)
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id');
      
      const staffUserIds = staffRoles?.map(r => r.user_id) || [];

      // Fetch all data in parallel
      const [
        profilesRes,
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
      ] = await Promise.all([
        supabase.from('profiles').select('user_id'),
        supabase.from('applications').select('id, status, created_at'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'uploaded'),
        supabase.from('calls').select('*').order('started_at', { ascending: false }).limit(100),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'unread').eq('direction', 'incoming'),
        supabase.from('tasks').select('id, title, priority, status, created_at, due_date').neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).in('status', ['pending', 'partial']),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        // Individual status counts for accurate stats beyond 1000-row limit
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        // Task priority counts
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'high').neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'normal').neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'low').neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'completed').neq('status', 'cancelled'),
      ]);

      const profiles = profilesRes.data || [];
      const applications = applicationsRes.data || [];
      const calls = callsRes.data || [];
      const tasks = pendingTasksRes.data || [];

      // Calculate stats - filter out staff from student count
      const totalStudents = profiles.filter(p => !staffUserIds.includes(p.user_id)).length;
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
  }, []);

  return { stats, loading, refetch: fetchStats };
}
