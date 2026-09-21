/**
 * Universitetlar katalogi — institutions + yuklangan guideline Excel'lari.
 *
 * Katalog kartasi uchun kerak bo'lgani (shahar, kontrakt oralig'i, TOPIK/IELTS)
 * university_guidelines qatoridayoq hisoblangan holda turadi, shuning uchun
 * ro'yxat ikkita yengil so'rov bilan yig'iladi. Fakultetlar, muddatlar va
 * hujjatlar faqat universitet ochilganda tortiladi.
 *
 * Yangi jadvallar hali `supabase gen types` ga tushmagan — quyidagi `db`
 * yordamchisi orqali tipsiz o'qiladi.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GuidelinePayload } from '@/lib/universityGuidelineExcel';

interface PostgrestLikeResult {
  data: unknown;
  error: { message: string } | null;
}

/** Zanjirlanadigan so'rov: har bir bo'g'in yana o'zini qaytaradi. */
interface UntypedQuery extends PromiseLike<PostgrestLikeResult> {
  select: (columns?: string) => UntypedQuery;
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
  maybeSingle: () => UntypedQuery;
}

/**
 * Generated types'da hali yo'q jadvallar uchun tipsiz kirish.
 *
 * Loyihadagi odatiy `@ts-expect-error` faqat `.from(...)` bo'g'inini qoplaydi:
 * undan keyingi `.eq(...)` / `.order(...)` `never` ustida chaqirilib yana
 * xato beradi. `supabase gen types` qayta ishlatilgach bu yordamchini olib
 * tashlab, oddiy `supabase.from(...)` ga o'tish kerak.
 */
const db = supabase as unknown as { from: (table: string) => UntypedQuery };

export interface CatalogInstitution {
  id: string;
  name_ko: string;
  name_en: string | null;
  name_ko_short: string | null;
  city_ko: string | null;
  region_code: string | null;
  primary_domain: string;
  institution_type: string;
  tier: number | null;
  is_partner: boolean;
  logo_url: string | null;
  primary_admissions_url_ko: string | null;
}

/** Katalog kartasi uchun yetarli bo'lgan guideline xulosasi. */
export interface GuidelineSummary {
  id: string;
  guideline_id: string;
  institution_id: string;
  univ_kod: string;
  univ_nomi_en: string | null;
  univ_nomi_kr: string | null;
  kampus: string | null;
  shahar: string | null;
  qabul_yili: number | null;
  semestr: string | null;
  daraja: string | null;
  english_track: boolean | null;
  korean_track: boolean | null;
  topik_min: number | null;
  ielts_min: number | null;
  toefl_ibt_min: number | null;
  narx_valyuta: string | null;
  kirish_tolovi: number | null;
  kontrakt_min: number | null;
  kontrakt_max: number | null;
  kontrakt_davri: string | null;
  fakultet_soni: number;
  fayl_nomi: string | null;
  updated_at: string;
}

export interface CatalogEntry {
  institution: CatalogInstitution;
  /** Eng yangi qabul birinchi. */
  guidelines: GuidelineSummary[];
  latest: GuidelineSummary | null;
}

const SUMMARY_COLUMNS =
  'id, guideline_id, institution_id, univ_kod, univ_nomi_en, univ_nomi_kr, kampus, shahar,' +
  ' qabul_yili, semestr, daraja, english_track, korean_track, topik_min, ielts_min,' +
  ' toefl_ibt_min, narx_valyuta, kirish_tolovi, kontrakt_min, kontrakt_max, kontrakt_davri,' +
  ' fakultet_soni,' +
  ' fayl_nomi, updated_at';

/** Kuz qabuli bahordan keyin keladi — "eng yangisi" shunga qarab tanlanadi. */
function recency(g: GuidelineSummary): number {
  const year = g.qabul_yili ?? 0;
  const term = g.semestr === 'kuz' ? 1 : 0;
  return year * 2 + term;
}

export const CATALOG_KEY = ['university-catalog'] as const;

export function useUniversityCatalog() {
  const institutionsQuery = useQuery<CatalogInstitution[], Error>({
    queryKey: [...CATALOG_KEY, 'institutions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select(
          'id, name_ko, name_en, name_ko_short, city_ko, region_code, primary_domain,' +
            ' institution_type, tier, is_partner, logo_url, primary_admissions_url_ko',
        )
        .order('name_ko', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CatalogInstitution[];
    },
  });

  const guidelinesQuery = useQuery<GuidelineSummary[], Error>({
    queryKey: [...CATALOG_KEY, 'guidelines'],
    queryFn: async () => {
      const { data, error } = await db.from('university_guidelines').select(SUMMARY_COLUMNS);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as GuidelineSummary[];
    },
  });

  const entries = useMemo<CatalogEntry[]>(() => {
    const institutions = institutionsQuery.data ?? [];
    const byInstitution = new Map<string, GuidelineSummary[]>();

    for (const g of guidelinesQuery.data ?? []) {
      const list = byInstitution.get(g.institution_id);
      if (list) list.push(g);
      else byInstitution.set(g.institution_id, [g]);
    }
    for (const list of byInstitution.values()) {
      list.sort((a, b) => recency(b) - recency(a) || b.updated_at.localeCompare(a.updated_at));
    }

    return institutions.map((institution) => {
      const guidelines = byInstitution.get(institution.id) ?? [];
      return { institution, guidelines, latest: guidelines[0] ?? null };
    });
  }, [institutionsQuery.data, guidelinesQuery.data]);

  return {
    entries,
    loading: institutionsQuery.isLoading || guidelinesQuery.isLoading,
    error: institutionsQuery.error ?? guidelinesQuery.error ?? null,
    refetch: async () => {
      await Promise.all([institutionsQuery.refetch(), guidelinesQuery.refetch()]);
    },
  };
}

