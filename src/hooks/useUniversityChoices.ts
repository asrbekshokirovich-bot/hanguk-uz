/**
 * "Universitet tanlash" — talaba uchun tanlangan universitetlar va eski
 * formadan qolgan erkin matnli istaklar.
 *
 * The owner's rule (2026-10-14): staff pick two universities themselves
 * (ranks 1–2); the third choice (rank 3) is always a partner university. Each
 * choice is offered to the student, who answers in the mobile app ("Roziman" /
 * "O'zgartirish so'rayman"), and staff then give the final confirmation.
 *
 * Ikkala jadval ham generated types'da yo'q (student_university_choices yangi,
 * student_university_priorities esa src'da ishlatilmagan edi), shuning uchun
 * useUniversityCatalog'dagi kabi tipsiz o'qiladi.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const MAX_CHOICES = 3;
/** Ranks 1..MAX_REGULAR are picked by staff; PARTNER_RANK is the partner slot. */
export const MAX_REGULAR = 2;
export const PARTNER_RANK = 3;

export type ChoiceStatus = 'offered' | 'accepted' | 'change_requested' | 'confirmed';

export interface UniversityChoice {
  id: string;
  student_id: string;
  institution_id: string;
  rank: number;
  created_at: string;
  status: ChoiceStatus;
  responded_at: string | null;
  change_reason: string | null;
  change_note: string | null;
  confirmed_at: string | null;
}

/** Reason codes the mobile app sends with "O'zgartirish so'rayman". */
export const CHANGE_REASON_LABELS: Record<string, string> = {
  city: "Shahar to'g'ri kelmaydi",
  price: 'Kontrakt narxi qimmat',
  major: "Boshqa yo'nalish xohlaydi",
  other: 'Boshqa sabab',
};

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
        db
          .from('student_university_choices')
          .select('id, student_id, institution_id, rank, created_at, status, responded_at, change_reason, change_note, confirmed_at')
          .order('rank'),
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

  /**
   * Offer a university. A partner goes into the partner slot (rank 3); any
   * other university takes the next free staff slot (1–2). `autoPartnerId`,
   * when given, also fills an empty partner slot — used when there is exactly
   * one partner university, so the third choice appears on its own.
   */
  const add = useMutation({
    mutationFn: async ({
      studentId,
      institutionId,
      partner = false,
      autoPartnerId,
    }: {
      studentId: string;
      institutionId: string;
      partner?: boolean;
      autoPartnerId?: string | null;
    }) => {
      const current = byStudent.get(studentId) ?? [];
      if (current.some((c) => c.institution_id === institutionId)) throw new Error('Bu universitet allaqachon tanlangan');
      const regular = current.filter((c) => c.rank !== PARTNER_RANK);
      const hasPartner = current.some((c) => c.rank === PARTNER_RANK);
      if (partner) {
        if (hasPartner) throw new Error('Hamkor universitet allaqachon tanlangan');
        await run(db.from('student_university_choices').insert({ student_id: studentId, institution_id: institutionId, rank: PARTNER_RANK }));
        return;
      }
      if (regular.length >= MAX_REGULAR) throw new Error(`Xodim ko'pi bilan ${MAX_REGULAR} ta universitet tanlaydi`);
      await run(
        db.from('student_university_choices').insert({ student_id: studentId, institution_id: institutionId, rank: regular.length + 1 }),
      );
      if (autoPartnerId && !hasPartner && autoPartnerId !== institutionId) {
        await run(db.from('student_university_choices').insert({ student_id: studentId, institution_id: autoPartnerId, rank: PARTNER_RANK }));
      }
    },
    onSettled: invalidate,
  });

  /** Staff's final word, once the student has agreed. */
  const confirm = useMutation({
    mutationFn: async (choice: UniversityChoice) => {
      if (choice.status !== 'accepted') throw new Error('Talaba hali rozi bo\'lmagan');
      const { data: auth } = await supabase.auth.getUser();
      await run(
        db
          .from('student_university_choices')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: auth.user?.id ?? null })
          .eq('id', choice.id),
      );
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (choice: UniversityChoice) => {
      await run(db.from('student_university_choices').delete().eq('id', choice.id));
      if (choice.rank === PARTNER_RANK) return;
      const rest = (byStudent.get(choice.student_id) ?? []).filter((c) => c.id !== choice.id && c.rank !== PARTNER_RANK);
      await writeRanks(rest);
    },
    onSettled: invalidate,
  });

  /** Swap a choice with its neighbour (direction -1 = up, +1 = down). */
  const move = useMutation({
    mutationFn: async ({ choice, direction }: { choice: UniversityChoice; direction: -1 | 1 }) => {
      // Only the staff-picked slots reorder; the partner slot stays third.
      const list = (byStudent.get(choice.student_id) ?? []).filter((c) => c.rank !== PARTNER_RANK);
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
    confirm,
  };
}
