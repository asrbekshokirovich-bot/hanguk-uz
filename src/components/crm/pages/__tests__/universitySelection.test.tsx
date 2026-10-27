import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import UniversitySelectionContent from '../UniversitySelectionContent';

const add = vi.fn();
const remove = vi.fn();
const move = vi.fn();
const confirm = vi.fn();
type Choice = {
  id: string; student_id: string; institution_id: string; rank: number; created_at: string;
  status: string; responded_at: string | null; change_reason: string | null; change_note: string | null; confirmed_at: string | null;
};
let choices: Choice[] = [];
const choice = (id: string, institution_id: string, rank: number, status = 'offered', extra: Partial<Choice> = {}): Choice => ({
  id, student_id: 'u1', institution_id, rank, created_at: '', status,
  responded_at: null, change_reason: null, change_note: null, confirmed_at: null, ...extra,
});

vi.mock('@/hooks/useUniversityChoices', async (orig) => {
  const real = await orig<typeof import('@/hooks/useUniversityChoices')>();
  return {
    ...real,
    useUniversityChoices: () => {
      const byStudent = new Map<string, Choice[]>();
      for (const c of choices) byStudent.set(c.student_id, [...(byStudent.get(c.student_id) ?? []), c]);
      for (const l of byStudent.values()) l.sort((a, b) => a.rank - b.rank);
      return {
        byStudent,
        wishesByStudent: new Map([['u1', [{ id: 'w1', student_id: 'u1', custom_university_name: 'Inha', institution_id: null }]]]),
        loading: false,
        error: null,
        add: { mutate: add, isPending: false },
        remove: { mutate: remove, isPending: false },
        move: { mutate: move, isPending: false },
        confirm: { mutate: confirm, isPending: false },
      };
    },
  };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const guideline = (institution_id: string, ielts_min: number | null, topik_min: number | null) => ({
  id: `g-${institution_id}`, guideline_id: `g-${institution_id}`, institution_id, univ_kod: institution_id,
  univ_nomi_en: null, univ_nomi_kr: null, kampus: null, shahar: 'Seoul', qabul_yili: 2027, semestr: 'bahor',
  daraja: 'bakalavr', english_track: ielts_min !== null, korean_track: topik_min !== null, topik_min, ielts_min,
  toefl_ibt_min: null, narx_valyuta: 'KRW', kirish_tolovi: null, kontrakt_min: null, kontrakt_max: null,
  kontrakt_davri: null, fakultet_soni: 0, fayl_nomi: null, updated_at: '2026-10-01',
});
const entry = (id: string, name: string, ielts_min: number | null, topik_min: number | null, is_partner = false) => {
  const g = guideline(id, ielts_min, topik_min);
  return {
    institution: { id, name_ko: name, name_en: name, name_ko_short: null, city_ko: 'Seoul', region_code: null, primary_domain: `${id}.ac.kr`, institution_type: 'university', tier: null, is_partner, logo_url: null, primary_admissions_url_ko: null },
    guidelines: [g],
    latest: g,
  };
};

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({
    entries: [
      entry('ku', 'Korea University', 6, null),
      entry('yu', 'Yonsei University', 6.5, null),
      entry('pn', 'Pusan National', null, 3),
      entry('dh', 'Daegu Haany University', 5.5, null, true),
    ],
    loading: false,
    error: null,
  }),
}));

type Student = ComponentProps<typeof UniversitySelectionContent>['students'][number];
const student = {
  user_id: 'u1', full_name: 'ABDIRAIMOV XURSHID', magic_code: 'VHK', avatar_url: null,
  contract_date: '2026-10-01', hasPaid: true, ielts_score: 6, topik_level: null,
  pipeline: { submissions: [{ student_id: 's1', institution_id: 'ku', online_submitted_at: '2026-10-27T00:00:00Z', offline_sent_at: null, interview_at: null, result: null, final_at: null, visa_status: null }] },
} as unknown as Student;

const setup = (props: Partial<ComponentProps<typeof UniversitySelectionContent>> = {}) =>
  render(<UniversitySelectionContent students={[student]} loading={false} {...props} />);

