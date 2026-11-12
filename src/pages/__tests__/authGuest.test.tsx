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
    fireEvent.change(field('signup-phone'), { target: { value: '90 123 45 67' } });
    fireEvent.change(field('signup-email'), { target: { value: 'ali@example.com' } });
    fireEvent.change(field('signup-password'), { target: { value: 'secret1' } });
    fireEvent.change(field('signup-confirm'), { target: { value: 'secret1' } });
    fireEvent.submit(field('signup-name').closest('form')!);

    // The number goes to the server the way the CRM keeps it.
    await waitFor(() => expect(signUpGuest).toHaveBeenCalledWith('ali@example.com', 'secret1', 'ALI VALIYEV', '+998901234567'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
    expect(localStorage.getItem('guest_session')).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz',
      description: 'Maslahatchimiz tez orada siz bilan bog\'lanadi.',
    }));
  });

  it('asks for a phone number: without one that can be called nothing is sent', async () => {
    const { container } = open();
    await toRegistration();
    const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
    await waitFor(() => expect(field('signup-phone')).not.toBeNull());
    expect(field('signup-phone').required).toBe(true);
    expect(field('signup-phone').type).toBe('tel');
    // Letters do not get into the field.
    fireEvent.change(field('signup-phone'), { target: { value: 'tel 12345' } });
    expect(field('signup-phone').value).toBe(' 12345');

    fireEvent.change(field('signup-name'), { target: { value: 'Ali Valiyev' } });
    fireEvent.change(field('signup-email'), { target: { value: 'ali@example.com' } });
    fireEvent.change(field('signup-password'), { target: { value: 'secret1' } });
    fireEvent.change(field('signup-confirm'), { target: { value: 'secret1' } });
    fireEvent.submit(field('signup-name').closest('form')!);

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      description: 'Telefon raqamini to\'liq kiriting (masalan, +998 90 123 45 67)',
    })));
    expect(signUpGuest).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/auth');
  });

  it('the form no longer promises a guest account that does nothing', async () => {
    open();
    await toRegistration();
    expect(await screen.findByText('Ma\'lumotlaringizni qoldiring — maslahatchimiz siz bilan bog\'lanadi.')).toBeTruthy();
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
    fireEvent.change(field('signup-phone'), { target: { value: '+998 90 123 45 67' } });
    fireEvent.change(field('signup-email'), { target: { value: 'ali@example.com' } });
    fireEvent.change(field('signup-password'), { target: { value: 'secret1' } });
    fireEvent.change(field('signup-confirm'), { target: { value: 'secret1' } });
    fireEvent.submit(field('signup-name').closest('form')!);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByTestId('where').textContent).toBe('/auth');
  });

  it('staff sign-in mistakes are explained in the page\'s language, not in English', async () => {
    const { container } = open();
    fireEvent.click(await screen.findByRole('button', { name: /Xodim/ }));
    const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
    await waitFor(() => expect(field('login-username')).not.toBeNull());

    // Too short to be a login.
    fireEvent.change(field('login-username'), { target: { value: 'ab' } });
    fireEvent.change(field('login-password'), { target: { value: 'secret1' } });
    fireEvent.submit(field('login-username').closest('form')!);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Login 3–20 belgidan iborat bo\'lishi kerak (harf, raqam, pastki chiziq)',
    })));

    // An email typed where the login goes.
    toast.mockReset();
    fireEvent.change(field('login-username'), { target: { value: 'ali@example.com' } });
    fireEvent.submit(field('login-username').closest('form')!);
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Xodimlar email bilan emas, login bilan kiradi.',
    })));
  });

  it('the sign-in page\'s messages are written in every site language', () => {
    for (const lng of ['uz', 'en', 'ru', 'ko']) {
      for (const key of ['usernameRules', 'staffUsernameOnly', 'welcomeName', 'genericError', 'setupError', 'fullNameRequired', 'ownerCreated', 'signupFailed', 'phone', 'phoneInvalid', 'consultantWillCall']) {
        expect(i18n.getResource(lng, 'translation', `auth.${key}`), `${lng}: auth.${key}`).toBeTruthy();
      }
    }
  });
});
