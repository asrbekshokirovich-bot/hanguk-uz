/**
 * Where one student is in the application process — the ONE rule every CRM
 * screen uses (Asrbek, 2026-10-27: "kelajakda bunaqa xato chiqmasin").
 *
 * Sources (the same as the Arizalar board):
 *   - documents                         the 8-slot application pack
 *   - student_intakes.docs_ready        staff marked the pack ready
 *   - student_university_choices        universities the student agreed to and staff confirmed
 *   - student_university_submissions    online / offline / interview / result / final / visa
 *
 * The old `applications` table is NOT a source: staff stopped using it on
 * 2026-10-15 and rows without a submission keep stale, hand-set statuses
 * (src/lib/__tests__/legacyApplicationsGuard.test.ts keeps it that way).
 */

import type { Tables } from '@/integrations/supabase/types';
import { buildApplicationPack } from '@/lib/studentDocSlots';
import { PIPELINE_LABELS, PIPELINE_STAGES, pipelineStage, type PipelineStage } from '@/lib/applicationPipeline';

export interface SubmissionFacts {
  student_id: string;
  institution_id: string;
  online_submitted_at: string | null;
  offline_sent_at: string | null;
  interview_at: string | null;
  result: string | null;
  result_at?: string | null;
  final_at: string | null;
  visa_status: string | null;
}

export interface StudentPipeline {
  stage: PipelineStage;
  label: string;
  /** 1-based position of `stage` among the board columns. */
  step: number;
  steps: number;
  docsVerified: number;
  docsRequired: number;
  /** Universities to show for the student: sent submissions first, then the other confirmed choices. */
  universityIds: string[];
  submissions: SubmissionFacts[];
  /** (student, university) pairs sent online or posted. */
  sentCount: number;
  /** At least one university answered "accepted". */
  admitted: boolean;
  finalUniversityId: string | null;
}

export function buildStudentPipeline(input: {
  docsReady?: boolean | null;
  documents?: Tables<'documents'>[] | null;
  submissions?: SubmissionFacts[] | null;
  confirmedChoiceIds?: string[] | null;
}): StudentPipeline {
  const subs = input.submissions ?? [];
  const pack = buildApplicationPack(input.documents ?? []);
  const stage = pipelineStage({
    docsReady: !!input.docsReady || (pack.requiredTotal > 0 && pack.requiredVerified === pack.requiredTotal),
    onlineSubmitted: subs.some((s) => s.online_submitted_at),
    offlineSent: subs.some((s) => s.offline_sent_at),
    hasInterview: subs.some((s) => s.interview_at),
    visaProcess: subs.some((s) => s.final_at && s.visa_status === 'process'),
    visaWaiting: subs.some((s) => s.final_at && s.visa_status === 'waiting'),
    visaReceived: subs.some((s) => s.final_at && s.visa_status === 'received'),
    hasResult: subs.some((s) => s.result),
  });
  const sent = subs.filter((s) => s.online_submitted_at || s.offline_sent_at);
  const final = subs.find((s) => s.final_at) ?? null;
  const universityIds = [
    ...new Set([
      ...(final ? [final.institution_id] : []),
      ...sent.map((s) => s.institution_id),
      ...(input.confirmedChoiceIds ?? []),
      ...subs.map((s) => s.institution_id),
    ]),
  ];
  return {
    stage,
    label: PIPELINE_LABELS[stage],
    step: PIPELINE_STAGES.indexOf(stage) + 1,
    steps: PIPELINE_STAGES.length,
    docsVerified: pack.requiredVerified,
    docsRequired: pack.requiredTotal,
    universityIds,
    submissions: subs,
    sentCount: sent.length,
    admitted: subs.some((s) => s.result === 'accepted'),
    finalUniversityId: final?.institution_id ?? null,
  };
}

/** One university's own progress, for per-university rows (profile, messages). */
export type SubmissionStep = 'chosen' | 'online' | 'offline' | 'interview' | 'accepted' | 'rejected' | 'final' | 'visa_process' | 'visa_waiting' | 'visa_received';

export const SUBMISSION_STEP_LABELS: Record<SubmissionStep, string> = {
  chosen: 'Tanlangan',
  online: 'Onlayn topshirildi',
  offline: 'Oflayn yuborildi',
  interview: 'Suhbat belgilangan',
  accepted: 'Qabul qilindi',
  rejected: 'Rad etildi',
  final: 'Yakuniy universitet',
  visa_process: 'Viza jarayonlari',
  visa_waiting: 'Viza natijasini kutyapti',
  visa_received: 'Viza oldi',
};

export function submissionStep(s: SubmissionFacts | null | undefined): SubmissionStep {
  if (!s) return 'chosen';
  if (s.final_at && s.visa_status === 'received') return 'visa_received';
  if (s.final_at && s.visa_status === 'waiting') return 'visa_waiting';
  if (s.final_at && s.visa_status === 'process') return 'visa_process';
  if (s.final_at) return 'final';
  if (s.result === 'accepted') return 'accepted';
  if (s.result === 'rejected') return 'rejected';
  if (s.interview_at) return 'interview';
  if (s.offline_sent_at) return 'offline';
  if (s.online_submitted_at) return 'online';
  return 'chosen';
}

export { PIPELINE_LABELS, PIPELINE_STAGES, type PipelineStage };
