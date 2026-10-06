import { useCallback, useMemo } from 'react';
import { useStaffMentions } from '@/hooks/useStaffMentions';

/**
 * Staff by auth user id: the owner / closed-by / operator columns show names,
 * and the owner pickers list the people. Built on the existing mentions hook.
 */
export function useStaffNames() {
  const { staffList, loading } = useStaffMentions();
  const byId = useMemo(() => new Map(staffList.map((s) => [s.user_id, s.full_name])), [staffList]);
  const nameOf = useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      return byId.get(id) ?? `#${id.slice(0, 6)}`;
    },
    [byId],
  );
  const sorted = useMemo(() => [...staffList].sort((a, b) => a.full_name.localeCompare(b.full_name)), [staffList]);
  return { staffList: sorted, loading, nameOf };
}
