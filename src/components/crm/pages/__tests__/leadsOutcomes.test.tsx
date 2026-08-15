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

let leads: Lead[] = [];

vi.mock('@/hooks/useLeads', () => ({
  useLeads: () => ({
    leads,
    loading: false,
    createLead,
    updateLead,
    convertToStudent,
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
  const roster = [
    lead({ id: 'a', full_name: 'Muhammad Eshmurodov', city: 'Toshkent' }),
    lead({ id: 'b', full_name: 'Aziza Rahimova', city: 'Samarqand', phone: '+998 90 111 22 33' }),
    lead({ id: 'c', full_name: 'Bekzod Aliyev', status: 'lost', city: 'Toshkent' }),
  ];

  it('narrows the list to what was typed', async () => {
    await renderPage(roster);
    expect(screen.getByText('Muhammad Eshmurodov')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Leadlarni qidirish'), { target: { value: 'aziza' } });

    expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument();
    expect(screen.queryByText('Muhammad Eshmurodov')).not.toBeInTheDocument();
  });

  it('finds a lead by part of the phone number', async () => {
    await renderPage(roster);
    fireEvent.change(screen.getByLabelText('Leadlarni qidirish'), {
      target: { value: '90 111' },
    });
    expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument();
  });

  it('counts the matches on the filter each lead belongs to', async () => {
    await renderPage(roster);
    fireEvent.change(screen.getByLabelText('Leadlarni qidirish'), {
      target: { value: 'toshkent' },
    });

    // One active match and one rejected — visible without leaving this filter.
    expect(screen.getByRole('button', { name: /Ishlanmoqda 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rad etilganlar 1/ })).toBeInTheDocument();
  });

  it('says so when nothing matches, rather than looking empty', async () => {
    await renderPage(roster);
    fireEvent.change(screen.getByLabelText('Leadlarni qidirish'), {
      target: { value: 'nobody here' },
    });
    expect(screen.getByText(/mos lead yo‘q/)).toBeInTheDocument();
  });

  it('filters by a picked value once the panel is opened', async () => {
    await renderPage(roster);
    fireEvent.click(screen.getByRole('button', { name: /Filtrlar/ }));
    fireEvent.change(screen.getByLabelText('Shahar'), { target: { value: 'Samarqand' } });

    expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument();
    expect(screen.queryByText('Muhammad Eshmurodov')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filtrlar 1/ })).toBeInTheDocument();
  });

  it('puts every lead back when the search is cleared', async () => {
    await renderPage(roster);
    fireEvent.change(screen.getByLabelText('Leadlarni qidirish'), { target: { value: 'aziza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hammasini tozalash' }));

    expect(screen.getByText('Muhammad Eshmurodov')).toBeInTheDocument();
    expect(screen.getByText('Aziza Rahimova')).toBeInTheDocument();
  });

  it('jumps to the search box on "/"', async () => {
    await renderPage(roster);
    const box = screen.getByLabelText('Leadlarni qidirish');
    expect(box).not.toHaveFocus();

    fireEvent.keyDown(window, { key: '/' });
    expect(box).toHaveFocus();
  });
});
