import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ fetchLead: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => import('./supabaseMock'));
vi.mock('../../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api')>()), ...api }));

import { invalidateLead, leadKey, useLead } from '../useLead';
import { channelChain, supabase } from './supabaseMock';
import { makeLead } from './helpers';

function setup(id: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, ...renderHook(() => useLead(id), { wrapper }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchLead.mockResolvedValue(makeLead());
});

describe('useLead', () => {
  it('returns { lead, loading, error, refetch } for ["lead-v2","lead",id]', async () => {
    const { result, qc } = setup('lead-1');
    expect(result.current.loading).toBe(true);
    expect(result.current.lead).toBeNull();
    await waitFor(() => expect(result.current.lead?.id).toBe('lead-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(api.fetchLead).toHaveBeenCalledWith('lead-1');
    expect(qc.getQueryData(['lead-v2', 'lead', 'lead-1'])).toMatchObject({ id: 'lead-1' });
    expect(leadKey('lead-1')).toEqual(['lead-v2', 'lead', 'lead-1']);
  });

  it('watches that lead\'s row in realtime and refetches when it changes', async () => {
    const { result, unmount } = setup('lead-1');
    await waitFor(() => expect(result.current.lead).not.toBeNull());

    expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining('lead-v2-lead-lead-1'));
    const call = channelChain.on.mock.calls.find((c: unknown[]) => c[0] === 'postgres_changes');
    expect(call?.[1]).toEqual({ event: '*', schema: 'public', table: 'leads', filter: 'id=eq.lead-1' });
    expect(channelChain.subscribe).toHaveBeenCalled();

    api.fetchLead.mockResolvedValue(makeLead({ full_name: 'Yangi Ism' }));
    const before = api.fetchLead.mock.calls.length;
    act(() => call?.[2]({ new: {} }));
    await waitFor(() => expect(result.current.lead?.full_name).toBe('Yangi Ism'));
    expect(api.fetchLead.mock.calls.length).toBe(before + 1);

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('reports a load failure as text and can retry', async () => {
    api.fetchLead.mockRejectedValueOnce(new Error('not_allowed'));
    const { result } = setup('lead-1');
    await waitFor(() => expect(result.current.error).toBe('not_allowed'));
    expect(result.current.lead).toBeNull();
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.lead?.id).toBe('lead-1'));
    expect(result.current.error).toBeNull();
  });

  it('does nothing without an id', () => {
    const { result } = setup(null);
    expect(result.current.lead).toBeNull();
    expect(api.fetchLead).not.toHaveBeenCalled();
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('invalidateLead refreshes the desk, the counts, the card and the timeline', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    invalidateLead(qc, 'lead-1', ['drafts']);
    const keys = spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
    expect(keys).toEqual([
      '["lead-v2","desk"]',
      '["lead-v2","counts"]',
      '["lead-v2","lead","lead-1"]',
      '["lead-v2","timeline","lead-1"]',
      '["lead-v2","drafts","lead-1"]',
    ]);
  });
});
