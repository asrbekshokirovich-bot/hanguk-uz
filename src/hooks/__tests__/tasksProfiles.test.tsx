import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// An API in memory that counts what is asked of it.
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { tasks: [], profiles: [], task_comments: [] };
const requests: string[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      const b = {
        select: () => b,
        eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), b),
        in: (col: string, list: unknown[]) => (filters.push((r) => list.includes(r[col])), b),
        order: () => b,
        maybeSingle: () => {
          requests.push(`${table}:one`);
          return Promise.resolve({ data: (db[table] ?? []).find((r) => filters.every((f) => f(r))) ?? null, error: null });
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          requests.push(`${table}:list`);
          const data = (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
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
  requests.length = 0;
  db.profiles = [
    { user_id: 'staff-1', full_name: 'Operator Bir' },
    { user_id: 'staff-2', full_name: 'Operator Ikki' },
    { user_id: 'owner', full_name: 'Rahbar' },
  ];
  db.tasks = [];
  db.task_comments = [];
});

describe('useTasks — names', () => {
  it('69 tasks are two requests, not 139', async () => {
    db.tasks = Array.from({ length: 69 }, (_, i) => ({
      id: `task-${i}`,
      title: `Vazifa ${i}`,
      intake_id: 'spring-2027',
      status: 'todo',
      priority: 'normal',
      assigned_to: i % 3 === 0 ? null : i % 2 ? 'staff-1' : 'staff-2',
      created_by: i === 5 ? 'gone' : 'owner',
    }));
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tasks).toHaveLength(69);
    expect(requests).toEqual(['tasks:list', 'profiles:list']);
    const byId = Object.fromEntries(result.current.tasks.map((t) => [t.id, t]));
    expect(byId['task-1'].assignee).toEqual({ full_name: 'Operator Bir' });
    expect(byId['task-2'].assignee).toEqual({ full_name: 'Operator Ikki' });
    expect(byId['task-1'].creator).toEqual({ full_name: 'Rahbar' });
    // Nobody assigned, and a creator whose profile is gone: no name, no error.
    expect(byId['task-0'].assignee).toBeNull();
    expect(byId['task-5'].creator).toBeNull();
  });

  it('no tasks: the names are not asked for at all', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(requests).toEqual(['tasks:list']);
  });

  it('a task\'s comments come with their authors in one more request', async () => {
    db.task_comments = [
      { id: 'c1', task_id: 't', user_id: 'staff-1', content: 'a' },
      { id: 'c2', task_id: 't', user_id: 'staff-2', content: 'b' },
      { id: 'c3', task_id: 't', user_id: 'staff-1', content: 'c' },
      { id: 'c4', task_id: 'other', user_id: 'owner', content: 'd' },
    ];
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    requests.length = 0;
    const { data } = await result.current.fetchComments('t');
    expect(data.map((c) => c.user?.full_name)).toEqual(['Operator Bir', 'Operator Ikki', 'Operator Bir']);
    expect(requests).toEqual(['task_comments:list', 'profiles:list']);
  });
});
