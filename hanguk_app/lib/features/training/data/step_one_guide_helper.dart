/// Normalizes the `selectedTrack` string used by Study Plan / Personal
/// Statement Step 1 guide.
///
/// Audit F5: track values used to be `'english'` / `'korean'` (Study Plan)
/// vs `'en'` / `'ko'` (Interview). We unified on `'en'` / `'ko'` going
/// forward, but legacy rows still carry the long form. This helper
/// returns one of three normalized identifiers — `'english'`, `'korean'`,
/// or `'uzbek'` — that the guide-content branches key off.
///
/// Pure Dart so the locale routing is unit-testable.
library step_one_guide_helper;

/// Normalize a track value to one of: `'english'`, `'korean'`, `'uzbek'`.
/// Anything we don't recognize falls back to `'uzbek'` — the largest cohort.
String normalizeTrack(String? track) {
  switch (track) {
    case 'ko':
    case 'korean':
      return 'korean';
    case 'en':
    case 'english':
      return 'english';
    default:
      return 'uzbek';
  }
}
