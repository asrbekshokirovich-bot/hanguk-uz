/**
 * The Arizalar board, read only. The owner's rule (2026-10-15): nothing is
 * done on Arizalar any more — each student sits in the column of the last
 * stage the other sections have recorded for them:
 *
 *   new           contract signed, nothing further yet
 *   docs_ready    the application pack is fully approved (Hujjatlar)
 *   online        "Onlayn topshirildi" for at least one university
 *   offline       paper documents posted to at least one university
 *   interview     — no section records interviews yet
 *   result        a university answered (Onlayn ariza → Natijalar)
 *   visa_process  — no section records the visa yet
 *   visa_waiting  —
 *   visa_received —
 *
 * The interview and visa columns stay empty until their sections exist; they
 * then only need to feed `PipelineFacts`.
 */

export const PIPELINE_STAGES = [
  'new',
  'docs_ready',
  'online',
  'offline',
  'interview',
  'result',
  'visa_process',
  'visa_waiting',
  'visa_received',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  new: 'Yangi',
  docs_ready: 'Hujjat tayyor',
  online: 'Onlayn ariza',
  offline: 'Oflayn ariza',
  interview: 'Suhbat',
  result: 'Natija',
  visa_process: 'Viza jarayonlari',
  visa_waiting: 'Viza natijasini kutyapti',
  visa_received: 'Viza oldi',
};

/** Columns no section feeds yet — shown with a "coming" note. */
export const PIPELINE_NOT_WIRED = new Set<PipelineStage>(['interview', 'visa_process', 'visa_waiting', 'visa_received']);

export interface PipelineFacts {
  docsReady: boolean;
  onlineSubmitted: boolean;
  offlineSent: boolean;
  hasInterview?: boolean;
  hasResult: boolean;
  visaProcess?: boolean;
  visaWaiting?: boolean;
  visaReceived?: boolean;
}

/** The furthest stage the student has reached. */
export function pipelineStage(f: PipelineFacts): PipelineStage {
  if (f.visaReceived) return 'visa_received';
  if (f.visaWaiting) return 'visa_waiting';
  if (f.visaProcess) return 'visa_process';
  if (f.hasResult) return 'result';
  if (f.hasInterview) return 'interview';
  if (f.offlineSent) return 'offline';
  if (f.onlineSubmitted) return 'online';
  if (f.docsReady) return 'docs_ready';
  return 'new';
}
