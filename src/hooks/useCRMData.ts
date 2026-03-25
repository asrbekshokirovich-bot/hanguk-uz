import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { getPlanByValue, calculateFirstPaymentDueDate } from '@/hooks/useStudentPlan';

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  documents?: Tables<'documents'>[];
  paymentStatus?: string | null;
  initialPaymentOverdue?: boolean;
};

export function useCRMData() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [applications, setApplications] = useState<Tables<'applications'>[]>([]);
  const [universities, setUniversities] = useState<Tables<'universities'>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    try {
      // Get all staff user IDs
      const { data: staffRoles, error: staffError } = await supabase
        .from('user_roles')
        .select('user_id');
      
      if (staffError) {
        console.error('Error fetching staff roles:', staffError);
        toast.error('Failed to load staff roles');
        return;
      }

      const staffUserIds = staffRoles?.map(r => r.user_id) || [];

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast.error('Failed to load student profiles');
        return;
      }

      if (!profiles) return;

      // Filter out staff members
      const studentProfiles = profiles.filter(
        profile => !staffUserIds.includes(profile.user_id)
      );

      const studentUserIds = studentProfiles.map(p => p.user_id);

      // Batch fetch all applications, documents, and payments for all students at once
      const [appsResult, docsResult, paymentsResult] = await Promise.all([
        supabase
          .from('applications')
          .select('*, university:universities(*)')
          .in('student_id', studentUserIds),
        supabase
          .from('documents')
          .select('*')
          .in('student_id', studentUserIds),
        supabase
          .from('payments')
      .select('student_id, status, payment_type, paid_amount')
      .in('student_id', studentUserIds),
      ]);

      if (appsResult.error) {
        console.error('Error fetching applications:', appsResult.error);
      }
      if (docsResult.error) {
        console.error('Error fetching documents:', docsResult.error);
      }

      const allApps = appsResult.data || [];
      const allDocs = docsResult.data || [];
      const allPayments = paymentsResult.data || [];

      // Compute worst payment status per student
      const PAYMENT_STATUS_PRIORITY: Record<string, number> = { overdue: 4, pending: 3, partial: 2, completed: 1 };
      const paymentStatusByStudent = new Map<string, string>();
      for (const p of allPayments) {
        const current = paymentStatusByStudent.get(p.student_id);
        const newPriority = PAYMENT_STATUS_PRIORITY[p.status] || 0;
        const currentPriority = current ? PAYMENT_STATUS_PRIORITY[current] || 0 : 0;
        if (newPriority > currentPriority) {
          paymentStatusByStudent.set(p.student_id, p.status);
        }
      }

      // Group by student_id
      const appsByStudent = new Map<string, typeof allApps>();
      for (const app of allApps) {
        const existing = appsByStudent.get(app.student_id) || [];
        existing.push(app);
        appsByStudent.set(app.student_id, existing);
      }

      const docsByStudent = new Map<string, typeof allDocs>();
      for (const doc of allDocs) {
        const existing = docsByStudent.get(doc.student_id) || [];
        existing.push(doc);
        docsByStudent.set(doc.student_id, existing);
      }

      // Compute initialPaymentOverdue per student
      const initialOverdueByStudent = new Map<string, boolean>();
      for (const profile of studentProfiles) {
        const uid = profile.user_id;
        if (!profile.contract_date || !profile.payment_plan) {
          initialOverdueByStudent.set(uid, false);
          continue;
        }
        const plan = getPlanByValue(profile.payment_plan);
        if (!plan || plan.value === 'free') {
          initialOverdueByStudent.set(uid, false);
          continue;
        }
        const mode = profile.payment_mode || 'one_time';
        const expectedInitial = mode === 'installment' ? plan.firstPayment : plan.priceOneTime;
        const dueDate = calculateFirstPaymentDueDate(profile.contract_date);
        const today = new Date().toISOString().split('T')[0];
        if (today <= dueDate) {
          initialOverdueByStudent.set(uid, false);
          continue;
        }
        // Sum completed initial payments
        const studentPayments = allPayments.filter(p => p.student_id === uid);
        const paidInitial = studentPayments
          .filter(p => p.status === 'completed' && ['first_payment', 'initial_deposit', 'full_payment'].includes(p.payment_type))
          .reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
        initialOverdueByStudent.set(uid, paidInitial < expectedInitial);
      }

      // Combine
      const studentsWithData = studentProfiles.map(profile => ({
        ...profile,
        applications: appsByStudent.get(profile.user_id) || [],
        documents: docsByStudent.get(profile.user_id) || [],
        paymentStatus: paymentStatusByStudent.get(profile.user_id) || null,
        initialPaymentOverdue: initialOverdueByStudent.get(profile.user_id) || false,
      }));

      setStudents(studentsWithData);
    } catch (error) {
      console.error('Unexpected error in fetchStudents:', error);
      toast.error('Failed to load students');
    }
  };

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*, university:universities(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching applications:', error);
        toast.error('Failed to load applications');
        return;
      }
      if (data) setApplications(data);
    } catch (error) {
      console.error('Unexpected error in fetchApplications:', error);
    }
  };

  const fetchUniversities = async () => {
    try {
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .order('ranking', { ascending: true });

      if (error) {
        console.error('Error fetching universities:', error);
        toast.error('Failed to load universities');
        return;
      }
      if (data) setUniversities(data);
    } catch (error) {
      console.error('Unexpected error in fetchUniversities:', error);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    const { error } = await supabase
      .from('applications')
      .update({ status: newStatus })
      .eq('id', applicationId);

    if (!error) {
      await fetchApplications();
      await fetchStudents();
    }
    return { error };
  };

  const updateDocumentStatus = async (documentId: string, newStatus: string, notes?: string) => {
    if (newStatus === 'rejected') {
      // Fetch the file path first
      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        return { error: fetchError };
      }

      // Delete from storage (best-effort — don't block on storage error)
      await supabase.storage
        .from('student-documents')
        .remove([doc.file_path]);

      // Delete the DB record entirely so the slot resets to empty
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (!error) {
        await fetchStudents();
      }
      return { error };
    }

    // For all other statuses (approved, uploaded, etc.) — update as before
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('documents')
      .update({ 
        status: newStatus, 
        notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq('id', documentId);

    if (!error) {
      await fetchStudents();
    }
    return { error };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchApplications(),
        fetchUniversities(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    students,
    applications,
    universities,
    loading,
    refetchStudents: fetchStudents,
    refetchApplications: fetchApplications,
    updateApplicationStatus,
    updateDocumentStatus,
  };
}
