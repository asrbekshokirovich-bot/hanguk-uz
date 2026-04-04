import { useLeadsContext } from '@/contexts/LeadsContext';
export type { Lead, CreateLeadData } from '@/contexts/LeadsContext';

export const useLeads = () => {
  return useLeadsContext();
};
