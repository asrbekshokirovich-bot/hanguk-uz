import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getTotalBudgetForPlan, normalizePlanName } from './useStudentPlan';

export interface IncomeDistributionSetting {
  id: string;
  recipient_name: string;
  percentage: number;
  recipient_type: 'owner' | 'charity' | 'other';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncomeDistribution {
  id: string;
  payment_id: string | null;
  recipient_id: string | null;
  recipient_name: string;
  percentage: number;
  base_amount: number;
  distributed_amount: number;
  distribution_month: string;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;
  created_at: string;
}

export interface MonthlyDistributionSummary {
  month: string;
  totalBaseAmount: number;
  distributions: Array<{
    recipient_name: string;
    recipient_type: string;
    percentage: number;
    total_amount: number;
    pending_amount: number;
    paid_amount: number;
  }>;
}

export function useIncomeDistribution() {
  const [settings, setSettings] = useState<IncomeDistributionSetting[]>([]);
  const [distributions, setDistributions] = useState<IncomeDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('income_distribution_settings')
      .select('*')
      .eq('is_active', true)
      .order('percentage', { ascending: false });

    if (!error && data) {
      setSettings(data as IncomeDistributionSetting[]);
    }
    return data;
  };

  const fetchDistributions = async (month?: string) => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    
    const { data, error } = await supabase
      .from('income_distributions')
      .select('*')
      .eq('distribution_month', targetMonth)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDistributions(data as IncomeDistribution[]);
    }
    setLoading(false);
    return data;
  };

  const updateSetting = async (id: string, updates: Partial<IncomeDistributionSetting>) => {
    const { error } = await supabase
      .from('income_distribution_settings')
      .update(updates)
      .eq('id', id);

    if (!error) {
      await fetchSettings();
    }
    return { error };
  };

  const addSetting = async (setting: {
    recipient_name: string;
    percentage: number;
    recipient_type: 'owner' | 'charity' | 'other';
  }) => {
    const { error, data } = await supabase
      .from('income_distribution_settings')
      .insert(setting)
      .select()
      .single();

    if (!error) {
      await fetchSettings();
    }
    return { error, data };
  };

  const deleteSetting = async (id: string) => {
    const { error } = await supabase
      .from('income_distribution_settings')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchSettings();
    }
    return { error };
  };

  const markAsPaid = async (distributionIds: string[]) => {
    const { error } = await supabase
      .from('income_distributions')
      .update({ 
        status: 'paid', 
        paid_at: new Date().toISOString() 
      })
      .in('id', distributionIds);

    if (!error) {
      await fetchDistributions();
    }
    return { error };
  };

  const getMonthlyDistributionSummary = async (month?: string): Promise<MonthlyDistributionSummary | null> => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    
    const { data: dists } = await supabase
      .from('income_distributions')
      .select('*')
      .eq('distribution_month', targetMonth);

    if (!dists || dists.length === 0) {
      return {
        month: targetMonth,
        totalBaseAmount: 0,
        distributions: [],
      };
    }

    // Group by recipient
    const recipientTotals: Record<string, {
      recipient_name: string;
      recipient_type: string;
      percentage: number;
      total_amount: number;
      pending_amount: number;
      paid_amount: number;
    }> = {};

    let totalBase = 0;
    const seenPayments = new Set<string>();

    dists.forEach((dist: any) => {
      // Only count base amount once per payment
      if (dist.payment_id && !seenPayments.has(dist.payment_id)) {
        totalBase += Number(dist.base_amount);
        seenPayments.add(dist.payment_id);
      }

      const key = dist.recipient_name;
      if (!recipientTotals[key]) {
        recipientTotals[key] = {
          recipient_name: dist.recipient_name,
          recipient_type: 'owner', // Default, we'll look it up
          percentage: Number(dist.percentage),
          total_amount: 0,
          pending_amount: 0,
          paid_amount: 0,
        };
      }
      
      const amount = Number(dist.distributed_amount);
      recipientTotals[key].total_amount += amount;
      
      if (dist.status === 'paid') {
        recipientTotals[key].paid_amount += amount;
      } else if (dist.status === 'pending') {
        recipientTotals[key].pending_amount += amount;
      }
    });

    // Get recipient types from settings
    const { data: settingsData } = await supabase
      .from('income_distribution_settings')
      .select('recipient_name, recipient_type');

    if (settingsData) {
      settingsData.forEach((s: any) => {
        if (recipientTotals[s.recipient_name]) {
          recipientTotals[s.recipient_name].recipient_type = s.recipient_type;
        }
      });
    }

    return {
      month: targetMonth,
      totalBaseAmount: totalBase,
      distributions: Object.values(recipientTotals),
    };
  };

  useEffect(() => {
    fetchSettings();
    fetchDistributions();
  }, []);

  return {
    settings,
    distributions,
    loading,
    fetchSettings,
    fetchDistributions,
    updateSetting,
    addSetting,
    deleteSetting,
    markAsPaid,
    getMonthlyDistributionSummary,
  };
}

