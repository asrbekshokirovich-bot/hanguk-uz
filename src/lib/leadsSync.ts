/**
 * Keeping the CRM's list of leads in step with the database without reading
 * it all again.
 *
 * Every write to `leads` used to make each open CRM tab download the whole
 * list — about 2 MB for a thousand rows, a few hundred times a day. Now a
 * change names the rows it touched; those rows alone are read again, under
 * the list's own filter, and applyLeadChanges() folds the answer in:
 * a row that came back replaces the old one (or joins the list), a row that
 * was asked for and did not come back has left the list — deleted, moved to
 * another season, or no longer qualified.
 */

export interface StaffProfileRow {
  user_id: string;
  full_name: string | null;
}

export interface StudentProfileRow {
  full_name: string | null;
  phone: string | null;
}

/** What a lead row is decorated with: names of people, and who is already a student. */
export interface LeadLookups {
  names: Map<string, { full_name: string | null }>;
  studentNames: Set<string>;
  studentPhones: Set<string>;
}

/** The last nine digits: +998 90 123 45 67 and 901234567 are the same phone. */
export const phoneKey = (phone: string | null | undefined): string => (phone ? phone.replace(/\D/g, '').slice(-9) : '');

const nameKey = (name: string | null | undefined): string => (name ?? '').toLowerCase().trim();

export function buildLeadLookups(
  studentProfiles: StudentProfileRow[] | null | undefined,
  allProfiles: StaffProfileRow[] | null | undefined,
): LeadLookups {
  const names = new Map<string, { full_name: string | null }>();
  (allProfiles ?? []).forEach((p) => names.set(p.user_id, { full_name: p.full_name }));
  const studentNames = new Set<string>();
  const studentPhones = new Set<string>();
  (studentProfiles ?? []).forEach((p) => {
    const n = nameKey(p.full_name);
    if (n) studentNames.add(n);
    const ph = phoneKey(p.phone);
    if (ph) studentPhones.add(ph);
  });
  return { names, studentNames, studentPhones };
}

interface RawLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  assigned_to: string | null;
  referred_by_student_id: string | null;
}

export function enrichLead<T extends RawLead>(lead: T, lookups: LeadLookups) {
  const name = nameKey(lead.full_name);
  const phone = phoneKey(lead.phone);
  return {
    ...lead,
    assignee: lead.assigned_to ? lookups.names.get(lead.assigned_to) ?? null : null,
    referrer: lead.referred_by_student_id ? lookups.names.get(lead.referred_by_student_id) ?? null : null,
    isAlreadyStudent: (name !== '' && lookups.studentNames.has(name)) || (phone !== '' && lookups.studentPhones.has(phone)),
  };
}

/**
 * Fold a partial re-read into the list. `asked` are the ids that changed,
 * `fresh` what the server returned for them under the list's filter.
 * Order of the untouched rows is kept; new rows go to the end (the caller sorts).
 */
export function applyLeadChanges<T extends { id: string }>(current: T[], asked: Iterable<string>, fresh: T[]): T[] {
  const askedSet = new Set(asked);
  if (askedSet.size === 0 && fresh.length === 0) return current;
  const freshById = new Map(fresh.map((r) => [r.id, r]));
  const next: T[] = [];
  for (const row of current) {
    const replacement = freshById.get(row.id);
    if (replacement) {
      next.push(replacement);
      freshById.delete(row.id);
    } else if (!askedSet.has(row.id)) {
      next.push(row);
    }
    // asked for and not returned: the row left the list
  }
  for (const row of freshById.values()) next.push(row);
  return next;
}

/** More changed rows than this in one burst: read the whole list instead. */
export const LEAD_PARTIAL_REFRESH_MAX = 100;
