import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// What the signed-in account holds, by user id, and a gate to hold the answer back.
const rolesOf: Record<string, string[]> = { staff: ['call_operator'], owner: ['owner'], investor: ['investor'] };
let release: (() => void) | null = null;
let held = false;
let failRoles = false;
let failAccess = false;
let financeAccess = false;
/** How many times user_roles was read. */
let reads = 0;

vi.mock('@/integrations/supabase/client', () => {
  const answer = <T,>(value: T) =>
    held ? new Promise<T>((resolve) => { release = () => resolve(value); }) : Promise.resolve(value);
  const from = (table: string) => {
    if (table === 'user_roles') {
      return {
        select: () => ({
          eq: (_c: string, id: string) =>
            (reads++, answer)(failRoles ? { data: null, error: { message: 'boom' } } : { data: (rolesOf[id] ?? []).map((role) => ({ role })), error: null }),
        }),
      };
    }
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve(
          failAccess
            ? { data: null, error: { message: 'boom' } }
            : { data: table === 'finance_access' && financeAccess ? { user_id: 'x' } : null, error: null },
        ),
    };
    return chain;
  };
  return { supabase: { from } };
});

let auth: { user: { id: string } | null; loading: boolean } = { user: null, loading: true };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { resetUserRoleStore, useUserRole } from '@/hooks/useUserRole';

/** Every render the hook's caller saw. */
const mount = () => {
  const seen: { user: string | null; loading: boolean; isStaff: boolean; isInvestor: boolean }[] = [];
  const hook = renderHook(() => {
    const r = useUserRole();
    seen.push({ user: auth.user?.id ?? null, loading: r.loading, isStaff: r.isStaff, isInvestor: r.isInvestor });
    return r;
  });
  return { ...hook, seen };
};

beforeEach(() => {
  auth = { user: null, loading: true };
  release = null;
  held = false;
  failRoles = false;
  failAccess = false;
  financeAccess = false;
  reads = 0;
  resetUserRoleStore();
});

