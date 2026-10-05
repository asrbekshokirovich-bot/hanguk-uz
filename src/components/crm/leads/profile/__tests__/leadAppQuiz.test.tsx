import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance } from 'i18next';
import uz from '@/locales/uz.json';
import { LeadAppQuiz } from '../LeadAppQuiz';
import type { LeadRecord } from '../useLeadProfile';

const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'uz',
  fallbackLng: 'uz',
  resources: { uz: { translation: uz } },
  interpolation: { escapeValue: false },
});

const lead = (overrides: Partial<LeadRecord> = {}): LeadRecord => ({
  id: 'lead-1',
  full_name: 'Dilnoza',
  phone: '+998901234567',
  city: "Farg'ona",
  status: 'new',
  interest_level: null,
  current_stage: null,
  preferred_program: null,
  created_at: new Date(2026, 9, 5).toISOString(),
  telegram_handle: null,
  instagram_handle: null,
  link_code: 'abc',
  quiz_answers: null,
  eligibility_result: null,
  eligibility_band: null,
  tariff_interest: null,
  needs_operator: false,
  quiz_submitted_at: null,
  ...overrides,
});

const show = (l: LeadRecord) =>
  render(
    <I18nextProvider i18n={i18n}>
      <LeadAppQuiz lead={l} />
    </I18nextProvider>,
  );

describe('LeadAppQuiz', () => {
  it('is not shown for a lead that never took the quiz', () => {
    const { container } = show(lead());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the answers, band and tariff in words', () => {
    show(
      lead({
        quiz_submitted_at: new Date(2026, 9, 5, 10, 0).toISOString(),
        eligibility_band: 'mid',
        tariff_interest: 'premium',
        needs_operator: true,
        quiz_answers: {
          route: 'bachelor',
          age: '19',
          grad_year: '2026',
          korean: 'topik2',
          english: 'ielts60',
          budget: '6to10',
          payer: 'parents',
          formal_income: 'yes',
          bank_statement: 'no',
          region: "Farg'ona",
          intake: '2027_spring',
        },
      }),
    );
    expect(screen.getByText("O'rta imkoniyat")).toBeInTheDocument();
    expect(screen.getByText('Tavsiya: Premium')).toBeInTheDocument();
    expect(screen.getByText('Bakalavr')).toBeInTheDocument();
    expect(screen.getByText('Ingliz tili')).toBeInTheDocument();
    expect(screen.getByText('IELTS 6.0')).toBeInTheDocument();
    expect(screen.getByText('19 yosh · 2026')).toBeInTheDocument();
    expect(screen.getByText('$6–10 ming · Ota-onasi')).toBeInTheDocument();
    expect(screen.getByText("Rasmiy daromad: bor · Bank spravkasi: yo'q")).toBeInTheDocument();
    expect(screen.getByText("Farg'ona · 2027 bahor")).toBeInTheDocument();
    expect(screen.getByText(/operator aniqlashtirsin/)).toBeInTheDocument();
  });

  it('shows a code it has no label for as it is', () => {
    show(lead({ quiz_submitted_at: new Date().toISOString(), quiz_answers: { route: 'newroute' } }));
    expect(screen.getByText('newroute')).toBeInTheDocument();
  });
});
