import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// A stand-in for the API: tables in memory behind the query chain the hook
// builds, with PostgREST's cap of 1000 rows per request.
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { leads: [], profiles: [], user_roles: [], student_intakes: [] };
const requests: string[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let range: [number, number] | null = null;
      const b = {
        select: () => b,
        eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), b),
        order: () => b,
        range: (a: number, z: number) => ((range = [a, z]), b),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          let data = (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
          data = range ? data.slice(range[0], Math.min(range[1] + 1, range[0] + 1000)) : data.slice(0, 1000);
          requests.push(`${table}:${range ? range[0] : 'all'}`);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  },
}));
vi.mock('@/contexts/IntakeContext', () => ({ useActiveIntake: () => ({ activeIntakeId: 'spring-2027' }) }));

import { useRegionalAnalytics } from '@/hooks/useRegionalAnalytics';

beforeEach(() => {
  requests.length = 0;
  db.leads = [];
  db.profiles = [];
  db.user_roles = [];
  db.student_intakes = [];
});

describe('useRegionalAnalytics', () => {
  it('counts every lead of the season, not the first thousand', async () => {
    // 1065 leads: the last 65 are the only ones from Samarkand.
    db.leads = Array.from({ length: 1065 }, (_, i) => ({
      id: `lead-${String(i).padStart(5, '0')}`,
      city: i < 1000 ? 'Toshkent shahri' : 'Samarqand',
      qualified: true,
      intake_id: 'spring-2027',
    }));
    db.leads.push({ id: 'other-season', city: 'Samarqand', qualified: true, intake_id: 'fall-2026' });
    db.leads.push({ id: 'not-qualified', city: 'Samarqand', qualified: false, intake_id: 'spring-2027' });

    const { result } = renderHook(() => useRegionalAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.totals.leads).toBe(1065);
    const by = Object.fromEntries(result.current.data.map((r) => [r.regionId, r.leadsCount]));
    expect(by.tashkent_city).toBe(1000);
    expect(by.samarkand).toBe(65);
    expect(requests.filter((r) => r.startsWith('leads:'))).toEqual(['leads:0', 'leads:1000']);
  });

  it('a short list is one request', async () => {
    db.leads = [{ id: 'a', city: 'Buxoro', qualified: true, intake_id: 'spring-2027' }];
    const { result } = renderHook(() => useRegionalAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totals.leads).toBe(1);
    expect(requests.filter((r) => r.startsWith('leads:'))).toEqual(['leads:0']);
  });
});
