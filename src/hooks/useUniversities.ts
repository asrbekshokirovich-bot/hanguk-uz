/**
 * Phase 3R-B cutover (2026-05-10): the legacy `public.universities` table
 * was dropped. This hook now queries `public.institutions` (the uni_db
 * canonical table) and exposes an institution-shaped record. The old
 * `useUniversities` name is retained so existing call sites keep working
 * during the cutover; rename to `useInstitutions` in a follow-up if you
 * want the names to match the schema.
 *
 * Differences from the legacy `universities` table:
 *   - `programs: string[]` is gone (recruitment_units is the canonical store)
 *   - `tuition_min/max`, `ranking`, `acceptance_rate`, `description_*`,
 *     `requirements_*`, `local_rank`, `global_rank`, `enriched_at` are gone
 *   - `name_uz`, `name_ru`, `city_uz/ru/en` are gone (use display_names jsonb
 *     for non-Korean/English names; institution_type tracks the kind)
 *   - `website`, `website_url` collapsed into `primary_admissions_url_ko`
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

// `Tables<'institutions'>` from the auto-generated types may not yet be
// present; cast through a permissive shape so the hook keeps compiling
// until `npx supabase gen types typescript` is re-run.
export type Institution = Tables<'institutions'> extends never
  ? {
      id: string;
      name_ko: string;
      name_ko_short: string | null;
      name_en: string | null;
      institution_type: string;
      tier: number | null;
      region_code: string | null;
      city_ko: string | null;
      latitude: number | null;
      longitude: number | null;
      primary_domain: string;
      primary_admissions_url_ko: string | null;
      logo_url: string | null;
      is_partner: boolean;
      is_visible_on_map: boolean;
      display_names: Record<string, unknown> | null;
      kcue_code: string | null;
      wikidata_id: string | null;
      ieqas_status: string | null;
      last_verified_at: string | null;
      source_blob_hash: string | null;
      created_at: string;
      updated_at: string;
    }
  : Tables<'institutions'>;

// Backwards-compatible alias so legacy components keep their imports working.
export type University = Institution;

export function useUniversities() {
  const [universities, setUniversities] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUniversities = async (visibleOnly = false) => {
    let query = supabase
      .from('institutions')
      .select('*')
      .order('tier', { ascending: true, nullsFirst: false })
      .order('name_ko', { ascending: true });

    if (visibleOnly) {
      query = query.eq('is_visible_on_map', true);
    }

    const { data, error } = await query;

    if (!error && data) {
      setUniversities(data as unknown as Institution[]);
    }
    setLoading(false);
  };

  const createUniversity = async (institution: Partial<Institution>) => {
    const { error, data } = await supabase
      .from('institutions')
      .insert(institution as never)
      .select()
      .single();

    if (!error) {
      await fetchUniversities();
    }
    return { error, data: data as unknown as Institution | null };
  };

  const updateUniversity = async (id: string, updates: Partial<Institution>) => {
    const { error, data } = await supabase
      .from('institutions')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (!error) {
      await fetchUniversities();
    }
    return { error, data: data as unknown as Institution | null };
  };

  const deleteUniversity = async (id: string) => {
    const { error } = await supabase
      .from('institutions')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchUniversities();
    }
    return { error };
  };

  const togglePartner = async (id: string, isPartner: boolean) =>
    updateUniversity(id, { is_partner: isPartner });

  const toggleMapVisibility = async (id: string, isVisible: boolean) =>
    updateUniversity(id, { is_visible_on_map: isVisible });

  useEffect(() => {
    fetchUniversities();
  }, []);

  const stats = {
    total: universities.length,
    partners: universities.filter((u) => u.is_partner).length,
    visibleOnMap: universities.filter((u) => u.is_visible_on_map).length,
    withDomain: universities.filter((u) => u.primary_domain && u.primary_domain !== 'unknown.ac.kr').length,
    withGeo: universities.filter((u) => u.latitude !== null && u.longitude !== null).length,
  };

  return {
    universities,
    loading,
    stats,
    fetchUniversities,
    createUniversity,
    updateUniversity,
    deleteUniversity,
    togglePartner,
    toggleMapVisibility,
  };
}