/**
 * Calculate net distributable income after deducting (in order):
 * 1. Gateway fees (PayMe 1.5%, Click 1%, Uzum 1%)
 * 2. Staff bonus (for the staff member who signed this student) - ONLY ONCE per student
 * 3. Student-specific budget (based on plan type) - ONLY ONCE per student
 * 4. Operational fund (for monthly salaries/rent/utilities)
 * 5. Then remaining is distributed to shareholders
 */
export async function calculateNetDistributableIncome(
  paymentAmount: number,
  studentId: string,
  paymentId: string
): Promise<{ 
  netIncome: number; 
  deductions: { 
    gatewayFee: number;
    staffBonus: number;
    studentBudget: number;
    operationalFund: number; 
  } 
}> {
  // 1) Gateway fee deduction - lookup from payment_transactions
  const { data: transactions } = await supabase
    .from('payment_transactions')
    .select('gateway_fee')
    .eq('payment_id', paymentId);

  const gatewayFeeDeduction = (transactions || []).reduce(
    (sum, tx: any) => sum + Number(tx.gateway_fee || 0),
    0
  );

  // Check if this is the first distribution ever for this student
  const { data: anyDistForStudent } = await supabase
    .from('income_distributions')
    .select('id, payments!inner(student_id)')
    .eq('payments.student_id', studentId)
    .limit(1);

  const isFirstDistributionForStudent = !anyDistForStudent || anyDistForStudent.length === 0;

  // Get student profile for plan info
  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_plan')
    .eq('user_id', studentId)
    .maybeSingle();

  // 2) Staff bonus deduction (ONLY ONCE per student - on first payment)
  let staffBonusDeduction = 0;
  if (isFirstDistributionForStudent) {
    const { data: bonusRecord } = await supabase
      .from('staff_bonuses')
      .select('bonus_amount')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();

    if (bonusRecord) {
      staffBonusDeduction = Number(bonusRecord.bonus_amount || 0);
    } else if (profile?.payment_plan) {
      // Use centralized normalization for plan name
      const normalizedPlan = normalizePlanName(profile.payment_plan);
      const bonusAmounts: Record<string, number> = {
        standart: 100000,
        premium: 150000,
        no_risk: 150000,
      };
      staffBonusDeduction = bonusAmounts[normalizedPlan] || 0;
    }
  }

  // 3) Student budget deduction (ONLY ONCE per student - on first payment)
  let studentBudgetDeduction = 0;
  
  const { data: budgetRowsForPayment } = await supabase
    .from('student_budgets')
    .select('allocated_amount')
    .eq('allocated_from_payment_id', paymentId);

  const budgetAllocatedFromThisPayment = (budgetRowsForPayment || []).reduce(
    (sum, row: any) => sum + Number(row.allocated_amount || 0),
    0
  );

  if (budgetAllocatedFromThisPayment > 0) {
    studentBudgetDeduction = budgetAllocatedFromThisPayment;
  } else if (isFirstDistributionForStudent && profile?.payment_plan) {
    // If budgets haven't been allocated yet (legacy data), still subtract the expected budget
    const { data: anyBudgetForStudent } = await supabase
      .from('student_budgets')
      .select('id')
      .eq('student_id', studentId)
      .limit(1);

    if (!anyBudgetForStudent || anyBudgetForStudent.length === 0) {
      const { total } = getTotalBudgetForPlan(profile.payment_plan);
      studentBudgetDeduction = total;
    }
  }

  // 4) Operational fund deduction (monthly payments)
  const { data: opSettings } = await supabase
    .from('operational_fund_settings')
    .select('amount_per_student')
    .limit(1)
    .maybeSingle();

  const { data: opAllocRows } = await supabase
    .from('operational_fund_allocations')
    .select('allocated_amount')
    .eq('payment_id', paymentId);

  const opAllocatedForPayment = (opAllocRows || []).reduce(
    (sum, row: any) => sum + Number(row.allocated_amount || 0),
    0
  );

  const operationalFundDeduction = opAllocatedForPayment > 0
    ? Math.min(opAllocatedForPayment, paymentAmount)
    : Math.min(opSettings?.amount_per_student || 0, paymentAmount);

  // Calculate net income in order: Payment - Fees - Bonus - Budget - Monthly
  const afterGatewayFee = paymentAmount - gatewayFeeDeduction;
  const afterBonus = afterGatewayFee - staffBonusDeduction;
  const afterBudget = afterBonus - studentBudgetDeduction;
  const netIncome = Math.max(0, afterBudget - operationalFundDeduction);

  console.log('📊 Income calculation breakdown (new order):', {
    paymentAmount,
    '1. - gatewayFee': gatewayFeeDeduction,
    '2. - staffBonus': staffBonusDeduction,
    '3. - studentBudget': studentBudgetDeduction,
    '4. - operationalFund (monthly)': operationalFundDeduction,
    '5. = netIncome (for distribution)': netIncome,
  });

  return {
    netIncome,
    deductions: {
      gatewayFee: gatewayFeeDeduction,
      staffBonus: staffBonusDeduction,
      studentBudget: studentBudgetDeduction,
      operationalFund: operationalFundDeduction,
    },
  };
}

