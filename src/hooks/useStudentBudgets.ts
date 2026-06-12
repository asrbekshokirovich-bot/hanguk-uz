import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import { getBudgetCategoriesForPlan, BudgetCategory, normalizePlanName } from './useStudentPlan';

export interface StudentBudget {
  id: string;
  student_id: string;
  category: string;
  allocated_amount: number;
  spent_amount: number;
  currency: string;
  status: string;
  allocated_from_payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetSummary {
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
  currency: string;
  categories: {
    category: string;
    label: string;
    allocated: number;
    spent: number;
    remaining: number;
    progress: number;
  }[];
}

export function useStudentBudgets(studentId?: string) {
  const [budgets, setBudgets] = useState<StudentBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeIntakeId } = useActiveIntake();

  const fetchBudgets = useCallback(async (id?: string) => {
    const targetId = id || studentId;
    if (!targetId) {
      setLoading(false);
      return;
    }

    const { data, error } = await applyIntake(
      supabase.from('student_budgets').select('*').eq('student_id', targetId),
      activeIntakeId,
    ).order('created_at', { ascending: true });

    if (!error && data) {
      setBudgets(data);
    }
    setLoading(false);
  }, [studentId, activeIntakeId]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  return {
    budgets,
    loading,
    fetchBudgets,
  };
}

// Hook for managing all budgets (for dashboard/overview)
export function useAllStudentBudgets() {
  const [budgets, setBudgets] = useState<StudentBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeIntakeId } = useActiveIntake();

  const fetchAllBudgets = useCallback(async () => {
    const { data, error } = await applyIntake(
      supabase.from('student_budgets').select('*'),
      activeIntakeId,
    ).order('created_at', { ascending: false });

    if (!error && data) {
      setBudgets(data);
    }
    setLoading(false);
  }, [activeIntakeId]);

  useEffect(() => {
    fetchAllBudgets();
  }, [fetchAllBudgets]);

  // Get summary by category across all students
  const getCategorySummary = useCallback(() => {
    const summary: Record<string, { allocated: number; spent: number; count: number }> = {};
    
    budgets.forEach(budget => {
      if (!summary[budget.category]) {
        summary[budget.category] = { allocated: 0, spent: 0, count: 0 };
      }
      summary[budget.category].allocated += Number(budget.allocated_amount);
      summary[budget.category].spent += Number(budget.spent_amount || 0);
      summary[budget.category].count++;
    });

    return summary;
  }, [budgets]);

  // Get budgets for a specific student
  const getBudgetsForStudent = useCallback((studentId: string) => {
    return budgets.filter(b => b.student_id === studentId);
  }, [budgets]);

  return {
    budgets,
    loading,
    fetchAllBudgets,
    getCategorySummary,
    getBudgetsForStudent,
  };
}

// Allocate budgets for a student when payment is completed
export async function allocateBudgetsForPayment(
  studentId: string,
  planValue: string,
  paymentId: string,
  intakeId?: string | null,
): Promise<{ success: boolean; error?: string; allocated?: number }> {
  // Check if budgets already exist for this student in this intake.
  let existingQuery = supabase
    .from('student_budgets')
    .select('id')
    .eq('student_id', studentId)
    .limit(1);
  if (intakeId) existingQuery = existingQuery.eq('intake_id', intakeId);
  const { data: existingBudgets } = await existingQuery;

  if (existingBudgets && existingBudgets.length > 0) {
    // Budgets already allocated
    return { success: true, allocated: 0 };
  }

  // Normalize the plan name before looking up categories
  const normalizedPlan = normalizePlanName(planValue);
  
  // Get applicable categories for the plan
  const categories = getBudgetCategoriesForPlan(normalizedPlan);
  
  if (categories.length === 0) {
    console.warn(`No budget categories found for plan: ${planValue} (normalized: ${normalizedPlan})`);
    return { success: false, error: `No budget categories found for plan: ${planValue}` };
  }

  // Create budget records
  const budgetRecords = categories.map(cat => ({
    student_id: studentId,
    category: cat.id,
    allocated_amount: cat.amount,
    spent_amount: 0,
    currency: cat.currency,
    status: 'allocated',
    allocated_from_payment_id: paymentId,
    intake_id: intakeId ?? null,
  }));

  const { error } = await supabase
    .from('student_budgets')
    .insert(budgetRecords);

  if (error) {
    console.error('Failed to allocate budgets:', error);
    return { success: false, error: error.message };
  }

  return { success: true, allocated: categories.length };
}

