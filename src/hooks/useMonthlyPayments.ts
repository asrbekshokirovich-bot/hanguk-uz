import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MonthlyPaymentCategory {
  id: string;
  name: string;
  category_type: 'salary' | 'rent' | 'utilities' | 'other';
  amount: number;
  currency: string;
  recipient_name: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useMonthlyPayments() {
  const [categories, setCategories] = useState<MonthlyPaymentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('monthly_payment_categories')
      .select('*')
      .order('category_type', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setCategories(data as MonthlyPaymentCategory[]);
    }
    setLoading(false);
  };

  const createCategory = async (category: {
    name: string;
    category_type: 'salary' | 'rent' | 'utilities' | 'other';
    amount: number;
    recipient_name?: string;
    notes?: string;
  }) => {
    const { error, data } = await supabase
      .from('monthly_payment_categories')
      .insert({
        name: category.name,
        category_type: category.category_type,
        amount: category.amount,
        recipient_name: category.recipient_name || null,
        notes: category.notes || null,
      })
      .select()
      .single();

    if (!error) {
      await fetchCategories();
    }
    return { error, data };
  };

  const updateCategory = async (id: string, updates: Partial<MonthlyPaymentCategory>) => {
    const { error } = await supabase
      .from('monthly_payment_categories')
      .update(updates)
      .eq('id', id);

    if (!error) {
      await fetchCategories();
    }
    return { error };
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from('monthly_payment_categories')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchCategories();
    }
    return { error };
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    return updateCategory(id, { is_active: isActive });
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Calculate stats
  const activeCategories = categories.filter(c => c.is_active);
  const totalMonthlyObligations = activeCategories.reduce((sum, c) => sum + Number(c.amount), 0);
  
  const categoryBreakdown = {
    salary: activeCategories.filter(c => c.category_type === 'salary').reduce((sum, c) => sum + Number(c.amount), 0),
    rent: activeCategories.filter(c => c.category_type === 'rent').reduce((sum, c) => sum + Number(c.amount), 0),
    utilities: activeCategories.filter(c => c.category_type === 'utilities').reduce((sum, c) => sum + Number(c.amount), 0),
    other: activeCategories.filter(c => c.category_type === 'other').reduce((sum, c) => sum + Number(c.amount), 0),
  };

  return {
    categories,
    activeCategories,
    loading,
    totalMonthlyObligations,
    categoryBreakdown,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleActive,
  };
}