/**
 * Automatically distribute income from a payment after deducting all costs.
 * This function:
 * 1. Calculates net income (payment - operational fund - student budget)
 * 2. Distributes to owners and charity based on configured percentages
 */
export async function distributeIncomeFromPayment(
  paymentId: string,
  paymentAmount: number,
  studentId: string,
  month?: string
) {
  const currentMonth = month || format(new Date(), 'yyyy-MM');

  // Check if distributions already exist for this payment
  const { data: existingDistributions } = await supabase
    .from('income_distributions')
    .select('id')
    .eq('payment_id', paymentId)
    .limit(1);

  if (existingDistributions && existingDistributions.length > 0) {
    console.log('Income distribution already exists for payment:', paymentId);
    return;
  }

  // Calculate net distributable income
  const { netIncome, deductions } = await calculateNetDistributableIncome(
    paymentAmount,
    studentId,
    paymentId
  );

  console.log('💰 Income distribution calculation:', {
    paymentAmount,
    gatewayFee: deductions.gatewayFee,
    operationalFund: deductions.operationalFund,
    studentBudget: deductions.studentBudget,
    staffBonus: deductions.staffBonus,
    netIncome,
  });

  if (netIncome <= 0) {
    console.log('No distributable income after deductions');
    return;
  }

  // Get active distribution settings
  const { data: settings } = await supabase
    .from('income_distribution_settings')
    .select('*')
    .eq('is_active', true);

  if (!settings || settings.length === 0) {
    console.warn('No active income distribution settings found');
    return;
  }

  // Validate total percentage equals 100%
  const totalPercentage = settings.reduce((sum, s) => sum + Number(s.percentage), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    console.warn('Income distribution percentages do not sum to 100%:', totalPercentage);
  }

  // Create distribution records
  const distributions = settings.map(setting => ({
    payment_id: paymentId,
    recipient_id: setting.id,
    recipient_name: setting.recipient_name,
    percentage: setting.percentage,
    base_amount: netIncome,
    distributed_amount: (netIncome * Number(setting.percentage)) / 100,
    distribution_month: currentMonth,
    status: 'pending' as const,
  }));

  const { error } = await supabase
    .from('income_distributions')
    .insert(distributions);

  if (error) {
    console.error('Failed to create income distributions:', error);
  } else {
    console.log('✅ Income distributions created successfully for net amount:', netIncome);
    // Dispatch event to refresh UI (only in browser context)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('income-distribution-updated'));
    }
  }
}

/**
 * Sync missing distributions for completed payments that don't have distribution records.
 * This is a one-time function to retroactively process existing payments.
 */