// ---------------------------------------------------------------------------
// Bitta guideline'ning to'liq tarkibi
// ---------------------------------------------------------------------------

export interface GuidelineRound {
  id: string;
  bosqich: number;
  etap_raqam: number;
  etap_nomi: string;
  boshlanish_sana: string | null;
  boshlanish_vaqt: string | null;
  tugash_sana: string | null;
  tugash_vaqt: string | null;
  holat: string | null;
  izoh: string | null;
  sahifa: string | null;
}

export interface GuidelineFaculty {
  id: string;
  tartib: number;
  track: string | null;
  kollej_en: string | null;
  kollej_kr: string | null;
  fakultet_en: string | null;
  fakultet_kr: string | null;
  topik_min: number | null;
  ielts_min: number | null;
  toefl_ibt_min: number | null;
  til_izoh: string | null;
  kontrakt_summa: number | null;
  kontrakt_davri: string | null;
  kontrakt_izoh: string | null;
  izoh: string | null;
  sahifa: string | null;
}

export interface GuidelineDoc {
  id: string;
  tartib: number;
  etap_raqam: number | null;
  hujjat_nomi: string | null;
  hujjat_nomi_asl: string | null;
  kimlar_uchun: string | null;
  majburiy: string | null;
  shakli: string | null;
  apostil: string | null;
  notarial_tarjima: string | null;
  muddat: string | null;
  muddat_turi: string | null;
  izoh: string | null;
  sahifa: string | null;
}

/** universitet varag'ining barcha ustunlari + xulosa. */
export type GuidelineFull = GuidelineSummary & Record<string, unknown>;

export interface GuidelineDetail {
  guideline: GuidelineFull;
  rounds: GuidelineRound[];
  faculties: GuidelineFaculty[];
  docs: GuidelineDoc[];
}

export function useGuidelineDetail(guidelineUuid: string | null) {
  return useQuery<GuidelineDetail | null, Error>({
    queryKey: ['university-guideline', guidelineUuid],
    enabled: !!guidelineUuid,
    queryFn: async () => {
      const id = guidelineUuid as string;

      const [guideline, rounds, faculties, docs] = await Promise.all([
        db.from('university_guidelines').select('*').eq('id', id).maybeSingle(),
        db
          .from('university_guideline_rounds')
          .select('*')
          .eq('guideline_uuid', id)
          .order('bosqich')
          .order('etap_raqam'),
        db
          .from('university_guideline_faculties')
          .select('*')
          .eq('guideline_uuid', id)
          .order('tartib'),
        db.from('university_guideline_docs').select('*').eq('guideline_uuid', id).order('tartib'),
      ]);

      const failure = guideline.error ?? rounds.error ?? faculties.error ?? docs.error;
      if (failure) throw new Error(failure.message);
      if (!guideline.data) return null;

      return {
        guideline: guideline.data as unknown as GuidelineFull,
        rounds: (rounds.data ?? []) as unknown as GuidelineRound[],
        faculties: (faculties.data ?? []) as unknown as GuidelineFaculty[],
        docs: (docs.data ?? []) as unknown as GuidelineDoc[],
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Excel import va yangi universitet qo'shish
// ---------------------------------------------------------------------------

export interface ImportOutcome {
  guideline_uuid: string;
  institution_id: string;
  muddatlar: number;
  fakultetlar: number;
  hujjatlar: number;
}

interface ImportArgs {
  payload: GuidelinePayload;
  /** Karta ichidan yuklanganda — o'sha universitet. Bo'sh bo'lsa univ_kod bo'yicha topiladi. */
  institutionId?: string | null;
}

export function useGuidelineImport() {
  const qc = useQueryClient();

  return useMutation<ImportOutcome, Error, ImportArgs>({
    mutationFn: async ({ payload, institutionId }) => {
      const { data, error } = await supabase.rpc(
        // @ts-expect-error - import_university_guideline not in generated types yet
        'import_university_guideline',
        { payload: { ...payload, institution_id: institutionId ?? null } },
      );
      if (error) throw new Error(error.message);
      return data as unknown as ImportOutcome;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
    },
  });
}

export interface NewInstitution {
  name_ko: string;
  name_en: string;
  city_ko: string;
  primary_domain: string;
  institution_type: string;
}

export function useAddInstitution() {
  const qc = useQueryClient();

  return useMutation<CatalogInstitution, Error, NewInstitution>({
    mutationFn: async (fields) => {
      const body = {
        name_ko: fields.name_ko.trim(),
        name_en: fields.name_en.trim() || null,
        city_ko: fields.city_ko.trim() || null,
        primary_domain: fields.primary_domain.trim().toLowerCase(),
        institution_type: fields.institution_type,
      };
      const { data, error } = await supabase
        .from('institutions')
        .insert(body as never)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as CatalogInstitution;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_KEY });
    },
  });
}