describe('UniversitySelectionContent', () => {
  beforeEach(() => {
    choices = [];
    [add, remove, move, confirm].forEach((m) => m.mockReset());
  });

  it('checks each university against the student score', () => {
    setup();
    expect(screen.getAllByText('IELTS 6 mos').length).toBeGreaterThan(0);
    expect(screen.getByText('IELTS +0.5 kerak')).toBeInTheDocument();
    expect(screen.getByText('TOPIK 3 kerak')).toBeInTheDocument();
    expect(screen.getByText(/Inha/)).toBeInTheDocument();
  });

  it('adds a staff choice and fills the partner slot with the only partner', () => {
    setup();
    fireEvent.click(screen.getAllByText('Tanlash')[0]);
    expect(add).toHaveBeenCalledWith(
      { studentId: 'u1', institutionId: 'ku', partner: false, autoPartnerId: 'dh' },
      expect.anything(),
    );
  });

  it('stops at two staff choices; the partner goes only into the third slot', () => {
    choices = [choice('c1', 'ku', 1), choice('c2', 'pn', 2)];
    setup();
    for (const b of screen.getAllByText('Tanlash')) expect(b.closest('button')).toBeDisabled();
    // Partner slot is still empty → offered with the partner's name.
    fireEvent.click(screen.getByRole('button', { name: /Daegu Haany University/ }));
    expect(add).toHaveBeenCalledWith(
      { studentId: 'u1', institutionId: 'dh', partner: true, autoPartnerId: 'dh' },
      expect.anything(),
    );
  });

  it('shows each choice status and gives staff the final confirmation', () => {
    choices = [
      choice('c1', 'ku', 1, 'accepted', { responded_at: '2026-10-13T00:00:00Z' }),
      choice('c2', 'pn', 2, 'change_requested', { change_reason: 'price', change_note: 'Arzonrog\'i' }),
      choice('c3', 'dh', 3, 'confirmed', { confirmed_at: '2026-10-14T00:00:00Z' }),
    ];
    setup();
    const rows = screen.getAllByTestId('choice-row');
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['accepted', 'change_requested', 'confirmed']);

    fireEvent.click(within(rows[0]).getByText('Yakuniy tasdiqlash'));
    expect(confirm).toHaveBeenCalledWith(choices[0], expect.anything());

    expect(within(rows[1]).getByText('Kontrakt narxi qimmat')).toBeInTheDocument();
    fireEvent.click(within(rows[1]).getByText('Almashtirish'));
    expect(remove).toHaveBeenCalledWith(choices[1], expect.anything());

    // A confirmed choice is locked: no remove, no reorder.
    expect(within(rows[2]).getByText(/Biriktirildi/)).toBeInTheDocument();
    expect(within(rows[2]).queryByLabelText('Olib tashlash')).not.toBeInTheDocument();
  });

  it('lets staff confirm the partner slot without waiting for the student', () => {
    choices = [choice('c1', 'ku', 1, 'offered'), choice('c3', 'dh', 3, 'offered')];
    setup();
    const rows = screen.getAllByTestId('choice-row');
    expect(within(rows[0]).getByText('Talaba javobi kutilmoqda')).toBeInTheDocument();
    expect(within(rows[0]).queryByText('Yakuniy tasdiqlash')).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("Talaba tasdig'i shart emas")).toBeInTheDocument();
    fireEvent.click(within(rows[1]).getByText('Yakuniy tasdiqlash'));
    expect(confirm).toHaveBeenCalledWith(choices[1], expect.anything());
  });

  it('shows "Arizada" only for a university really sent, and no legacy send step', () => {
    choices = [choice('c1', 'ku', 1, 'confirmed'), choice('c3', 'dh', 3, 'confirmed')];
    setup();
    const rows = screen.getAllByTestId('choice-row');
    expect(within(rows[0]).getByText('Arizada')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Arizada')).not.toBeInTheDocument();
    expect(screen.queryByText(/Arizaga o'tkazish/)).not.toBeInTheDocument();
  });

  it('filters to universities the student fits', () => {
    setup();
    fireEvent.click(screen.getByText('Faqat mos keladigan'));
    expect(screen.getByText('Korea University')).toBeInTheDocument();
    expect(screen.queryByText('Yonsei University')).not.toBeInTheDocument();
  });
});
