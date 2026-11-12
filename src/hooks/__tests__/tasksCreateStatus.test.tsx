import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// What the hook writes, kept as it was sent.
type Row = Record<string, unknown>;
const inserted: Row[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const b = {
        select: () => b,
        eq: () => b,
        in: () => b,
        order: () => b,
        insert: (row: Row) => {
          if (table === 'tasks') inserted.push(row);
          const saved = { id: `task-${inserted.length}`, source: 'manual', ...row };
          return { select: () => ({ single: () => Promise.resolve({ data: saved, error: null }) }) };
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return b;
    },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff-1' } }) }));
vi.mock('@/contexts/IntakeContext', () => ({ useActiveIntake: () => ({ activeIntakeId: 'spring-2027' }) }));
vi.mock('@/hooks/useCommandCenterSync', () => ({ useCommandCenterSync: () => ({ syncTask: vi.fn() }) }));
vi.mock('@/hooks/useStaffMentions', () => ({ useStaffMentions: () => ({ staffList: [] }) }));

import { useTasks } from '@/hooks/useTasks';

beforeEach(() => {
  inserted.length = 0;
});

describe('useTasks — a new task keeps the column it was added in', () => {
  it('added under «Jarayonda»: saved as in progress', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createTask({ title: 'Hujjatlarni tekshirish', status: 'in_progress' });
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      title: 'Hujjatlarni tekshirish',
      status: 'in_progress',
      completed_at: null,
      created_by: 'staff-1',
      intake_id: 'spring-2027',
    });
  });

  it('added under «Bajarildi»: saved as done, with the time it was done', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createTask({ title: 'Qo‘ng‘iroq qilindi', status: 'completed' });
    });
    expect(inserted[0].status).toBe('completed');
    expect(typeof inserted[0].completed_at).toBe('string');
    expect(Number.isNaN(Date.parse(inserted[0].completed_at as string))).toBe(false);
  });

  it('no column given (the «Yangi vazifa» button): to do, as before', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createTask({ title: 'Oddiy vazifa' });
    });
    expect(inserted[0]).toMatchObject({ status: 'todo', completed_at: null, priority: 'normal' });
  });
});
