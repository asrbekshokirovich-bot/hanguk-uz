import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { MemoryRouter } from 'react-router-dom';
import uz from '@/locales/uz.json';
import type { Lead } from '@/contexts/LeadsContext';
import { isKgLead } from '@/components/crm/leads/intake/intakeForm';

/**
 * Leads from Kyrgyzstan in the CRM (QA audit 2026-11-11): a «KG» mark beside
 * the number and a «Qirg'iziston» chip that leaves only those leads.
 */
let leads: Lead[] = [];

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'staff-1' } }) }));
vi.mock('@/hooks/useLeads', () => ({
  useLeads: () => ({
    leads,
    loading: false,
    createLead: vi.fn(),
    updateLead: vi.fn(),
    convertToStudent: vi.fn(),
    deleteLead: vi.fn(),
    refetch: vi.fn(),
  }),
}));

const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const lead = (overrides: Partial<Lead>): Lead =>
  ({
    id: 'x',
    full_name: 'X',
    phone: '+998 90 123 45 67',
    status: 'new',
    notes: null,
    last_contacted_at: null,
    created_at: new Date(2026, 7, 11).toISOString(),
    ...overrides,
  }) as Lead;

const renderPage = async (rows: Lead[]) => {
  leads = rows;
  const { default: LeadsContent } = await import('../LeadsContent');
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <LeadsContent />
      </I18nextProvider>
    </MemoryRouter>,
  );
};

describe('isKgLead', () => {
  it('country KG, or a +996 number not saved since', () => {
    expect(isKgLead({ country: 'KG', phone: null })).toBe(true);
    expect(isKgLead({ country: null, phone: '+996 700 123 456' })).toBe(true);
    expect(isKgLead({ country: null, phone: '996700123456' })).toBe(true);
    expect(isKgLead({ country: null, phone: '+998 90 123 45 67' })).toBe(false);
    expect(isKgLead({ country: 'UZ', phone: '901234567' })).toBe(false);
  });
});

describe('LeadsContent · Qirg\'iziston', () => {
  it('marks KG leads and filters to them', async () => {
    await renderPage([
      lead({ id: 'a', full_name: 'Aybek Toktogulov', phone: '+996700123456', country: 'KG' }),
      lead({ id: 'b', full_name: 'Dilnoza Karimova', phone: '+998 90 111 22 33' }),
    ]);
    expect(screen.getAllByText(/Aybek/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dilnoza/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('KG')).toHaveLength(1);

    const chip = screen.getByRole('button', { name: /Qirg'iziston/ });
    expect(chip).toHaveTextContent('1');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/Aybek/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Dilnoza/)).toHaveLength(0);
  });

  it('shows no chip when there are no KG leads', async () => {
    await renderPage([lead({ id: 'b', full_name: 'Dilnoza Karimova' })]);
    expect(screen.queryByRole('button', { name: /Qirg'iziston/ })).not.toBeInTheDocument();
  });
});
