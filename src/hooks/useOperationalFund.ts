import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface OperationalFundSettings {
  id: string;
  amount_per_student: number;
  currency: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OperationalFundAllocation {
  id: string;
  student_id: string;
  payment_id: string | null;
  category_id: string | null;
  allocated_amount: number;
  allocation_month: string;
  status: 'allocated' | 'spent' | 'pending';
  created_at: string;
  category?: {
    name: string;
    category_type: string;
  };
}

export function useOperationalFund() {
  const [settings, setSettings] = useState<OperationalFundSettings | null>(null);
  const [allocations, setAllocations] = useState<OperationalFundAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('operational_fund_settings')
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      setSettings(data as OperationalFundSettings);
    }
    return data;
  };

  const fetchAllocations = async (month?: string) => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    
    const { data, error } = await supabase
      .from('operational_fund_allocations')
      .select(`
        *,
        category:monthly_payment_categories(name, category_type)
      `)
      .eq('allocation_month', targetMonth)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAllocations(data as OperationalFundAllocation[]);
    }
    setLoading(false);
    return data;
  };

  const updateAmountPerStudent = async (amount: number) => {
    if (!settings) return { error: new Error('Settings not loaded') };

    const { error } = await supabase
      .from('operational_fund_settings')
      .update({ 
        amount_per_student: amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings.id);

    if (!error) {
      await fetchSettings();
    }
    return { error };
  };

  // Allocate funds from a student payment to monthly categories
  const allocateFundsFromPayment = async (
    paymentId: string,
    studentId: string,
    paymentAmount: number
  ) => {
    // Get current settings
    const settingsData = await fetchSettings();
    if (!settingsData) return { error: new Error('Could not fetch settings') };

    const amountToAllocate = Math.min(settingsData.amount_per_student, paymentAmount);
    
    // Get active categories
    const { data: categories, error: catError } = await supabase
      .from('monthly_payment_categories')
      .select('*')
      .eq('is_active', true);

    if (catError || !categories || categories.length === 0) {
      return { error: catError || new Error('No active categories') };
    }

    // Calculate total obligations
    const totalObligations = categories.reduce((sum, c) => sum + Number(c.amount), 0);
    if (totalObligations === 0) return { error: new Error('Total obligations is zero') };

    const currentMonth = format(new Date(), 'yyyy-MM');
    
    // Create allocations for each category proportionally
    const allocationsToInsert = categories.map(category => ({
      student_id: studentId,
      payment_id: paymentId,
      category_id: category.id,
      allocated_amount: (Number(category.amount) / totalObligations) * amountToAllocate,
      allocation_month: currentMonth,
      status: 'allocated' as const,
    }));

    const { error } = await supabase
      .from('operational_fund_allocations')
      .insert(allocationsToInsert);

    if (!error) {
      await fetchAllocations(currentMonth);
    }

    return { error };
  };

  // Get summary for a specific month
  const getMonthlyFundSummary = async (month?: string) => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    
    const { data: allocs } = await supabase
      .from('operational_fund_allocations')
      .select(`
        allocated_amount,
        category:monthly_payment_categories(id, name, amount, category_type)
      `)
      .eq('allocation_month', targetMonth)
      .not('payment_id', 'is', null);

    if (!allocs) return null;

    // Group by category
    const categoryTotals: Record<string, { 
      name: string; 
      target: number; 
      collected: number;
      category_type: string;
    }> = {};

    allocs.forEach((alloc: any) => {
      if (alloc.category) {
        const catId = alloc.category.id;
        if (!categoryTotals[catId]) {
          categoryTotals[catId] = {
            name: alloc.category.name,
            target: Number(alloc.category.amount),
            collected: 0,
            category_type: alloc.category.category_type,
          };
        }
        categoryTotals[catId].collected += Number(alloc.allocated_amount);
      }
    });

    const totalCollected = Object.values(categoryTotals).reduce((sum, c) => sum + c.collected, 0);
    const totalTarget = Object.values(categoryTotals).reduce((sum, c) => sum + c.target, 0);

    return {
      month: targetMonth,
      totalCollected,
      totalTarget,
      coveragePercent: totalTarget > 0 ? (totalCollected / totalTarget) * 100 : 0,
      categories: Object.entries(categoryTotals).map(([id, data]) => ({
        id,
        ...data,
        coveragePercent: data.target > 0 ? (data.collected / data.target) * 100 : 0,
      })),
    };
  };

  useEffect(() => {
    fetchSettings();
    fetchAllocations();
  }, []);

  return {
    settings,
    allocations,
    loading,
    fetchSettings,
    fetchAllocations,
    updateAmountPerStudent,
    allocateFundsFromPayment,
    getMonthlyFundSummary,
  };
}

