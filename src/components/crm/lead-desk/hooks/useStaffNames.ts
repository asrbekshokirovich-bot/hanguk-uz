import { useMemo } from 'react';
import { useStaffMentions, type MentionableStaff } from '@/hooks/useStaffMentions';

/** user_id -> full name, for the "Egasi" column. */
export type StaffNames = Record<string, string>;

export function buildStaffNames(staff: readonly Pick<MentionableStaff, 'user_id' | 'full_name'>[]): StaffNames {
  const names: StaffNames = {};
  for (const s of staff) {
    const name = s.full_name?.trim();
    // useStaffMentions fills a missing name with "Unknown"; that helps nobody.
    if (s.user_id && name && name !== 'Unknown') names[s.user_id] = name;
  }
  return names;
}

/**
 * Who owns a lead: a lookup of staff names by user id, built on the staff list
 * the @mention picker already loads (so no new query to maintain).
 */
export function useStaffNames() {
  const { staffList, loading } = useStaffMentions();
  const names = useMemo(() => buildStaffNames(staffList), [staffList]);
  return { names, loading };
}
