/**
 * The chosen universities, each with the students chosen for it — shared by
 * the Onlayn ariza and Oflayn ariza pages. Only universities confirmed for at
 * least one student (student_university_choices, status 'confirmed') appear; a student with
 * several choices appears under each one, carrying their rank for it.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUniversityCatalog } from '@/hooks/useUniversityCatalog';
import { useUniversityChoices, type UniversityChoice } from '@/hooks/useUniversityChoices';
import { cityLabel, displayName, type DisplayName } from '@/components/crm/pages/university-catalog/format';

export interface StudentLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  magic_code: string | null;
  contract_date?: string | null;
  hasPaid?: boolean;
}

export interface UniversityGroup {
  institutionId: string;
  name: DisplayName;
  city: string | null;
  choices: UniversityChoice[];
}

export function useChosenUniversityGroups(students: StudentLite[], search: string) {
  const catalog = useUniversityCatalog();
  const choices = useUniversityChoices();

  // Only choices the student agreed to and staff confirmed reach Onlayn /
  // Oflayn ariza; offered or disputed ones stay on Universitet tanlash.
  const allChoices = useMemo(
    () => [...choices.byStudent.values()].flat().filter((c) => c.status === 'confirmed'),
    [choices.byStudent],
  );

  // Students chosen for a university but outside the CRM's loaded season are
  // fetched so their card still has a name.
  const known = useMemo(() => new Map(students.map((s) => [s.user_id, s])), [students]);
  const missingIds = useMemo(
    () => [...new Set(allChoices.map((c) => c.student_id))].filter((id) => !known.has(id)).sort(),
    [allChoices, known],
  );
  const extraProfiles = useQuery<StudentLite[], Error>({
    queryKey: ['chosen-university-profiles', missingIds],
    enabled: missingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, magic_code, contract_date')
        .in('user_id', missingIds);
      if (error) throw new Error(error.message);
      return (data ?? []) as StudentLite[];
    },
  });
  const studentById = useMemo(() => {
    const m = new Map(known);
    for (const p of extraProfiles.data ?? []) m.set(p.user_id, p);
    return m;
  }, [known, extraProfiles.data]);

  const entryById = useMemo(() => new Map(catalog.entries.map((e) => [e.institution.id, e])), [catalog.entries]);

  const universities = useMemo<UniversityGroup[]>(() => {
    const groups = new Map<string, UniversityChoice[]>();
    for (const c of allChoices) groups.set(c.institution_id, [...(groups.get(c.institution_id) ?? []), c]);
    const q = search.trim().toLowerCase();
    const nameOf = (id: string) => studentById.get(id)?.full_name ?? '';
    return [...groups.entries()]
      .map(([institutionId, list]) => {
        const entry = entryById.get(institutionId);
        return {
          institutionId,
          name: entry ? displayName(entry) : { primary: '—', secondary: null },
          city: entry ? cityLabel(entry) : null,
          choices: [...list].sort((a, b) => a.rank - b.rank || nameOf(a.student_id).localeCompare(nameOf(b.student_id))),
        };
      })
      .filter((u) => {
        if (!q) return true;
        if (`${u.name.primary} ${u.name.secondary ?? ''}`.toLowerCase().includes(q)) return true;
        return u.choices.some((c) => nameOf(c.student_id).toLowerCase().includes(q));
      })
      .sort((a, b) => b.choices.length - a.choices.length || a.name.primary.localeCompare(b.name.primary));
  }, [allChoices, entryById, studentById, search]);

  return {
    universities,
    studentById,
    loading: catalog.loading || choices.loading,
    error: choices.error,
  };
}

export function getInitials(name: string | null) {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
