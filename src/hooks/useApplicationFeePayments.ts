/**
 * Application fee payments — per-student, per-university fee records staff
 * log (amount in KRW + a receipt file). See
 * supabase/migrations/20260922110000_application_fee_payments.sql.
 *
 * Staff reach them from the "Application fee" block of the selected student
 * on Universitet tanlash (StudentFeePanel); Moliya > Tranzaksiyalar lists the
 * season's payments through useAllFeePayments.
 *
 * `application_fee_payments` isn't in the generated types yet, so the client
 * is widened once here (same chainable-untyped-query approach as
 * src/hooks/useUniversityCatalog.ts) rather than `as any` at every call site.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';
import {
  type FeeReceipt,
  isMissingRelationError,
  legacyReceiptColumns,
  receiptsForPayment,
  RECEIPTS_MIGRATION_MISSING_MESSAGE,
} from '@/lib/applicationFeeReceipts';

interface PostgrestLikeResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface UntypedQuery extends PromiseLike<PostgrestLikeResult> {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  in: (column: string, values: unknown[]) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  insert: (values: unknown) => UntypedQuery;
  update: (values: unknown) => UntypedQuery;
  delete: () => UntypedQuery;
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
  expense_krw: number | null;
  receipt_url: string | null;
  receipt_file_name: string | null;
  created_at: string;
  institution: FeePaymentInstitution | null;
  /** Barcha cheklar (yangi jadvaldan; bo'lmasa eski ustundagi bitta chek). */
  receipts: FeeReceipt[];
}

export interface InstitutionOption {
  id: string;
  name_ko: string;
  name_en: string | null;
  city_ko: string | null;
  is_partner: boolean;
}

const PAYMENTS_KEY = 'application-fee-payments';
const INSTITUTIONS_KEY = 'application-fee-institutions';
const LEDGER_KEY = 'application-fee-ledger';

export interface FeeLedgerEntry {
  id: string;
  student_id: string;
  student_name: string | null;
  institution_name: string | null;
  amount_krw: number;
  expense_krw: number | null;
  created_at: string;
}

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

/**
 * Joriy sezondagi barcha to'lovlar (talaba va universitet nomi bilan) — Finance
 * > Tranzaksiyalar sahifasida kirim/chiqim sifatida ko'rsatish uchun.
 */
