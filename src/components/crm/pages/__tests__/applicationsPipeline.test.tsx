import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ApplicationsPipeline from '../ApplicationsPipeline';
import { pipelineStage } from '@/lib/applicationPipeline';
import { APPLICATION_PACK_SLOTS } from '@/lib/studentDocSlots';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

vi.mock('@/hooks/useUniversityCatalog', () => ({
  useUniversityCatalog: () => ({
    entries: [
      { institution: { id: 'knu', name_ko: 'Kyungpook', name_en: 'Kyungpook', name_ko_short: null }, guidelines: [], latest: null },
      { institution: { id: 'pnu', name_ko: 'Pusan', name_en: 'Pusan', name_ko_short: null }, guidelines: [], latest: null },
    ],
    loading: false,
  }),
}));

const sub = (student_id: string, institution_id: string, extra: Record<string, unknown> = {}) => ({
  id: `${student_id}:${institution_id}`, student_id, institution_id, online_submitted_at: null, offline_sent_at: null,
  copies: null, note: null, interview_at: null, result: null, result_at: null, final_at: null, student_confirmed_at: null,
  visa_status: null, visa_status_at: null, ...extra,
});
const subs = [
  sub('online', 'knu', { online_submitted_at: '2026-10-10' }),
  sub('online', 'pnu', { online_submitted_at: '2026-10-11' }),
  sub('offline', 'knu', { online_submitted_at: '2026-10-10', offline_sent_at: '2026-10-12' }),
  sub('interviewed', 'knu', { online_submitted_at: '2026-10-10', offline_sent_at: '2026-10-12', interview_at: '2026-10-24T09:00:00Z' }),
  sub('visa', 'pnu', { online_submitted_at: '2026-10-10', result: 'accepted', final_at: '2026-11-20', visa_status: 'waiting' }),
  sub('admitted', 'knu', { online_submitted_at: '2026-10-10', result: 'accepted' }),
];
vi.mock('@/hooks/useUniversitySubmissions', () => ({
  useUniversitySubmissions: () => ({
    byKey: new Map(subs.map((s) => [`${s.student_id}:${s.institution_id}`, s])),
    loading: false,
  }),
}));

const approvedPack = APPLICATION_PACK_SLOTS.filter((s) => s.required).map((s, i) => ({
  id: `d${i}`, student_id: 'ready', name: `[${s.id}] file`, file_path: `x/${s.id}-1.pdf`, status: 'approved', created_at: '2026-10-01',
}));

const student = (user_id: string, extra: Record<string, unknown> = {}) => ({
  user_id, full_name: user_id.toUpperCase(), avatar_url: null, magic_code: null, ...extra,
});

describe('applications pipeline', () => {
  it('puts a student in the furthest stage reached', () => {
    const base = { docsReady: false, onlineSubmitted: false, offlineSent: false, hasResult: false };
    expect(pipelineStage(base)).toBe('new');
    expect(pipelineStage({ ...base, docsReady: true })).toBe('docs_ready');
    expect(pipelineStage({ ...base, docsReady: true, onlineSubmitted: true })).toBe('online');
    expect(pipelineStage({ ...base, onlineSubmitted: true, offlineSent: true })).toBe('offline');
    expect(pipelineStage({ ...base, onlineSubmitted: true, offlineSent: true, hasInterview: true })).toBe('interview');
    expect(pipelineStage({ ...base, onlineSubmitted: true, hasInterview: true, hasResult: true })).toBe('result');
    expect(pipelineStage({ ...base, onlineSubmitted: true, hasResult: true })).toBe('result');
    expect(pipelineStage({ ...base, hasResult: true, visaReceived: true })).toBe('visa_received');
  });

  it('shows every student read-only in their column and opens them on click', () => {
    const onOpen = vi.fn();
    const students = [
      student('fresh'),
      student('ready', { documents: approvedPack }),
      student('online'),
      student('offline'),
      student('interviewed'),
      student('visa'),
      student('admitted'),
    ];
    render(<ApplicationsPipeline students={students as never} loading={false} onOpenStudent={onOpen} />);
    const col = (s: string) => screen.getByTestId(`column-${s}`);
    expect(within(col('new')).getByText('FRESH')).toBeInTheDocument();
    expect(within(col('docs_ready')).getByText('READY')).toBeInTheDocument();
    expect(within(col('online')).getByText('ONLINE')).toBeInTheDocument();
    // Every university on its own line, no "Kyungpook +1".
    expect(within(col('online')).getByText('Kyungpook')).toBeInTheDocument();
    expect(within(col('online')).getByText('Pusan')).toBeInTheDocument();
    expect(within(col('online')).queryByText(/\+1/)).toBeNull();
    expect(within(col('offline')).getByText('OFFLINE')).toBeInTheDocument();
    expect(within(col('result')).getByText('Kirdi: Kyungpook')).toBeInTheDocument();
    // Suhbat: the university and the interview time.
    expect(within(col('interview')).getByText('INTERVIEWED')).toBeInTheDocument();
    expect(within(col('interview')).getByText(/^Kyungpook · 24-okt, \d\d:00$/)).toBeInTheDocument();
    // Viza: the visa status set on the final university.
    expect(within(col('visa_waiting')).getByText('VISA')).toBeInTheDocument();
    expect(within(col('visa_waiting')).getByText('Pusan')).toBeInTheDocument();
    expect(screen.queryByText(/tez orada/)).not.toBeInTheDocument();
    // Nothing to move or edit — the card only opens the student.
    expect(screen.queryByRole('button', { name: /keyingi|advance|o'tkazish/i })).not.toBeInTheDocument();
    fireEvent.click(within(col('offline')).getByText('OFFLINE'));
    expect(onOpen).toHaveBeenCalledWith(students[3]);
  });
});
