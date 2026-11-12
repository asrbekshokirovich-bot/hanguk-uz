import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/lib/i18n';

// Someone already signed in opens /auth?next=…: the page sends them on.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    signInWithUsername: vi.fn(),
    signInGuest: vi.fn(),
    signUpGuest: vi.fn(),
    signUpOwner: vi.fn(),
  }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: { owner_created: true }, error: null }),
  };
  return { supabase: { from: () => chain, functions: { invoke: vi.fn() }, auth: { setSession: vi.fn() } } };
});
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import Auth from '../Auth';

const Where = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
};
const openWith = (next: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth?next=${encodeURIComponent(next)}`]}>
      <Routes>
        <Route path="/auth" element={<><Auth /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await i18n.changeLanguage('uz');
});

describe('Auth — ?next=', () => {
  it('continues to the page of this site the link asked for', async () => {
    openWith('/surveys/7f3c?from=tg');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/surveys/7f3c?from=tg'));
  });

  it.each([
    ['a protocol-relative address', '//evil.example/login'],
    ['a backslash the browser reads as a slash', '/\\evil.example/login'],
    ['a tab the browser drops', '/\t/evil.example/login'],
    ['a full address', 'https://evil.example/login'],
  ])('goes home instead of to another site: %s', async (_name, next) => {
    openWith(next);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });
});
