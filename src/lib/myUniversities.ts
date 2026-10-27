import { supabase } from '@/integrations/supabase/client';

/**
 * The signed-in student's universities (web portal and app read the same
 * thing): confirmed choices ∪ submissions ∪ the student's own requests still
 * waiting for staff. `status` is derived from the submission by the database
 * (migration 20261030220000, `my_universities()`), so it always matches the
 * CRM's Arizalar board — never the legacy `applications` rows staff no
 * longer update.
 */
export interface MyUniversity {
  id: string;
  institution_id: string;
  /** pending_approval · documents · application_submitted · originals_sent ·
   *  interview · university_response · rejected · visa_documents · visa_issue ·
   *  completed (visa received) */
  status: string;
  program: string | null;
  created_at: string;
  name_en: string | null;
  name_ko: string | null;
  city_ko: string | null;
  is_partner: boolean;
}

export async function fetchMyUniversities(): Promise<MyUniversity[]> {
  const { data, error } = await supabase.rpc('my_universities' as never);
  if (error) throw error;
  return (data ?? []) as unknown as MyUniversity[];
}
