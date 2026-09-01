import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import { useCommandCenterSync } from '@/hooks/useCommandCenterSync';
import { allocateBudgetsForPayment } from '@/hooks/useStudentBudgets';
import { allocateOperationalFund } from '@/hooks/useOperationalFund';
import { distributeIncomeFromPayment } from '@/hooks/useIncomeDistribution';
import { createBonusForPayment } from '@/hooks/useStaffBonuses';
import { calculateGatewayFee } from '@/lib/paymentUtils';
export interface Payment {
  id: string;
  student_id: string;
  application_id: string | null;
  payment_type: 'initial_deposit' | 'remaining_payment' | 'other';
  amount: number;
  currency: string;
  status: 'pending' | 'partial' | 'completed' | 'overdue' | 'refunded';
  paid_amount: number;
  due_date: string | null;
  paid_at: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: {
    full_name: string | null;
    phone: string | null;
  };
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  amount: number;
  payment_method: string | null;
  transaction_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const { syncTransaction } = useCommandCenterSync();
  const { activeIntakeId } = useActiveIntake();

  const fetchPayments = async () => {
    const { data, error } = await applyIntake(
      supabase.from('payments').select('*'),
      activeIntakeId,
    ).order('created_at', { ascending: false });

    if (!error && data) {
      // Batch fetch all student profiles (fix N+1 query)
      const uniqueStudentIds = [...new Set(data.map(p => p.student_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', uniqueStudentIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { full_name: p.full_name, phone: p.phone }])
      );

      const paymentsWithStudents = data.map(payment => ({
        ...payment,
        student: profileMap.get(payment.student_id) || undefined,
      }));
      setPayments(paymentsWithStudents as Payment[]);
    }
    setLoading(false);
  };

  const createPayment = async (payment: {
    student_id: string;
    application_id?: string;
    payment_type: 'initial_deposit' | 'remaining_payment' | 'other';
    amount: number;
    /** Undiscounted plan price for this installment, only when a discount
     *  applies — feeds the investor P&L's informational "discounts given"
     *  line. Omit (or pass equal to amount) when no discount applies. */
    listAmount?: number;
    currency?: string;
    due_date?: string;
    notes?: string;
  }) => {
    const { error, data } = await supabase
      .from('payments')
      .insert({
        student_id: payment.student_id,
        application_id: payment.application_id || null,
        payment_type: payment.payment_type,
        amount: payment.amount,
        list_amount: payment.listAmount && payment.listAmount > payment.amount ? payment.listAmount : null,
        currency: payment.currency || 'USD',
        due_date: payment.due_date || null,
        notes: payment.notes || null,
        intake_id: activeIntakeId,
      })
      .select()
      .single();

    if (!error && data) {
      // Sync to Command Center
      syncTransaction({
        id: data.id,
        type: 'income',
        amount: data.amount,
        currency: data.currency,
        description: `${data.payment_type} - ${data.invoice_number || 'No invoice'}`,
        category: data.payment_type === 'initial_deposit' ? 'Deposit' : 'Tuition',
        date: data.created_at.split('T')[0],
        scheduled_date: data.due_date,
      });
      await fetchPayments();
    }
    return { error, data };
  };

  const recordTransaction = async (
    paymentId: string,
    transaction: {
      amount: number;
      payment_method?: string;
      transaction_reference?: string;
      notes?: string;
    }
  ) => {
    // Calculate gateway fee based on payment method
    const gatewayFee = transaction.payment_method 
      ? calculateGatewayFee(transaction.amount, transaction.payment_method)
      : 0;

    // Insert transaction with gateway fee
    const { error: txError, data: txData } = await supabase
      .from('payment_transactions')
      .insert({
        payment_id: paymentId,
        amount: transaction.amount,
        payment_method: transaction.payment_method || null,
        transaction_reference: transaction.transaction_reference || null,
        notes: transaction.notes || null,
        gateway_fee: gatewayFee,
      })
      .select()
      .single();

    if (txError) return { error: txError };

    // Fetch fresh payment data from DB to avoid stale state
    const { data: payment, error: paymentFetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentFetchError || !payment) {
      return { error: paymentFetchError || new Error('Payment not found') };
    }

    // Auto-create expense for gateway fee if fee > 0 (using fresh DB data)
    if (gatewayFee > 0 && txData) {
      const methodLabel = transaction.payment_method === 'payme' ? 'PayMe' :
                          transaction.payment_method === 'click' ? 'Click' :
                          transaction.payment_method === 'uzum' ? 'Uzum' : transaction.payment_method;
      
      await supabase
        .from('expenses')
        .insert({
          category: 'gateway_fee',
          description: `${methodLabel} to'lov komissiyasi`,
          amount: gatewayFee,
          currency: payment.currency || 'UZS',
          payment_method: transaction.payment_method,
          recipient: methodLabel,
          expense_date: new Date().toISOString().split('T')[0],
          notes: `Auto-generated fee for transaction ${txData.id}`,
          linked_transaction_id: txData.id,
        });
    }

    {
      const newPaidAmount = Number(payment.paid_amount) + transaction.amount;
      const newStatus = newPaidAmount >= payment.amount ? 'completed' : 'partial';
      
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_at: newStatus === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', paymentId);

      if (!updateError) {
        // Sync transaction to Command Center
        syncTransaction({
          id: `tx-${paymentId}-${Date.now()}`,
          type: 'income',
          amount: transaction.amount,
          currency: payment.currency,
          description: `Payment received - ${payment.invoice_number || 'No invoice'}`,
          category: 'Payment',
          date: new Date().toISOString().split('T')[0],
        });

        // Only allocate when payment is FULLY completed (paid_amount >= amount)
        if (newStatus === 'completed') {
          // Get student's plan to allocate appropriate budgets
          const { data: profile } = await supabase
            .from('profiles')
            .select('payment_plan')
            .eq('user_id', payment.student_id)
            .single();
          
          if (profile?.payment_plan) {
            // Allocate student budgets
            await allocateBudgetsForPayment(
              payment.student_id,
              profile.payment_plan,
              paymentId,
              payment.intake_id
            );

            // Create staff bonus for this student
            await createBonusForPayment(payment.student_id, profile.payment_plan);
          }

          // Allocate operational fund from this payment
          await allocateOperationalFund(
            paymentId,
            payment.student_id,
            Math.min(newPaidAmount, Number(payment.amount))
          );

          // Auto-distribute income after deducting operational fund and student budgets
          await distributeIncomeFromPayment(
            paymentId,
            Math.min(newPaidAmount, Number(payment.amount)),
            payment.student_id
          );
        }

        await fetchPayments();
      }
      return { error: updateError };
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: Payment['status']) => {
    const { error } = await supabase
      .from('payments')
      .update({ status })
      .eq('id', paymentId);

    if (!error) {
      await fetchPayments();
    }
    return { error };
  };

  // Update payment transaction (especially for changing payment method)
  const updatePaymentTransaction = async (
    transactionId: string,
    updates: {
      payment_method?: string;
      amount?: number;
      notes?: string;
    }
  ) => {
    // Get the current transaction to calculate old/new fees
    const { data: currentTx, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !currentTx) return { error: fetchError };

    const amount = updates.amount || currentTx.amount;
    const paymentMethod = updates.payment_method || currentTx.payment_method;

    // Calculate new gateway fee
    const newGatewayFee = paymentMethod ? calculateGatewayFee(amount, paymentMethod) : 0;

    // Update the transaction
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        ...updates,
        gateway_fee: newGatewayFee,
      })
      .eq('id', transactionId);

    if (updateError) return { error: updateError };

    // Update or create/delete linked expense for gateway fee
    const methodLabel = paymentMethod === 'payme' ? 'PayMe' :
                        paymentMethod === 'click' ? 'Click' :
                        paymentMethod === 'uzum' ? 'Uzum' : paymentMethod;

    // Check if there's an existing expense linked to this transaction
    const { data: existingExpense } = await supabase
      .from('expenses')
      .select('id')
      .eq('linked_transaction_id', transactionId)
      .single();

    if (newGatewayFee > 0) {
      // Get payment currency
      const { data: payment } = await supabase
        .from('payments')
        .select('currency')
        .eq('id', currentTx.payment_id)
        .single();

      if (existingExpense) {
        // Update existing expense
        await supabase
          .from('expenses')
          .update({
            amount: newGatewayFee,
            payment_method: paymentMethod,
            recipient: methodLabel,
            description: `${methodLabel} to'lov komissiyasi`,
          })
          .eq('id', existingExpense.id);
      } else {
        // Create new expense
        await supabase
          .from('expenses')
          .insert({
            category: 'gateway_fee',
            description: `${methodLabel} to'lov komissiyasi`,
            amount: newGatewayFee,
            currency: payment?.currency || 'UZS',
            payment_method: paymentMethod,
            recipient: methodLabel,
            expense_date: new Date().toISOString().split('T')[0],
            notes: `Auto-generated fee for transaction ${transactionId}`,
            linked_transaction_id: transactionId,
          });
      }
    } else if (existingExpense) {
      // Delete expense if no fee is needed (e.g., switched to cash)
      await supabase
        .from('expenses')
        .delete()
        .eq('id', existingExpense.id);
    }

    await fetchPayments();
    return { error: null };
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntakeId]);

  // Calculate stats
  const stats = {
    totalPending: payments
      .filter(p => p.status === 'pending' || p.status === 'partial')
      .reduce((acc, p) => acc + (Number(p.amount) - Number(p.paid_amount)), 0),
    totalCollected: payments.reduce((acc, p) => acc + Number(p.paid_amount), 0),
    overdueCount: payments.filter(p => p.status === 'overdue').length,
    completedCount: payments.filter(p => p.status === 'completed').length,
  };

  return {
    payments,
    loading,
    stats,
    fetchPayments,
    createPayment,
    recordTransaction,
    updatePaymentStatus,
    updatePaymentTransaction,
  };
}
