/**
 * "Universitet tanlash" — talaba uchun tanlangan universitetlar (3 tagacha,
 * ustuvorlik tartibida) va eski formadan qolgan erkin matnli istaklar.
 *
 * Ikkala jadval ham generated types'da yo'q (student_university_choices yangi,
 * student_university_priorities esa src'da ishlatilmagan edi), shuning uchun
 * useUniversityCatalog'dagi kabi tipsiz o'qiladi.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const MAX_CHOICES = 3;

export interface UniversityChoice {
  id: string;
  student_id: string;
  institution_id: string;
  rank: number;
  created_at: string;
}

export interface LegacyWish {
  id: string;
  student_id: string;
  custom_university_name: string | null;
  institution_id: string | null;
}

interface Result {
  data: unknown;
  error: { message: string } | null;
}
interface UntypedQuery extends PromiseLike<Result> {
  select: (columns?: string) => UntypedQuery;
  insert: (values: unknown) => UntypedQuery;
  update: (values: unknown) => UntypedQuery;
  delete: () => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
}
const db = supabase as unknown as { from: (table: string) => UntypedQuery };

const KEY = ['university-choices'] as const;

async function run(q: PromiseLike<Result>): Promise<unknown> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

/** Ranks 1..n in the given order, written one row at a time. */
async function writeRanks(ordered: UniversityChoice[]) {
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i].rank !== i + 1) {
      await run(db.from('student_university_choices').update({ rank: i + 1 }).eq('id', ordered[i].id));
    }
  }
}

export function useUniversityChoices() {
  const qc = useQueryClient();

  const choicesQuery = useQuery<UniversityChoice[], Error>({
    queryKey: [...KEY, 'choices'],
    queryFn: async () =>
      ((await run(
        db.from('student_university_choices').select('id, student_id, institution_id, rank, created_at').order('rank'),
      )) ?? []) as UniversityChoice[],
  });

  const wishesQuery = useQuery<LegacyWish[], Error>({
    queryKey: [...KEY, 'wishes'],
    queryFn: async () =>
      ((await run(
        db.from('student_university_priorities').select('id, student_id, custom_university_name, institution_id'),
      )) ?? []) as LegacyWish[],
  });

  const byStudent = useMemo(() => {
    const map = new Map<string, UniversityChoice[]>();
    for (const c of choicesQuery.data ?? []) {
      const list = map.get(c.student_id);
      if (list) list.push(c);
      else map.set(c.student_id, [c]);
    }
    for (const list of map.values()) list.sort((a, b) => a.rank - b.rank);
    return map;
  }, [choicesQuery.data]);

  const wishesByStudent = useMemo(() => {
    const map = new Map<string, LegacyWish[]>();
    for (const w of wishesQuery.data ?? []) {
      const list = map.get(w.student_id);
      if (list) list.push(w);
      else map.set(w.student_id, [w]);
    }
    return map;
  }, [wishesQuery.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: [...KEY, 'choices'] });

  const add = useMutation({
    mutationFn: async ({ studentId, institutionId }: { studentId: string; institutionId: string }) => {
      const current = byStudent.get(studentId) ?? [];
      if (current.length >= MAX_CHOICES) throw new Error(`Ko'pi bilan ${MAX_CHOICES} ta universitet tanlanadi`);
      if (current.some((c) => c.institution_id === institutionId)) throw new Error('Bu universitet allaqachon tanlangan');
      await run(
        db.from('student_university_choices').insert({
          student_id: studentId,
          institution_id: institutionId,
          rank: current.length + 1,
        }),
      );
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (choice: UniversityChoice) => {
      await run(db.from('student_university_choices').delete().eq('id', choice.id));
      const rest = (byStudent.get(choice.student_id) ?? []).filter((c) => c.id !== choice.id);
      await writeRanks(rest);
    },
    onSettled: invalidate,
  });

  /** Swap a choice with its neighbour (direction -1 = up, +1 = down). */
  const move = useMutation({
    mutationFn: async ({ choice, direction }: { choice: UniversityChoice; direction: -1 | 1 }) => {
      const list = [...(byStudent.get(choice.student_id) ?? [])];
      const i = list.findIndex((c) => c.id === choice.id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await writeRanks(list);
    },
    onSettled: invalidate,
  });

  return {
    byStudent,
    wishesByStudent,
    loading: choicesQuery.isLoading,
    error: choicesQuery.error ?? null,
    add,
    remove,
    move,
  };
}
