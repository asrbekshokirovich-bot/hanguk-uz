import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StudentPlanInfo {
  paymentPlan: string | null;
  paymentMode: string | null;
  isVIP: boolean;
  isPremium: boolean;
  isNoRisk: boolean;
  isStandart: boolean;
  isFree: boolean;
  planLabel: string;
  features: string[];
}

/**
 * CRITICAL: Centralized plan name normalization function.
 * The system uses 'standart' (with 't') as the canonical spelling.
 * This function ensures all plan name variations are normalized consistently.
 * 
 * Valid plan values: 'standart', 'premium', 'no_risk'
 */
export function normalizePlanName(plan: string | null | undefined): string {
  if (!plan) return '';
  const lowered = plan.toLowerCase().trim();
  
  // Fix common misspellings and variations
  if (lowered === 'free') {
    return 'free';
  }
  if (lowered === 'standard' || lowered === 'standart') {
    return 'standart';
  }
  if (lowered === 'no risk' || lowered === 'norisk' || lowered === 'no_risk') {
    return 'no_risk';
  }
  if (lowered === 'premium' || lowered.startsWith('premium_')) {
    return 'premium';
  }
  
  return lowered;
}

// Plan feature definitions
const PLAN_FEATURES = {
  free: ['applications', 'map', 'documents', 'aiChat'],
  standart: ['applications', 'map', 'documents', 'aiChat'],
  premium: ['applications', 'map', 'documents', 'aiChat', 'interview', 'studyPlan', 'embassy'],
  no_risk: ['applications', 'map', 'documents', 'aiChat', 'interview', 'studyPlan', 'embassy', 'flightApartment'],
};

const PLAN_LABELS: Record<string, string> = {
  free: 'FREE',
  standart: 'STANDART',
  premium: 'PREMIUM',
  no_risk: 'NO RISK',
};

const VIP_PLANS = ['premium', 'no_risk'];

export function useStudentPlan() {
  const { user } = useAuth();
  const [planInfo, setPlanInfo] = useState<StudentPlanInfo>({
    paymentPlan: null,
    paymentMode: null,
    isVIP: false,
    isPremium: false,
    isNoRisk: false,
    isStandart: false,
    isFree: false,
    planLabel: '',
    features: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlanInfo = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('payment_plan, payment_mode')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          const plan = normalizePlanName(data.payment_plan);
          const isPremium = plan === 'premium';
          const isNoRisk = plan === 'no_risk';
          const isStandart = plan === 'standart';
          const isFree = plan === 'free';
          const isVIP = VIP_PLANS.includes(plan);
          const planLabel = PLAN_LABELS[plan] || (data.payment_plan?.toUpperCase() ?? '');
          const features = PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.free;

          setPlanInfo({
            paymentPlan: data.payment_plan,
            paymentMode: data.payment_mode,
            isVIP,
            isPremium,
            isNoRisk,
            isStandart,
            isFree,
            planLabel,
            features,
          });
        }
      } catch (err) {
        console.error('Failed to fetch plan info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanInfo();
  }, [user]);

  return { ...planInfo, loading };
}

// Payment plan definitions with correct split amounts
// Split payments: 1st payment after contract, 2nd payment after university admission
export const PAYMENT_PLANS = [
  { 
    value: 'free', 
    label: 'FREE', 
    currency: 'UZS', 
    // No payment required
    priceOneTime: 0, 
    priceInstallment: 0,
    firstPayment: 0,
    secondPayment: 0,
    isVIP: false,
  },
  { 
    value: 'standart', 
    label: 'STANDART', 
    currency: 'UZS', 
    // One-time: 5M UZS
    priceOneTime: 5000000, 
    // Split: 4M + 2M = 6M UZS
    priceInstallment: 6000000,
    firstPayment: 4000000,
    secondPayment: 2000000,
    isVIP: false,
  },
  { 
    value: 'premium', 
    label: 'PREMIUM', 
    currency: 'UZS', 
    // One-time: 10M UZS
    priceOneTime: 10000000, 
    // Split: 7M + 6M = 13M UZS
    priceInstallment: 13000000,
    firstPayment: 7000000,
    secondPayment: 6000000,
    isVIP: true,
  },
  { 
    value: 'no_risk', 
    label: 'NO RISK', 
    currency: 'USD', 
    // One-time: $5,000 USD
    priceOneTime: 5000, 
    // Split: $3,000 + $2,500 = $5,500 USD
    priceInstallment: 5500,
    firstPayment: 3000,
    secondPayment: 2500,
    isVIP: true,
  },
];

export const PAYMENT_MODES = [
  { value: 'one_time', label: 'One-time Payment' },
  { value: 'installment', label: '2 Payments (Split)' },
];

export function getPlanByValue(value: string) {
  const normalized = normalizePlanName(value);
  return PAYMENT_PLANS.find(p => p.value === normalized);
}

