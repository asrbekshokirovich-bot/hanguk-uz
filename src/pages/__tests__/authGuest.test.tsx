import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/lib/i18n';

const signUpGuest = vi.fn();
const signInGuest = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signInWithUsername: vi.fn(), signInGuest, signUpGuest, signUpOwner: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: { owner_created: true }, error: null }),
  };
  return { supabase: { from: () => chain, functions: { invoke: vi.fn() }, auth: { setSession: vi.fn() } } };
});
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import Auth from '../Auth';

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const open = () =>
  render(
    <MemoryRouter initialEntries={['/auth']}>
      <Routes>
        <Route path="/auth" element={<><Auth /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

/** From the sign-in screen to the guest registration form. */
const toRegistration = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Maslahatchi bilan bog/ }));
};

beforeEach(async () => {
  await i18n.changeLanguage('uz');
  localStorage.clear();
  signUpGuest.mockReset();
  signInGuest.mockReset();
  toast.mockReset();
});

describe('Auth — guest registration', () => {
  it('a browser that still holds guest_session reaches the sign-in form, and the key is removed', async () => {
    localStorage.setItem('guest_session', JSON.stringify({ id: 'lead-1', notes: 'internal' }));
    open();
    await screen.findByRole('button', { name: /Maslahatchi bilan bog/ });
    // It used to be sent to /guest-portal — a route that does not exist.
    expect(screen.getByTestId('where').textContent).toBe('/auth');
    await waitFor(() => expect(localStorage.getItem('guest_session')).toBeNull());
  });

  it('registering goes to the home page, not to a page that does not exist, and keeps nothing in the browser', async () => {
    signUpGuest.mockResolvedValue({ error: null, data: { id: 'lead-1', full_name: 'ALI', email: 'ali@example.com' } });
    const { container } = open();
    await toRegistration();
    const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
    await waitFor(() => expect(field('signup-name')).not.toBeNull());
    fireEvent.change(field('signup-name'), { target: { value: 'Ali Valiyev' } });
    fireEvent.change(field('signup-email'), { target: { value: 'ali@example.com' } });
    fireEvent.change(field('signup-password'), { target: { value: 'secret1' } });
    fireEvent.change(field('signup-confirm'), { target: { value: 'secret1' } });
    fireEvent.submit(field('signup-name').closest('form')!);

    await waitFor(() => expect(signUpGuest).toHaveBeenCalledWith('ali@example.com', 'secret1', 'ALI VALIYEV'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    expect(localStorage.getItem('guest_session')).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz' }));
  });

  it('a guest signing in goes to the home page too', async () => {
    signInGuest.mockResolvedValue({ error: null, data: { id: 'lead-1', full_name: 'ALI', email: 'ali@example.com' } });
    const { container } = open();
    await toRegistration();
    fireEvent.click(await screen.findByRole('button', { name: /Hisobingiz bormi/ }));
    const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
    await waitFor(() => expect(field('guest-email')).not.toBeNull());
    fireEvent.change(field('guest-email'), { target: { value: 'ali@example.com' } });
    fireEvent.change(field('guest-password'), { target: { value: 'secret1' } });
    fireEvent.submit(field('guest-email').closest('form')!);

    await waitFor(() => expect(signInGuest).toHaveBeenCalledWith('ali@example.com', 'secret1'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    expect(localStorage.getItem('guest_session')).toBeNull();
  });

  it('a refused registration stays on the form and says why', async () => {
    signUpGuest.mockResolvedValue({ error: new Error("Bu email allaqachon ro'yxatdan o'tgan.") });
    const { container } = open();
    await toRegistration();
    const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
    await waitFor(() => expect(field('signup-name')).not.toBeNull());
    fireEvent.change(field('signup-name'), { target: { value: 'Ali' } });
    fireEvent.change(field('signup-email'), { target: { value: 'ali@example.com' } });
    fireEvent.change(field('signup-password'), { target: { value: 'secret1' } });
    fireEvent.change(field('signup-confirm'), { target: { value: 'secret1' } });
    fireEvent.submit(field('signup-name').closest('form')!);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByTestId('where').textContent).toBe('/auth');
  });
});
