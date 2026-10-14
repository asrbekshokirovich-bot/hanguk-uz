import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import UniversitySelectionContent from '../UniversitySelectionContent';

const add = vi.fn();
const remove = vi.fn();
const move = vi.fn();
let choices: { id: string; student_id: string; institution_id: string; rank: number; created_at: string }[] = [];

vi.mock('@/hooks/useUniversityChoices', () => ({
  MAX_CHOICES: 3,
  useUniversityChoices: () => {
    const byStudent = new Map<string, typeof choices>();
    for (const c of choices) byStudent.set(c.student_id, [...(byStudent.get(c.student_id) ?? []), c]);
    return {
      byStudent,
      wishesByStudent: new Map([['u1', [{ id: 'w1', student_id: 'u1', custom_university_name: 'Inha', institution_id: null }]]]),
      loading: false,
      error: null,
      add: { mutate: add, isPending: false },
      remove: { mutate: remove, isPending: false },
      move: { mutate: move, isPending: false },
    };
  },
}));

const guideline = (institution_id: string, ielts_min: number | null, topik_min: number | null) => ({
  id: `g-${institution_id}`, guideline_id: `g-${institution_id}`, institution_id, univ_kod: institution_id,
  univ_nomi_en: null, univ_nomi_kr: null, kampus: null, shahar: 'Seoul', qabul_yili: 2027, semestr: 'bahor',
  daraja: 'bakalavr', english_track: ielts_min !== null, korean_track: topik_min !== null, topik_min, ielts_min,
  toefl_ibt_min: null, narx_valyuta: 'KRW', kirish_tolovi: null, kontrakt_min: null, kontrakt_max: null,
  kontrakt_davri: null, fakultet_soni: 0, fayl_nomi: null, updated_at: '2026-10-01',
});
const entry = (id: string, name: string, ielts_min: number | null, topik_min: number | null) => {
  const g = guideline(id, ielts_min, topik_min);
  return {
    institution: { id, name_ko: name, name_en: name, name_ko_short: null, city_ko: 'Seoul', region_code: null, primary_domain: `${id}.ac.kr`, institution_type: 'university', tier: null, is_partner: false, logo_url: null, primary_admissions_url_ko: null },
    guidelines: [g],
    latest: g,
  };
};

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({
    entries: [entry('ku', 'Korea University', 6, null), entry('yu', 'Yonsei University', 6.5, null), entry('pn', 'Pusan National', null, 3)],
    loading: false,
    error: null,
  }),
}));

type Student = ComponentProps<typeof UniversitySelectionContent>['students'][number];
const student = {
  user_id: 'u1', full_name: 'ABDIRAIMOV XURSHID', magic_code: 'VHK', avatar_url: null,
  contract_date: '2026-10-01', hasPaid: true, ielts_score: 6, topik_level: null, applications: [],
} as unknown as Student;

describe('UniversitySelectionContent', () => {
  beforeEach(() => {
    choices = [];
    add.mockReset();
  });

  it('checks each university against the student score', () => {
    render(<UniversitySelectionContent students={[student]} loading={false} />);
    expect(screen.getByText('IELTS 6 mos')).toBeInTheDocument();
    expect(screen.getByText('IELTS +0.5 kerak')).toBeInTheDocument();
    expect(screen.getByText('TOPIK 3 kerak')).toBeInTheDocument();
    // The old intake-form wish is shown, read-only.
    expect(screen.getByText(/Inha/)).toBeInTheDocument();
  });

  it('adds a university to the student', () => {
    render(<UniversitySelectionContent students={[student]} loading={false} />);
    fireEvent.click(screen.getAllByText('Tanlash')[0]);
    expect(add).toHaveBeenCalledWith({ studentId: 'u1', institutionId: 'ku' }, expect.anything());
  });

  it('filters to universities the student fits', () => {
    render(<UniversitySelectionContent students={[student]} loading={false} />);
    fireEvent.click(screen.getByText('Faqat mos keladigan'));
    expect(screen.getByText('Korea University')).toBeInTheDocument();
    expect(screen.queryByText('Yonsei University')).not.toBeInTheDocument();
  });

  it('blocks a fourth choice and sends choices to applications', async () => {
    choices = ['ku', 'yu', 'pn'].map((id, i) => ({ id: `c${i}`, student_id: 'u1', institution_id: id, rank: i + 1, created_at: '' }));
    const onCreateApplication = vi.fn().mockResolvedValue({ error: null });
    render(<UniversitySelectionContent students={[student]} loading={false} onCreateApplication={onCreateApplication} />);
    expect(screen.getAllByText('3/3').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tanlash')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Arizaga o'tkazish/));
    await waitFor(() => expect(onCreateApplication).toHaveBeenCalledTimes(3));
    expect(onCreateApplication).toHaveBeenNthCalledWith(1, 'u1', 'ku');
  });
});
