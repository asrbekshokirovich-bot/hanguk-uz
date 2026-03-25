import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  calculateFirstPaymentDueDate, 
  calculateSecondPaymentDueDate,
  getPaymentAmount,
  getPlanByValue 
} from './useStudentPlan';

export interface ScheduledPayment {
  id: string;
  student_id: string;
  payment_type: 'first_payment' | 'second_payment' | 'other';
  amount: number;
  currency: string;
  scheduled_date: string | null;
  trigger_type: 'contract_based' | 'admission_trigger';
  trigger_application_id: string | null;
  status: 'pending' | 'triggered' | 'paid' | 'cancelled';
  linked_payment_id: string | null;
  triggered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    full_name: string | null;
    phone: string | null;
    payment_plan: string | null;
    payment_mode: string | null;
    contract_date: string | null;
  };
}

export function useScheduledPayments() {
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScheduledPayments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .order('scheduled_date', { ascending: true });

    if (!error && data) {
      // Batch fetch all student profiles (fix N+1 query)
      const uniqueStudentIds = [...new Set(data.map(p => p.student_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, payment_plan, payment_mode, contract_date')
        .in('user_id', uniqueStudentIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, {
          full_name: p.full_name,
          phone: p.phone,
          payment_plan: p.payment_plan,
          payment_mode: p.payment_mode,
          contract_date: p.contract_date,
        }])
      );

      const paymentsWithStudents = data.map(payment => ({
        ...payment,
        student: profileMap.get(payment.student_id) || undefined,
      } as ScheduledPayment));
      setScheduledPayments(paymentsWithStudents);
    }
    setLoading(false);
  }, []);

  /**
   * Create scheduled payments for a student based on their plan and payment mode
   */
  const createScheduledPaymentsForStudent = async (
    studentId: string,
    planValue: string,
    paymentMode: string,
    contractDate: string | null
  ) => {
    const plan = getPlanByValue(planValue);
    if (!plan) return { error: 'Invalid plan' };

    interface ScheduledPaymentInsert {
      student_id: string;
      payment_type: string;
      amount: number;
      currency: string;
      scheduled_date: string | null;
      trigger_type: string;
      status: string;
      notes?: string;
    }

    const paymentsToCreate: ScheduledPaymentInsert[] = [];

    if (paymentMode === 'one_time') {
      // Single full payment
      paymentsToCreate.push({
        student_id: studentId,
        payment_type: 'first_payment',
        amount: plan.priceOneTime,
        currency: plan.currency,
        scheduled_date: calculateFirstPaymentDueDate(contractDate),
        trigger_type: 'contract_based',
        status: 'pending',
      });
    } else {
      // Split payments (installment)
      // First payment - 7 working days after contract
      paymentsToCreate.push({
        student_id: studentId,
        payment_type: 'first_payment',
        amount: plan.firstPayment,
        currency: plan.currency,
        scheduled_date: calculateFirstPaymentDueDate(contractDate),
        trigger_type: 'contract_based',
        status: 'pending',
      });

      // Second payment - triggered by admission
      paymentsToCreate.push({
        student_id: studentId,
        payment_type: 'second_payment',
        amount: plan.secondPayment,
        currency: plan.currency,
        scheduled_date: null, // Will be set when admission is confirmed
        trigger_type: 'admission_trigger',
        status: 'pending',
        notes: 'Due 7 working days after university admission',
      });
    }

    const { error } = await supabase
      .from('scheduled_payments')
      .insert(paymentsToCreate);

    if (!error) {
      await fetchScheduledPayments();
    }

    return { error };
  };

  /**
   * Trigger second payment when admission is confirmed
   */
  const triggerSecondPayment = async (
    studentId: string,
    applicationId: string,
    admissionDate: string
  ) => {
    // Find the pending second payment for this student
    const { data: scheduledPayment } = await supabase
      .from('scheduled_payments')
      .select('*')
      .eq('student_id', studentId)
      .eq('payment_type', 'second_payment')
      .eq('trigger_type', 'admission_trigger')
      .eq('status', 'pending')
      .single();

    if (!scheduledPayment) return { error: 'No pending second payment found' };

    // Calculate due date (7 working days after admission)
    const dueDate = calculateSecondPaymentDueDate(admissionDate);

    // Update the scheduled payment
    const { error } = await supabase
      .from('scheduled_payments')
      .update({
        scheduled_date: dueDate,
        trigger_application_id: applicationId,
        triggered_at: new Date().toISOString(),
        status: 'triggered',
      })
      .eq('id', scheduledPayment.id);

    // Also create an actual payment record
    if (!error) {
      const { data: newPayment } = await supabase
        .from('payments')
        .insert({
          student_id: studentId,
          application_id: applicationId,
          payment_type: 'remaining_payment',
          amount: scheduledPayment.amount,
          currency: scheduledPayment.currency,
          due_date: dueDate,
          status: 'pending',
          notes: 'Auto-created upon university admission confirmation',
        })
        .select()
        .single();

      // Link the payment to the scheduled payment
      if (newPayment) {
        await supabase
          .from('scheduled_payments')
          .update({ linked_payment_id: newPayment.id })
          .eq('id', scheduledPayment.id);
      }

      await fetchScheduledPayments();
    }

    return { error };
  };

  /**
   * Mark a scheduled payment as paid
   */
  const markAsPaid = async (scheduledPaymentId: string, paymentId?: string) => {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({
        status: 'paid',
        linked_payment_id: paymentId || null,
      })
      .eq('id', scheduledPaymentId);

    if (!error) {
      await fetchScheduledPayments();
    }

    return { error };
  };

  /**
   * Cancel a scheduled payment
   */
  const cancelScheduledPayment = async (scheduledPaymentId: string, reason?: string) => {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({
        status: 'cancelled',
        notes: reason || 'Cancelled',
      })
      .eq('id', scheduledPaymentId);

    if (!error) {
      await fetchScheduledPayments();
    }

    return { error };
  };

  /**
   * Update scheduled date manually
   */
  const updateScheduledDate = async (scheduledPaymentId: string, newDate: string) => {
    const { error } = await supabase
      .from('scheduled_payments')
      .update({ scheduled_date: newDate })
      .eq('id', scheduledPaymentId);

    if (!error) {
      await fetchScheduledPayments();
    }

    return { error };
  };

  /**
   * Get scheduled payments for a specific student
   */
  const getStudentScheduledPayments = useCallback((studentId: string) => {
    return scheduledPayments.filter(sp => sp.student_id === studentId);
  }, [scheduledPayments]);

  /**
   * Calculate stats for scheduled payments
   */
  const getStats = useCallback(() => {
    const pending = scheduledPayments.filter(sp => sp.status === 'pending');
    const triggered = scheduledPayments.filter(sp => sp.status === 'triggered');
    const paid = scheduledPayments.filter(sp => sp.status === 'paid');
    
    const totalPendingAmount = pending.reduce((sum, sp) => sum + Number(sp.amount), 0);
    const totalTriggeredAmount = triggered.reduce((sum, sp) => sum + Number(sp.amount), 0);
    const totalPaidAmount = paid.reduce((sum, sp) => sum + Number(sp.amount), 0);

    // Count by currency
    const pendingByUZS = pending.filter(sp => sp.currency === 'UZS').reduce((sum, sp) => sum + Number(sp.amount), 0);
    const pendingByUSD = pending.filter(sp => sp.currency === 'USD').reduce((sum, sp) => sum + Number(sp.amount), 0);

    // Upcoming in next 7 days
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingThisWeek = pending.filter(sp => {
      if (!sp.scheduled_date) return false;
      const dueDate = new Date(sp.scheduled_date);
      return dueDate >= today && dueDate <= nextWeek;
    });

    // Overdue
    const overdue = pending.filter(sp => {
      if (!sp.scheduled_date) return false;
      return new Date(sp.scheduled_date) < today;
    });

    return {
      pendingCount: pending.length,
      triggeredCount: triggered.length,
      paidCount: paid.length,
      totalPendingAmount,
      totalTriggeredAmount,
      totalPaidAmount,
      pendingByUZS,
      pendingByUSD,
      upcomingThisWeek: upcomingThisWeek.length,
      overdueCount: overdue.length,
    };
  }, [scheduledPayments]);

  useEffect(() => {
    fetchScheduledPayments();
  }, [fetchScheduledPayments]);

  return {
    scheduledPayments,
    loading,
    fetchScheduledPayments,
    createScheduledPaymentsForStudent,
    triggerSecondPayment,
    markAsPaid,
    cancelScheduledPayment,
    updateScheduledDate,
    getStudentScheduledPayments,
    getStats,
  };
}
