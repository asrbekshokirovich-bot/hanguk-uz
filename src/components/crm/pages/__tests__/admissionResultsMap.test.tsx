import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdmissionResultsMap from '../AdmissionResultsMap';
import type { UniversityChoice } from '@/hooks/useUniversityChoices';
import type { UniversitySubmission } from '@/hooks/useUniversitySubmissions';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const choice = (student_id: string, institution_id: string, rank: number): UniversityChoice => ({
  id: `${student_id}-${institution_id}`, student_id, institution_id, rank, created_at: '', status: 'confirmed',
  responded_at: null, change_reason: null, change_note: null, confirmed_at: null,
});
const sub = (student_id: string, institution_id: string, extra: Partial<UniversitySubmission> = {}): UniversitySubmission => ({
  id: `${student_id}:${institution_id}`, student_id, institution_id, online_submitted_at: '2026-10-12T00:00:00Z',
  offline_sent_at: null, copies: null, note: null, result: null, result_at: null, final_at: null, student_confirmed_at: null, ...extra,
});

const NAMES: Record<string, string> = { knu: 'Kyungpook', pnu: 'Pusan', dh: 'Daegu Haany', sj: 'Sejong', ih: 'Inha' };

function setup(subs: UniversitySubmission[]) {
  const choicesByStudent = new Map([
    ['a', [choice('a', 'knu', 1), choice('a', 'pnu', 2), choice('a', 'dh', 3)]],
    ['b', [choice('b', 'sj', 1), choice('b', 'ih', 2)]],
    ['c', [choice('c', 'knu', 1), choice('c', 'dh', 3)]],
  ]);
  const studentById = new Map([
    ['a', { user_id: 'a', full_name: 'ABDIRAIMOV XURSHID', avatar_url: null, magic_code: null }],
    ['b', { user_id: 'b', full_name: 'NAZAROVA KAMOLA', avatar_url: null, magic_code: null }],
    ['c', { user_id: 'c', full_name: 'RAHIMOV UMID', avatar_url: null, magic_code: null }],
  ]);
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <AdmissionResultsMap
      choicesByStudent={choicesByStudent}
      studentById={studentById}
      universityName={(id) => NAMES[id]}
      submissions={new Map(subs.map((s) => [`${s.student_id}:${s.institution_id}`, s]))}
      saving={false}
      onSave={onSave}
    />,
  );
  const row = (name: string) => screen.getAllByTestId('result-row').find((r) => within(r).queryByText(name))!;
  return { onSave, row };
}

describe('AdmissionResultsMap', () => {
  it('colours each choice by result and flags who must choose, who is at risk and who is done', () => {
    const { row } = setup([
      sub('a', 'knu', { result: 'accepted' }), sub('a', 'pnu', { result: 'accepted' }), sub('a', 'dh'),
      sub('b', 'sj', { result: 'rejected' }), sub('b', 'ih', { result: 'rejected' }),
      sub('c', 'knu', { result: 'accepted', final_at: '2026-11-01T00:00:00Z', student_confirmed_at: '2026-11-02T00:00:00Z' }),
    ]);
    expect(row('ABDIRAIMOV XURSHID').getAttribute('data-state')).toBe('choose');
    expect(row('NAZAROVA KAMOLA').getAttribute('data-state')).toBe('risk');
    expect(within(row('NAZAROVA KAMOLA')).getByText('Xavf')).toBeInTheDocument();
    expect(row('RAHIMOV UMID').getAttribute('data-state')).toBe('final');
    expect(within(row('RAHIMOV UMID')).getByText('Talaba tasdiqladi')).toBeInTheDocument();
    // Not submitted yet → can't set a result.
    expect(within(row('RAHIMOV UMID')).getByText('Hali topshirilmagan')).toBeInTheDocument();
  });

  it('sets a result from the cell menu', async () => {
    const { onSave, row } = setup([sub('a', 'knu'), sub('a', 'pnu'), sub('a', 'dh')]);
    fireEvent.click(within(row('ABDIRAIMOV XURSHID')).getByText('Kyungpook'));
    fireEvent.click(screen.getByText('Kirdi', { selector: 'button' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('a', 'knu', { result: 'accepted' }));
  });

  it('picks the final university among the accepted ones', async () => {
    const { onSave, row } = setup([sub('a', 'knu', { result: 'accepted' }), sub('a', 'pnu', { result: 'accepted' }), sub('a', 'dh', { result: 'rejected' })]);
    fireEvent.click(within(row('ABDIRAIMOV XURSHID')).getByText('Tanlash'));
    expect(screen.getByText('Qaysi biriga boradi?')).toBeInTheDocument();
    const menu = screen.getByText('Qaysi biriga boradi?').parentElement!;
    expect(within(menu).queryByText('Daegu Haany')).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByText('Pusan'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('a', 'pnu', { final_at: expect.any(String) }));
  });
});
