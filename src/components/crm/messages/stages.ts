/**
 * Pipeline-stage mapping for the Messages section.
 *
 * The context rail in this design shows four steps — Consultation →
 * Documents → Application → Visa & Flight. They are folded from the Arizalar
 * board column (src/lib/studentPipeline.ts), never from the legacy
 * `applications.status` (stale since 2026-10-15). Read-only.
 */

import type { PipelineStage } from '@/lib/studentPipeline';

/** Index on the 4-step ladder. 4 means every step is complete. */
export type StageIndex = 0 | 1 | 2 | 3 | 4;

export const STAGE_KEYS = [
  'messages.stages.consultation',
  'messages.stages.documents',
  'messages.stages.application',
  'messages.stages.visa',
] as const;

/**
 * Shorter variants for the queue-row stage pill, which has far less room than
 * the rail's progress tracker.
 */
export const STAGE_PILL_KEYS = [
  'messages.stages.consultation',
  'messages.stages.documents',
  'messages.stages.application',
  'messages.stages.visaShort',
] as const;

/**
 * Board column → step on the 4-step ladder. A thread linked to a student is
 * a contracted student, so the ladder starts at Documents. `null` (no
 * pipeline) means consultation.
 */
export function stageIndexFor(stage: PipelineStage | null | undefined): StageIndex {
  switch (stage) {
    case null:
    case undefined:
      return 0;
    case 'new':
      return 1;
    case 'docs_ready':
    case 'online':
    case 'offline':
    case 'interview':
    case 'result':
      return 2;
    case 'visa_process':
    case 'visa_waiting':
      return 3;
    case 'visa_received':
      return 4;
  }
}

/**
 * i18n key for the queue-row stage pill: the step currently in progress, or
 * "Enrolled" once the ladder is complete, or "New Lead" when the thread is not
 * linked to a student at all.
 */
export function stageLabelKey(studentId: string | null, stage: PipelineStage | null | undefined): string {
  if (!studentId) return 'messages.stages.newLead';
  const idx = stageIndexFor(stage);
  if (idx === 4) return 'messages.stages.enrolled';
  return STAGE_PILL_KEYS[idx];
}
