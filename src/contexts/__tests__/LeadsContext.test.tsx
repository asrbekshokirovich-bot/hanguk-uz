import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// A stand-in for the API: an in-memory `leads` table behind the same query
// chain the context builds, with PostgREST's cap of 1000 rows per request.
type Row = Record<string, unknown> & { id: string };
const db = { leads: [] as Row[], profiles: [] as Row[] };
const calls: string[] = [];
let changeHandler: ((payload: { new?: unknown; old?: unknown }) => void) | null = null;
let statusHandler: ((status: string) => void) | null = null;

function from(table: 'leads' | 'profiles') {
  const filters: ((r: Row) => boolean)[] = [];
  let range: [number, number] | null = null;
  let ids: string[] | null = null;
  const builder = {
    select: () => builder,
    eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), builder),
    not: () => builder,
    order: () => builder,
    in: (col: string, list: string[]) => ((ids = list), filters.push((r) => list.includes(r[col] as string)), builder),
    range: (a: number, b: number) => ((range = [a, b]), builder),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let data = (table === 'leads' ? db.leads : db.profiles).filter((r) => filters.every((f) => f(r)));
      data = [...data].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id));
      data = range ? data.slice(range[0], Math.min(range[1] + 1, range[0] + 1000)) : data.slice(0, 1000);
      calls.push(`${table}:${ids ? `in(${ids.length})` : range ? `range(${range[0]})` : 'all'}`);
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: 'leads' | 'profiles') => from(table),
    channel: () => {
      const channel = {
        on: (_e: string, _f: unknown, cb: typeof changeHandler) => ((changeHandler = cb), channel),
        subscribe: (cb: typeof statusHandler) => ((statusHandler = cb), cb?.('SUBSCRIBED'), channel),
      };
      return channel;
    },
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff-1' }, verifySession: vi.fn() }) }));
vi.mock('@/contexts/IntakeContext', () => ({ useActiveIntake: () => ({ activeIntakeId: 'spring-2027' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LeadsProvider, useLeadsContext } from '../LeadsContext';

const lead = (n: number, o: Partial<Row> = {}): Row => ({
  id: `lead-${String(n).padStart(5, '0')}`, full_name: `Lid ${n}`, phone: null, status: 'new', qualified: true,
  intake_id: 'spring-2027', assigned_to: null, referred_by_student_id: null, converted_to_student_id: null,
  contract_number: null, last_contacted_at: null, next_follow_up: null, priority_score: 0, interest_level: 'low',
  source: 'manual', created_at: new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(), ...o,
});
const wrapper = ({ children }: { children: ReactNode }) => <LeadsProvider>{children}</LeadsProvider>;
const mount = async () => {
  const hook = renderHook(() => useLeadsContext(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};
const emit = (payload: { new?: unknown; old?: unknown }) => act(() => changeHandler?.(payload));
/** The realtime handler waits 1.5 s for a burst to end. */
const settled = (check: () => void) => waitFor(check, { timeout: 4000 });

beforeEach(() => {
  db.leads = Array.from({ length: 1065 }, (_, i) => lead(i));
  db.profiles = [{ id: 'p1', user_id: 'staff-1', full_name: 'Omina', phone: null, magic_code: null }];
  calls.length = 0;
  changeHandler = null;
  statusHandler = null;
});

describe('LeadsProvider', () => {
  it('shows every lead of the season, not the first 1000 (65 were missing on 2026-11-11)', async () => {
    const { result } = await mount();
    expect(result.current.leads).toHaveLength(1065);
    expect(new Set(result.current.leads.map((l) => l.id)).size).toBe(1065);
    expect(result.current.stats.total).toBe(1065);
  });

  it('reads the list once on mount, in two pages', async () => {
    await mount();
    expect(calls.filter((c) => c.startsWith('leads:'))).toEqual(['leads:range(0)', 'leads:range(1000)']);
  });

  it('a change re-reads only the changed lead', async () => {
    const { result } = await mount();
    calls.length = 0;
    db.leads[5] = { ...db.leads[5], status: 'lost', assigned_to: 'staff-1' };
    emit({ new: { id: db.leads[5].id } });
    await settled(() => expect(result.current.leads.find((l) => l.id === db.leads[5].id)?.status).toBe('lost'));
    expect(result.current.leads.find((l) => l.id === db.leads[5].id)?.assignee).toEqual({ full_name: 'Omina' });
    expect(result.current.leads).toHaveLength(1065);
    // not the whole list again, and the names of people come from the cache
    expect(calls).toEqual(['leads:in(1)']);
  });

  it('a new lead joins the list; a deleted one leaves it', async () => {
    const { result } = await mount();
    const added = lead(5000);
    db.leads.push(added);
    emit({ new: { id: added.id } });
    await settled(() => expect(result.current.leads).toHaveLength(1066));

    const gone = db.leads[0].id;
    db.leads = db.leads.filter((l) => l.id !== gone);
    emit({ old: { id: gone } });
    await settled(() => expect(result.current.leads.some((l) => l.id === gone)).toBe(false));
    expect(result.current.leads).toHaveLength(1065);
  });

  it('a lead moved to another season, or no longer qualified, leaves the list', async () => {
    const { result } = await mount();
    db.leads[1] = { ...db.leads[1], intake_id: 'fall-2027' };
    db.leads[2] = { ...db.leads[2], qualified: false };
    emit({ new: { id: db.leads[1].id } });
    emit({ new: { id: db.leads[2].id } });
    await settled(() => expect(result.current.leads).toHaveLength(1063));
  });

  it('a burst of saves is one request', async () => {
    const { result } = await mount();
    calls.length = 0;
    for (let i = 10; i < 40; i++) {
      db.leads[i] = { ...db.leads[i], status: 'contacted' };
      emit({ new: { id: db.leads[i].id } });
    }
    await settled(() => expect(result.current.leads.filter((l) => l.status === 'contacted')).toHaveLength(30));
    expect(calls).toEqual(['leads:in(30)']);
  });

  it('a very large burst reads the whole list instead', async () => {
    const { result } = await mount();
    calls.length = 0;
    for (let i = 0; i < 400; i++) {
      db.leads[i] = { ...db.leads[i], status: 'lost' };
      emit({ new: { id: db.leads[i].id } });
    }
    await settled(() => expect(result.current.leads.filter((l) => l.status === 'lost')).toHaveLength(400));
    expect(calls.filter((c) => c.startsWith('leads:'))).toEqual(['leads:range(0)', 'leads:range(1000)']);
  });

  it('reads the whole list again when the realtime channel comes back after a drop', async () => {
    const { result } = await mount();
    db.leads[7] = { ...db.leads[7], status: 'lost' }; // changed while the channel was down: no event
    calls.length = 0;
    act(() => statusHandler?.('CHANNEL_ERROR'));
    act(() => statusHandler?.('SUBSCRIBED'));
    await settled(() => expect(result.current.leads.find((l) => l.id === db.leads[7].id)?.status).toBe('lost'));
    expect(calls.filter((c) => c.startsWith('leads:'))).toEqual(['leads:range(0)', 'leads:range(1000)']);
  });
});