describe('useUserRole — loading', () => {
  it('a reload: no render says «signed in, loaded, not staff» about a member of staff', async () => {
    // 1. The page opens; the session is not restored yet.
    const { result, rerender, seen } = mount();
    expect(result.current.loading).toBe(true);
    // 2. The session arrives.
    auth = { user: { id: 'staff' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStaff).toBe(true);
    // CRMPortal redirects away on exactly this combination.
    expect(seen.filter((s) => s.user === 'staff' && !s.loading && !s.isStaff)).toEqual([]);
  });

  it('stays loading while the roles are on their way', async () => {
    held = true;
    auth = { user: { id: 'owner' }, loading: false };
    const { result } = mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.loading).toBe(true);
    release?.();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOwner).toBe(true);
  });

  it('signed out is loaded, with no roles', async () => {
    auth = { user: null, loading: false };
    const { result } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStaff).toBe(false);
    expect(result.current.roles).toEqual([]);
  });

  it('another account signs in: the first account\'s roles are never shown as the second\'s', async () => {
    auth = { user: { id: 'owner' }, loading: false };
    const { result, rerender, seen } = mount();
    await waitFor(() => expect(result.current.isOwner).toBe(true));
    auth = { user: { id: 'investor' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isInvestor).toBe(true);
    expect(result.current.isStaff).toBe(false);
    expect(seen.filter((s) => s.user === 'investor' && !s.loading && s.isStaff)).toEqual([]);
  });

  it('a new token for the same person: the roles are read again, without «loading»', async () => {
    auth = { user: { id: 'staff' }, loading: false };
    const { result, rerender, seen } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOwner).toBe(false);
    const before = seen.length;
    rolesOf.staff = ['call_operator', 'owner']; // granted meanwhile
    auth = { user: { id: 'staff' }, loading: false }; // a new object, the same id
    rerender();
    await waitFor(() => expect(result.current.isOwner).toBe(true));
    expect(seen.slice(before).every((s) => !s.loading && s.isStaff)).toBe(true);
    rolesOf.staff = ['call_operator'];
  });

  it('a re-read that fails keeps what is known about the same person', async () => {
    financeAccess = true;
    auth = { user: { id: 'staff' }, loading: false };
    const { result, rerender, seen } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canSeeFinance).toBe(true);
    const before = seen.length;
    failRoles = true;
    failAccess = true; // the network is gone for a moment
    auth = { user: { id: 'staff' }, loading: false };
    rerender();
    await new Promise((r) => setTimeout(r, 30));
    // Not «not staff» — that is what throws a person out of the CRM.
    expect(seen.slice(before).every((s) => !s.loading && s.isStaff)).toBe(true);
    expect(result.current.canSeeFinance).toBe(true);
    // And an access taken away is seen once the read works again.
    failRoles = false;
    failAccess = false;
    financeAccess = false;
    auth = { user: { id: 'staff' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.canSeeFinance).toBe(false));
  });

  it('a failed read of the roles is «no roles», not the previous account\'s', async () => {
    financeAccess = true;
    auth = { user: { id: 'owner' }, loading: false };
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current.isOwner).toBe(true));
    failRoles = true;
    auth = { user: { id: 'staff' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOwner).toBe(false);
    expect(result.current.roles).toEqual([]);
  });

  it('every hook on a page shares one read', async () => {
    held = true;
    auth = { user: { id: 'staff' }, loading: false };
    const hooks = [mount(), mount(), mount(), mount(), mount(), mount(), mount()];
    await new Promise((r) => setTimeout(r, 20));
    expect(hooks.every((h) => h.result.current.loading)).toBe(true);
    release?.();
    await waitFor(() => expect(hooks.every((h) => !h.result.current.loading && h.result.current.isStaff)).toBe(true));
    expect(reads).toBe(1);
    // A hook mounted later (another page, a dialog) has its answer at once.
    const late = mount();
    expect(late.result.current.loading).toBe(false);
    expect(late.result.current.isStaff).toBe(true);
    expect(late.seen.some((s) => s.loading)).toBe(false);
    expect(reads).toBe(1);
  });

  it('a new token is one more read for the whole page, not one per hook', async () => {
    auth = { user: { id: 'staff' }, loading: false };
    const hooks = [mount(), mount(), mount()];
    await waitFor(() => expect(hooks.every((h) => !h.result.current.loading)).toBe(true));
    expect(reads).toBe(1);
    auth = { user: { id: 'staff' }, loading: false }; // one new object, handed to all of them
    hooks.forEach((h) => h.rerender());
    await new Promise((r) => setTimeout(r, 30));
    expect(reads).toBe(2);
  });

  it('the session announced twice at start-up is one read', async () => {
    held = true;
    auth = { user: { id: 'staff' }, loading: false };
    const { result, rerender } = mount();
    auth = { user: { id: 'staff' }, loading: false }; // the second announcement, while the read is out
    rerender();
    await new Promise((r) => setTimeout(r, 20));
    release?.();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(reads).toBe(1);
  });

  it('a user object that is new on every render does not read for ever', async () => {
    const { result } = renderHook(() => {
      auth = { user: { id: 'staff' }, loading: false };
      return useUserRole();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await new Promise((r) => setTimeout(r, 60));
    // The first read, and one re-read that finds nothing new and renders nothing.
    expect(reads).toBeLessThanOrEqual(2);
    expect(result.current.isStaff).toBe(true);
  });

  it('signing out forgets the roles everywhere at once', async () => {
    auth = { user: { id: 'owner' }, loading: false };
    const a = mount();
    const b = mount();
    await waitFor(() => expect(a.result.current.isOwner && b.result.current.isOwner).toBe(true));
    auth = { user: null, loading: false };
    a.rerender();
    b.rerender();
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(a.result.current.roles).toEqual([]);
    expect(b.result.current.roles).toEqual([]);
    expect(b.seen.filter((s) => s.user === null && s.isStaff)).toEqual([]);
  });

  it('a failed read of an access table is «no access» for a new account', async () => {
    financeAccess = true;
    auth = { user: { id: 'staff' }, loading: false };
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current.canSeeFinance).toBe(true));
    failAccess = true;
    auth = { user: { id: 'investor' }, loading: false };
    rerender();
    await waitFor(() => expect(result.current.isInvestor).toBe(true));
    expect(result.current.canSeeFinance).toBe(false);
  });
});
