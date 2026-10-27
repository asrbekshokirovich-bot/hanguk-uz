import { describe, expect, it } from 'vitest';
import type { Tables } from '@/integrations/supabase/types';
import { buildStudentPipeline, submissionStep, type SubmissionFacts } from '../studentPipeline';

const sub = (patch: Partial<SubmissionFacts>): SubmissionFacts => ({
  student_id: 's1',
  institution_id: 'u1',
  online_submitted_at: null,
  offline_sent_at: null,
  interview_at: null,
  result: null,
  result_at: null,
  final_at: null,
  visa_status: null,
  ...patch,
});

const approved = (slot: string) =>
  ({ id: slot, student_id: 's1', name: `[${slot}] f.pdf`, file_path: `s1/${slot}-1.pdf`, status: 'approved', created_at: '2026-10-01T00:00:00Z' }) as unknown as Tables<'documents'>;

describe('buildStudentPipeline', () => {
  it('a contracted student with nothing else is "Yangi" (the Mamadaminov case)', () => {
    const p = buildStudentPipeline({ docsReady: false, documents: [], submissions: [], confirmedChoiceIds: [] });
    expect(p.stage).toBe('new');
    expect(p.label).toBe('Yangi');
    expect(p.step).toBe(1);
    expect(p.steps).toBe(9);
    expect(p.universityIds).toEqual([]);
    expect(p.admitted).toBe(false);
  });

  it('docs_ready flag or a fully approved pack moves to "Hujjat tayyor"', () => {
    expect(buildStudentPipeline({ docsReady: true }).stage).toBe('docs_ready');
    const pack = ['applicant_id_card', 'foreign_passport', 'father_id_card', 'mother_id_card', 'birth_certificate', 'language_certificate', 'photo', 'diploma'];
    const p = buildStudentPipeline({ documents: pack.map(approved) });
    expect(p.docsVerified).toBe(p.docsRequired);
    expect(p.stage).toBe('docs_ready');
  });

  it('submissions decide the later columns and the university order', () => {
    const p = buildStudentPipeline({
      confirmedChoiceIds: ['c1', 'u2'],
      submissions: [sub({ institution_id: 'u2', online_submitted_at: '2026-10-27', offline_sent_at: '2026-10-27' })],
    });
    expect(p.stage).toBe('offline');
    expect(p.universityIds).toEqual(['u2', 'c1']);
    expect(p.sentCount).toBe(1);
  });

  it('admission is a result "accepted", the final university leads', () => {
    const p = buildStudentPipeline({
      submissions: [
        sub({ institution_id: 'a', online_submitted_at: 'x', result: 'rejected' }),
        sub({ institution_id: 'b', online_submitted_at: 'x', result: 'accepted', final_at: 'y', visa_status: 'waiting' }),
      ],
    });
    expect(p.admitted).toBe(true);
    expect(p.stage).toBe('visa_waiting');
    expect(p.finalUniversityId).toBe('b');
    expect(p.universityIds[0]).toBe('b');
  });
});

describe('submissionStep', () => {
  it('labels one university', () => {
    expect(submissionStep(undefined)).toBe('chosen');
    expect(submissionStep(sub({ online_submitted_at: 'x' }))).toBe('online');
    expect(submissionStep(sub({ online_submitted_at: 'x', interview_at: 'y' }))).toBe('interview');
    expect(submissionStep(sub({ result: 'rejected' }))).toBe('rejected');
    expect(submissionStep(sub({ result: 'accepted', final_at: 'z', visa_status: 'received' }))).toBe('visa_received');
  });
});
