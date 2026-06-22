import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlannedTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  currency: string;
  expected_date: string;
  status: 'planned' | 'completed' | 'cancelled';
  recurrence: 'monthly' | 'quarterly' | 'yearly' | null;
  notes: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

export function usePlannedTransactions() {
  const [items, setItems] = useState<PlannedTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('planned_transactions') as any)
      .select('*')
      .order('expected_date', { ascending: true });
    if (!error && data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (item: Omit<PlannedTransaction, 'id' | 'status' | 'completed_at' | 'created_at' | 'created_by'>) => {
    const { error } = await (supabase.from('planned_transactions') as any).insert(item);
    if (error) throw error;
    await fetch();
  };

  const markCompleted = async (id: string) => {
    const { error } = await (supabase.from('planned_transactions') as any)
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const cancel = async (id: string) => {
    const { error } = await (supabase.from('planned_transactions') as any)
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from('planned_transactions') as any)
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetch();
  };

  const planned = items.filter(i => i.status === 'planned');
  const upcoming = planned.filter(i => new Date(i.expected_date) >= new Date(new Date().toDateString()));
  const overdue = planned.filter(i => new Date(i.expected_date) < new Date(new Date().toDateString()));

  const upcomingIncomeUZS = upcoming.filter(i => i.type === 'income' && i.currency === 'UZS').reduce((s, i) => s + i.amount, 0);
  const upcomingExpenseUZS = upcoming.filter(i => i.type === 'expense' && i.currency === 'UZS').reduce((s, i) => s + i.amount, 0);
  const upcomingIncomeUSD = upcoming.filter(i => i.type === 'income' && i.currency === 'USD').reduce((s, i) => s + i.amount, 0);
  const upcomingExpenseUSD = upcoming.filter(i => i.type === 'expense' && i.currency === 'USD').reduce((s, i) => s + i.amount, 0);

  return {
    items, planned, upcoming, overdue, loading,
    stats: { upcomingIncomeUZS, upcomingExpenseUZS, upcomingIncomeUSD, upcomingExpenseUSD, overdueCount: overdue.length },
    create, markCompleted, cancel, remove, refetch: fetch,
  };
}
