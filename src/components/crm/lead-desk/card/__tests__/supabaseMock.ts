/**
 * A stand-in for `@/integrations/supabase/client` (the real one throws without
 * env vars). Use it from a test file with
 *
 *   vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
 *
 * `results[table]` is what a select on that table returns; `writes` records
 * every insert / update so a test can assert what the card wrote.
 */
import { vi } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const channelChain: any = {
  on: vi.fn(() => channelChain),
  subscribe: vi.fn(() => channelChain),
};

export const results: Record<string, unknown[]> = {};
export const writes: { table: string; op: 'insert' | 'update'; row: unknown }[] = [];

function builder(table: string): any {
  const b: any = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    insert: (row: unknown) => {
      writes.push({ table, op: 'insert', row });
      return Promise.resolve({ data: null, error: null });
    },
    update: (row: unknown) => {
      writes.push({ table, op: 'update', row });
      return b;
    },
    then: (resolve: (v: unknown) => unknown) => resolve({ data: results[table] ?? [], error: null }),
  };
  return b;
}

export const supabase = {
  channel: vi.fn(() => channelChain),
  removeChannel: vi.fn(),
  from: vi.fn((table: string) => builder(table)),
  rpc: vi.fn(),
  functions: { invoke: vi.fn() },
};

export function resetSupabaseMock() {
  for (const k of Object.keys(results)) delete results[k];
  writes.length = 0;
}
