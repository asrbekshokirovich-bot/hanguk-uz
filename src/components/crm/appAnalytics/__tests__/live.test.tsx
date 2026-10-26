import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import { lowerFirst } from '../live';

const at = new Date().toISOString();
const live = {
  now: at,
  devices: 3,
  leads: 1,
  events: [
    { at, event: 'form_open', screen: '/assess/lead', element: null, duration_ms: null, props: { form: 'lead' }, platform: 'android', kind: 'lead', name: 'Aziz', lead_id: 'l1', source: 'instagram', contact_channel: 'Instagram' },
    { at, event: 'report_view', screen: '/assess/report', element: null, duration_ms: null, props: { universities: 2 }, platform: 'android', kind: 'guest', name: null, lead_id: null, source: null, contact_channel: null },
    { at, event: 'screen_leave', screen: '/university/:id', element: null, duration_ms: 52_000, props: {}, platform: 'web', kind: 'guest', name: null, lead_id: null, source: null, contact_channel: null },
    { at, event: 'tab_open', screen: 'client', element: null, duration_ms: null, props: { tab: 'documents' }, platform: 'ios', kind: 'student', name: 'Ali', lead_id: null, source: null, contact_channel: null },
    { at, event: 'tap', screen: '/guest', element: 'account.back', duration_ms: null, props: {}, platform: 'web', kind: 'lead', name: 'Vali', lead_id: 'l2', source: 'telegram', contact_channel: null },
  ],
};
const rpc = vi.fn(async () => ({ data: live, error: null }));
const from = () => ({ select: () => Promise.resolve({ data: [{ event: 'tap', description_uz: 'Bosdi' }] }) });
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])), from: () => from() } }));

import LiveTab from '../LiveTab';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });

describe('«Jonli»', () => {
  it('reads as the plan draws it: the count, then who — what', async () => {
    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <LiveTab />
        </I18nextProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('qurilma hozir ilovada · 1 tasi tanilgan lid')).toBeTruthy());
    expect(screen.getByText('3').tagName).toBe('B');
    await waitFor(() => expect(screen.getAllByRole('listitem')[4].children[1].textContent).toContain('Orqaga'));
    const lines = screen.getAllByRole('listitem').map((li) => li.children[1].textContent);
    expect(lines).toEqual([
      'Aziz · Lid · Instagram — konsultant formasini ochdi',
      "Mehmon · Android — hisobotni ko'rdi",
      'Mehmon · Web — universitet sahifasi, 52 s',
      "Ali · Talaba — Hujjatlar bo'limini ochdi",
      'Vali · Lid · Telegram — bosdi: Orqaga',
    ]);
    // only a lead's name is bold, and it opens the card
    expect(screen.getByText('Aziz · Lid · Instagram').tagName).toBe('B');
    expect(screen.getAllByRole('listitem')[0].children[0].textContent).toMatch(/^\d\d:\d\d$/);
    expect(rpc).toHaveBeenCalledWith('analytics_live', { p_minutes: 5 });
  });

  it('lowers the first letter only when the line does not start with a name', () => {
    expect(lowerFirst('Universitet sahifasi')).toBe('universitet sahifasi');
    expect(lowerFirst("Bo'limga o'tdi: Hujjatlar")).toBe("bo'limga o'tdi: Hujjatlar");
    expect(lowerFirst('Study Plan')).toBe('Study Plan');
    expect(lowerFirst('QR skaner')).toBe('QR skaner');
    expect(lowerFirst('Hanguk AI chat')).toBe('Hanguk AI chat');
    expect(lowerFirst('«Vizam chiqadimi?» testini boshladi')).toBe('«Vizam chiqadimi?» testini boshladi');
    expect(lowerFirst('Bosdi: Orqaga')).toBe('bosdi: Orqaga');
  });
});
