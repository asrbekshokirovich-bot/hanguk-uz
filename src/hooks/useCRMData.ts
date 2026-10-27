import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useActiveIntake } from '@/contexts/IntakeContext';
import { applyIntake } from '@/lib/intakeQuery';
import { getPlanByValue } from '@/hooks/useStudentPlan';
import { isInitialPaymentOverdue, partialBalances, type CurrencyBalance } from '@/lib/paymentBalance';
import { buildStudentPipeline, type StudentPipeline, type SubmissionFacts } from '@/lib/studentPipeline';

export type PipelineUniversity = Pick<Tables<'institutions'>, 'id' | 'name_en' | 'name_ko' | 'is_partner'>;

/**
 * A row of the legacy `applications` table that is still a live flow: a
 * university the student asked for in the app (status 'pending_approval').
 * Everything about progress comes from `pipeline` instead.
 */
export type StudentRequest = Pick<Tables<'applications'>, 'id' | 'institution_id' | 'status' | 'created_at'> & {
  university?: PipelineUniversity | null;
};

export type CRMStudent = StudentProfile;

type StudentProfile = Tables<'profiles'> & {
  /** Where the student is — same rule as the Arizalar board (src/lib/studentPipeline.ts). */
  pipeline: StudentPipeline;
  /** Names for pipeline.universityIds, in the same order. */
  pipelineUniversities: PipelineUniversity[];
  /** Universities the student requested in the app, waiting for staff. */
  studentRequests: StudentRequest[];
  /** Bakalavr / Magistratura / … — still kept on applications.degree_level. */
  degreeLevel: string | null;
  documents?: Tables<'documents'>[];
  paymentStatus?: string | null;
  initialPaymentOverdue?: boolean;
  /** Part-paid balances per currency: "5000$ dan 1000$ to'langan, 4000$ qoldi". */
  paymentBalances?: CurrencyBalance[];
  /** Contract cancelled in the active season (student_intakes.contract_cancelled_at). */
  contractCancelled?: boolean;
  /**
   * This season is a free re-application, so nothing is owed for it.
   *
   * Read off the student's `student_intakes` row for the active season, not
   * off the profile — the profile's plan is season-independent, and a student
   * carried over after a visa refusal paid for the season they came from.
   */
  freeReapplication?: boolean;
  /**
   * Staff marked this student's document pack ready (Hujjatlar) for this
   * season, even though no application/university is attached yet. Read off
   * `student_intakes`, same place as `freeReapplication` — see that field's
   * comment for why the season-scoped table, not the profile.
   */
  docsReady?: boolean;
};

const SUBMISSION_COLUMNS =
  'student_id, institution_id, online_submitted_at, offline_sent_at, interview_at, result, result_at, final_at, visa_status';

// student_university_submissions / _choices are newer than the generated types.
interface UntypedResult { data: unknown; error: { message: string } | null }
interface UntypedQuery extends PromiseLike<UntypedResult> {
  select: (columns: string) => UntypedQuery;
  in: (column: string, values: string[]) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
}
const untyped = supabase as unknown as { from: (table: string) => UntypedQuery };

