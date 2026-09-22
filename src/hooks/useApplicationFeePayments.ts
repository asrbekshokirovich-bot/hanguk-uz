/**
 * Application fee payments — per-student, per-university fee records staff
 * log (amount in KRW + a receipt file). See
 * supabase/migrations/20260922110000_application_fee_payments.sql.
 *
 * `application_fee_payments` isn't in the generated types yet, so the client
 * is widened once here (same chainable-untyped-query approach as
 * src/hooks/useUniversityCatalog.ts) rather than `as any` at every call site.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';

interface PostgrestLikeResult {
  data: unknown;
  error: { message: string } | null;
}

interface UntypedQuery extends PromiseLike<PostgrestLikeResult> {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  insert: (values: unknown) => UntypedQuery;
}

const rel = (name: string): UntypedQuery =>
  (supabase as unknown as { from: (n: string) => UntypedQuery }).from(name);

export interface FeePaymentInstitution {
  id: string;
  name_ko: string;
  name_en: string | null;
  city_ko: string | null;
}

export interface FeePayment {
  id: string;
  student_id: string;
  institution_id: string;
  amount_krw: number;
  receipt_url: string | null;
  receipt_file_name: string | null;
  created_at: string;
  institution: FeePaymentInstitution | null;
}

export interface FeeRosterEntry {
  student_id: string;
  full_name: string | null;
  avatar_url: string | null;
  office_location: string | null;
  paidCount: number;
}

export interface InstitutionOption {
  id: string;
  name_ko: string;
  name_en: string | null;
  city_ko: string | null;
  is_partner: boolean;
}

const ROSTER_KEY = 'application-fee-roster';
const PAYMENTS_KEY = 'application-fee-payments';
const INSTITUTIONS_KEY = 'application-fee-institutions';

/** 400+ universitetning yengil ro'yxati — universitet tanlash dialogi uchun. */
export function useInstitutionOptions() {
  return useQuery<InstitutionOption[], Error>({
    queryKey: [INSTITUTIONS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name_ko, name_en, city_ko, is_partner')
        .order('name_ko');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Talaba kartochkalari + har birining shu sezon uchun to'lov soni. */
export function useApplicationFeeRoster() {
  const { activeIntakeId } = useActiveIntake();

  const query = useQuery<FeeRosterEntry[], Error>({
    queryKey: [ROSTER_KEY, activeIntakeId],
    enabled: !!activeIntakeId,
    queryFn: async () => {
      if (!activeIntakeId) return [];

      // Sezon ro'yxati boshqa hamma joyda ham student_intakes'dan olinadi —
      // rolga qarab farq qilmaydigan yagona manba (useCRMData.fetchStudents bilan bir xil).
      const { data: memberships, error: mErr } = await supabase
        .from('student_intakes')
        .select('student_id')
        .eq('intake_id', activeIntakeId);
      if (mErr) throw new Error(mErr.message);

      const studentIds = [...new Set((memberships ?? []).map((m) => m.student_id))];
      if (studentIds.length === 0) return [];

      const [{ data: staffRoles, error: sErr }, { data: profiles, error: pErr }] = await Promise.all([
        supabase.from('user_roles').select('user_id'),
        supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url, office_location')
          .in('user_id', studentIds),
      ]);
      if (sErr) throw new Error(sErr.message);
      if (pErr) throw new Error(pErr.message);

      const { data: payments, error: payErr } = await rel('application_fee_payments')
        .select('student_id')
        .eq('intake_id', activeIntakeId);
      if (payErr) throw new Error(payErr.message);

      const staffIds = new Set((staffRoles ?? []).map((r) => r.user_id));
      const countByStudent = new Map<string, number>();
      for (const p of (payments ?? []) as { student_id: string }[]) {
        countByStudent.set(p.student_id, (countByStudent.get(p.student_id) ?? 0) + 1);
      }

      return (profiles ?? [])
        .filter((p) => !staffIds.has(p.user_id))
        .map((p) => ({ ...p, paidCount: countByStudent.get(p.user_id) ?? 0 }))
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
    },
  });

  return {
    roster: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Bitta talabaning barcha to'lov yozuvlari (universitet, summa, chek). */
export function useStudentFeePayments(studentId: string | null) {
  const query = useQuery<FeePayment[], Error>({
    queryKey: [PAYMENTS_KEY, studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await rel('application_fee_payments')
        .select(
          'id, student_id, institution_id, amount_krw, receipt_url, receipt_file_name, created_at,' +
            ' institution:institutions(id, name_ko, name_en, city_ko)',
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as FeePayment[];
    },
  });

  return {
    payments: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
}

export interface FeePaymentInput {
  institution_id: string;
  amount_krw: number;
  receipt_url: string | null;
  receipt_file_name: string | null;
}

/** Bir yoki bir nechta to'lov blokini bitta talabaga qo'shadi. */
export function useAddFeePayments() {
  const qc = useQueryClient();
  const { activeIntakeId } = useActiveIntake();

  return useMutation<void, Error, { studentId: string; entries: FeePaymentInput[] }>({
    mutationFn: async ({ studentId, entries }) => {
      const rows = entries.map((e) => ({
        student_id: studentId,
        institution_id: e.institution_id,
        intake_id: activeIntakeId,
        amount_krw: e.amount_krw,
        receipt_url: e.receipt_url,
        receipt_file_name: e.receipt_file_name,
      }));
      const { error } = await rel('application_fee_payments').insert(rows);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { studentId }) => {
      qc.invalidateQueries({ queryKey: [ROSTER_KEY] });
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY, studentId] });
    },
  });
}
