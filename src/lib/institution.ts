/**
 * Display helpers for `public.institutions` rows.
 *
 * The legacy `universities` table had name_uz/name_ru/city_uz/... columns and
 * components picked `name_${language}`. institutions only stores Korean and
 * English names and a Korean city, so that lookup returned undefined for the
 * default uz (and ru) interface and the UI showed "Unknown University".
 */
import type { Tables } from '@/integrations/supabase/types';

type Named = Pick<Tables<'institutions'>, 'name_en' | 'name_ko'>;

/** Korean UI: the Korean name first. Every other language: English first. */
export function institutionName(
  u: Partial<Named> | null | undefined,
  lang?: string | null,
): string {
  if (!u) return '';
  const en = u.name_en?.trim() || '';
  const ko = u.name_ko?.trim() || '';
  return (lang ?? '').toLowerCase().startsWith('ko') ? ko || en : en || ko;
}

/** Only a Korean city name is stored. */
export function institutionCity(
  u: Partial<Pick<Tables<'institutions'>, 'city_ko'>> | null | undefined,
): string {
  return u?.city_ko ?? '';
}