export function useCRMData() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [universities, setUniversities] = useState<Tables<'institutions'>[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeIntakeId } = useActiveIntake();

  const fetchStudents = async () => {
    if (!activeIntakeId) {
      setStudents([]);
      return;
    }
    try {
      // Roster for the active season = explicit membership (student_intakes).
      // This is role-independent, so every staff role sees the same students —
      // unlike the old "derive from applications ∪ documents ∪ payments" approach,
      // where a role that can't read `documents` (e.g. call_operator) saw fewer.
      const { data: memberships, error: membershipError } = await supabase
        .from('student_intakes')
        .select('student_id, is_free_reapplication, docs_ready, contract_cancelled_at')
        .eq('intake_id', activeIntakeId);

      if (membershipError) {
        console.error('Error fetching student memberships:', membershipError);
        toast.error('Failed to load students');
        return;
      }

      const memberIds = new Set((memberships ?? []).map((m) => m.student_id));
      // Exempt for THIS season only. The same student can be billed normally
      // in another season, which is the whole point of holding the flag here
      // rather than on the profile.
      const freeReapplicationIds = new Set(
        (memberships ?? []).filter((m) => m.is_free_reapplication).map((m) => m.student_id),
      );
      // Contract cancelled this season (migration 20261026150000): still listed,
      // with a red badge, but nothing is owed and nothing can be late.
      const cancelledIds = new Set(
        (memberships ?? []).filter((m) => m.contract_cancelled_at).map((m) => m.student_id),
      );
      const docsReadyIds = new Set(
        (memberships ?? []).filter((m) => m.docs_ready).map((m) => m.student_id),
      );

      // Staff are never students.
      const { data: staffRoles, error: staffError } = await supabase
        .from('user_roles')
        .select('user_id');

      if (staffError) {
        console.error('Error fetching staff roles:', staffError);
        toast.error('Failed to load staff roles');
        return;
      }

      const staffUserIds = new Set((staffRoles ?? []).map((r) => r.user_id));

      // Fetch all profiles, then keep this season's members (excluding staff).
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast.error('Failed to load student profiles');
        return;
      }

      if (!profiles) return;

      const memberProfiles = profiles.filter(
        (profile) => memberIds.has(profile.user_id) && !staffUserIds.has(profile.user_id),
      );

      const studentUserIds = memberProfiles.map((p) => p.user_id);

      if (studentUserIds.length === 0) {
        setStudents([]);
        return;
      }

      // Batch fetch this intake's documents and payments, the submissions and
      // confirmed university choices, and the two legacy facts still kept on
      // `applications` (student requests and the degree).
      const [appsResult, docsResult, paymentsResult, subsResult, choicesResult] = await Promise.all([
        applyIntake(
          supabase
            .from('applications')
            .select('id, institution_id, status, created_at, degree_level, student_id, university:institutions(id, name_en, name_ko, is_partner)')
            .in('student_id', studentUserIds),
          activeIntakeId,
        ),
        applyIntake(
          supabase.from('documents').select('*').in('student_id', studentUserIds),
          activeIntakeId,
        ),
        applyIntake(
          supabase.from('payments').select('student_id, status, payment_type, paid_amount, amount, currency').in('student_id', studentUserIds),
          activeIntakeId,
        ),
        untyped.from('student_university_submissions').select(SUBMISSION_COLUMNS).in('student_id', studentUserIds),
        untyped
          .from('student_university_choices')
          .select('student_id, institution_id, rank')
          .in('student_id', studentUserIds)
          .eq('status', 'confirmed'),
      ]);
      if (subsResult.error) console.error('Error fetching submissions:', subsResult.error);
      if (choicesResult.error) console.error('Error fetching university choices:', choicesResult.error);
      const allSubs = (subsResult.data ?? []) as SubmissionFacts[];
      const allChoices = ((choicesResult.data ?? []) as { student_id: string; institution_id: string; rank: number | null }[])
        .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

      if (appsResult.error) {
        console.error('Error fetching applications:', appsResult.error);
      }
      if (docsResult.error) {
        console.error('Error fetching documents:', docsResult.error);
      }

      const allApps = appsResult.data || [];
      const allDocs = docsResult.data || [];
      const allPayments = paymentsResult.data || [];

      // Compute worst payment status per student
      const PAYMENT_STATUS_PRIORITY: Record<string, number> = { overdue: 4, pending: 3, partial: 2, completed: 1 };
      const paymentStatusByStudent = new Map<string, string>();
      for (const p of allPayments) {
        const current = paymentStatusByStudent.get(p.student_id);
        const newPriority = PAYMENT_STATUS_PRIORITY[p.status] || 0;
        const currentPriority = current ? PAYMENT_STATUS_PRIORITY[current] || 0 : 0;
        if (newPriority > currentPriority) {
          paymentStatusByStudent.set(p.student_id, p.status);
        }
      }

      // Any money actually received. The Hujjatlar page colours a contracted
      // student by this: their documents are collected either way, but work on
      // them starts only once they have paid.
      const paidStudentIds = new Set(
        allPayments
          .filter((p) => p.status === 'completed' && Number(p.paid_amount || 0) > 0)
          .map((p) => p.student_id),
      );

      // Group by student_id
      const appsByStudent = new Map<string, typeof allApps>();
      for (const app of allApps) {
        const existing = appsByStudent.get(app.student_id) || [];
        existing.push(app);
        appsByStudent.set(app.student_id, existing);
      }

      const docsByStudent = new Map<string, typeof allDocs>();
      for (const doc of allDocs) {
        const existing = docsByStudent.get(doc.student_id) || [];
        existing.push(doc);
        docsByStudent.set(doc.student_id, existing);
      }

      // Group payments by student once; the overdue flag and the balance line
      // read the same rows.
      const paymentsByStudent = new Map<string, typeof allPayments>();
      for (const p of allPayments) {
        const existing = paymentsByStudent.get(p.student_id) || [];
        existing.push(p);
        paymentsByStudent.set(p.student_id, existing);
      }

      // Compute initialPaymentOverdue per student. The rules live in
      // src/lib/paymentBalance.ts (7 working days, part-paid amounts count).
      const initialOverdueByStudent = new Map<string, boolean>();
      for (const profile of memberProfiles) {
        const uid = profile.user_id;
        initialOverdueByStudent.set(
          uid,
          isInitialPaymentOverdue({
            contractDate: profile.contract_date,
            paymentPlan: profile.payment_plan,
            paymentMode: profile.payment_mode,
            payments: paymentsByStudent.get(uid) || [],
            // Nothing is owed for a free re-application, so nothing can be late.
            exempt: freeReapplicationIds.has(uid) || cancelledIds.has(uid),
          }),
        );
      }

      const subsByStudent = new Map<string, SubmissionFacts[]>();
      for (const s of allSubs) subsByStudent.set(s.student_id, [...(subsByStudent.get(s.student_id) ?? []), s]);
      const choicesByStudent = new Map<string, string[]>();
      for (const c of allChoices) choicesByStudent.set(c.student_id, [...(choicesByStudent.get(c.student_id) ?? []), c.institution_id]);

      const pipelines = new Map(
        memberProfiles.map((profile) => [
          profile.user_id,
          buildStudentPipeline({
            docsReady: docsReadyIds.has(profile.user_id),
            documents: docsByStudent.get(profile.user_id) || [],
            submissions: subsByStudent.get(profile.user_id) || [],
            confirmedChoiceIds: choicesByStudent.get(profile.user_id) || [],
          }),
        ]),
      );
      const neededIds = [...new Set([...pipelines.values()].flatMap((p) => p.universityIds))];
      const uniById = new Map<string, PipelineUniversity>();
      if (neededIds.length) {
        const { data: unis } = await supabase
          .from('institutions')
          .select('id, name_en, name_ko, is_partner')
          .in('id', neededIds);
        for (const u of unis ?? []) uniById.set(u.id, u);
      }

      // Combine
      const studentsWithData = memberProfiles.map(profile => ({
        ...profile,
        pipeline: pipelines.get(profile.user_id)!,
        pipelineUniversities: pipelines
          .get(profile.user_id)!
          .universityIds.map((id) => uniById.get(id))
          .filter((u): u is PipelineUniversity => !!u),
        studentRequests: (appsByStudent.get(profile.user_id) || [])
          .filter((a) => a.status === 'pending_approval')
          .map(({ id, institution_id, status, created_at, university }) => ({ id, institution_id, status, created_at, university })),
        degreeLevel: (appsByStudent.get(profile.user_id) || []).find((a) => a.degree_level)?.degree_level ?? null,
        documents: docsByStudent.get(profile.user_id) || [],
        paymentStatus: paymentStatusByStudent.get(profile.user_id) || null,
        initialPaymentOverdue: initialOverdueByStudent.get(profile.user_id) || false,
        paymentBalances: cancelledIds.has(profile.user_id)
          ? []
          : partialBalances(paymentsByStudent.get(profile.user_id) || []),
        contractCancelled: cancelledIds.has(profile.user_id),
        freeReapplication: freeReapplicationIds.has(profile.user_id),
        // Nothing is owed on a free plan or a free re-application, so those
        // count as paid.
        hasPaid:
          paidStudentIds.has(profile.user_id) ||
          freeReapplicationIds.has(profile.user_id) ||
          getPlanByValue(profile.payment_plan)?.value === 'free',
        docsReady: docsReadyIds.has(profile.user_id),
      }));

      setStudents(studentsWithData);
    } catch (error) {
      console.error('Unexpected error in fetchStudents:', error);
      toast.error('Failed to load students');
    }
  };

  const fetchUniversities = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .order('tier', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching universities:', error);
        toast.error('Failed to load universities');
        return;
      }
      if (data) setUniversities(data);
    } catch (error) {
      console.error('Unexpected error in fetchUniversities:', error);
    }
  };

  // Marks (or clears) a student's document pack as "ready" for the active
  // season when they have no application/university yet — student_intakes
  // already has a row for every roster member (that's what membership means),
  // so this is always an update, never an insert.
  const setDocsReady = async (studentId: string, ready: boolean) => {
    if (!activeIntakeId) return { error: new Error('No active intake') };
    const { error } = await supabase
      .from('student_intakes')
      .update({ docs_ready: ready })
      .eq('student_id', studentId)
      .eq('intake_id', activeIntakeId);

    if (!error) await fetchStudents();
    return { error };
  };

  const updateDocumentStatus = async (documentId: string, newStatus: string, notes?: string) => {
    if (newStatus === 'rejected') {
      // Fetch the file path first
      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        return { error: fetchError };
      }

      // Delete from storage (best-effort — don't block on storage error)
      await supabase.storage
        .from('student-documents')
        .remove([doc.file_path]);

      // Delete the DB record entirely so the slot resets to empty
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (!error) {
        await fetchStudents();
      }
      return { error };
    }

    // For all other statuses (approved, uploaded, etc.) — update as before
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('documents')
      .update({ 
        status: newStatus, 
        notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq('id', documentId);

    if (!error) {
      await fetchStudents();
    }
    return { error };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchUniversities(),
      ]);
      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntakeId]);

  return {
    students,
    universities,
    loading,
    refetchStudents: fetchStudents,
    updateDocumentStatus,
    setDocsReady,
  };
}
