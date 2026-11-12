import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import { MemoryRouter } from 'react-router-dom';
import uz from '@/locales/uz.json';
import type { Lead } from '@/contexts/LeadsContext';

/**
 * A lead made by hand with a number that is already in the list: the page
 * asks before it makes a second record of the same person (leads/samePhone).
 */
const updateLead = vi.fn().mockResolvedValue(undefined);
const createLead = vi.fn().mockResolvedValue({});
const refetch = vi.fn().mockResolvedValue(undefined);

let leads: Lead[] = [];

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'staff-1' } }),
}));
vi.mock('@/hooks/useLeads', () => ({
  useLeads: () => ({
    leads,
    loading: false,
    createLead,
    updateLead,
    convertToStudent: vi.fn(),
    deleteLead: vi.fn(),
    refetch,
  }),
}));

const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

/** The record Instagram made the evening before; an operator has called it. */
const existing = {
  id: 'lead-ig',
  full_name: 'muhammad_0989',
  phone: '+998941966989',
  source: 'instagram',
  contact_channel: 'instagram',
  call_result: 'Gaplashildi',
  status: 'new',
  notes: 'Instagramdan yozdi',
  last_contacted_at: null,
  created_at: '2026-11-11T14:33:00.000Z',
} as Lead;

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

/** "+ Yangi lid", a first name, a number and a note, then "Saqlash". */
const typeNewLead = (container: HTMLElement, phone: string) => {
  fireEvent.click(screen.getByRole('button', { name: '+ Yangi lid' }));
  const field = (id: string) => container.ownerDocument.querySelector(`#${id}`) as HTMLInputElement;
  fireEvent.change(field('intake-first'), { target: { value: 'Muhammad' } });
  fireEvent.change(field('intake-phone'), { target: { value: phone } });
  fireEvent.change(field('intake-note'), { target: { value: 'Kuzgi semestrga qiziqadi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LeadsContent — a new lead with a number that is already there', () => {
  it('asks first, naming the record, and writes into it when the operator says so', async () => {
    const { container } = await renderPage([existing]);
    typeNewLead(container, '94 196 69 89');

    // Nothing is saved yet: the page names the record it found.
    expect(await screen.findByText('Bu raqam bilan lid bor')).toBeInTheDocument();
    expect(createLead).not.toHaveBeenCalled();
    // 14:33 UTC on the 11th is still the 11th in Tashkent (19:33).
    expect(screen.getByText('instagram · 11-noyabr · Gaplashildi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Shu lidga yozish' }));

    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1));
    const [id, update] = updateLead.mock.calls[0];
    expect(id).toBe('lead-ig');
    expect(update).toMatchObject({
      full_name: 'Muhammad',
      phone: '+998941966989',
      notes: 'Instagramdan yozdi\nKuzgi semestrga qiziqadi',
    });
    // What was not typed is not sent: the record keeps what it holds.
    expect(Object.keys(update)).not.toContain('cert_level');
    expect(Object.keys(update)).not.toContain('contact_channel');
    expect(createLead).not.toHaveBeenCalled();
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    // The form closes with the dialog.
    await waitFor(() => expect(screen.queryByText('Bu raqam bilan lid bor')).toBeNull());
    expect(container.ownerDocument.querySelector('#intake-first')).toBeNull();
  });

  it('makes the second record when the operator insists (a sibling on the family phone)', async () => {
    const { container } = await renderPage([existing]);
    typeNewLead(container, '94 196 69 89');
    await screen.findByText('Bu raqam bilan lid bor');

    fireEvent.click(screen.getByRole('button', { name: 'Baribir yangi lid' }));

    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1));
    expect(createLead.mock.calls[0][0]).toMatchObject({ full_name: 'Muhammad', phone: '+998941966989' });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('cancelling keeps the form open with what was typed and saves nothing', async () => {
    const { container } = await renderPage([existing]);
    typeNewLead(container, '94 196 69 89');
    await screen.findByText('Bu raqam bilan lid bor');

    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));

    await waitFor(() => expect(screen.queryByText('Bu raqam bilan lid bor')).toBeNull());
    expect((container.ownerDocument.querySelector('#intake-first') as HTMLInputElement).value).toBe('Muhammad');
    expect(createLead).not.toHaveBeenCalled();
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('a number nobody has is saved straight away', async () => {
    const { container } = await renderPage([existing]);
    typeNewLead(container, '90 123 45 67');

    await waitFor(() => expect(createLead).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Bu raqam bilan lid bor')).toBeNull();
  });

  it('saving the record itself is not a duplicate of itself', async () => {
    await renderPage([{ ...existing, full_name: 'Muhammad Eshmurodov' } as Lead]);
    fireEvent.click(screen.getByRole('button', { name: 'Tahrirlash' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Bu raqam bilan lid bor')).toBeNull();
    expect(createLead).not.toHaveBeenCalled();
  });
});