export async function syncMissingDistributions(): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Get all payments with some amount paid
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, paid_amount, student_id, paid_at, status')
    .gt('paid_amount', 0)
    // Important: process oldest first so "first payment" deductions (budget/bonus) apply correctly
    .order('created_at', { ascending: true });

  if (!payments || payments.length === 0) {
    console.log('No payments found');
    return { processed, skipped, errors };
  }

  // Get existing distribution payment IDs
  const { data: existingDistributions } = await supabase
    .from('income_distributions')
    .select('payment_id');

  const existingPaymentIds = new Set(existingDistributions?.map(d => d.payment_id).filter(Boolean) || []);

  console.log(`Found ${payments.length} payments, ${existingPaymentIds.size} already have distributions`);

  for (const payment of payments) {
    // Skip if already has distributions
    if (existingPaymentIds.has(payment.id)) {
      continue;
    }

    // ONLY process FULLY COMPLETED payments (paid_amount >= amount)
    const isFullyCompleted = Number(payment.paid_amount) >= Number(payment.amount);
    if (!isFullyCompleted) {
      console.log(`⏳ Skipping partial payment ${payment.id} (${payment.paid_amount}/${payment.amount})`);
      skipped++;
      continue;
    }

    try {
      const month = payment.paid_at 
        ? format(new Date(payment.paid_at), 'yyyy-MM')
        : format(new Date(), 'yyyy-MM');

      await distributeIncomeFromPayment(
        payment.id,
        payment.paid_amount,
        payment.student_id,
        month
      );
      processed++;
      console.log(`✅ Processed distribution for completed payment ${payment.id}`);
    } catch (err) {
      errors++;
      console.error(`Error processing payment ${payment.id}:`, err);
    }
  }

  console.log(`Sync complete: ${processed} processed, ${skipped} skipped (partial), ${errors} errors`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('income-distribution-updated'));
  }
  
  return { processed, skipped, errors };
}

/**
 * Sync gateway fees for existing distributions.
 * This recalculates distributions to account for gateway fees that were missed.
 */
export async function syncGatewayFeesForDistributions(): Promise<{ updated: number; totalAdjustment: number }> {
  let updated = 0;
  let totalAdjustment = 0;

  // Get all payments with distributions
  const { data: distributedPayments } = await supabase
    .from('income_distributions')
    .select('payment_id, base_amount')
    .not('payment_id', 'is', null);

  if (!distributedPayments || distributedPayments.length === 0) {
    return { updated, totalAdjustment };
  }

  // Get unique payment IDs
  const paymentIds = [...new Set(distributedPayments.map(d => d.payment_id).filter(Boolean))];

  for (const paymentId of paymentIds) {
    if (!paymentId) continue;

    // Get gateway fees for this payment
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select('gateway_fee')
      .eq('payment_id', paymentId);

    const gatewayFee = (transactions || []).reduce(
      (sum, tx: any) => sum + Number(tx.gateway_fee || 0),
      0
    );

    if (gatewayFee <= 0) continue;

    // Get current distributions for this payment
    const { data: dists } = await supabase
      .from('income_distributions')
      .select('id, base_amount, distributed_amount, percentage')
      .eq('payment_id', paymentId);

    if (!dists || dists.length === 0) continue;

    // Calculate new base amount (current base - gateway fee / number of recipients)
    const currentBase = Number(dists[0].base_amount);
    const newBase = Math.max(0, currentBase - gatewayFee);

    if (newBase === currentBase) continue;

    // Update each distribution record
    for (const dist of dists) {
      const newAmount = (newBase * Number(dist.percentage)) / 100;
      const oldAmount = Number(dist.distributed_amount);
      
      await supabase
        .from('income_distributions')
        .update({
          base_amount: newBase,
          distributed_amount: newAmount,
        })
        .eq('id', dist.id);

      totalAdjustment += (oldAmount - newAmount);
    }

    updated++;
    console.log(`Updated distributions for payment ${paymentId}: reduced by ${gatewayFee} gateway fee`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('income-distribution-updated'));
  }
  console.log(`Gateway fee sync complete: ${updated} payments updated, ${totalAdjustment} total adjustment`);
  
  return { updated, totalAdjustment };
}
