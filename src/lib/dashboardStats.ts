import type { Tables } from '@/integrations/supabase/types';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/applicationPipeline';
import { buildStudentPipeline } from '@/lib/studentPipeline';

/**
 * CRM dashboard numbers, computed the same way as the Arizalar board
 * (src/components/crm/pages/ApplicationsPipeline.tsx) and the investor funnel
 * (migration 20261027110000). Asrbek, 2026-10-27: "hammasi aniq raqamlar
 * bilan yozilsin".
 *
 *  - Students: season members with an active contract, no demo, no staff.
 *  - Submitted applications: (student, university) pairs sent online or posted.
 *  - Admitted: those pairs with result "accepted".
 *  - By stage: every student in the board column they sit in.
 *  - Trend: submitted applications by the month they were first sent.
 *  - Recent activity: the latest contract / submission / interview / result events.
 *
 * The old applications table is no longer read: staff stopped using it on
 * 2026-10-15 and its rows belong partly to cancelled contracts.
 */

export interface DashMember {
  student_id: string;
  created_at: string;
  docs_ready: boolean | null;
  contract_cancelled_at: string | null;
}

export interface DashProfile {
  user_id: string;
  full_name: string | null;
  is_demo: boolean | null;
}

export interface DashSubmission {
  student_id: string;
  institution_id: string;
  online_submitted_at: string | null;
  offline_sent_at: string | null;
  interview_at: string | null;
  result: string | null;
  result_at: string | null;
  final_at: string | null;
  visa_status: string | null;
}

export type DashDocument = Pick<Tables<'documents'>, 'student_id' | 'name' | 'file_path' | 'status' | 'created_at'>;

export interface DashTask {
  id: string;
  title: string;
  priority: string | null;
  created_at: string;
}

export type ActivityKind = 'contract' | 'online' | 'offline' | 'interview' | 'accepted' | 'rejected';

export interface DashActivity {
  id: string;
  kind: ActivityKind;
  studentName: string;
  universityName: string | null;
  timestamp: string;
}

export interface DashboardNumbers {
  students: number;
  submittedApplications: number;
  admittedApplications: number;
  openTasks: number;
  byStage: { stage: PipelineStage; count: number }[];
  byMonth: { month: string; count: number }[];
  recent: DashActivity[];
  tasksByPriority: { priority: string; count: number }[];
}

export interface DashboardInput {
  members: DashMember[];
  profiles: DashProfile[];
  staffIds: Set<string>;
  submissions: DashSubmission[];
  documents: DashDocument[];
  tasks: DashTask[];
  universityName: (institutionId: string) => string | null;
  now?: Date;
}

const sent = (s: DashSubmission) => !!(s.online_submitted_at || s.offline_sent_at);

export const monthKey = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

export function computeDashboard(input: DashboardInput): DashboardNumbers {
  const profileById = new Map(input.profiles.map((p) => [p.user_id, p]));
  const active = input.members.filter((m) => {
    const p = profileById.get(m.student_id);
    return !!p && !p.is_demo && !m.contract_cancelled_at && !input.staffIds.has(m.student_id);
  });
  const activeIds = new Set(active.map((m) => m.student_id));
  const nameOf = (id: string) => profileById.get(id)?.full_name?.trim() || '—';

  const subs = input.submissions.filter((s) => activeIds.has(s.student_id));
  const subsByStudent = new Map<string, DashSubmission[]>();
  for (const s of subs) subsByStudent.set(s.student_id, [...(subsByStudent.get(s.student_id) ?? []), s]);
  const docsByStudent = new Map<string, DashDocument[]>();
  for (const d of input.documents) {
    if (!d.student_id || !activeIds.has(d.student_id)) continue;
    docsByStudent.set(d.student_id, [...(docsByStudent.get(d.student_id) ?? []), d]);
  }

  // Board column of every student.
  const stageCount = new Map<PipelineStage, number>(PIPELINE_STAGES.map((s) => [s, 0]));
  for (const m of active) {
    const own = subsByStudent.get(m.student_id) ?? [];
    // The one rule every CRM screen uses (src/lib/studentPipeline.ts).
    const { stage } = buildStudentPipeline({
      docsReady: m.docs_ready,
      documents: (docsByStudent.get(m.student_id) ?? []) as Tables<'documents'>[],
      submissions: own,
    });
    stageCount.set(stage, (stageCount.get(stage) ?? 0) + 1);
  }
  const byStage = PIPELINE_STAGES.map((stage) => ({ stage, count: stageCount.get(stage) ?? 0 })).filter(
    (s) => s.count > 0,
  );

  // Submitted applications by the month they were first sent, last 6 months.
  const now = input.now ?? new Date();
  const months: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) months.push({ month: monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), count: 0 });
  for (const s of subs) {
    const first = [s.online_submitted_at, s.offline_sent_at].filter(Boolean).sort()[0];
    if (!first) continue;
    const row = months.find((m) => m.month === monthKey(new Date(first)));
    if (row) row.count++;
  }

  // Latest events.
  const events: DashActivity[] = [];
  for (const m of active) {
    events.push({ id: `c:${m.student_id}`, kind: 'contract', studentName: nameOf(m.student_id), universityName: null, timestamp: m.created_at });
  }
  for (const s of subs) {
    const base = { studentName: nameOf(s.student_id), universityName: input.universityName(s.institution_id) };
    const key = `${s.student_id}:${s.institution_id}`;
    if (s.online_submitted_at) events.push({ ...base, id: `o:${key}`, kind: 'online', timestamp: s.online_submitted_at });
    if (s.offline_sent_at) events.push({ ...base, id: `f:${key}`, kind: 'offline', timestamp: s.offline_sent_at });
    if (s.interview_at) events.push({ ...base, id: `i:${key}`, kind: 'interview', timestamp: s.interview_at });
    if (s.result && s.result_at) {
      events.push({ ...base, id: `r:${key}`, kind: s.result === 'accepted' ? 'accepted' : 'rejected', timestamp: s.result_at });
    }
  }
  const nowMs = now.getTime();
  const recent = events
    .filter((e) => new Date(e.timestamp).getTime() <= nowMs) // a future interview is not activity yet
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const priorities = ['urgent', 'high', 'normal', 'low'];
  const tasksByPriority = priorities
    .map((priority) => ({ priority, count: input.tasks.filter((t) => (t.priority ?? 'normal') === priority).length }))
    .filter((t) => t.count > 0);

  return {
    students: active.length,
    submittedApplications: subs.filter(sent).length,
    admittedApplications: subs.filter((s) => s.result === 'accepted').length,
    openTasks: input.tasks.length,
    byStage,
    byMonth: months,
    recent,
    tasksByPriority,
  };
}
