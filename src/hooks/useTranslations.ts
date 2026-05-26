import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Reads precomputed translations from `public.translations` (uni_db). Korean
 * source fields (e.g. institutions.name_ko, announcements.title_ko) are
 * translated server-side into en/uz (also mn/vi); we fetch en + uz.
 *
 * `public.translations` / `public.guideline_documents` are not in the generated
 * Supabase types, so queries go through a minimal typed builder (`looseFrom`)
 * rather than the generated, table-aware client.
 */

export const TRANSLATION_LANGS = ['en', 'uz'] as const;

interface PgResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface LooseBuilder<T> extends PromiseLike<PgResult<T>> {
  select(cols: string): LooseBuilder<T>;
  eq(col: string, val: string): LooseBuilder<T>;
  in(col: string, vals: readonly string[]): LooseBuilder<T>;
  maybeSingle(): PromiseLike<{ data: T | null; error: { message: string } | null }>;
}
function looseFrom<T>(table: string): LooseBuilder<T> {
  return (supabase as unknown as { from: (t: string) => unknown }).from(table) as LooseBuilder<T>;
}

interface TranslationRow {
  entity_id: string;
  field_name: string;
  lang: string;
  text_value: string | null;
}

/** Key a flat lookup map by entity/field/lang. Pure — unit tested. */
export function buildTranslationMap(rows: TranslationRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    const v = (r.text_value ?? '').trim();
    if (v) map.set(`${r.entity_id}|${r.field_name}|${r.lang}`, v);
  }
  return map;
}

export interface TranslationLookup {
  /** Returns the stored translation for (entity, field, lang), or null. */
  get: (entityId: string | null | undefined, fieldName: string, lang: string) => string | null;
  isLoading: boolean;
}

/**
 * Batch-fetch translations for a set of entity ids + fields of one entity type.
 * Designed to be called once per list (one query for many rows).
 */
export function useTranslations(
  entityType: string,
  entityIds: Array<string | null | undefined>,
  fieldNames: string[],
): TranslationLookup {
  const ids = Array.from(new Set(entityIds.filter((x): x is string => !!x))).sort();
  const fields = Array.from(new Set(fieldNames.filter(Boolean))).sort();
  const enabled = ids.length > 0 && fields.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ['translations', entityType, ids, fields],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await looseFrom<TranslationRow>('translations')
        .select('entity_id, field_name, lang, text_value')
        .eq('entity_type', entityType)
        .in('entity_id', ids)
        .in('field_name', fields)
        .in('lang', TRANSLATION_LANGS);
      if (error) throw new Error(error.message);
      return buildTranslationMap(data ?? []);
    },
  });

  return {
    get: (entityId, fieldName, lang) =>
      entityId ? (data?.get(`${entityId}|${fieldName}|${lang}`) ?? null) : null,
    isLoading: enabled && isLoading,
  };
}

/**
 * Review-queue convenience: the dashboard row exposes the guideline document but
 * not the institution id, so resolve it (one cached lookup) and then read the
 * institution-name translations. Returns en/uz (or null when absent).
 */
export function useInstitutionNameTranslation(guidelineDocumentId: string | null | undefined) {
  const { data: institutionId } = useQuery({
    queryKey: ['institution-id-for-doc', guidelineDocumentId],
    enabled: !!guidelineDocumentId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await looseFrom<{ institution_id: string | null }>('guideline_documents')
        .select('institution_id')
        .eq('id', guidelineDocumentId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.institution_id ?? null;
    },
  });
  const tr = useTranslations('institutions', [institutionId], ['name_ko']);
  return {
    uz: institutionId ? tr.get(institutionId, 'name_ko', 'uz') : null,
    en: institutionId ? tr.get(institutionId, 'name_ko', 'en') : null,
  };
}

// ---------------------------------------------------------------------------
// Display resolution (pure — unit tested)
// ---------------------------------------------------------------------------

export interface LocalizeInput {
  /** App language: 'uz' | 'ko' | 'ru' | 'en' (region suffixes are ignored). */
  lang: string;
  /** Original Korean source value. */
  ko?: string | null;
  /** Inline English value if the row already carries one (e.g. name_en). */
  en?: string | null;
  /** Resolver into the translations table for this field, by language. */
  translation?: (lang: string) => string | null;
}

export interface Localized {
  text: string;
  /** The language actually displayed. */
  lang: string;
  /** True when the requested language was unavailable and we fell back. */
  fallback: boolean;
}

/**
 * Resolve the best display string for a Korean field in the requested language:
 *   requested translation → inline English → English translation → Korean.
 * Never returns an error/blank when any value exists; flags `fallback` so the
 * caller can show a subtle "(not translated yet)" hint.
 */
export function localizeText({ lang, ko, en, translation }: LocalizeInput): Localized {
  const want = (lang || '').slice(0, 2).toLowerCase();
  const KO = (ko ?? '').trim();
  const EN = (en ?? '').trim();
  const tr = (l: string) => (translation?.(l) ?? '').trim();

  if (want === 'ko') {
    if (KO) return { text: KO, lang: 'ko', fallback: false };
    if (EN) return { text: EN, lang: 'en', fallback: true };
    return { text: '', lang: 'ko', fallback: false };
  }

  const reqTr = tr(want);
  if (reqTr) return { text: reqTr, lang: want, fallback: false };
  if (want === 'en' && EN) return { text: EN, lang: 'en', fallback: false };

  // Fallbacks for a requested language we don't have.
  const enTr = tr('en');
  if (enTr) return { text: enTr, lang: 'en', fallback: want !== 'en' };
  if (EN) return { text: EN, lang: 'en', fallback: want !== 'en' };
  if (KO) return { text: KO, lang: 'ko', fallback: true };
  return { text: '', lang: want, fallback: false };
}
