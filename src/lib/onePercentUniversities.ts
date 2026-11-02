/**
 * Hanguk's "1% universitetlar ro'yxati" — 33 universities (Asrbek's list,
 * 2026-10-21; resent as 3 images 2026-10-29, same 33), by Korean name as
 * institutions.name_ko writes it. All 33 match a catalog row (checked against
 * production on 2026-10-29). The mobile app keeps the same list in
 * hanguk_app/lib/features/catalog/data/catalog_filters.dart
 * (kOnePercentUniversities) — change both together.
 */
export const ONE_PERCENT_UNIVERSITIES: ReadonlySet<string> = new Set([
  '건국대학교',
  '건양대학교',
  '경북대학교',
  '경성대학교',
  '경희대학교',
  '계명대학교',
  '고려대학교',
  '덕성여자대학교',
  '동국대학교',
  '부산대학교',
  '부산외국어대학교',
  '서울시립대학교',
  '서울신학대학교',
  '선문대학교',
  '성결대학교',
  '성균관대학교',
  '성신여자대학교',
  '세종대학교',
  '숙명여자대학교',
  '아주대학교',
  '울산과학기술원',
  '이화여자대학교',
  '인하대학교',
  '제주대학교',
  '중부대학교',
  '중앙대학교',
  '충남대학교',
  '충북대학교',
  '포항공과대학교',
  '한국항공대학교',
  '한성대학교',
  '한양대학교',
  '홍익대학교',
]);

export function isOnePercent(institution: { name_ko: string | null }): boolean {
  return ONE_PERCENT_UNIVERSITIES.has((institution.name_ko ?? '').trim());
}
