import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };
const calls: Call[] = [];
let receiptsTableMissing = false;

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  const result = () => {
    if (table === 'application_fee_receipts' && receiptsTableMissing) {
      return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.application_fee_receipts'" } };
    }
    if (table === 'application_fee_payments' && call.op === 'insert') {
      const rows = call.payload as unknown[];
      return { data: rows.map((_, i) => ({ id: `p${i + 1}` })), error: null };
    }
    return { data: [], error: null };
  };
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (c: string, v: unknown) => (call.filters.push([c, v]), b),
    in: () => b,
    order: () => b,
    limit: () => b,
    insert: (p: unknown) => ((call.op = 'insert'), (call.payload = p), calls.push(call), b),
    update: (p: unknown) => ((call.op = 'update'), (call.payload = p), calls.push(call), b),
    delete: () => ((call.op = 'delete'), calls.push(call), b),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej),
  };
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('@/contexts/IntakeContext', () => ({ useActiveIntake: () => ({ activeIntakeId: 'intake-1' }) }));

import { useAddFeePayments, useUpdateFeePayment } from '../useApplicationFeePayments';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const chek = (n: number) => ({ url: `https://cdn/${n}.jpg`, fileName: `${n}.jpg` });

describe('application fee cheklari (hook)', () => {
  beforeEach(() => {
    calls.length = 0;
    receiptsTableMissing = false;
  });

  it("to'lov qo'shilganda barcha cheklar yangi jadvalga, birinchisi eski ustunga yoziladi", async () => {
    const { result } = renderHook(() => useAddFeePayments(), { wrapper });
    await result.current.mutateAsync({
      studentId: 's1',
      entries: [{ institution_id: 'u1', amount_krw: 100000, expense_krw: null, receipts: [chek(1), chek(2), chek(3)] }],
    });

    const payment = calls.find((c) => c.table === 'application_fee_payments' && c.op === 'insert');
    expect((payment?.payload as Record<string, unknown>[])[0]).toMatchObject({
      receipt_url: chek(1).url,
      receipt_file_name: chek(1).fileName,
    });
    const receipts = calls.find((c) => c.table === 'application_fee_receipts' && c.op === 'insert');
    expect(receipts?.payload).toEqual([
      { payment_id: 'p1', url: chek(1).url, file_name: '1.jpg' },
      { payment_id: 'p1', url: chek(2).url, file_name: '2.jpg' },
      { payment_id: 'p1', url: chek(3).url, file_name: '3.jpg' },
    ]);
  });

  it("jadval hali yo'q bo'lsa va chek 1 tadan ko'p bo'lsa — hech narsa yozilmaydi, xato chiqadi", async () => {
    receiptsTableMissing = true;
    const { result } = renderHook(() => useAddFeePayments(), { wrapper });
    await expect(
      result.current.mutateAsync({
        studentId: 's1',
        entries: [{ institution_id: 'u1', amount_krw: 100000, expense_krw: null, receipts: [chek(1), chek(2)] }],
      }),
    ).rejects.toThrow(/qo'llanmagan/);
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it("jadval yo'q bo'lsa ham bitta chek eskicha saqlanadi", async () => {
    receiptsTableMissing = true;
    const { result } = renderHook(() => useAddFeePayments(), { wrapper });
    await result.current.mutateAsync({
      studentId: 's1',
      entries: [{ institution_id: 'u1', amount_krw: 100000, expense_krw: null, receipts: [chek(1)] }],
    });
    const payment = calls.find((c) => c.table === 'application_fee_payments' && c.op === 'insert');
    expect((payment?.payload as Record<string, unknown>[])[0]).toMatchObject({ receipt_url: chek(1).url });
  });

  it("tahrirlashda cheklar ro'yxati almashtiriladi", async () => {
    const { result } = renderHook(() => useUpdateFeePayment(), { wrapper });
    await result.current.mutateAsync({
      id: 'p9',
      studentId: 's1',
      update: { institution_id: 'u1', amount_krw: 5, expense_krw: null, receipts: [chek(4), chek(5)] },
    });
    await waitFor(() => expect(calls.some((c) => c.table === 'application_fee_receipts' && c.op === 'insert')).toBe(true));
    const del = calls.find((c) => c.table === 'application_fee_receipts' && c.op === 'delete');
    expect(del?.filters).toEqual([['payment_id', 'p9']]);
    const ins = calls.find((c) => c.table === 'application_fee_receipts' && c.op === 'insert');
    expect((ins?.payload as unknown[]).length).toBe(2);
  });
});
