import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { normalizePlanName } from './useStudentPlan';

// Bonus amounts based on plan type
export const BONUS_AMOUNTS = {
  free: 0,             // No bonus for FREE plan
  standart: 100000,    // 100,000 UZS for STANDART
  premium: 150000,     // 150,000 UZS for PREMIUM
  no_risk: 150000,     // 150,000 UZS for NO RISK
} as const;

// Standalone function to create bonus when payment is completed
export async function createBonusForPayment(studentId: string, planType: string): Promise<boolean> {
  // Use centralized normalization
  const normalizedPlan = normalizePlanName(planType);
  const bonusAmount = BONUS_AMOUNTS[normalizedPlan as keyof typeof BONUS_AMOUNTS];
  
  if (!bonusAmount) {
    console.log('No bonus defined for plan:', planType, '(normalized:', normalizedPlan, ')');
    return false;
  }

  const monthYear = format(new Date(), 'yyyy-MM');

  // Record via SECURITY DEFINER RPC: staff_bonuses is owner-only at the table
  // level, but this lets any staff role create the bonus. The RPC is idempotent
  // (one bonus per student), so no client-side existence check is needed.
  const { data, error } = await supabase.rpc('record_staff_bonus', {
    p_student_id: studentId,
    p_plan_type: normalizedPlan,
    p_bonus_amount: bonusAmount,
    p_currency: 'UZS',
    p_month_year: monthYear,
  });

  if (error) {
    console.error('Error creating bonus:', error);
    return false;
  }

  return data === true;
}

export interface StaffBonus {
  id: string;
  student_id: string;
  staff_user_id: string | null;
  plan_type: string;
  bonus_amount: number;
  currency: string;
  status: 'pending' | 'assigned' | 'paid';
  assigned_at: string | null;
  assigned_by: string | null;
  paid_at: string | null;
  month_year: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  student_name?: string;
  staff_name?: string;
}

export interface MonthlyBonusSummary {
  month_year: string;
  staff_user_id: string;
  staff_name: string;
  total_amount: number;
  bonus_count: number;
  paid_count: number;
  pending_count: number;
}

