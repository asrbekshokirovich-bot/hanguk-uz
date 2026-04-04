import { useCallsContext } from '@/contexts/CallsContext';

export type { Call } from '@/contexts/CallsContext';

export function useCalls() {
  return useCallsContext();
}
