import { useStaffPresenceContext } from '@/contexts/StaffPresenceContext';
export type { StaffPresenceStatus } from '@/contexts/StaffPresenceContext';

export function useStaffPresence() {
  return useStaffPresenceContext();
}