export function useStaffBonuses() {
  const { toast } = useToast();
  const [bonuses, setBonuses] = useState<StaffBonus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBonuses = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('staff_bonuses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bonuses:', error);
      setLoading(false);
      return;
    }

    console.log('Fetched bonuses from DB:', data?.length || 0);

    // Enrich with student and staff names - but include ALL bonuses even if profile lookup fails
    const enrichedBonuses: StaffBonus[] = [];
    
    if (data && data.length > 0) {
      // Get unique student IDs
      const studentIds = [...new Set(data.map(b => b.student_id))];
      const staffIds = [...new Set(data.filter(b => b.staff_user_id).map(b => b.staff_user_id!))];

      console.log('Looking up profiles for', studentIds.length, 'students');

      // Fetch student profiles - use user_id since staff_bonuses.student_id stores user_id
      const { data: studentProfiles, error: studentError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', studentIds);

      if (studentError) {
        console.error('Error fetching student profiles:', studentError);
      }

      // Fetch staff profiles
      const { data: staffProfiles, error: staffError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', staffIds);

      if (staffError) {
        console.error('Error fetching staff profiles:', staffError);
      }

      console.log('Found', studentProfiles?.length || 0, 'student profiles');

      const studentMap = new Map(studentProfiles?.map(p => [p.user_id, p.full_name]) || []);
      const staffMap = new Map(staffProfiles?.map(p => [p.user_id, p.full_name]) || []);

      // Include ALL bonuses - don't filter out any
      for (const bonus of data) {
        enrichedBonuses.push({
          ...bonus,
          status: bonus.status as 'pending' | 'assigned' | 'paid',
          student_name: studentMap.get(bonus.student_id) || 'Unknown Student',
          staff_name: bonus.staff_user_id ? (staffMap.get(bonus.staff_user_id) || 'Unknown Staff') : undefined,
        });
      }

      console.log('Final enriched bonuses count:', enrichedBonuses.length);
    }

    setBonuses(enrichedBonuses);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBonuses();
  }, [fetchBonuses]);

  // Create bonus when a new student is added
  const createBonusForStudent = async (studentId: string, planType: string) => {
    const normalizedPlan = planType.toLowerCase().replace(' ', '_').replace('-', '_');
    const bonusAmount = BONUS_AMOUNTS[normalizedPlan as keyof typeof BONUS_AMOUNTS];
    
    if (!bonusAmount) {
      console.log('No bonus defined for plan:', planType);
      return null;
    }

    const monthYear = format(new Date(), 'yyyy-MM');

    // Record via the idempotent SECURITY DEFINER RPC (works for any staff role).
    const { data, error } = await supabase.rpc('record_staff_bonus', {
      p_student_id: studentId,
      p_plan_type: normalizedPlan,
      p_bonus_amount: bonusAmount,
      p_currency: 'UZS',
      p_month_year: monthYear,
    });

    if (error) {
      console.error('Error creating bonus:', error);
      return null;
    }

    await fetchBonuses();
    return data === true;
  };

  // Assign bonus to a staff member (owner only)
  const assignBonus = async (bonusId: string, staffUserId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('staff_bonuses')
      .update({
        staff_user_id: staffUserId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        assigned_by: user?.id,
      })
      .eq('id', bonusId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign bonus',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Bonus Assigned',
      description: 'Bonus has been assigned to the staff member',
    });

    await fetchBonuses();
    return true;
  };

  // Mark bonus as paid
  const markAsPaid = async (bonusId: string) => {
    const { error } = await supabase
      .from('staff_bonuses')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', bonusId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark bonus as paid',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Bonus Paid',
      description: 'Bonus has been marked as paid',
    });

    await fetchBonuses();
    return true;
  };

  // Bulk mark as paid for a staff member in a month
  const markMonthlyBonusesAsPaid = async (staffUserId: string, monthYear: string) => {
    const { error } = await supabase
      .from('staff_bonuses')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('staff_user_id', staffUserId)
      .eq('month_year', monthYear)
      .eq('status', 'assigned');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark bonuses as paid',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Bonuses Paid',
      description: `All bonuses for ${monthYear} marked as paid`,
    });

    await fetchBonuses();
    return true;
  };

  // Get monthly summary grouped by staff member
  const getMonthlySummary = (monthYear?: string): MonthlyBonusSummary[] => {
    const targetMonth = monthYear || format(new Date(), 'yyyy-MM');
    
    const assignedBonuses = bonuses.filter(
      b => b.month_year === targetMonth && b.staff_user_id
    );

    const summaryMap = new Map<string, MonthlyBonusSummary>();

    for (const bonus of assignedBonuses) {
      const key = bonus.staff_user_id!;
      const existing = summaryMap.get(key);

      if (existing) {
        existing.total_amount += bonus.bonus_amount;
        existing.bonus_count += 1;
        if (bonus.status === 'paid') existing.paid_count += 1;
        else existing.pending_count += 1;
      } else {
        summaryMap.set(key, {
          month_year: targetMonth,
          staff_user_id: key,
          staff_name: bonus.staff_name || 'Unknown',
          total_amount: bonus.bonus_amount,
          bonus_count: 1,
          paid_count: bonus.status === 'paid' ? 1 : 0,
          pending_count: bonus.status !== 'paid' ? 1 : 0,
        });
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.total_amount - a.total_amount);
  };

  // Get unassigned bonuses
  const getUnassignedBonuses = () => {
    return bonuses.filter(b => !b.staff_user_id && b.status === 'pending');
  };

  // Get stats
  const getStats = () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const currentMonthBonuses = bonuses.filter(b => b.month_year === currentMonth);
    
    return {
      totalBonuses: bonuses.length,
      unassignedCount: bonuses.filter(b => !b.staff_user_id).length,
      assignedCount: bonuses.filter(b => b.status === 'assigned').length,
      paidCount: bonuses.filter(b => b.status === 'paid').length,
      currentMonthTotal: currentMonthBonuses.reduce((sum, b) => sum + b.bonus_amount, 0),
      currentMonthPending: currentMonthBonuses.filter(b => b.status !== 'paid').reduce((sum, b) => sum + b.bonus_amount, 0),
    };
  };

  // Get bonus amount for a specific student (for income distribution calculation).
  // Uses the SECURITY DEFINER RPC so non-owner staff get the real amount too.
  const getBonusForStudent = async (studentId: string): Promise<number> => {
    const { data } = await supabase.rpc('staff_bonus_amount', { p_student_id: studentId });
    return Number(data) || 0;
  };

  // Sync missing bonuses for students with COMPLETED payments but no bonus records
  const syncMissingBonuses = async (): Promise<{ created: number; errors: number }> => {
    let created = 0;
    let errors = 0;

    console.log('Starting bonus sync...');

    // Get all fully paid payments with student profiles
    const { data: paidPayments } = await supabase
      .from('payments')
      .select('id, student_id, amount, paid_amount');

    if (!paidPayments || paidPayments.length === 0) {
      console.log('No payments found');
      return { created, errors };
    }

    // Filter to only fully paid payments
    const fullyPaidPayments = paidPayments.filter(p => 
      Number(p.paid_amount) >= Number(p.amount)
    );

    console.log(`Found ${fullyPaidPayments.length} fully paid payments`);

    // Get unique student IDs with fully paid payments
    const paidStudentIds = [...new Set(fullyPaidPayments.map(p => p.student_id))];

    // Get profiles for these students
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, payment_plan')
      .in('user_id', paidStudentIds);

    if (!profiles || profiles.length === 0) {
      console.log('No profiles found for paid students');
      return { created, errors };
    }

    // Get existing bonus student IDs
    const { data: existingBonuses } = await supabase
      .from('staff_bonuses')
      .select('student_id');

    const existingStudentIds = new Set(existingBonuses?.map(b => b.student_id) || []);
    console.log(`Existing bonuses for ${existingStudentIds.size} students`);

    // Create bonuses for students with completed payments but no bonus
    for (const profile of profiles) {
      const studentId = profile.user_id;
      
      if (existingStudentIds.has(studentId)) {
        console.log(`Student ${studentId} already has bonus, skipping`);
        continue;
      }

      if (!profile.payment_plan) {
        console.log(`Student ${studentId} has no payment plan, skipping`);
        continue;
      }

      console.log(`Creating bonus for student ${studentId} with plan ${profile.payment_plan}`);
      const result = await createBonusForStudent(studentId, profile.payment_plan);
      if (result) {
        created++;
      } else {
        errors++;
      }
    }

    toast({
      title: 'Bonuslar sinxronlandi',
      description: `${created} ta yangi bonus yaratildi`,
    });

    await fetchBonuses();
    return { created, errors };
  };

  return {
    bonuses,
    loading,
    createBonusForStudent,
    assignBonus,
    markAsPaid,
    markMonthlyBonusesAsPaid,
    getMonthlySummary,
    getUnassignedBonuses,
    getStats,
    getBonusForStudent,
    syncMissingBonuses,
    refetch: fetchBonuses,
  };
}