// Standalone function for use in other hooks
export async function allocateOperationalFund(
  paymentId: string,
  studentId: string,
  paymentAmount: number
) {
  // Get current settings
  const { data: settingsData } = await supabase
    .from('operational_fund_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!settingsData || settingsData.amount_per_student === 0) return;

  const amountToAllocate = Math.min(settingsData.amount_per_student, paymentAmount);
  if (amountToAllocate <= 0) return;

  // Prevent double-allocation for the same payment
  const { data: existingAllocations } = await supabase
    .from('operational_fund_allocations')
    .select('id')
    .eq('payment_id', paymentId)
    .limit(1);

  if (existingAllocations && existingAllocations.length > 0) return;
  
  // Get active categories
  const { data: categories } = await supabase
    .from('monthly_payment_categories')
    .select('*')
    .eq('is_active', true);

  if (!categories || categories.length === 0) return;

  // Calculate total obligations
  const totalObligations = categories.reduce((sum, c) => sum + Number(c.amount), 0);
  if (totalObligations === 0) return;

  const currentMonth = format(new Date(), 'yyyy-MM');
  
  // Create allocations for each category proportionally
  const allocationsToInsert = categories.map(category => ({
    student_id: studentId,
    payment_id: paymentId,
    category_id: category.id,
    allocated_amount: (Number(category.amount) / totalObligations) * amountToAllocate,
    allocation_month: currentMonth,
    status: 'allocated' as const,
  }));

  const { error } = await supabase
    .from('operational_fund_allocations')
    .insert(allocationsToInsert);

  if (error) {
    console.error('Failed to allocate operational fund:', error);
  }
}

// Retroactively allocate operational funds for completed payments that are missing allocations
export async function syncMissingOperationalAllocations(
  amountPerStudent: number
): Promise<{ success: boolean; count: number; error?: string }> {
  if (amountPerStudent <= 0) {
    return { success: false, count: 0, error: 'Amount per student must be greater than 0' };
  }

  // Get all completed/partial payments
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, student_id, paid_amount, status')
    .in('status', ['completed', 'partial'])
    .gt('paid_amount', 0);

  if (paymentsError || !payments) {
    return { success: false, count: 0, error: paymentsError?.message || 'Failed to fetch payments' };
  }

  // Get active categories
  const { data: categories } = await supabase
    .from('monthly_payment_categories')
    .select('*')
    .eq('is_active', true);

  if (!categories || categories.length === 0) {
    return { success: false, count: 0, error: 'No active monthly categories found' };
  }

  const totalObligations = categories.reduce((sum, c) => sum + Number(c.amount), 0);
  if (totalObligations === 0) {
    return { success: false, count: 0, error: 'Total category obligations is zero' };
  }

  const currentMonth = format(new Date(), 'yyyy-MM');
  let allocatedCount = 0;

  // Batch fetch all existing allocations to avoid N+1 queries
  const paymentIds = payments.map(p => p.id);
  const { data: allExistingAllocations } = await supabase
    .from('operational_fund_allocations')
    .select('payment_id')
    .in('payment_id', paymentIds);

  const allocatedPaymentIds = new Set(
    (allExistingAllocations || []).map(a => a.payment_id).filter(Boolean)
  );

  for (const payment of payments) {
    // Check if this payment already has allocations
    if (allocatedPaymentIds.has(payment.id)) {
      continue; // Skip - already has allocations
    }

    const amountToAllocate = Math.min(amountPerStudent, Number(payment.paid_amount));
    if (amountToAllocate <= 0) continue;

    // Create allocations for each category proportionally
    const allocationsToInsert = categories.map(category => ({
      student_id: payment.student_id,
      payment_id: payment.id,
      category_id: category.id,
      allocated_amount: (Number(category.amount) / totalObligations) * amountToAllocate,
      allocation_month: currentMonth,
      status: 'allocated' as const,
    }));

    const { error } = await supabase
      .from('operational_fund_allocations')
      .insert(allocationsToInsert);

    if (!error) {
      allocatedCount++;
    }
  }

  return { success: true, count: allocatedCount };
}
