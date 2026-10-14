import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OfflineApplicationContent from '../OfflineApplicationContent';

const save = vi.fn();
let rows: { student_id: string; institution_id: string; online_submitted_at: string | null; offline_sent_at: string | null; copies: number | null; note: string | null }[] = [];

vi.mock('@/hooks/useUniversitySubmissions', () => ({
  submissionKey: (s: string, i: string) => `${s}:${i}`,
  useUniversitySubmissions: () => ({
    byKey: new Map(rows.map((r) => [`${r.student_id}:${r.institution_id}`, r])),
    loading: false,
    error: null,
    save: { mutate: save, isPending: false },
  }),
}));

const students = new Map([
  ['a', { user_id: 'a', full_name: 'ALIYEV SARDOR', avatar_url: null, magic_code: null }],
  ['b', { user_id: 'b', full_name: 'KARIMOVA MADINA', avatar_url: null, magic_code: null }],
  ['c', { user_id: 'c', full_name: 'TOSHMATOV JASUR', avatar_url: null, magic_code: null }],
]);
vi.mock('@/hooks/useChosenUniversityGroups', () => ({
  getInitials: () => 'X',
  useChosenUniversityGroups: () => ({
    loading: false,
    error: null,
    studentById: students,
    universities: [
      {
        institutionId: 'knu',
        name: { primary: 'Kyungpook National University', secondary: null },
        city: 'Daegu',
        choices: ['a', 'b', 'c'].map((id, i) => ({ id: `c${i}`, student_id: id, institution_id: 'knu', rank: 1, created_at: '' })),
      },
    ],
  }),
}));

const setup = () => render(<OfflineApplicationContent students={[]} loading={false} />);

describe('OfflineApplicationContent', () => {
  beforeEach(() => {
    save.mockReset();
    rows = [
      { student_id: 'a', institution_id: 'knu', online_submitted_at: '2026-10-10T00:00:00Z', offline_sent_at: null, copies: 2, note: null },
      { student_id: 'c', institution_id: 'knu', online_submitted_at: '2026-10-10T00:00:00Z', offline_sent_at: '2026-10-12T00:00:00Z', copies: null, note: null },
    ];
  });

  it('dims a student whose online application is not done and blocks sending', () => {
    setup();
    const cards = screen.getAllByTestId('offline-card');
    expect(cards.map((c) => c.getAttribute('data-ready'))).toEqual(['yes', 'no', 'yes']);
    const madina = within(cards[1]);
    expect(madina.getByText(/Onlayn ariza tayyorlanmoqda/)).toBeInTheDocument();
    expect(madina.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('1 ta yuborildi')).toBeInTheDocument();
  });

  it('asks before marking documents as sent', () => {
    setup();
    const box = within(screen.getAllByTestId('offline-card')[0]).getByRole('checkbox');
    expect(screen.getByText(/2 nusxa/)).toBeInTheDocument();
    fireEvent.click(box);
    expect(screen.getByText('Oflayn hujjat yuborilsinmi?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ha, yuborilsin'));
    expect(save).toHaveBeenCalledWith(
      { studentId: 'a', institutionId: 'knu', patch: { offline_sent_at: expect.any(String) } },
      expect.anything(),
    );
  });

  it('shows a sent student as checked and locked', () => {
    setup();
    const box = within(screen.getAllByTestId('offline-card')[2]).getByRole('checkbox');
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(box).toBeDisabled();
    expect(screen.getByText(/Yuborildi ·/)).toBeInTheDocument();
  });

  it('saves copies and a note from the student sheet', () => {
    setup();
    fireEvent.click(screen.getByText('KARIMOVA MADINA'));
    fireEvent.change(screen.getByLabelText('Universitetga nechta nusxa yuboriladi'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Izoh'), { target: { value: 'Apostil bilan' } });
    fireEvent.click(screen.getByText('Saqlash'));
    expect(save).toHaveBeenCalledWith(
      { studentId: 'b', institutionId: 'knu', patch: { copies: 3, note: 'Apostil bilan' } },
      expect.anything(),
    );
  });
});
