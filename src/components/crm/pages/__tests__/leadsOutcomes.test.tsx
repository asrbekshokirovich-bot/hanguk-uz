import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import type { Lead } from '@/contexts/LeadsContext';

/**
 * What the leads page actually *writes* when a lead is converted, rejected or
 * restored.
 *
 * The rules are unit-tested in `intake/outcome`; what these cover is the wiring
 * — that the page sends the payload those rules produce, to the right call, and
 * only after the operator has confirmed. That wiring is where a lead would
 * silently lose its note or its status.
 */
const updateLead = vi.fn().mockResolvedValue(undefined);
const convertToStudent = vi.fn().mockResolvedValue({ success: true });
const createLead = vi.fn().mockResolvedValue({});
const refetch = vi.fn().mockResolvedValue(undefined);
const deleteLead = vi.fn().mockResolvedValue(undefined);

/** Whether the signed-in user may delete. Flipped per test. */
let isAdmin = true;

let leads: Lead[] = [];

vi.mock('@/hooks/useLeads', () => ({
  useLeads: () => ({
    leads,
    loading: false,
    createLead,
    updateLead,
    convertToStudent,
    deleteLead,
    refetch,
  }),
}));

// `useUserRole` reaches for `useAuth`, which needs a provider these tests do
// not mount. The role is a one-line input to the page, so it is supplied
// directly rather than standing up auth around every case.
vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: () => ({ isAdmin }),
}));

const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const lead = (overrides: Partial<Lead> = {}): Lead =>
  ({
    id: 'lead-1',
    full_name: 'Muhammad Eshmurodov',
    phone: '+998 94 196 69 89',
    age: 18,
    city: 'Toshkent',
    cert_level: 'TOPIK 4',
    education_level: 'Bakalavr',
    target_intake: 'Bahorgi 2027',
    contact_channel: 'Instagram',
    how_heard: 'Instagram sahifasi',
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
    <I18nextProvider i18n={i18n}>
      <LeadsContent />
    </I18nextProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
});

