import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StudentInsight {
  id: string;
  type: 'action' | 'info' | 'success' | 'warning';
  icon: string;
  title: string;
  description: string;
  priority: number;
}

export function useStudentInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<StudentInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = async () => {
    if (!user) return;
    
    setLoading(true);
    const insightsList: StudentInsight[] = [];

    try {
      // Fetch student data
      const [applicationsRes, documentsRes, paymentsRes, tasksRes] = await Promise.all([
        supabase.from('applications').select('*, university:universities(*)').eq('student_id', user.id),
        supabase.from('documents').select('*').eq('student_id', user.id),
        supabase.from('payments').select('*').eq('student_id', user.id),
        supabase.from('tasks').select('*').eq('student_id', user.id).neq('status', 'completed'),
      ]);

      const applications = applicationsRes.data || [];
      const documents = documentsRes.data || [];
      const payments = paymentsRes.data || [];
      const tasks = tasksRes.data || [];

      // 1. Check for pending document uploads
      const uploadedDocs = documents.filter(d => d.status === 'uploaded');
      const approvedDocs = documents.filter(d => d.status === 'approved');
      const rejectedDocs = documents.filter(d => d.status === 'rejected');

      if (rejectedDocs.length > 0) {
        insightsList.push({
          id: 'rejected-docs',
          type: 'warning',
          icon: '⚠️',
          title: `${rejectedDocs.length} document${rejectedDocs.length > 1 ? 's' : ''} need resubmission`,
          description: `Please review and reupload: ${rejectedDocs.map(d => d.name).join(', ')}`,
          priority: 1,
        });
      }

      // 2. Check for applications needing documents
      const docCollectionApps = applications.filter(a => a.status === 'documents_collection');
      if (docCollectionApps.length > 0 && documents.length < 3) {
        insightsList.push({
          id: 'need-more-docs',
          type: 'action',
          icon: '📄',
          title: 'Upload more documents',
          description: `You have ${docCollectionApps.length} application${docCollectionApps.length > 1 ? 's' : ''} in document collection phase. Upload required documents to proceed.`,
          priority: 2,
        });
      }

      // 3. Check for pending payments
      const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'partial');
      const overduePayments = payments.filter(p => p.status === 'overdue');

      if (overduePayments.length > 0) {
        const totalOverdue = overduePayments.reduce((sum, p) => sum + (Number(p.amount) - Number(p.paid_amount)), 0);
        insightsList.push({
          id: 'overdue-payment',
          type: 'warning',
          icon: '💰',
          title: 'Overdue payment',
          description: `You have $${totalOverdue.toLocaleString()} in overdue payments. Please contact your consultant.`,
          priority: 1,
        });
      } else if (pendingPayments.length > 0) {
        const upcomingPayment = pendingPayments.find(p => p.due_date);
        if (upcomingPayment) {
          const dueDate = new Date(upcomingPayment.due_date);
          const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilDue <= 7 && daysUntilDue > 0) {
            insightsList.push({
              id: 'upcoming-payment',
              type: 'action',
              icon: '📅',
              title: `Payment due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}`,
              description: `$${Number(upcomingPayment.amount) - Number(upcomingPayment.paid_amount)} due on ${dueDate.toLocaleDateString()}`,
              priority: 2,
            });
          }
        }
      }

      // 4. Check for tasks assigned to student
      if (tasks.length > 0) {
        const urgentTasks = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
        if (urgentTasks.length > 0) {
          insightsList.push({
            id: 'urgent-tasks',
            type: 'action',
            icon: '✅',
            title: `${urgentTasks.length} important task${urgentTasks.length > 1 ? 's' : ''} for you`,
            description: urgentTasks.map(t => t.title).slice(0, 2).join(', ') + (urgentTasks.length > 2 ? '...' : ''),
            priority: 2,
          });
        }
      }

      // 5. Application status updates (positive)
      const acceptedApps = applications.filter(a => a.decision === 'accepted');
      if (acceptedApps.length > 0) {
        insightsList.push({
          id: 'accepted-apps',
          type: 'success',
          icon: '🎉',
          title: `Congratulations! ${acceptedApps.length} acceptance${acceptedApps.length > 1 ? 's' : ''}`,
          description: `You've been accepted to ${acceptedApps.map(a => a.university?.name_en).join(', ')}!`,
          priority: 0,
        });
      }

      // 6. Applications under review
      const underReview = applications.filter(a => a.status === 'university_review');
      if (underReview.length > 0) {
        insightsList.push({
          id: 'under-review',
          type: 'info',
          icon: '🏫',
          title: `${underReview.length} application${underReview.length > 1 ? 's' : ''} under university review`,
          description: `Waiting for response from: ${underReview.map(a => a.university?.name_en).join(', ')}`,
          priority: 3,
        });
      }

      // 7. Documents being reviewed
      if (uploadedDocs.length > 0) {
        insightsList.push({
          id: 'docs-review',
          type: 'info',
          icon: '👀',
          title: `${uploadedDocs.length} document${uploadedDocs.length > 1 ? 's' : ''} under review`,
          description: 'Our team is reviewing your uploaded documents.',
          priority: 4,
        });
      }

      // Sort by priority
      insightsList.sort((a, b) => a.priority - b.priority);

      setInsights(insightsList);
    } catch (error) {
      console.error('Error fetching student insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return { insights, loading, refresh: fetchInsights };
}