// Retroactively allocate budgets for all students with completed payments but no budgets
export async function allocateMissingBudgets(): Promise<{ success: boolean; results: Array<{ studentId: string; name: string; status: string }> }> {
  const results: Array<{ studentId: string; name: string; status: string }> = [];
  
  console.log('Starting budget allocation sync...');
  
  // Get all payments that are fully paid (paid_amount >= amount)
  // This is more reliable than checking status
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, student_id, status, amount, paid_amount, intake_id');

  if (paymentsError || !payments) {
    console.error('Failed to fetch payments:', paymentsError);
    return { success: false, results };
  }

  // Filter to only fully paid payments
  const fullyPaidPayments = payments.filter(p => 
    Number(p.paid_amount) >= Number(p.amount)
  );

  console.log(`Found ${fullyPaidPayments.length} fully paid payments out of ${payments.length} total`);

  // Track processed (student, season) pairs to avoid duplicates. Keyed per
  // intake so a multi-season student still gets budgets allocated in each season.
  const processedStudents = new Set<string>();

  for (const payment of fullyPaidPayments) {
    const dedupKey = `${payment.student_id}:${payment.intake_id ?? 'none'}`;
    // Skip if we already processed this student+season in this run
    if (processedStudents.has(dedupKey)) {
      continue;
    }
    processedStudents.add(dedupKey);

    // Check if student already has budgets in THIS season.
    let existingQuery = supabase
      .from('student_budgets')
      .select('id')
      .eq('student_id', payment.student_id)
      .limit(1);
    if (payment.intake_id) existingQuery = existingQuery.eq('intake_id', payment.intake_id);
    const { data: existingBudgets } = await existingQuery;

    if (existingBudgets && existingBudgets.length > 0) {
      console.log(`Student ${payment.student_id} already has budgets for this season, skipping`);
      continue; // Skip - budgets already exist
    }

    // Get student's profile for plan info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, payment_plan')
      .eq('user_id', payment.student_id)
      .single();

    if (!profile?.payment_plan) {
      results.push({ 
        studentId: payment.student_id, 
        name: profile?.full_name || 'Unknown', 
        status: 'skipped - no plan' 
      });
      console.log(`Student ${profile?.full_name || payment.student_id} has no payment plan, skipping`);
      continue;
    }

    console.log(`Allocating budgets for ${profile.full_name} with plan ${profile.payment_plan}`);

    const allocation = await allocateBudgetsForPayment(
      payment.student_id,
      profile.payment_plan,
      payment.id,
      payment.intake_id,
    );

    results.push({
      studentId: payment.student_id,
      name: profile.full_name || 'Unknown',
      status: allocation.success 
        ? `allocated ${allocation.allocated} categories` 
        : allocation.error || 'failed',
    });
  }

  console.log('Budget allocation sync complete:', results);
  return { success: true, results };
}

// Update spent amount for a budget category
export async function updateBudgetSpent(
  budgetId: string,
  spentAmount: number
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('student_budgets')
    .update({ 
      spent_amount: spentAmount,
      status: 'partially_spent',
      updated_at: new Date().toISOString(),
    })
    .eq('id', budgetId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Get budget summary for a student
export function calculateBudgetSummary(
  budgets: StudentBudget[],
  categories: BudgetCategory[]
): BudgetSummary {
  const categoryMap = new Map(categories.map(c => [c.id, c.label]));
  
  const totalAllocated = budgets.reduce((sum, b) => sum + Number(b.allocated_amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0);
  
  const categoryDetails = budgets.map(budget => {
    const allocated = Number(budget.allocated_amount);
    const spent = Number(budget.spent_amount || 0);
    const remaining = allocated - spent;
    const progress = allocated > 0 ? (spent / allocated) * 100 : 0;
    
    return {
      category: budget.category,
      label: categoryMap.get(budget.category) || budget.category,
      allocated,
      spent,
      remaining,
      progress,
    };
  });

  return {
    totalAllocated,
    totalSpent,
    remaining: totalAllocated - totalSpent,
    currency: 'UZS',
    categories: categoryDetails,
  };
}
