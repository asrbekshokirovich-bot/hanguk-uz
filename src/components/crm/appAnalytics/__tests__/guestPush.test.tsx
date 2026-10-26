import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';

const campaigns = {
  reachable: 14,
  campaigns: [{ campaign: 'muddat-noyabr', title: { uz: 'Muddat yaqin' }, body: { uz: 'Matn' }, targeted: 14, delivered: 12, failed: 2, opened: 3, created_at: '2026-10-20T10:00:00Z', sent_at: '2026-10-20T10:01:00Z' }],
};
const invoke = vi.fn(async (_fn: string, { body }: { body: { dry: boolean } }) =>
  body.dry ? { data: { ok: true, dry: true, tokens: 15, phones: 14, by_lang: { uz: 10, ru: 4 } }, error: null } : { data: { ok: true, phones: 14, delivered: 13, failed: 1 }, error: null },
);
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: campaigns, error: null }), functions: { invoke: (fn: string, o: { body: { dry: boolean } }) => invoke(fn, o) } },
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ isAdmin: true }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import GuestPushBlock from '../GuestPushBlock';
import { campaignKey, validKey } from '../push';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });

describe('«Mehmonlarga push»', () => {
  it('shows who can be reached and each campaign with its opens', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <GuestPushBlock />
      </I18nextProvider>,
    );
    await waitFor(() => expect(screen.getByText(/bildirishnomaga ruxsat bergan mehmonlar: 14/)).toBeTruthy());
    expect(screen.getByText('muddat-noyabr')).toBeTruthy();
    expect(screen.getByText('12 / 14')).toBeTruthy();
    expect(screen.getByText('3 (25%)')).toBeTruthy();
  });

  it('checks who gets it first, then sends after the confirmation', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <GuestPushBlock />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByLabelText('Kampaniya kodi'), { target: { value: 'Grant Noyabr' } });
    fireEvent.change(screen.getByLabelText('Sarlavha (uz)'), { target: { value: 'Yangi grantlar' } });
    fireEvent.change(screen.getByLabelText('Matn (uz)'), { target: { value: 'Koreyada yangi grantlar e\'lon qilindi' } });
    fireEvent.click(screen.getByRole('button', { name: "Kimga borishini ko'rish" }));
    await waitFor(() => expect(screen.getByText('«grant-noyabr» yuborilsinmi?')).toBeTruthy());
    expect(invoke).toHaveBeenLastCalledWith('send-guest-push', { body: expect.objectContaining({ campaign: 'grant-noyabr', dry: true }) });
    expect(screen.getByText(/14 ta telefonga boradi\. \(uz 10 · ru 4\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yuborish' }));
    await waitFor(() => expect(invoke).toHaveBeenLastCalledWith('send-guest-push', { body: expect.objectContaining({ dry: false, title: { uz: 'Yangi grantlar' } }) }));
  });

  it('makes a key from what was typed', () => {
    expect(campaignKey(' Grant Noyabr ')).toBe('grant-noyabr');
    expect(validKey('grant-noyabr')).toBe(true);
    expect(validKey('g')).toBe(false);
    expect(validKey('grant noyabr')).toBe(false);
  });
});