/**
 * Apply a 0-100 discount percentage to an amount, rounded to the nearest
 * whole currency unit. This is the ONLY rounding rule for discounted
 * amounts in the app — used identically by writers (payment prefills) and
 * readers (expected-payment derivations) so a discounted expected amount
 * and a discounted stored amount are always bit-for-bit equal.
 */
export function applyDiscount(amount: number, discountPercent: number | null | undefined): number {
  const pct = Math.min(100, Math.max(0, discountPercent || 0));
  if (pct === 0) return amount;
  return Math.round(amount * (1 - pct / 100));
}

export function getPlanPrice(planValue: string, mode: string = 'one_time', discountPercent: number = 0) {
  const plan = getPlanByValue(planValue);
  if (!plan) return { amount: 0, currency: 'UZS' };

  const amount = mode === 'installment' ? plan.priceInstallment : plan.priceOneTime;
  return { amount: applyDiscount(amount, discountPercent), currency: plan.currency };
}

// Get specific payment amount based on payment type
export function getPaymentAmount(planValue: string, mode: string = 'one_time', paymentType: 'first_payment' | 'second_payment' | 'initial_deposit' | 'remaining_payment' = 'first_payment', discountPercent: number = 0) {
  const plan = getPlanByValue(planValue);
  if (!plan) return { amount: 0, currency: 'UZS' };

  // For one-time payment, everything is in the first payment
  if (mode === 'one_time') {
    return { amount: applyDiscount(plan.priceOneTime, discountPercent), currency: plan.currency };
  }

  // For split payments, return the specific amount
  const isFirstPayment = paymentType === 'first_payment' || paymentType === 'initial_deposit';
  const amount = isFirstPayment ? plan.firstPayment : plan.secondPayment;
  return { amount: applyDiscount(amount, discountPercent), currency: plan.currency };
}

// Legacy function for backward compatibility
export function getInstallmentAmount(planValue: string, mode: string = 'one_time', installmentNumber: 1 | 2 = 1, discountPercent: number = 0) {
  const paymentType = installmentNumber === 1 ? 'first_payment' : 'second_payment';
  return getPaymentAmount(planValue, mode, paymentType, discountPercent);
}

/**
 * List price + discounted price side by side, for previews (Add/Edit
 * Student dialogs, StudentDetail). Returns null for unknown plans.
 */
export function getStudentPricing(planValue: string, mode: string = 'one_time', discountPercent: number = 0) {
  const plan = getPlanByValue(planValue);
  if (!plan) return null;

  const list = mode === 'installment' ? plan.priceInstallment : plan.priceOneTime;
  const discounted = applyDiscount(list, discountPercent);
  return { list, discounted, currency: plan.currency, discountPercent: Math.min(100, Math.max(0, discountPercent || 0)) };
}

/**
 * Add working days to a date, excluding weekends (Saturday and Sunday)
 * @param startDate - The starting date
 * @param days - Number of working days to add
 * @returns The resulting date after adding working days
 */
export function addWorkingDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return result;
}

/**
 * Calculate due date for first payment (7 working days after contract date)
 * @param contractDate - The contract signing date
 * @returns The due date as ISO string (YYYY-MM-DD)
 */
export function calculateFirstPaymentDueDate(contractDate: string | null): string {
  if (!contractDate) {
    // Default to 7 working days from today if no contract date
    return addWorkingDays(new Date(), 7).toISOString().split('T')[0];
  }
  
  const contract = new Date(contractDate);
  const dueDate = addWorkingDays(contract, 7);
  return dueDate.toISOString().split('T')[0];
}

/**
 * Calculate due date for second payment (7 working days after admission confirmation)
 * @param admissionDate - The date of university admission confirmation
 * @returns The due date as ISO string (YYYY-MM-DD)
 */
export function calculateSecondPaymentDueDate(admissionDate: string | null): string {
  if (!admissionDate) {
    // Return empty if no admission date yet
    return '';
  }
  
  const admission = new Date(admissionDate);
  const dueDate = addWorkingDays(admission, 7);
  return dueDate.toISOString().split('T')[0];
}

// Legacy function for backward compatibility - now uses working days logic
export function calculateDueDate(
  contractDate: string | null, 
  paymentType: 'initial_deposit' | 'remaining_payment' | 'other' | 'first_payment' | 'second_payment', 
  mode: string = 'one_time'
): string {
  const isFirstPayment = paymentType === 'initial_deposit' || paymentType === 'first_payment';
  
  if (isFirstPayment) {
    return calculateFirstPaymentDueDate(contractDate);
  }
  
  // For second payment, we can't calculate until admission is confirmed
  // Return a placeholder date (30 working days from contract as estimate)
  if (contractDate) {
    const contract = new Date(contractDate);
    // Estimate: admission typically happens 1-2 months after contract
    const estimatedDueDate = addWorkingDays(contract, 45);
    return estimatedDueDate.toISOString().split('T')[0];
  }
  
  // Default: 30 working days from today
  return addWorkingDays(new Date(), 30).toISOString().split('T')[0];
}

