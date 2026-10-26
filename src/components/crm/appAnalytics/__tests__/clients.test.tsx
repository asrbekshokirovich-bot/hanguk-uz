import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';

const now = new Date();
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const activity = {
  now: now.toISOString(),
  offers: [
    { user_id: 'u1', name: 'Ali Valiyev', institution_id: 'i1', university: 'Kyungpook National University', offered_at: ago(72), overdue: true, reminded_at: ago(20), last_seen_at: ago(30) },
    { user_id: 'u2', name: 'Vali Aliyev', institution_id: 'i2', university: 'Busan University', offered_at: ago(5), overdue: false, reminded_at: null, last_seen_at: null },
  ],
  documents: [
    { user_id: 'u3', name: 'Sardor', contract_date: '2026-10-01', gaps: [{ slot: 'foreign_passport', state: 'rejected' }, { slot: 'diploma', state: 'missing' }], last_upload_at: ago(26), last_seen_at: ago(2) },
  ],
  inactive: [{ user_id: 'u4', name: 'Bobur', contract_date: '2026-09-01', last_seen_at: null }],
};
const rpc = vi.fn(async () => ({ data: activity, error: null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import ClientsTab from '../ClientsTab';
import { studentPath, waited } from '../clients';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

describe('«Mijozlar faolligi»', () => {
  it('lists offers, missing documents and students away from the app; a row opens the student', async () => {
    render(
      <MemoryRouter initialEntries={['/crm/app-analytics/clients']}>
        <I18nextProvider i18n={i18n}>
          <Routes>
            <Route path="/crm/app-analytics/clients" element={<ClientsTab />} />
            <Route path="/crm/students" element={<Where />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Javobsiz universitet takliflari')).toBeTruthy());
    // 72 hours is three days, red; 5 hours is not
    expect(screen.getByText('3 kun').className).toContain('B4232E');
    expect(screen.getByText('5 soat').className).not.toContain('B4232E');
    const docs = screen.getByText('Sardor').closest('tr') as HTMLElement;
    expect(within(docs).getByText("Topshiruvchining zagran pasporti nusxasi · rad etilgan")).toBeTruthy();
    expect(within(docs).getByText('Diplom yoki attestat nusxasi')).toBeTruthy();
    expect(within(screen.getByText('Bobur').closest('tr') as HTMLElement).getByText('hech qachon')).toBeTruthy();
    fireEvent.click(screen.getByText('Ali Valiyev'));
    expect(screen.getByTestId('where').textContent).toBe('/crm/students?student=u1');
  });

  it('says how long in hours, then days', () => {
    expect(waited(ago(5), t, now)).toBe('5 soat');
    expect(waited(ago(49), t, now)).toBe('2 kun');
    expect(waited(null, t, now)).toBe('—');
    expect(studentPath('a b')).toBe('/crm/students?student=a%20b');
  });
});
