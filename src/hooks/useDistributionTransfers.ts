import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface DistributionTransfer {
  id: string;
  transfer_month: string;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  items?: DistributionTransferItem[];
}

export interface DistributionTransferItem {
  id: string;
  transfer_id: string;
  recipient_name: string;
  percentage: number;
  deducted_amount: number;
  created_at: string;
}

// Fixed shareholder percentages
const SHAREHOLDER_PERCENTAGES = [
  { name: 'Asrbek', percentage: 47.5 },
  { name: 'Mukhsin', percentage: 47.5 },
  { name: 'Charity', percentage: 5 },
];

export function useDistributionTransfers() {
  const [transfers, setTransfers] = useState<DistributionTransfer[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTransfers = async (month?: string) => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    setLoading(true);

    const { data, error } = await supabase
      .from('distribution_transfers')
      .select('*')
      .eq('transfer_month', targetMonth)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Batch-fetch items for every transfer in a single query.
      // Previously this ran one items query per transfer (an N+1);
      // now it's one .in() lookup grouped by transfer_id into a Map.
      const transferIds = Array.from(
        new Set(
          data
            .map((transfer: any) => transfer.id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const itemsByTransferId = new Map<string, DistributionTransferItem[]>();
      if (transferIds.length > 0) {
        const { data: items } = await supabase
          .from('distribution_transfer_items')
          .select('*')
          .in('transfer_id', transferIds);
        for (const item of items ?? []) {
          const list = itemsByTransferId.get(item.transfer_id) ?? [];
          list.push(item as DistributionTransferItem);
          itemsByTransferId.set(item.transfer_id, list);
        }
      }

      const transfersWithItems = data.map((transfer: any) => ({
        ...transfer,
        items: itemsByTransferId.get(transfer.id) ?? [],
      }));
      setTransfers(transfersWithItems as DistributionTransfer[]);
    }
    setLoading(false);
    return data;
  };

  const getTotalTransfersForMonth = async (month?: string): Promise<number> => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    
    const { data } = await supabase
      .from('distribution_transfers')
      .select('total_amount')
      .eq('transfer_month', targetMonth);

    if (!data) return 0;
    return data.reduce((sum, t) => sum + Number(t.total_amount), 0);
  };

  /**
   * Create a manual transfer from distribution pool to monthly operations.
   * This:
   * 1. Deducts proportionally from each shareholder (47.5% Asrbek, 47.5% Mukhsin, 5% Charity)
   * 2. Allocates the amount to monthly operational categories proportionally
   */
  const createTransfer = async (
    amount: number,
    month: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    try {
      // 1. Create the main transfer record
      const { data: transfer, error: transferError } = await supabase
        .from('distribution_transfers')
        .insert({
          transfer_month: month,
          total_amount: amount,
          notes: notes || null,
        })
        .select()
        .single();

      if (transferError || !transfer) {
        throw new Error(transferError?.message || 'Failed to create transfer');
      }

      // 2. Create transfer items for each shareholder (deductions)
      const transferItems = SHAREHOLDER_PERCENTAGES.map(s => ({
        transfer_id: transfer.id,
        recipient_name: s.name,
        percentage: s.percentage,
        deducted_amount: (amount * s.percentage) / 100,
      }));

      const { error: itemsError } = await supabase
        .from('distribution_transfer_items')
        .insert(transferItems);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      // 3. Allocate to monthly operational categories
      const { data: categories } = await supabase
        .from('monthly_payment_categories')
        .select('*')
        .eq('is_active', true);

      if (categories && categories.length > 0) {
        const totalObligations = categories.reduce((sum, c) => sum + Number(c.amount), 0);
        
        if (totalObligations > 0) {
          // Get current user for student_id placeholder (we'll use a special ID for manual transfers)
          const { data: { user } } = await supabase.auth.getUser();
          
          const allocations = categories.map(category => ({
            student_id: user?.id || 'manual-transfer',  // Use current user as placeholder
            payment_id: null,  // No payment - manual transfer
            category_id: category.id,
            allocated_amount: (Number(category.amount) / totalObligations) * amount,
            allocation_month: month,
            status: 'allocated' as const,
          }));

          await supabase
            .from('operational_fund_allocations')
            .insert(allocations);
        }
      }

      // Dispatch events to refresh UI
      window.dispatchEvent(new CustomEvent('distribution-transfer-created'));
      window.dispatchEvent(new CustomEvent('operational-fund-updated'));
      window.dispatchEvent(new CustomEvent('income-distribution-updated'));

      await fetchTransfers(month);
      return { success: true };
    } catch (err: any) {
      console.error('Failed to create transfer:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteTransfer = async (transferId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get transfer details first to know the month
      const { data: transfer } = await supabase
        .from('distribution_transfers')
        .select('transfer_month')
        .eq('id', transferId)
        .single();

      // Delete the transfer (items will cascade delete)
      const { error } = await supabase
        .from('distribution_transfers')
        .delete()
        .eq('id', transferId);

      if (error) throw error;

      // Dispatch events
      window.dispatchEvent(new CustomEvent('distribution-transfer-created'));
      window.dispatchEvent(new CustomEvent('income-distribution-updated'));

      if (transfer) {
        await fetchTransfers(transfer.transfer_month);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const getTransferDeductionsByRecipient = async (month?: string): Promise<Record<string, number>> => {
    const targetMonth = month || format(new Date(), 'yyyy-MM');
    
    const { data } = await supabase
      .from('distribution_transfer_items')
      .select(`
        recipient_name,
        deducted_amount,
        transfer:distribution_transfers!inner(transfer_month)
      `)
      .eq('transfer.transfer_month', targetMonth);

    const deductions: Record<string, number> = {};
    data?.forEach((item: any) => {
      deductions[item.recipient_name] = 
        (deductions[item.recipient_name] || 0) + Number(item.deducted_amount);
    });
    return deductions;
  };

  return {
    transfers,
    loading,
    fetchTransfers,
    getTotalTransfersForMonth,
    getTransferDeductionsByRecipient,
    createTransfer,
    deleteTransfer,
    SHAREHOLDER_PERCENTAGES,
  };
}

/**
 * Calculate preview of how a transfer amount would be split among shareholders
 */
export function calculateTransferPreview(amount: number) {
  return SHAREHOLDER_PERCENTAGES.map(s => ({
    name: s.name,
    percentage: s.percentage,
    deduction: (amount * s.percentage) / 100,
  }));
}
