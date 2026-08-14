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

describe('LeadsTable', () => {
  it('renders every column heading from the design', () => {
    renderWithI18n(<LeadsTable leads={[lead()]} onOpen={vi.fn()} now={NOW} />);
    for (const heading of [
      "O‘quvchi", 'Telefon', 'Kanal', 'Shahar', 'Manba',
      "Yo‘nalish", 'Semestr', 'Sertifikat', 'Yosh', 'Holat',
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it('marks a fully answered lead complete and a half-filled one incomplete', () => {
    renderWithI18n(
      <LeadsTable
        leads={[lead(), lead({ id: 'lead-2', full_name: 'Aziza Rahimova', city: null })]}
        onOpen={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByText('To‘ldirilgan')).toBeInTheDocument();
    expect(screen.getByText('To‘liq emas')).toBeInTheDocument();
  });

  it('shows a dash for an unanswered cell rather than an empty one', () => {
    renderWithI18n(<LeadsTable leads={[lead({ city: null })]} onOpen={vi.fn()} now={NOW} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the follow-up line only when a date is set', () => {
    const { rerender } = renderWithI18n(
      <LeadsTable leads={[lead()]} onOpen={vi.fn()} now={NOW} />,
    );
    expect(screen.queryByText(/Qayta aloqa:/)).not.toBeInTheDocument();

    rerender(
      <I18nextProvider i18n={i18n}>
        <LeadsTable leads={[lead({ next_follow_up: '2026-08-15' })]} onOpen={vi.fn()} now={NOW} />
      </I18nextProvider>,
    );
    expect(screen.getByText(/Qayta aloqa: 15-avgust · ertaga/)).toBeInTheDocument();
  });

  it('opens the lead that was clicked', () => {
    const onOpen = vi.fn();
    const target = lead();
    renderWithI18n(<LeadsTable leads={[target]} onOpen={onOpen} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: /Muhammad Eshmurodov/ }));
    expect(onOpen).toHaveBeenCalledWith(target);
  });

  it('reads the created-at line as a relative age', () => {
    renderWithI18n(<LeadsTable leads={[lead()]} onOpen={vi.fn()} now={NOW} />);
    expect(screen.getByText('3 kun oldin')).toBeInTheDocument();
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

  it('holds errors back until the operator tries to save', () => {
    const { onSave } = setup();
    expect(screen.queryByText('Ismni kiriting')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Ismni kiriting')).toBeInTheDocument();
    expect(screen.getByText('Barcha maydonlarni to‘ldiring')).toBeInTheDocument();
  });

  it('names the specific rule a field broke', () => {
    setup({ initial: { ...formFromLead(lead()), phone: '+998 94', age: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(screen.getByText('Telefon raqamini to‘liq kiriting')).toBeInTheDocument();
    expect(screen.getByText('Yoshni kiriting (15-45)')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Qayta aloqa sanasi')).toHaveValue('2026-08-15');
    expect(screen.getByText(/Rejalashtirilgan: 15-avgust · ertaga/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1 haftadan keyin' }));
    expect(screen.getByLabelText('Qayta aloqa sanasi')).toHaveValue('2026-08-21');
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