export function formatPlanAmount(amount: number, currency: string) {
  if (currency === 'UZS') {
    return `${(amount / 1000000).toFixed(1)}M UZS`;
  }
  return `$${amount.toLocaleString()} USD`;
}

export function formatAmount(amount: number, currency: string) {
  if (currency === 'UZS') {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M UZS`;
    }
    return `${amount.toLocaleString()} UZS`;
  }
  return `$${amount.toLocaleString()} USD`;
}

// Get payment schedule for a student
export function getPaymentSchedule(planValue: string, mode: string = 'one_time', contractDate: string | null, discountPercent: number = 0) {
  const plan = getPlanByValue(planValue);
  if (!plan) return null;

  if (mode === 'one_time') {
    const amount = applyDiscount(plan.priceOneTime, discountPercent);
    return {
      totalAmount: amount,
      currency: plan.currency,
      payments: [{
        type: 'full_payment',
        label: 'Full Payment',
        amount,
        dueDate: calculateFirstPaymentDueDate(contractDate),
        triggerType: 'contract_based',
      }],
    };
  }

  // Split payment (installment): each installment is discounted
  // independently and the total is the sum of the discounted parts, so a
  // fully-paid discounted student's payment rows always add up to totalAmount.
  const firstAmount = applyDiscount(plan.firstPayment, discountPercent);
  const secondAmount = applyDiscount(plan.secondPayment, discountPercent);
  return {
    totalAmount: firstAmount + secondAmount,
    currency: plan.currency,
    payments: [
      {
        type: 'first_payment',
        label: '1st Payment',
        amount: firstAmount,
        dueDate: calculateFirstPaymentDueDate(contractDate),
        triggerType: 'contract_based',
      },
      {
        type: 'second_payment',
        label: '2nd Payment',
        amount: secondAmount,
        dueDate: null, // Will be set when admission is confirmed
        triggerType: 'admission_trigger',
        triggerDescription: 'Due 7 working days after university admission',
      },
    ],
  };
}

// Check if a date is overdue
export function isPaymentOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'completed' || status === 'paid') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

// Get days until due or days overdue
export function getDaysUntilDue(dueDate: string | null): { days: number; isOverdue: boolean } {
  if (!dueDate) return { days: 0, isOverdue: false };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    days: Math.abs(diffDays),
    isOverdue: diffDays < 0,
  };
}

// ==================== BUDGET ALLOCATION SYSTEM ====================

export interface BudgetCategory {
  id: string;
  label: string;
  amount: number;
  currency: string;
  applicablePlans: string[];
}

// Budget categories with amounts per plan type
export const BUDGET_CATEGORIES: BudgetCategory[] = [
  {
    id: 'document_preparation',
    label: 'Document Preparation',
    amount: 350000,
    currency: 'UZS',
    applicablePlans: ['standart', 'premium', 'no_risk'],
  },
  {
    id: 'document_delivery',
    label: 'Document Delivery to Korea',
    amount: 650000,
    currency: 'UZS',
    applicablePlans: ['standart', 'premium', 'no_risk'],
  },
  {
    id: 'bank_statement',
    label: 'Bank Statement',
    amount: 800000,
    currency: 'UZS',
    applicablePlans: ['premium', 'no_risk'],
  },
  {
    id: 'welcoming_delivery',
    label: 'Welcoming & Delivery in Korea',
    amount: 700000,
    currency: 'UZS',
    applicablePlans: ['premium', 'no_risk'],
  },
  {
    id: 'tuition_fees',
    label: 'Tuition Fees',
    amount: 25000000,
    currency: 'UZS',
    applicablePlans: ['no_risk'],
  },
  {
    id: 'rental_application',
    label: 'Rental Apartment + Application Fees',
    amount: 6000000,
    currency: 'UZS',
    applicablePlans: ['no_risk'],
  },
  {
    id: 'visa_processes',
    label: 'Visa Processes',
    amount: 1500000,
    currency: 'UZS',
    applicablePlans: ['standart', 'premium', 'no_risk'],
  },
];

// Get applicable budget categories for a plan
export function getBudgetCategoriesForPlan(planValue: string): BudgetCategory[] {
  const normalizedPlan = normalizePlanName(planValue);
  
  return BUDGET_CATEGORIES.filter(cat => 
    cat.applicablePlans.includes(normalizedPlan)
  );
}

// Get total budget amount for a plan
export function getTotalBudgetForPlan(planValue: string): { total: number; currency: string } {
  const categories = getBudgetCategoriesForPlan(planValue);
  const total = categories.reduce((sum, cat) => sum + cat.amount, 0);
  return { total, currency: 'UZS' };
}