export function useAllFeePayments() {
  const { activeIntakeId } = useActiveIntake();

  const query = useQuery<FeeLedgerEntry[], Error>({
    queryKey: [LEDGER_KEY, activeIntakeId],
    enabled: !!activeIntakeId,
    queryFn: async () => {
      if (!activeIntakeId) return [];

      const { data, error } = await rel('application_fee_payments')
        .select(
          'id, student_id, institution_id, amount_krw, expense_krw, created_at,' +
            ' institution:institutions(name_ko, name_en)',
        )
        .eq('intake_id', activeIntakeId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as {
        id: string;
        student_id: string;
        amount_krw: number;
        expense_krw: number | null;
        created_at: string;
        institution: { name_ko: string; name_en: string | null } | null;
      }[];
      if (rows.length === 0) return [];

      const studentIds = [...new Set(rows.map((r) => r.student_id))];
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', studentIds);
      if (pErr) throw new Error(pErr.message);
      const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

      return rows.map((r) => ({
        id: r.id,
        student_id: r.student_id,
        student_name: nameById.get(r.student_id) ?? null,
        institution_name: r.institution?.name_en || r.institution?.name_ko || null,
        amount_krw: r.amount_krw,
        expense_krw: r.expense_krw,
        created_at: r.created_at,
      }));
    },
  });

  return {
    entries: query.data ?? [],
    loading: query.isLoading,
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
          'id, student_id, institution_id, amount_krw, expense_krw, receipt_url, receipt_file_name, created_at,' +
            ' institution:institutions(id, name_ko, name_en, city_ko)',
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Omit<FeePayment, 'receipts'>[];
      if (rows.length === 0) return [];

      const receiptRows = await fetchReceiptRows(rows.map((r) => r.id));
      return rows.map((r) => ({
        ...r,
        receipts: receiptsForPayment(r, receiptRows?.get(r.id)),
      }));
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
  expense_krw: number | null;
  receipts: FeeReceipt[];
}

type ReceiptRow = { payment_id: string; url: string; file_name: string | null };

/**
 * To'lovlarning cheklari, to'lov id bo'yicha guruhlangan. Jadval hali bazada
 * bo'lmasa (migratsiya qo'llanmagan) `null` — chaqiruvchi eski ustunga qaytadi.
 */
async function fetchReceiptRows(paymentIds: string[]): Promise<Map<string, ReceiptRow[]> | null> {
  const { data, error } = await rel('application_fee_receipts')
    .select('payment_id, url, file_name')
    .in('payment_id', paymentIds)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw new Error(error.message);
  }
  const byPayment = new Map<string, ReceiptRow[]>();
  for (const row of (data ?? []) as ReceiptRow[]) {
    const list = byPayment.get(row.payment_id) ?? [];
    list.push(row);
    byPayment.set(row.payment_id, list);
  }
  return byPayment;
}

/**
 * Cheklar jadvali bazada bormi. Bir nechta chek saqlashdan OLDIN tekshiriladi:
 * jadval yo'q bo'lsa to'lov umuman yozilmaydi va xodim aniq xabar ko'radi —
 * ikkinchi chek indamay yo'qolib qolmaydi.
 */
async function receiptsTableAvailable(): Promise<boolean> {
  const { error } = await rel('application_fee_receipts').select('id').limit(1);
  if (!error) return true;
  if (isMissingRelationError(error)) return false;
  throw new Error(error.message);
}

/** To'lovning cheklarini berilgan ro'yxat bilan almashtiradi. */
async function replaceReceipts(paymentId: string, receipts: FeeReceipt[], tableAvailable: boolean) {
  if (!tableAvailable) return;
  const { error: delErr } = await rel('application_fee_receipts').delete().eq('payment_id', paymentId);
  if (delErr) throw new Error(delErr.message);
  if (receipts.length === 0) return;
  const { error } = await rel('application_fee_receipts').insert(
    receipts.map((r) => ({ payment_id: paymentId, url: r.url, file_name: r.fileName })),
  );
  if (error) throw new Error(error.message);
}

async function ensureReceiptsStorable(entries: { receipts: FeeReceipt[] }[]): Promise<boolean> {
  const available = await receiptsTableAvailable();
  if (!available && entries.some((e) => e.receipts.length > 1)) {
    throw new Error(RECEIPTS_MIGRATION_MISSING_MESSAGE);
  }
  return available;
}

/** Bir yoki bir nechta to'lov blokini bitta talabaga qo'shadi. */
export function useAddFeePayments() {
  const qc = useQueryClient();
  const { activeIntakeId } = useActiveIntake();

  return useMutation<void, Error, { studentId: string; entries: FeePaymentInput[] }>({
    mutationFn: async ({ studentId, entries }) => {
      const tableAvailable = await ensureReceiptsStorable(entries);
      const rows = entries.map((e) => ({
        student_id: studentId,
        institution_id: e.institution_id,
        intake_id: activeIntakeId,
        amount_krw: e.amount_krw,
        expense_krw: e.expense_krw,
        ...legacyReceiptColumns(e.receipts),
      }));
      const { data, error } = await rel('application_fee_payments').insert(rows).select('id');
      if (error) throw new Error(error.message);

      // PostgREST qo'shilgan qatorlarni yuborilgan tartibda qaytaradi.
      const inserted = (data ?? []) as { id: string }[];
      if (inserted.length !== entries.length) {
        throw new Error("To'lovlar saqlandi, lekin cheklarni biriktirib bo'lmadi. Sahifani yangilab tekshiring.");
      }
      for (let i = 0; i < entries.length; i++) {
        await replaceReceipts(inserted[i].id, entries[i].receipts, tableAvailable);
      }
    },
    onSuccess: (_data, { studentId }) => {
      qc.invalidateQueries({ queryKey: [LEDGER_KEY] });
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY, studentId] });
    },
  });
}

/** Mavjud to'lov yozuvini (universitet, summa, chek) tahrirlaydi. */
export function useUpdateFeePayment() {
  const qc = useQueryClient();

  return useMutation<void, Error, { id: string; studentId: string; update: FeePaymentInput }>({
    mutationFn: async ({ id, update }) => {
      const tableAvailable = await ensureReceiptsStorable([update]);
      const { error } = await rel('application_fee_payments')
        .update({
          institution_id: update.institution_id,
          amount_krw: update.amount_krw,
          expense_krw: update.expense_krw,
          ...legacyReceiptColumns(update.receipts),
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
      await replaceReceipts(id, update.receipts, tableAvailable);
    },
    onSuccess: (_data, { studentId }) => {
      qc.invalidateQueries({ queryKey: [LEDGER_KEY] });
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY, studentId] });
    },
  });
}

/** To'lov yozuvini butunlay o'chiradi. */
export function useDeleteFeePayment() {
  const qc = useQueryClient();

  return useMutation<void, Error, { id: string; studentId: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await rel('application_fee_payments').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { studentId }) => {
      qc.invalidateQueries({ queryKey: [LEDGER_KEY] });
      qc.invalidateQueries({ queryKey: [PAYMENTS_KEY, studentId] });
    },
  });
}
