/**
 * Admissions-detail data for a single institution (uni_db).
 *
 * Re-points the CRM Universities detail view at the post-2026-05-10 schema. The
 * legacy `public.universities` blob columns were dropped and the data normalized
 * into uni_db tables; the old detail sheet was deleted in that cutover and never
 * rebuilt, so every university appeared "empty". This hook is the missing read
 * layer.
 *
 * Join shape (verified against prod):
 *   institutions.id
 *     ← admission_cycles.institution_id            (cycle = year/term/track)
 *         ← requirements.cycle_id                  (admission tracks)
 *         ← documents_required.cycle_id            (required documents)
 *     ← scholarships.institution_id
 *     ← tuition.institution_id
 *     ← university_admission_periods.institution_id (application timeline)
 *
 * NOTE: most of these tables are not in the generated Supabase types yet, so the
 * queries are cast at the boundary (same pattern as UniDbReviewContent's view).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdmissionRequirement {
  id: string;
  cycle_id: string;
  applicant_category: string | null;
  topik_min_level: number | null;
  topik_deferred: boolean | null;
  english_test: unknown | null;
  gpa_floor_pct: number | null;
  interview_required: boolean | null;
  practical_exam_required: boolean | null;
  prose_ko: string | null;
  source_text_ko: string | null;
  extractor_confidence: number | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
}

export interface RequiredDocument {
  id: string;
  cycle_id: string;
  applicant_category: string | null;
  document_type: string;
  is_required: boolean | null;
  is_apostille_required: boolean | null;
  country_specific: unknown | null;
  notes_ko: string | null;
  source_text_ko: string | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
}

export interface AdmissionCycle {
  id: string;
  institution_id: string;
  intake_year: number | null;
  intake_term: string | null;
  cycle_track: string | null;
  round_number: number | null;
  applicant_category: string | null;
  status: string | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
  requirements: AdmissionRequirement[];
  documents_required: RequiredDocument[];
}

export interface Scholarship {
  id: string;
  institution_id: string | null;
  scope: string | null;
  name_ko: string | null;
  name_en: string | null;
  award_type: string | null;
  award_value: number | null;
  prose_ko: string | null;
  source_text_ko: string | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
}

export interface TuitionRow {
  id: string;
  institution_id: string;
  faculty_group: string | null;
  academic_year: number | null;
  semester_number: number | null;
  amount_krw: number | null;
  admission_fee_krw: number | null;
  source_text_ko: string | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
}

export interface AdmissionPeriod {
  id: string;
  institution_id: string | null;
  program_level: string | null;
  language_track: string | null;
  semester: string | null;
  year: number | null;
  application_start: string | null;
  application_end: string | null;
  document_deadline: string | null;
  result_announcement: string | null;
  application_fee_krw: number | null;
  application_fee_usd: number | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
}

export interface UniversityAdmissions {
  cycles: AdmissionCycle[];
  scholarships: Scholarship[];
  tuition: TuitionRow[];
  periods: AdmissionPeriod[];
  flaggedCount: number;
}

export function useUniversityAdmissions(institutionId: string | null) {
  return useQuery<UniversityAdmissions, Error>({
    queryKey: ['uni-db', 'admissions', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const id = institutionId as string;

      // Cycle-scoped data: requirements + documents embed under their cycle via
      // the cycle_id FK in one round-trip. Hide superseded cycles (matches the
      // admission_cycles_app_read RLS policy).
      const cyclesQ = supabase
        // @ts-expect-error - uni_db tables not in generated types yet
        .from('admission_cycles')
        .select(
          '*, requirements(*), documents_required(*)',
        )
        .eq('institution_id', id)
        .neq('status', 'superseded')
        .order('intake_year', { ascending: false })
        .order('intake_term', { ascending: true });

      // Institution-scoped data.
      const scholarshipsQ = supabase
        // @ts-expect-error - uni_db tables not in generated types yet
        .from('scholarships')
        .select('*')
        .eq('institution_id', id);

      const tuitionQ = supabase
        // @ts-expect-error - uni_db tables not in generated types yet
        .from('tuition')
        .select('*')
        .eq('institution_id', id)
        .order('academic_year', { ascending: false });

      const periodsQ = supabase
        .from('university_admission_periods')
        .select('*')
        .eq('institution_id', id)
        .order('year', { ascending: false })
        .order('semester', { ascending: true });

      const [cyclesRes, scholarshipsRes, tuitionRes, periodsRes] =
        await Promise.all([cyclesQ, scholarshipsQ, tuitionQ, periodsQ]);

      const firstError =
        cyclesRes.error || scholarshipsRes.error || tuitionRes.error || periodsRes.error;
      if (firstError) throw firstError;

      const cycles = (cyclesRes.data ?? []) as unknown as AdmissionCycle[];
      const scholarships = (scholarshipsRes.data ?? []) as unknown as Scholarship[];
      const tuition = (tuitionRes.data ?? []) as unknown as TuitionRow[];
      const periods = (periodsRes.data ?? []) as unknown as AdmissionPeriod[];

      const flaggedCount =
        cycles.filter((c) => c.needs_attention).length +
        cycles.reduce(
          (acc, c) =>
            acc +
            (c.requirements ?? []).filter((r) => r.needs_attention).length +
            (c.documents_required ?? []).filter((d) => d.needs_attention).length,
          0,
        ) +
        scholarships.filter((s) => s.needs_attention).length +
        tuition.filter((t) => t.needs_attention).length +
        periods.filter((p) => p.needs_attention).length;

      return { cycles, scholarships, tuition, periods, flaggedCount };
    },
  });
}
