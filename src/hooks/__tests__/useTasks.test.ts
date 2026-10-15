import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Records every row the hook inserts into `tasks`.
const inserts: Record<string, unknown>[] = [];

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'update', 'is', 'in']) q[m] = vi.fn(() => q);
  q.insert = vi.fn((row: Record<string, unknown>) => {
    inserts.push(row);
    return q;
  });
  q.single = vi.fn(() =>
    Promise.resolve({ data: { id: 't-1', title: 'x', status: inserts.at(-1)?.status ?? 'todo' }, error: null }),
  );
  q.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => chain({ data: [], error: null })) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff-1' } }) }));
vi.mock('@/contexts/IntakeContext', () => ({ useActiveIntake: () => ({ activeIntakeId: null }) }));
vi.mock('@/lib/intakeQuery', () => ({ applyIntake: (q: unknown) => q }));
vi.mock('@/hooks/useCommandCenterSync', () => ({ useCommandCenterSync: () => ({ syncTask: vi.fn() }) }));
vi.mock('@/hooks/useStaffMentions', () => ({ useStaffMentions: () => ({ staffList: [] }) }));
vi.mock('@/hooks/useMentionNotifications', () => ({ createMention: vi.fn() }));

import { useTasks } from '../useTasks';

describe('useTasks.createTask', () => {
  beforeEach(() => {
    inserts.length = 0;
  });

  it('creates the task in the kanban column it was added from', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createTask({ title: 'Call the student', status: 'in_progress' });
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].status).toBe('in_progress');
  });

  it('stamps completed_at when added straight to the completed column', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createTask({ title: 'Already done', status: 'completed' });
    });
    expect(inserts[0].status).toBe('completed');
    expect(typeof inserts[0].completed_at).toBe('string');
  });

  it('leaves the status to the database default when none is given', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.createTask({ title: 'Quick add' });
    });
    expect(inserts[0]).not.toHaveProperty('status');
  });
});
