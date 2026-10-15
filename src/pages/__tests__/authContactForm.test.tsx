import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// "Konsultantga murojaat" on /auth: a contact request (name, phone, optional
// e-mail), no password — it replaced a guest sign-up that stored passwords as
// typed and sent people to /guest-portal, a page that does not exist.

const requestConsultant = vi.fn();
const navigate = vi.fn();
const toast = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    signInWithUsername: vi.fn(),
    signUpOwner: vi.fn(),
    requestConsultant,
  }),
}));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: 'uz' } }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('@/components/ThemeToggleButton', () => ({ ThemeToggleButton: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { owner_created: true }, error: null }) }) }),
    }),
  },
}));

import Auth from '../Auth';

const renderAuth = async () => {
  render(<MemoryRouter><Auth /></MemoryRouter>);
  fireEvent.click(await screen.findByText('Contact a consultant'));
};

beforeEach(() => {
  requestConsultant.mockReset();
  navigate.mockReset();
  toast.mockReset();
  localStorage.clear();
  delete (window as any).__OWNER_CHECK_CACHED__;
});

describe('/auth contact request', () => {
  it('asks for name, phone and an optional e-mail — never a password', async () => {
    await renderAuth();
    expect(screen.getByLabelText('auth.fullName')).toBeRequired();
    expect(screen.getByLabelText('auth.phone')).toBeRequired();
    expect(screen.getByLabelText('auth.emailOptional')).not.toBeRequired();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('sends the request and shows "we will call you"; nothing is kept in the browser', async () => {
    requestConsultant.mockResolvedValue({ error: null });
    await renderAuth();
    fireEvent.change(screen.getByLabelText('auth.fullName'), { target: { value: ' Aziza Karimova ' } });
    fireEvent.change(screen.getByLabelText('auth.phone'), { target: { value: '+998 90 123 45 67' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.contactBtn' }));
    await waitFor(() => expect(requestConsultant).toHaveBeenCalledWith('Aziza Karimova', '+998 90 123 45 67', ''));
    expect(await screen.findByText('auth.contactSentTitle')).toBeInTheDocument();
    expect(localStorage.getItem('guest_session')).toBeNull();
    expect(navigate).not.toHaveBeenCalledWith('/guest-portal');
  });

  it('explains a refused number', async () => {
    requestConsultant.mockResolvedValue({ error: new Error('INVALID_PHONE') });
    await renderAuth();
    fireEvent.change(screen.getByLabelText('auth.fullName'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('auth.phone'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'auth.contactBtn' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'auth.contactInvalidPhone' })));
    expect(screen.queryByText('auth.contactSentTitle')).toBeNull();
  });

  it('frees a browser stuck with the old guest_session instead of sending it to /guest-portal', async () => {
    localStorage.setItem('guest_session', '{"id":"x","notes":"internal"}');
    render(<MemoryRouter><Auth /></MemoryRouter>);
    await screen.findByText('Contact a consultant');
    expect(localStorage.getItem('guest_session')).toBeNull();
    expect(navigate).not.toHaveBeenCalledWith('/guest-portal');
  });
});
