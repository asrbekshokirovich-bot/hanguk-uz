import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// get_thread_previews behind the API's cap: at most 1000 rows per answer,
// newest conversation first.
type Row = { id: string; source: string; sender_id: string; last_message_at: string; unread_count: number };
let rows: Row[] = [];
const ranges: [number, number][] = [];
let failAt: number | null = null;

function rpc(name: string) {
  let range: [number, number] | null = null;
  const builder = {
    order: () => builder,
    range: (a: number, b: number) => ((range = [a, b]), builder),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      if (name !== 'get_thread_previews') return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      const [a, b] = range ?? [0, 999];
      ranges.push([a, b]);
      if (failAt !== null && a >= failAt) return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolve, reject);
      const sorted = [...rows].sort((x, y) => y.last_message_at.localeCompare(x.last_message_at) || x.id.localeCompare(y.id));
      return Promise.resolve({ data: sorted.slice(a, Math.min(b + 1, a + 1000)), error: null }).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => {
  const channel: Record<string, unknown> = {};
  channel.on = () => channel;
  channel.subscribe = () => channel;
  return {
    supabase: {
      rpc: (name: string) => rpc(name),
      channel: () => channel,
      removeChannel: vi.fn(),
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
    },
  };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff-1' } }) }));

import { MessagesProvider, useMessagesContext } from '../MessagesContext';

const thread = (n: number): Row => ({
  id: `t-${String(n).padStart(5, '0')}`, source: 'telegram', sender_id: String(n), unread_count: 0,
  last_message_at: new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString(),
});
const wrapper = ({ children }: { children: ReactNode }) => <MessagesProvider>{children}</MessagesProvider>;

beforeEach(() => {
  rows = Array.from({ length: 1111 }, (_, i) => thread(i));
  ranges.length = 0;
  failAt = null;
});

describe('MessagesProvider — the inbox list', () => {
  it('holds every conversation, not the newest 1000 (111 were missing on 2026-11-11)', async () => {
    const { result } = renderHook(() => useMessagesContext(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1111));
    expect(new Set(result.current.threads.map((t) => t.id)).size).toBe(1111);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    // newest first, the oldest at the very end
    expect(result.current.threads[0].id).toBe('t-01110');
    expect(result.current.threads[1110].id).toBe('t-00000');
  });

  it('a short inbox is one request', async () => {
    rows = rows.slice(0, 40);
    const { result } = renderHook(() => useMessagesContext(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(40));
    expect(ranges).toEqual([[0, 999]]);
  });

  it('keeps the first page when a later page fails', async () => {
    failAt = 1000;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useMessagesContext(), { wrapper });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(result.current.threads).toHaveLength(1000);
    expect(result.current.loading).toBe(false);
    spy.mockRestore();
  });
});
