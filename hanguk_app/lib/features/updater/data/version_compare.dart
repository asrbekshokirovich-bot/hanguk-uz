/// Pure-Dart semver-with-build comparator for app versions.
///
/// Format expected: `<major>.<minor>.<patch>[+<build>]`, e.g. `1.0.18+2031`.
///
/// Comparison rules:
///   1. Compare major, then minor, then patch numerically.
///   2. If all three equal, compare the build number numerically.
///   3. A missing build number is treated as 0 — so `1.0.18` < `1.0.18+1`.
///   4. Non-numeric components compare as 0 (defensive — never throw).
///
/// This replaces the inline parser in v1's `updater_repository.dart` which had
/// edge-case bugs (e.g. `1.0.10` vs `1.0.9` could compare as 9 < 10 lex but
/// the old code only compared digits one segment at a time).
library;

/// Returns:
///   <0 if [a] < [b]
///   0 if [a] == [b]
///   >0 if [a] > [b]
int compareVersions(String a, String b) {
  if (a == b) return 0;
  final pa = _parseVersion(a);
  final pb = _parseVersion(b);
  for (var i = 0; i < 4; i++) {
    final cmp = pa[i].compareTo(pb[i]);
    if (cmp != 0) return cmp;
  }
  return 0;
}

/// True iff [candidate] is strictly newer than [current].
bool isNewerVersion({required String current, required String candidate}) {
  return compareVersions(candidate, current) > 0;
}

/// True iff [candidate] is strictly older than [floor].
/// Used for `min_supported_version` checks: if local < floor, force update.
bool isBelowFloor({required String floor, required String candidate}) {
  return compareVersions(candidate, floor) < 0;
}

/// Returns `[major, minor, patch, build]` as ints. Missing or non-numeric
/// segments become 0 (defensive — never throws on user-supplied strings).
List<int> _parseVersion(String s) {
  // Split on `+` first so `1.0.18+2031` becomes [`1.0.18`, `2031`].
  final plusIdx = s.indexOf('+');
  final basePart = plusIdx >= 0 ? s.substring(0, plusIdx) : s;
  final buildPart = plusIdx >= 0 ? s.substring(plusIdx + 1) : '0';

  final segments = basePart.split('.');
  final major = _parseInt(segments.isNotEmpty ? segments[0] : '0');
  final minor = _parseInt(segments.length > 1 ? segments[1] : '0');
  final patch = _parseInt(segments.length > 2 ? segments[2] : '0');
  final build = _parseInt(buildPart);
  return [major, minor, patch, build];
}

int _parseInt(String s) {
  // Accept anything `int.tryParse` can parse; everything else (e.g. semver
  // pre-release suffixes like `1.0.0-beta`) is treated as 0.
  return int.tryParse(s.trim()) ?? 0;
}
