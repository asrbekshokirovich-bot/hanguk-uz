import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Records every .select() string the hook sends, so the test can check it only
// asks for institution columns that exist (institutions has no name_uz; asking
// for it makes PostgREST reject the whole query).
const selects: string[] = [];

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['insert', 'eq', 'order', 'update']) q[m] = vi.fn(() => q);
  q.select = vi.fn((cols: string) => {
    selects.push(cols);
    return q;
  });
  q.single = vi.fn(() => Promise.resolve(result));
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => chain({ data: [], error: null })),
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'stu-1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { useStudyPlanSessions } from '../useStudyPlanSessions';
import type { Database } from '@/integrations/supabase/types';

type InstitutionColumn = keyof Database['public']['Tables']['institutions']['Row'];
// Columns the trainer reads from the joined institution. Typed against the live
// schema, so a column that does not exist fails type-checking as well.
const allowed: InstitutionColumn[] = ['id', 'name_en', 'name_ko'];

function embeddedColumns(select: string): string[] {
  const m = select.match(/university:[^(]*\(([^)]*)\)/);
  return m ? m[1].split(',').map((c) => c.trim()).filter(Boolean) : [];
}

describe('useStudyPlanSessions', () => {
  beforeEach(() => {
    selects.length = 0;
  });

  it('only selects institution columns that exist (no name_uz)', async () => {
    const { result } = renderHook(() => useStudyPlanSessions());
    await waitFor(() => expect(result.current.isSessionsLoading).toBe(false));
    await act(async () => {
      await result.current.createSession('study_plan', 'inst-1');
      await result.current.loadSession('sess-1');
    });

    const uniSelects = selects.filter((s) => s.includes('university:'));
    expect(uniSelects.length).toBe(3);
    for (const s of uniSelects) {
      const cols = embeddedColumns(s);
      expect(cols.length).toBeGreaterThan(0);
      for (const c of cols) expect(allowed).toContain(c);
      // Names the target table so the embed cannot be ambiguous.
      expect(s).toContain('institutions!');
    }
  });
});