describe('LeadsContent outcomes', () => {
  it('converts only after the confirmation is accepted', async () => {
    await renderPage([lead()]);

    fireEvent.click(screen.getByRole('button', { name: /O‘quvchiga/ }));
    expect(convertToStudent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Aylantirish' }));
    await waitFor(() => expect(convertToStudent).toHaveBeenCalledWith('lead-1'));
  });

  it('abandons the conversion when the operator cancels', async () => {
    await renderPage([lead()]);

    fireEvent.click(screen.getByRole('button', { name: /O‘quvchiga/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));

    expect(convertToStudent).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('warns before converting someone who is already a student', async () => {
    await renderPage([lead({ isAlreadyStudent: true })]);
    fireEvent.click(screen.getByRole('button', { name: /O‘quvchiga/ }));
    expect(screen.getByText(/allaqachon bor/)).toBeInTheDocument();
  });

  it('writes the rejection reason into the note alongside the status', async () => {
    await renderPage([lead({ notes: 'Birinchi suhbat' })]);

    fireEvent.click(screen.getByRole('button', { name: /Rad etish/ }));
    fireEvent.change(screen.getByLabelText('Sabab'), {
      target: { value: 'Byudjeti yetmaydi' },
    });
    fireEvent.change(screen.getByLabelText(/Izoh/), {
      target: { value: 'Keyingi yilga qoldirdi' },
    });
    // Unambiguous: the open dialog hides the row behind it from the a11y tree,
    // so the row's own reject button is not a candidate here.
    fireEvent.click(screen.getByRole('button', { name: 'Rad etish' }));

    await waitFor(() =>
      expect(updateLead).toHaveBeenCalledWith('lead-1', {
        status: 'lost',
        notes: 'Birinchi suhbat\nRad etildi: Byudjeti yetmaydi — Keyingi yilga qoldirdi',
      }),
    );
  });

  it('restores a rejected lead to where it was, note cleaned up', async () => {
    await renderPage([
      lead({
        status: 'lost',
        notes: 'Birinchi suhbat\nRad etildi: Qiziqmaydi',
        last_contacted_at: new Date(2026, 7, 12).toISOString(),
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Rad etilganlar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Qaytarish/ }));

    await waitFor(() =>
      expect(updateLead).toHaveBeenCalledWith('lead-1', {
        status: 'contacted',
        notes: 'Birinchi suhbat',
      }),
    );
  });

  it('restores a never-contacted lead as new', async () => {
    await renderPage([lead({ status: 'lost', notes: 'Rad etildi: Qiziqmaydi' })]);

    fireEvent.click(screen.getByRole('button', { name: /Rad etilganlar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Qaytarish/ }));

    await waitFor(() =>
      expect(updateLead).toHaveBeenCalledWith('lead-1', { status: 'new', notes: '' }),
    );
  });

  it('files each lead under the tab its outcome belongs to', async () => {
    await renderPage([
      lead({ id: 'a', full_name: 'Aktiv Lead' }),
      lead({ id: 'b', full_name: 'Talaba Lead', status: 'converted' }),
      lead({ id: 'c', full_name: 'Rad Lead', status: 'lost' }),
    ]);

    expect(screen.getByText('Aktiv Lead')).toBeInTheDocument();
    expect(screen.queryByText('Talaba Lead')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /O‘quvchilar/ }));
    expect(screen.getByText('Talaba Lead')).toBeInTheDocument();
    expect(screen.queryByText('Aktiv Lead')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Rad etilganlar/ }));
    expect(screen.getByText('Rad Lead')).toBeInTheDocument();
  });
});

describe('LeadsContent search', () => {
  it('narrows the list by name and by phone, ignoring punctuation', async () => {
    const rows = [
      lead({ id: 'a', full_name: 'Aziz Karimov', phone: '+998 90 123-45-67' }),
      lead({ id: 'b', full_name: 'Bek Tursunov', phone: '+998 91 765-43-21' }),
    ];
    await renderPage(rows);
    const box = screen.getByLabelText('Lidlarni qidirish');

    fireEvent.change(box, { target: { value: 'tursun' } });
    await waitFor(() => expect(screen.queryByText('Aziz Karimov')).not.toBeInTheDocument());
    expect(screen.getByText('Bek Tursunov')).toBeInTheDocument();

    fireEvent.change(box, { target: { value: '901234567' } });
    await waitFor(() => expect(screen.getByText('Aziz Karimov')).toBeInTheDocument());
    expect(screen.queryByText('Bek Tursunov')).not.toBeInTheDocument();
  });

  it('clearing the box brings everyone back', async () => {
    const rows = [lead({ id: 'a', full_name: 'Aziz Karimov' })];
    await renderPage(rows);
    const box = screen.getByLabelText('Lidlarni qidirish');
    fireEvent.change(box, { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.queryByText('Aziz Karimov')).not.toBeInTheDocument());
    fireEvent.change(box, { target: { value: '' } });
    await waitFor(() => expect(screen.getByText('Aziz Karimov')).toBeInTheDocument());
  });

  it('says the search came up empty rather than the list being empty', async () => {
    const rows = [lead({ id: 'a', full_name: 'Aziz Karimov' })];
    await renderPage(rows);
    fireEvent.change(screen.getByLabelText('Lidlarni qidirish'), {
      target: { value: 'zzz' },
    });
    await waitFor(() =>
      expect(screen.getByText(/hech narsa topilmadi/)).toBeInTheDocument(),
    );
  });
});

describe('LeadsContent delete', () => {
  it('is offered to an admin, behind a confirmation', async () => {
    const rows = [lead({ id: 'a', full_name: 'Aziz Karimov' })];
    await renderPage(rows);
    fireEvent.click(screen.getByRole('button', { name: /Aziz Karimov/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'O‘chirish' }));
    // Nothing is destroyed on the first click.
    expect(deleteLead).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Ha, o‘chirilsin' }));
    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('a'));
  });

  it('is hidden from someone the database would refuse anyway', async () => {
    // `leads` has an admin-only DELETE policy; offering the button to everyone
    // would be a dead end dressed as a choice.
    isAdmin = false;
    const rows = [lead({ id: 'a', full_name: 'Aziz Karimov' })];
    await renderPage(rows);
    fireEvent.click(screen.getByRole('button', { name: /Aziz Karimov/ }));
    await screen.findByRole('button', { name: 'Saqlash' });
    expect(screen.queryByRole('button', { name: 'O‘chirish' })).not.toBeInTheDocument();
  });
});
