import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import uz from '@/locales/uz.json';
import type { Lead } from '@/contexts/LeadsContext';
import { LeadIntakeScreen } from '../LeadIntakeScreen';
import { LeadsTable } from '../LeadsTable';
import { EMPTY_FORM, formFromLead } from '../intakeForm';

/**
 * These tests deliberately run against the real Uzbek bundle rather than a
 * stubbed `t`, because half of what can break here is a missing or misspelled
 * translation key — a stub would render the key name and pass regardless.
 */
const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const renderWithI18n = (ui: React.ReactElement) =>
  render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const NOW = new Date(2026, 7, 14); // 14 August 2026

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
    source_note: null,
    notes: null,
    next_follow_up: null,
    created_at: new Date(2026, 7, 11).toISOString(),
    ...overrides,
  }) as Lead;

const table = (props: Partial<React.ComponentProps<typeof LeadsTable>> = {}) => (
  <LeadsTable
    leads={[lead()]}
    onOpen={vi.fn()}
    onConvert={vi.fn()}
    onReject={vi.fn()}
    onRestore={vi.fn()}
    busy={false}
    now={NOW}
    {...props}
  />
);

describe('LeadsTable', () => {
  it('renders every column heading from the design', () => {
    renderWithI18n(table());
    for (const heading of [
      "O‘quvchi", 'Telefon', 'Kanal', 'Shahar', 'Manba',
      "Yo‘nalish", 'Semestr', 'Sertifikat', 'Yosh', 'Holat', 'Amallar',
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it('marks a fully answered lead complete and a half-filled one incomplete', () => {
    renderWithI18n(
      table({ leads: [lead(), lead({ id: 'lead-2', full_name: 'Aziza Rahimova', city: null })] }),
    );
    expect(screen.getByText('To‘ldirilgan')).toBeInTheDocument();
    expect(screen.getByText('To‘liq emas')).toBeInTheDocument();
  });

  it('shows a dash for an unanswered cell rather than an empty one', () => {
    renderWithI18n(table({ leads: [lead({ city: null })] }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the follow-up line only when a date is set', () => {
    const { rerender } = renderWithI18n(table());
    expect(screen.queryByText(/Qayta aloqa:/)).not.toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        {table({ leads: [lead({ next_follow_up: '2026-08-15' })] })}
      </I18nextProvider>,
    );
    expect(screen.getByText(/Qayta aloqa: 15-avgust · ertaga/)).toBeInTheDocument();
  });

  it('opens the lead that was clicked', () => {
    const onOpen = vi.fn();
    const target = lead();
    renderWithI18n(table({ leads: [target], onOpen }));
    fireEvent.click(screen.getByRole('button', { name: /Muhammad Eshmurodov/ }));
    expect(onOpen).toHaveBeenCalledWith(target);
  });

  it('reads the created-at line as a relative age', () => {
    renderWithI18n(table());
    expect(screen.getByText('3 kun oldin')).toBeInTheDocument();
  });

  it('offers convert and reject on a lead still being worked', () => {
    const onConvert = vi.fn();
    const onReject = vi.fn();
    const target = lead();
    renderWithI18n(table({ leads: [target], onConvert, onReject }));

    fireEvent.click(screen.getByRole('button', { name: /O‘quvchiga/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rad etish/ }));
    expect(onConvert).toHaveBeenCalledWith(target);
    expect(onReject).toHaveBeenCalledWith(target);
  });

  it('blocks conversion until the record is fully answered', () => {
    renderWithI18n(table({ leads: [lead({ city: null })] }));
    expect(screen.getByRole('button', { name: /O‘quvchiga/ })).toBeDisabled();
  });

  it('holds every action while a write is in flight', () => {
    renderWithI18n(table({ busy: true }));
    expect(screen.getByRole('button', { name: /O‘quvchiga/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Rad etish/ })).toBeDisabled();
  });

  it('replaces the actions with a restore button on a rejected lead', () => {
    const onRestore = vi.fn();
    const target = lead({ status: 'lost' });
    renderWithI18n(table({ leads: [target], onRestore }));

    expect(screen.getByText('Rad etilgan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rad etish/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Qaytarish/ }));
    expect(onRestore).toHaveBeenCalledWith(target);
  });

  it('shows a converted lead as a student, with no further actions', () => {
    renderWithI18n(table({ leads: [lead({ status: 'converted' })] }));
    expect(screen.getByText('Allaqachon o‘quvchi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rad etish/ })).not.toBeInTheDocument();
  });
});

describe('LeadIntakeScreen', () => {
  const setup = (props: Partial<React.ComponentProps<typeof LeadIntakeScreen>> = {}) => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithI18n(
      <LeadIntakeScreen
        initial={EMPTY_FORM}
        isNew
        now={NOW}
        busy={false}
        onClose={onClose}
        onSave={onSave}
        {...props}
      />,
    );
    return { onSave, onClose };
  };

  it('renders the four sections the design specifies', () => {
    setup();
    for (const section of ["Shaxsiy ma’lumotlar", "Ta’lim", "Bog‘lanish manbasi", 'Izoh']) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it('refuses an empty sheet, because the name is all that is required', () => {
    const { onSave } = setup();
    expect(screen.queryByText('Ismni kiriting')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Kamida ism yoki familiyani yozing')).toBeInTheDocument();
  });

  it('saves a lead that is only a name', () => {
    // The case the office actually loses: a caller gives a name and hangs up.
    // The form used to refuse the record, so the operator either retyped it
    // later from memory or the lead was never written down at all.
    const { onSave } = setup({ initial: { ...EMPTY_FORM, firstName: 'Aziz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ firstName: 'Aziz' });
  });

  it('a surname alone is enough too', () => {
    const { onSave } = setup({ initial: { ...EMPTY_FORM, lastName: 'Karimov' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('says how much is still unanswered without blocking the save', () => {
    const { onSave } = setup({ initial: { ...EMPTY_FORM, firstName: 'Aziz' } });
    // Nine of the ten completeness answers are still missing; the note counts
    // them and the button still works.
    expect(screen.getByRole('status')).toHaveTextContent('9');
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('opens an unfinished lead with its gaps already marked', () => {
    // Reopening a half-filled record IS the act of coming back to finish it.
    // The page's whole question is "whose record is still missing answers",
    // so it must say WHICH, not just how many.
    setup({
      initial: { ...EMPTY_FORM, firstName: 'Aziz' },
      isNew: false,
    });
    expect(screen.getByText('Telefon raqamini to‘liq kiriting')).toBeInTheDocument();
  });

  it('a blank new sheet still opens quiet', () => {
    // Flagging fields nobody has reached yet reads as a failure the operator
    // caused.
    setup();
    expect(screen.queryByText('Ismni kiriting')).not.toBeInTheDocument();
  });

  it('still names the specific rule a half-filled field broke', () => {
    // The per-field hints are guidance now, not a wall: they appear AND the
    // lead saves.
    const { onSave } = setup({
      initial: { ...formFromLead(lead()), phone: '+998 94', age: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves a fully answered form', () => {
    const { onSave } = setup({ initial: formFromLead(lead()), isNew: false });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      firstName: 'Muhammad',
      lastName: 'Eshmurodov',
      city: 'Toshkent',
    });
  });

  it('reveals the clarification field only for sources that need one', () => {
    setup();
    expect(screen.queryByLabelText('Aniqlashtirish')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Do‘sti / tanishi tavsiyasi' }));
    expect(screen.getByLabelText('Aniqlashtirish')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Google qidiruv' }));
    expect(screen.queryByLabelText('Aniqlashtirish')).not.toBeInTheDocument();
  });

  it('offers the current and next year as semesters', () => {
    setup();
    for (const semester of ['Bahorgi 2026', 'Kuzgi 2026', 'Bahorgi 2027', 'Kuzgi 2027']) {
      expect(screen.getByRole('radio', { name: semester })).toBeInTheDocument();
    }
  });

  it('fills the follow-up date from the quick buttons', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Ertaga' }));
    // The field reads day-month-year now. `<input type="date">` rendered in
    // the BROWSER's locale, which showed staff here 08/15/2026 — month first —
    // and 02/03 is a different date depending on who is reading it.
    expect(screen.getByLabelText('Qayta aloqa sanasi')).toHaveValue('15.08.2026');
    // The summary line is rendered from the form's own state, so this asserts
    // the stored value is still the ISO date the column expects — only the
    // display order changed.
    expect(screen.getByText(/Rejalashtirilgan: 15-avgust · ertaga/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1 haftadan keyin' }));
    expect(screen.getByLabelText('Qayta aloqa sanasi')).toHaveValue('21.08.2026');
  });

  it('records a single choice per group', () => {
    setup();
    const bachelor = screen.getByRole('radio', { name: 'Bakalavr' });
    const master = screen.getByRole('radio', { name: 'Magistr' });
    fireEvent.click(bachelor);
    expect(bachelor).toBeChecked();
    fireEvent.click(master);
    expect(master).toBeChecked();
    expect(bachelor).not.toBeChecked();
  });

  it('closes on Escape and on the close button', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('disables saving while a write is in flight', () => {
    setup({ busy: true });
    expect(screen.getByRole('button', { name: /Saqlanmoqda/ })).toBeDisabled();
  });

  it('offers every city from the design', () => {
    setup();
    const select = screen.getByLabelText('Yashash shahri');
    expect(within(select).getAllByRole('option')).toHaveLength(14); // 13 cities + placeholder
  });
});
