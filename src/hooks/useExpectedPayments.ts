import { useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { Payment } from './usePayments';
import {
  getPlanByValue,
  formatAmount,
  calculateFirstPaymentDueDate,
  applyDiscount,
} from './useStudentPlan';

export interface ExpectedPayment {
  id: string;
  student_id: string;
  student_name: string | null;
  student_phone: string | null;
  payment_plan: string | null;
  payment_mode: string | null;
  contract_date: string | null;
  expected_amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  status: 'not_started' | 'partial' | 'completed';
  due_date: string | null;
  payment_type: 'first_payment' | 'second_payment' | 'full_payment';
  payments: Payment[];
}

type StudentProfile = Tables<'profiles'> & {
  applications?: (Tables<'applications'> & {
    university?: Tables<'universities'>;
  })[];
  /** Set by useCRMData from the active season's student_intakes row. */
  freeReapplication?: boolean;
  /** Set by useCRMData from the active season's student_intakes row. */
  discountPercent?: number;
};

/**
 * Hook to calculate expected payments for all students based on their plan
 * This computes what each student owes vs. what they've paid
 */
export function useExpectedPayments(
  students: StudentProfile[],
  payments: Payment[]
) {
  const expectedPayments = useMemo(() => {
    const result: ExpectedPayment[] = [];

    students.forEach(student => {
      // A free re-application owes nothing for this season. The plan lives on
      // the profile and is season-independent, so a student carried over after
      // a visa refusal would otherwise have the same plan expected again here,
      // on top of the season they already paid for.
      if (student.freeReapplication) return;
      if (!student.payment_plan) return; // Skip students without a plan

      const plan = getPlanByValue(student.payment_plan);
      if (!plan) return;

      const studentPayments = payments.filter(p => p.student_id === student.user_id);
      const mode = student.payment_mode || 'one_time';
      const discountPercent = student.discountPercent || 0;

      if (mode === 'one_time') {
        // Single payment expected
        const expectedAmount = applyDiscount(plan.priceOneTime, discountPercent);
        const paidAmount = studentPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
        const remainingAmount = Math.max(0, expectedAmount - paidAmount);

        let status: ExpectedPayment['status'] = 'not_started';
        if (paidAmount >= expectedAmount) {
          status = 'completed';
        } else if (paidAmount > 0) {
          status = 'partial';
        }

        result.push({
          id: `expected-${student.user_id}-full`,
          student_id: student.user_id,
          student_name: student.full_name,
          student_phone: student.phone,
          payment_plan: student.payment_plan,
          payment_mode: mode,
          contract_date: student.contract_date,
          expected_amount: expectedAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          currency: plan.currency,
          status,
          due_date: calculateFirstPaymentDueDate(student.contract_date),
          payment_type: 'full_payment',
          payments: studentPayments,
        });
      } else {
        // Split payments - track first and second separately
        const firstPaymentExpected = applyDiscount(plan.firstPayment, discountPercent);
        const secondPaymentExpected = applyDiscount(plan.secondPayment, discountPercent);
        
        // Calculate paid amounts for each payment type
        const firstPayments = studentPayments.filter(
          p => p.payment_type === 'initial_deposit'
        );
        const secondPayments = studentPayments.filter(
          p => p.payment_type === 'remaining_payment'
        );
        
        const firstPaid = firstPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
        const secondPaid = secondPayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);
        
        const firstRemaining = Math.max(0, firstPaymentExpected - firstPaid);
        const secondRemaining = Math.max(0, secondPaymentExpected - secondPaid);

        // First payment status
        let firstStatus: ExpectedPayment['status'] = 'not_started';
        if (firstPaid >= firstPaymentExpected) {
          firstStatus = 'completed';
        } else if (firstPaid > 0) {
          firstStatus = 'partial';
        }

        // Second payment status
        let secondStatus: ExpectedPayment['status'] = 'not_started';
        if (secondPaid >= secondPaymentExpected) {
          secondStatus = 'completed';
        } else if (secondPaid > 0) {
          secondStatus = 'partial';
        }

        // Only add if not fully completed
        if (firstStatus !== 'completed') {
          result.push({
            id: `expected-${student.user_id}-first`,
            student_id: student.user_id,
            student_name: student.full_name,
            student_phone: student.phone,
            payment_plan: student.payment_plan,
            payment_mode: mode,
            contract_date: student.contract_date,
            expected_amount: firstPaymentExpected,
            paid_amount: firstPaid,
            remaining_amount: firstRemaining,
            currency: plan.currency,
            status: firstStatus,
            due_date: calculateFirstPaymentDueDate(student.contract_date),
            payment_type: 'first_payment',
            payments: firstPayments,
          });
        }

        // Add second payment (regardless of first payment status)
        if (secondStatus !== 'completed') {
          // Check if student has admission to calculate due date
          const hasAdmission = student.applications?.some(
            app => app.status === 'university_response' || 
                   app.status === 'admission_letter' ||
                   app.status === 'visa_preparation' ||
                   app.status === 'completed'
          );
          
          result.push({
            id: `expected-${student.user_id}-second`,
            student_id: student.user_id,
            student_name: student.full_name,
            student_phone: student.phone,
            payment_plan: student.payment_plan,
            payment_mode: mode,
            contract_date: student.contract_date,
            expected_amount: secondPaymentExpected,
            paid_amount: secondPaid,
            remaining_amount: secondRemaining,
            currency: plan.currency,
            status: secondStatus,
            due_date: hasAdmission ? null : null, // Will be calculated when admission happens
            payment_type: 'second_payment',
            payments: secondPayments,
          });
        }
      }
    });

    return result;
  }, [students, payments]);

  // Calculate aggregate stats
  const stats = useMemo(() => {
    const pending = expectedPayments.filter(ep => ep.status !== 'completed');
    const notStarted = expectedPayments.filter(ep => ep.status === 'not_started');
    const partial = expectedPayments.filter(ep => ep.status === 'partial');
    const completed = expectedPayments.filter(ep => ep.status === 'completed');
    
    // Total remaining by currency
    const remainingUZS = pending
      .filter(ep => ep.currency === 'UZS')
      .reduce((sum, ep) => sum + ep.remaining_amount, 0);
    const remainingUSD = pending
      .filter(ep => ep.currency === 'USD')
      .reduce((sum, ep) => sum + ep.remaining_amount, 0);

    // Overdue count (only for payments with due dates)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = pending.filter(ep => {
      if (!ep.due_date) return false;
      const due = new Date(ep.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    });

    // Due this week
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = pending.filter(ep => {
      if (!ep.due_date) return false;
      const due = new Date(ep.due_date);
      return due >= today && due <= nextWeek;
    });

    return {
      totalPending: pending.length,
      notStartedCount: notStarted.length,
      partialCount: partial.length,
      completedCount: completed.length,
      remainingUZS,
      remainingUSD,
      overdueCount: overdue.length,
      dueThisWeekCount: dueThisWeek.length,
    };
  }, [expectedPayments]);

  return {
    expectedPayments,
    stats,
  };
}
