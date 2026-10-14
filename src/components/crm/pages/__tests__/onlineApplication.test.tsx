import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OnlineApplicationContent from '../OnlineApplicationContent';
import { formatAnswer } from '@/hooks/useStudentSurveyAnswers';

const choices = [
  { id: 'c1', student_id: 'a', institution_id: 'knu', rank: 1, created_at: '' },
  { id: 'c2', student_id: 'a', institution_id: 'pnu', rank: 2, created_at: '' },
  { id: 'c3', student_id: 'b', institution_id: 'knu', rank: 2, created_at: '' },
];

vi.mock('@/hooks/useUniversityChoices', () => ({
  useUniversityChoices: () => {
    const byStudent = new Map<string, typeof choices>();
    for (const c of choices) byStudent.set(c.student_id, [...(byStudent.get(c.student_id) ?? []), c]);
    return { byStudent, wishesByStudent: new Map(), loading: false, error: null };
  },
}));

const inst = (id: string, name: string) => ({
  institution: { id, name_ko: name, name_en: name, name_ko_short: null, city_ko: 'Daegu', region_code: null, primary_domain: `${id}.ac.kr`, institution_type: 'university', tier: null, is_partner: false, logo_url: null, primary_admissions_url_ko: null },
  guidelines: [],
  latest: null,
});
vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({
    entries: [inst('knu', 'Kyungpook National University'), inst('pnu', 'Pusan National University'), inst('snu', 'Seoul National University')],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useStudentSurveyAnswers', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useStudentSurveyAnswers')>()),
  useStudentSurveyAnswers: () => ({
    isLoading: false,
    error: null,
    data: [
      { surveyId: 's1', title: "Universtet tanlash uchun so'rovnoma", items: [{ questionId: 'q1', question: 'Qaysi shaharda o\'qimoqchisiz?', answer: 'Daegu' }] },
      { surveyId: 's2', title: "UNIVERSITETGA ARIZA TOPSHIRISH UCHUN MAXSUS SO'ROVNOMA", items: [{ questionId: 'q2', question: 'Email manzilingiz', answer: null }] },
    ],
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const save = vi.fn();
let submissions: { student_id: string; institution_id: string; online_submitted_at: string | null }[] = [];
vi.mock('@/hooks/useUniversitySubmissions', () => ({
  submissionKey: (s: string, i: string) => `${s}:${i}`,
  useUniversitySubmissions: () => ({
    byKey: new Map(submissions.map((r) => [`${r.student_id}:${r.institution_id}`, r])),
    loading: false,
    error: null,
    save: { mutate: save, isPending: false },
  }),
}));

const students = [
  { user_id: 'a', full_name: 'ALIYEV SARDOR', avatar_url: null, magic_code: 'AAA', contract_date: '2026-10-01', hasPaid: true },
  { user_id: 'b', full_name: 'KARIMOVA MADINA', avatar_url: null, magic_code: 'BBB', contract_date: null },
];

const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OnlineApplicationContent students={students} loading={false} />
    </QueryClientProvider>,
  );

describe('OnlineApplicationContent', () => {
  it('lists only chosen universities, each with every student who chose it and their rank', () => {
    setup();
    const blocks = screen.getAllByTestId('university-block');
    expect(blocks).toHaveLength(2);
    expect(screen.queryByText('Seoul National University')).not.toBeInTheDocument();

    const knu = blocks[0];
    expect(within(knu).getByText('Kyungpook National University')).toBeInTheDocument();
    expect(within(knu).getByText('2 ta talaba')).toBeInTheDocument();
    expect(within(knu).getByText('1-tanlov')).toBeInTheDocument();
    expect(within(knu).getByText('2-tanlov')).toBeInTheDocument();

    // A student with two choices shows under both universities.
    expect(screen.getAllByText('ALIYEV SARDOR')).toHaveLength(2);
    expect(within(blocks[1]).getByText('2-tanlov')).toBeInTheDocument();
  });

  it("opens the student's survey answers, question then answer, both surveys in order", () => {
    setup();
    fireEvent.click(screen.getAllByText('KARIMOVA MADINA')[0]);
    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(titles).toEqual(["Universtet tanlash uchun so'rovnoma", "UNIVERSITETGA ARIZA TOPSHIRISH UCHUN MAXSUS SO'ROVNOMA"]);
    expect(screen.getByText(/Qaysi shaharda/)).toBeInTheDocument();
    expect(screen.getByText('Daegu')).toBeInTheDocument();
    expect(screen.getByText('Javob berilmagan')).toBeInTheDocument();
  });
});

describe('Onlayn topshirildi', () => {
  it('marks one student at one university as submitted online, and can undo it', () => {
    submissions = [{ student_id: 'a', institution_id: 'pnu', online_submitted_at: '2026-10-14T10:00:00Z' }];
    setup();
    const toggles = screen.getAllByText('Onlayn topshirildi').map((el) => el.closest('button')!);
    // KNU: ALIYEV (a, rank 1) then KARIMOVA (b); PNU: ALIYEV — already submitted.
    expect(toggles.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    fireEvent.click(toggles[0]);
    expect(save).toHaveBeenLastCalledWith(
      { studentId: 'a', institutionId: 'knu', patch: { online_submitted_at: expect.any(String) } },
      expect.anything(),
    );
    fireEvent.click(toggles[2]);
    expect(save).toHaveBeenLastCalledWith(
      { studentId: 'a', institutionId: 'pnu', patch: { online_submitted_at: null } },
      expect.anything(),
    );
  });
});

describe('formatAnswer', () => {
  it('reads strings, lists and empty answers', () => {
    expect(formatAnswer(' Daegu ')).toBe('Daegu');
    expect(formatAnswer(['Seoul', 'Busan'])).toBe('Seoul, Busan');
    expect(formatAnswer('')).toBeNull();
    expect(formatAnswer(null)).toBeNull();
  });
});
