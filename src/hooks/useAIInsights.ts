import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Insight {
  id: string;
  type: 'urgent' | 'warning' | 'info' | 'success';
  category: 'payment' | 'document' | 'task' | 'student' | 'message' | 'application';
  title: string;
  description: string;
  action?: {
    label: string;
    path: string;
  };
  count?: number;
  items?: Array<{
    id: string;
    name: string;
    detail: string;
  }>;
}

export function useAIInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = async () => {
    if (!user) return;
    
    setLoading(true);
    const insightsList: Insight[] = [];

    try {
      // 1. Check for overdue payments
      const { data: overduePayments } = await supabase
        .from('payments')
        .select('id, amount, paid_amount, student_id')
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(5);

      if (overduePayments && overduePayments.length > 0) {
        // Get student names
        const studentIds = overduePayments.map(p => p.student_id);
        const { data: students } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', studentIds);
        
        const studentMap = new Map((students || []).map(s => [s.user_id, s.full_name]));

        insightsList.push({
          id: 'overdue-payments',
          type: 'urgent',
          category: 'payment',
          title: `${overduePayments.length} Overdue Payment${overduePayments.length > 1 ? 's' : ''}`,
          description: 'Students with past-due payments need immediate follow-up.',
          action: { label: 'View Payments', path: '/crm/payments' },
          count: overduePayments.length,
          items: overduePayments.map(p => ({
            id: p.id,
            name: studentMap.get(p.student_id) || 'Unknown',
            detail: `$${Number(p.amount) - Number(p.paid_amount)} overdue`
          }))
        });
      }

      // 2. Check for pending payments due soon (within 7 days)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const { data: upcomingPayments } = await supabase
        .from('payments')
        .select('id, amount, paid_amount, due_date, student_id')
        .eq('status', 'pending')
        .lte('due_date', sevenDaysFromNow.toISOString())
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      if (upcomingPayments && upcomingPayments.length > 0) {
        const studentIds = upcomingPayments.map(p => p.student_id);
        const { data: students } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', studentIds);
        
        const studentMap = new Map((students || []).map(s => [s.user_id, s.full_name]));

        insightsList.push({
          id: 'upcoming-payments',
          type: 'warning',
          category: 'payment',
          title: `${upcomingPayments.length} Payment${upcomingPayments.length > 1 ? 's' : ''} Due Soon`,
          description: 'Payments due within the next 7 days.',
          action: { label: 'View Payments', path: '/crm/payments' },
          count: upcomingPayments.length,
          items: upcomingPayments.map(p => ({
            id: p.id,
            name: studentMap.get(p.student_id) || 'Unknown',
            detail: `$${Number(p.amount) - Number(p.paid_amount)} due ${p.due_date ? new Date(p.due_date).toLocaleDateString() : 'soon'}`
          }))
        });
      }

      // 3. Check for pending document reviews
      const { data: pendingDocs } = await supabase
        .from('documents')
        .select('id, name, created_at, student_id')
        .eq('status', 'uploaded')
        .order('created_at', { ascending: true })
        .limit(10);

      if (pendingDocs && pendingDocs.length > 0) {
        const oldDocs = pendingDocs.filter(d => {
          const uploadedDate = new Date(d.created_at);
          const daysSinceUpload = (Date.now() - uploadedDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUpload > 3;
        });

        if (oldDocs.length > 0) {
          const studentIds = oldDocs.map(d => d.student_id);
          const { data: students } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', studentIds);
          
          const studentMap = new Map((students || []).map(s => [s.user_id, s.full_name]));

          insightsList.push({
            id: 'old-pending-docs',
            type: 'warning',
            category: 'document',
            title: `${oldDocs.length} Document${oldDocs.length > 1 ? 's' : ''} Waiting 3+ Days`,
            description: 'Documents uploaded more than 3 days ago need review.',
            action: { label: 'Review Documents', path: '/crm/documents' },
            count: oldDocs.length,
            items: oldDocs.slice(0, 5).map(d => ({
              id: d.id,
              name: studentMap.get(d.student_id) || 'Unknown',
              detail: d.name
            }))
          });
        } else if (pendingDocs.length > 0) {
          insightsList.push({
            id: 'pending-docs',
            type: 'info',
            category: 'document',
            title: `${pendingDocs.length} Document${pendingDocs.length > 1 ? 's' : ''} Pending Review`,
            description: 'New documents waiting for staff review.',
            action: { label: 'Review Documents', path: '/crm/documents' },
            count: pendingDocs.length,
          });
        }
      }

      // 4. Check for urgent tasks
      const { data: urgentTasks } = await supabase
        .from('tasks')
        .select('id, title, student_id')
        .eq('priority', 'urgent')
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(5);

      if (urgentTasks && urgentTasks.length > 0) {
        const studentIds = urgentTasks.filter(t => t.student_id).map(t => t.student_id);
        const { data: students } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', studentIds);
        
        const studentMap = new Map((students || []).map(s => [s.user_id, s.full_name]));

        insightsList.push({
          id: 'urgent-tasks',
          type: 'urgent',
          category: 'task',
          title: `${urgentTasks.length} Urgent Task${urgentTasks.length > 1 ? 's' : ''}`,
          description: 'High priority tasks requiring immediate attention.',
          action: { label: 'View Tasks', path: '/crm/tasks' },
          count: urgentTasks.length,
          items: urgentTasks.map(t => ({
            id: t.id,
            name: t.title,
            detail: t.student_id ? (studentMap.get(t.student_id) || 'Unknown student') : 'No student'
          }))
        });
      }

      // 5. Check for overdue tasks
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date')
        .neq('status', 'completed')
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      if (overdueTasks && overdueTasks.length > 0) {
        insightsList.push({
          id: 'overdue-tasks',
          type: 'warning',
          category: 'task',
          title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`,
          description: 'Tasks past their due date.',
          action: { label: 'View Tasks', path: '/crm/tasks' },
          count: overdueTasks.length,
          items: overdueTasks.map(t => ({
            id: t.id,
            name: t.title,
            detail: `Due ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'unknown'}`
          }))
        });
      }

      // 6. Check for unread messages
      const { data: unreadThreads } = await supabase
        .from('message_threads')
        .select('id, sender_name, unread_count, source')
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(5);

      if (unreadThreads && unreadThreads.length > 0) {
        const totalUnread = unreadThreads.reduce((sum, t) => sum + t.unread_count, 0);
        insightsList.push({
          id: 'unread-messages',
          type: 'info',
          category: 'message',
          title: `${totalUnread} Unread Message${totalUnread > 1 ? 's' : ''}`,
          description: `From ${unreadThreads.length} conversation${unreadThreads.length > 1 ? 's' : ''}.`,
          action: { label: 'View Messages', path: '/crm/messages' },
          count: totalUnread,
          items: unreadThreads.map(t => ({
            id: t.id,
            name: t.sender_name || 'Unknown',
            detail: `${t.unread_count} unread from ${t.source}`
          }))
        });
      }

      // 7. Check for students without recent activity (no updates in 14+ days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: inactiveStudents } = await supabase
        .from('profiles')
        .select('user_id, full_name, updated_at')
        .lt('updated_at', fourteenDaysAgo.toISOString())
        .order('updated_at', { ascending: true })
        .limit(10);

      if (inactiveStudents && inactiveStudents.length > 0) {
        const studentIds = inactiveStudents.map(s => s.user_id);
        const { data: staffRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('user_id', studentIds);

        const staffIds = new Set((staffRoles || []).map(r => r.user_id));
        const actualInactiveStudents = inactiveStudents.filter(s => !staffIds.has(s.user_id));

        if (actualInactiveStudents.length > 0) {
          insightsList.push({
            id: 'inactive-students',
            type: 'info',
            category: 'student',
            title: `${actualInactiveStudents.length} Student${actualInactiveStudents.length > 1 ? 's' : ''} Need Follow-up`,
            description: 'No activity in the last 14 days.',
            action: { label: 'View Students', path: '/crm/students' },
            count: actualInactiveStudents.length,
            items: actualInactiveStudents.slice(0, 5).map(s => ({
              id: s.user_id,
              name: s.full_name || 'Unknown',
              detail: `Last active ${new Date(s.updated_at).toLocaleDateString()}`
            }))
          });
        }
      }

      // 8. Check for applications in review for too long
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: stuckApplications } = await supabase
        .from('applications')
        .select('id, student_id, institution_id, updated_at')
        .eq('status', 'university_review')
        .lt('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: true })
        .limit(5);

      if (stuckApplications && stuckApplications.length > 0) {
        const studentIds = stuckApplications.map(a => a.student_id);
        const universityIds = stuckApplications.map(a => a.institution_id);
        
        const [studentsRes, universitiesRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', studentIds),
          supabase.from('institutions').select('id, name_en').in('id', universityIds)
        ]);
        
        const studentMap = new Map((studentsRes.data || []).map(s => [s.user_id, s.full_name]));
        const uniMap = new Map((universitiesRes.data || []).map(u => [u.id, u.name_en]));

        insightsList.push({
          id: 'stuck-applications',
          type: 'info',
          category: 'application',
          title: `${stuckApplications.length} Application${stuckApplications.length > 1 ? 's' : ''} Awaiting Response`,
          description: 'Applications under university review for 7+ days.',
          action: { label: 'View Applications', path: '/crm/applications' },
          count: stuckApplications.length,
          items: stuckApplications.map(a => ({
            id: a.id,
            name: studentMap.get(a.student_id) || 'Unknown',
            detail: uniMap.get(a.institution_id) || 'Unknown university'
          }))
        });
      }

      // 9. Success insight - recently accepted applications
      const { data: recentAccepted } = await supabase
        .from('applications')
        .select('id, student_id, institution_id')
        .eq('decision', 'accepted')
        .gte('decision_at', sevenDaysAgo.toISOString())
        .order('decision_at', { ascending: false })
        .limit(3);

      if (recentAccepted && recentAccepted.length > 0) {
        const studentIds = recentAccepted.map(a => a.student_id);
        const universityIds = recentAccepted.map(a => a.institution_id);
        
        const [studentsRes, universitiesRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', studentIds),
          supabase.from('institutions').select('id, name_en').in('id', universityIds)
        ]);
        
        const studentMap = new Map((studentsRes.data || []).map(s => [s.user_id, s.full_name]));
        const uniMap = new Map((universitiesRes.data || []).map(u => [u.id, u.name_en]));

        insightsList.push({
          id: 'recent-acceptances',
          type: 'success',
          category: 'application',
          title: `${recentAccepted.length} New Acceptance${recentAccepted.length > 1 ? 's' : ''} This Week! 🎉`,
          description: 'Students accepted by universities recently.',
          count: recentAccepted.length,
          items: recentAccepted.map(a => ({
            id: a.id,
            name: studentMap.get(a.student_id) || 'Unknown',
            detail: `Accepted to ${uniMap.get(a.institution_id) || 'university'}`
          }))
        });
      }

      setInsights(insightsList);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    
    // Refresh insights every 5 minutes
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return {
    insights,
    loading,
    refresh: fetchInsights,
    urgentCount: insights.filter(i => i.type === 'urgent').length,
    warningCount: insights.filter(i => i.type === 'warning').length,
  };
}
