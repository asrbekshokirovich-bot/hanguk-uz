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
// The selected season's roster (student_intakes), read with select().eq().is().is().
let roster: string[] | null = null;
const rosterQuery = vi.fn();
function rosterBuilder() {
  const b = {
    select: () => b,
    eq: (col: string, v: unknown) => (rosterQuery(col, v), b),
    is: (col: string, v: unknown) => (rosterQuery(col, v), b),
    then: (ok: (r: { data: { student_id: string }[] | null; error: unknown }) => unknown) =>
      Promise.resolve(roster ? { data: roster.map((id) => ({ student_id: id })), error: null } : { data: null, error: { message: 'x' } }).then(ok),
  };
  return b;
}
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])), from: () => rosterBuilder() },
}));
vi.mock('@/contexts/IntakeContext', () => ({
  useActiveIntake: () => ({ activeIntakeId: 'intake-1', activeIntake: { id: 'intake-1', season: 'spring', year: 2027 } }),
}));

import ClientsTab from '../ClientsTab';
import { studentPath, waited } from '../clients';

const i18n = createInstance();
i18n.use(initReactI18next).init({ lng: 'uz', fallbackLng: 'uz', resources: { uz: { translation: uz } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n) as unknown as (k: string, o?: Record<string, unknown>) => string;

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/crm/app-analytics/clients']}>
      <I18nextProvider i18n={i18n}>
        <Routes>
          <Route path="/crm/app-analytics/clients" element={<ClientsTab />} />
          <Route path="/crm/students" element={<Where />} />
        </Routes>
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('«Mijozlar faolligi»', () => {
  it('lists offers, missing documents and students away from the app; a row opens the student', async () => {
    roster = ['u1', 'u2', 'u3', 'u4'];
    renderTab();
    await waitFor(() => expect(screen.getByText('Javobsiz universitet takliflari')).toBeTruthy());
    // 72 hours is three days, red; 5 hours is not
    expect(screen.getByText('3 kun').className).toContain('B4232E');
    expect(screen.getByText('5 soat').className).not.toContain('B4232E');
    const docs = screen.getByText('Sardor').closest('tr') as HTMLElement;
    expect(within(docs).getByText("Topshiruvchining zagran pasporti nusxasi · rad etilgan")).toBeTruthy();
    expect(within(docs).getByText('Diplom yoki attestat nusxasi')).toBeTruthy();
    expect(within(screen.getByText('Bobur').closest('tr') as HTMLElement).getByText('hech qachon')).toBeTruthy();
    // the contract day as the plan writes a day
    expect(within(docs).getByText(new Date().getFullYear() === 2026 ? '1-okt' : '1-okt 2026')).toBeTruthy();
    fireEvent.click(screen.getByText('Ali Valiyev'));
    expect(screen.getByTestId('where').textContent).toBe('/crm/students?student=u1');
  });

  it("shows only the season picked in the top bar: its roster, without cancelled contracts and those who left", async () => {
    roster = ['u1', 'u3'];
    rosterQuery.mockClear();
    renderTab();
    await waitFor(() => expect(screen.getByText('Ali Valiyev')).toBeTruthy());
    expect(screen.getByText(/Faqat Bahor 2027 mavsumi talabalari/)).toBeTruthy();
    expect(screen.queryByText('Vali Aliyev')).toBeNull();
    expect(screen.getByText('Sardor')).toBeTruthy();
    expect(screen.queryByText('Bobur')).toBeNull();
    expect(rosterQuery).toHaveBeenCalledWith('intake_id', 'intake-1');
    expect(rosterQuery).toHaveBeenCalledWith('contract_cancelled_at', null);
    expect(rosterQuery).toHaveBeenCalledWith('departed_at', null);
  });

  it('shows the lists whole when the roster cannot be read', async () => {
    roster = null;
    renderTab();
    await waitFor(() => expect(screen.getByText('Vali Aliyev')).toBeTruthy());
    expect(screen.getByText('Bobur')).toBeTruthy();
    expect(screen.queryByText(/mavsumi talabalari/)).toBeNull();
  });

  it('says how long in hours, then days', () => {
    expect(waited(ago(5), t, now)).toBe('5 soat');
    expect(waited(ago(49), t, now)).toBe('2 kun');
    expect(waited(null, t, now)).toBe('—');
    expect(studentPath('a b')).toBe('/crm/students?student=a%20b');
  });
});
