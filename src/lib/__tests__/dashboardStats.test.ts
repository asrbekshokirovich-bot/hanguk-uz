import { describe, expect, it } from 'vitest';
import { computeDashboard, monthKey, type DashDocument, type DashboardInput } from '@/lib/dashboardStats';

const PACK = ['applicant_id_card', 'foreign_passport', 'father_id_card', 'mother_id_card', 'birth_certificate', 'language_certificate', 'photo', 'diploma'];
const fullPack = (student: string): DashDocument[] =>
  PACK.map((slot) => ({ student_id: student, name: `[${slot}]`, file_path: `x/${slot}.pdf`, status: 'approved', created_at: '2026-10-01T00:00:00Z' }));

const member = (id: string, extra: Partial<DashboardInput['members'][number]> = {}) => ({
  student_id: id,
  created_at: '2026-09-01T00:00:00Z',
  docs_ready: false,
  contract_cancelled_at: null,
  ...extra,
});

function input(over: Partial<DashboardInput> = {}): DashboardInput {
  return {
    members: [
      member('new1'),
      member('flag', { docs_ready: true }),
      member('pack'),
      member('sent', { created_at: '2026-10-20T00:00:00Z' }),
      member('cancelled', { contract_cancelled_at: '2026-10-10T00:00:00Z', docs_ready: true }),
      member('demo'),
      member('staff'),
    ],
    profiles: ['new1', 'flag', 'pack', 'sent', 'cancelled', 'demo', 'staff'].map((id) => ({
      user_id: id,
      full_name: id.toUpperCase(),
      is_demo: id === 'demo',
    })),
    staffIds: new Set(['staff']),
    submissions: [
      { student_id: 'sent', institution_id: 'u1', online_submitted_at: '2026-10-23T09:00:00Z', offline_sent_at: '2026-10-27T05:00:00Z', interview_at: null, result: null, result_at: null, final_at: null, visa_status: null },
      { student_id: 'sent', institution_id: 'u2', online_submitted_at: null, offline_sent_at: null, interview_at: '2026-12-01T00:00:00Z', result: null, result_at: null, final_at: null, visa_status: null },
      // A cancelled student's admission must not count.
      { student_id: 'cancelled', institution_id: 'u1', online_submitted_at: '2026-07-01T00:00:00Z', offline_sent_at: null, interview_at: null, result: 'accepted', result_at: '2026-08-01T00:00:00Z', final_at: null, visa_status: null },
    ],
    documents: [...fullPack('pack'), ...fullPack('cancelled'), ...fullPack('sent').slice(0, 5)],
    tasks: [
      { id: 't1', title: 'A', priority: 'urgent', created_at: '2026-10-13T00:00:00Z' },
      { id: 't2', title: 'B', priority: 'urgent', created_at: '2026-10-13T00:00:00Z' },
      { id: 't3', title: 'C', priority: 'high', created_at: '2026-10-13T00:00:00Z' },
    ],
    universityName: (id) => (id === 'u1' ? 'Hanyang University' : 'Ajou University'),
    now: new Date('2026-10-27T10:00:00Z'),
    ...over,
  };
}

describe('computeDashboard', () => {
  it('counts only active, real students', () => {
    expect(computeDashboard(input()).students).toBe(4);
  });

  it('counts submitted and admitted applications of active students only', () => {
    const d = computeDashboard(input());
    expect(d.submittedApplications).toBe(1);
    expect(d.admittedApplications).toBe(0);
  });

  it('puts every student in the board column, matching the Arizalar board', () => {
    const d = computeDashboard(input());
    expect(d.byStage).toEqual([
      { stage: 'new', count: 1 },
      { stage: 'docs_ready', count: 2 },
      { stage: 'interview', count: 1 },
    ]);
    expect(d.byStage.reduce((s, x) => s + x.count, 0)).toBe(d.students);
  });

  it('charts applications by the month they were first sent', () => {
    const d = computeDashboard(input());
    expect(d.byMonth).toHaveLength(6);
    expect(d.byMonth.at(-1)).toEqual({ month: monthKey(new Date(2026, 9, 1)), count: 1 });
    expect(d.byMonth.slice(0, 5).every((m) => m.count === 0)).toBe(true);
  });

  it('lists the latest real events, newest first, without future interviews', () => {
    const d = computeDashboard(input());
    expect(d.recent.map((r) => r.kind)).toEqual(['offline', 'online', 'contract', 'contract', 'contract']);
    expect(d.recent[0]).toMatchObject({ studentName: 'SENT', universityName: 'Hanyang University' });
    expect(d.recent.some((r) => r.kind === 'interview')).toBe(false);
  });

  it('counts open tasks by priority', () => {
    const d = computeDashboard(input());
    expect(d.openTasks).toBe(3);
    expect(d.tasksByPriority).toEqual([
      { priority: 'urgent', count: 2 },
      { priority: 'high', count: 1 },
    ]);
  });
});
