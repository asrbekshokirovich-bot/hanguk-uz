import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import {
  computeDashboard,
  type DashboardNumbers,
  type DashDocument,
  type DashMember,
  type DashProfile,
  type DashSubmission,
  type DashTask,
} from '@/lib/dashboardStats';

interface DashboardStats extends DashboardNumbers {
  pendingDocuments: number;
  totalCalls: number;
  unreadMessages: number;
  pendingPayments: number;
  callsByDay: { day: string; incoming: number; outgoing: number }[];
}

const EMPTY: DashboardStats = {
  students: 0,
  submittedApplications: 0,
  admittedApplications: 0,
  openTasks: 0,
  byStage: [],
  byMonth: [],
  recent: [],
  tasksByPriority: [],
  pendingDocuments: 0,
  totalCalls: 0,
  unreadMessages: 0,
  pendingPayments: 0,
  callsByDay: [],
};

// student_university_submissions is not in the generated types yet.
type UntypedSelect = {
  select: (columns: string) => { in: (column: string, values: string[]) => PromiseLike<{ data: unknown }> };
};
const db = supabase as unknown as { from: (table: string) => UntypedSelect };

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const { activeIntakeId } = useActiveIntake();

  const fetchStats = async () => {
    // Wait until the active intake has resolved, so the dashboard never shows
    // another season's numbers in the gap before the intake loads.
    if (!activeIntakeId) return;
    setLoading(true);

    try {
      // Calls and messages are agency-wide; everything else is this season.
      const [membersRes, staffRolesRes, pendingDocsRes, callsRes, unreadMsgRes, tasksRes, pendingPaymentsRes] =
        await Promise.all([
          supabase
            .from('student_intakes')
            .select('student_id, created_at, docs_ready, contract_cancelled_at')
            .eq('intake_id', activeIntakeId),
          supabase.from('user_roles').select('user_id'),
          applyIntake(supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'uploaded'), activeIntakeId),
          supabase.from('calls').select('*').order('started_at', { ascending: false }).limit(100),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'unread').eq('direction', 'incoming'),
          applyIntake(
            supabase.from('tasks').select('id, title, priority, created_at').neq('status', 'completed').neq('status', 'cancelled'),
            activeIntakeId,
          ),
          applyIntake(supabase.from('payments').select('id', { count: 'exact', head: true }).in('status', ['pending', 'partial']), activeIntakeId),
        ]);

      const members = (membersRes.data ?? []) as DashMember[];
      const ids = [...new Set(members.map((m) => m.student_id))];
      const none = ['00000000-0000-0000-0000-000000000000'];
      const [profilesRes, subsRes, docsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, is_demo').in('user_id', ids.length ? ids : none),
        db
          .from('student_university_submissions')
          .select('student_id, institution_id, online_submitted_at, offline_sent_at, interview_at, result, result_at, final_at, visa_status')
          .in('student_id', ids.length ? ids : none),
        supabase
          .from('documents')
          .select('student_id, name, file_path, status, created_at')
          .in('student_id', ids.length ? ids : none)
          .limit(5000),
      ]);
      const submissions = (subsRes.data ?? []) as DashSubmission[];
      const uniIds = [...new Set(submissions.map((s) => s.institution_id))];
      const unisRes = uniIds.length
        ? await supabase.from('institutions').select('id, name_en, name_ko').in('id', uniIds)
        : { data: [] as { id: string; name_en: string | null; name_ko: string | null }[] };
      const uniNames = new Map((unisRes.data ?? []).map((u) => [u.id, u.name_en || u.name_ko]));

      const numbers = computeDashboard({
        members,
        profiles: (profilesRes.data ?? []) as DashProfile[],
        staffIds: new Set((staffRolesRes.data ?? []).map((r) => r.user_id)),
        submissions,
        documents: (docsRes.data ?? []) as DashDocument[],
        tasks: (tasksRes.data ?? []) as DashTask[],
        universityName: (id) => uniNames.get(id) ?? null,
      });

      // Calls by day (last 7 days)
      const calls = callsRes.data || [];
      const dayCalls: Record<string, { incoming: number; outgoing: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayCalls[d.toLocaleDateString('en-US', { weekday: 'short' })] = { incoming: 0, outgoing: 0 };
      }
      calls.forEach((c) => {
        const key = new Date(c.started_at).toLocaleDateString('en-US', { weekday: 'short' });
        if (dayCalls[key]) {
          if (c.direction === 'incoming') dayCalls[key].incoming++;
          else dayCalls[key].outgoing++;
        }
      });

      setStats({
        ...numbers,
        pendingDocuments: pendingDocsRes.count || 0,
        totalCalls: calls.length,
        unreadMessages: unreadMsgRes.count || 0,
        pendingPayments: pendingPaymentsRes.count || 0,
        callsByDay: Object.entries(dayCalls).map(([day, counts]) => ({ day, ...counts })),
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntakeId]);

  return { stats, loading, refetch: fetchStats };
}
