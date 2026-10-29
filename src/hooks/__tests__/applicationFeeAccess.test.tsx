import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Per-test answers for each table the hook reads.
const db: { roles: string[]; tables: Record<string, boolean> } = { roles: [], tables: {} };

vi.mock('@/integrations/supabase/client', () => {
  const single = (table: string) => Promise.resolve({ data: db.tables[table] ? { user_id: 'u', id: 'x' } : null });
  const from = (table: string) => {
    if (table === 'user_roles') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: db.roles.map((role) => ({ role })), error: null }),
        }),
      };
    }
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => single(table),
    };
    return chain;
  };
  return { supabase: { from } };
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));

import { useUserRole } from '@/hooks/useUserRole';
// Not a hook despite the name: a plain builder, called here outside React.
import { useSidebarGroups as buildSidebarGroups } from '@/components/crm/CRMSidebar';
import { hasApplicationFeeRole } from '@/lib/applicationFeeAccess';

const roleOf = async (roles: string[], tables: Record<string, boolean> = {}) => {
  db.roles = roles;
  db.tables = tables;
  const { result } = renderHook(() => useUserRole());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

const t = (k: string) => k;
const feeItemVisible = (r: Awaited<ReturnType<typeof roleOf>>) =>
  buildSidebarGroups(
    r.canSeeFinance,
    r.isAdmin,
    r.isCallOperator,
    r.isDocumentHandler,
    t,
    'uz',
    r.canSeeApplicationFees,
  )
    .flatMap((g) => g.items)
    .find((i) => i.url === '/crm/application-fees')?.visible;

describe('Application fee access', () => {
  beforeEach(() => {
    db.roles = [];
    db.tables = {};
  });

  it('an owner sees the section (menu and page gate)', async () => {
    const r = await roleOf(['owner']);
    expect(r.canSeeApplicationFees).toBe(true);
    expect(feeItemVisible(r)).toBe(true);
  });

  it('admin and document handler see it through their role', async () => {
    expect((await roleOf(['admin'])).canSeeApplicationFees).toBe(true);
    expect((await roleOf(['document_handler'])).canSeeApplicationFees).toBe(true);
  });

  it('a call operator does not see it without a grant', async () => {
    const r = await roleOf(['call_operator']);
    expect(r.canSeeApplicationFees).toBe(false);
    expect(feeItemVisible(r)).toBe(false);
  });

  it('a call operator listed in application_fee_access sees it, and nothing else opens', async () => {
    const r = await roleOf(['call_operator'], { application_fee_access: true });
    expect(r.canSeeApplicationFees).toBe(true);
    expect(feeItemVisible(r)).toBe(true);
    // The grant is narrow: no document-handler pages, no finance.
    expect(r.isDocumentHandler).toBe(false);
    expect(r.canSeeFinance).toBe(false);
    const docs = buildSidebarGroups(r.canSeeFinance, r.isAdmin, r.isCallOperator, r.isDocumentHandler, t, 'uz', true)
      .flatMap((g) => g.items)
      .find((i) => i.url === '/crm/documents');
    expect(docs?.visible).toBe(false);
  });

  it('callers that do not pass the new flag keep the old rule', () => {
    const items = buildSidebarGroups(false, false, false, true, t, 'uz').flatMap((g) => g.items);
    expect(items.find((i) => i.url === '/crm/application-fees')?.visible).toBe(true);
  });

  it('knows which roles already carry the section', () => {
    expect(hasApplicationFeeRole(['owner'])).toBe(true);
    expect(hasApplicationFeeRole(['call_operator', 'document_handler'])).toBe(true);
    expect(hasApplicationFeeRole(['call_operator'])).toBe(false);
  });
});
