/// Pure-Dart resolver for grammar issue positions.
///
/// Audit A1: the AI returns a list of `{ originalText, suggestion }`
/// objects without offsets. We map each `originalText` to its first
/// *un-claimed* occurrence in the draft, marking the matched range as
/// consumed so subsequent issues don't all snap to the same word.
///
/// Lifted out of `advanced_drafting_workspace.dart` so the matching
/// logic is unit-testable.
library;

class ResolvedIssue {
  const ResolvedIssue({
    required this.start,
    required this.end,
    required this.originalText,
    required this.suggestion,
  });

  final int start;
  final int end;
  final String originalText;
  final String suggestion;
}

/// Find the first occurrence of [needleLower] in [haystackLower] that
/// doesn't overlap any range already marked `true` in [consumed].
/// Returns the start index, or -1 if no such occurrence exists.
int findFirstUnconsumed({
  required String haystackLower,
  required String needleLower,
  required List<bool> consumed,
  int from = 0,
}) {
  var i = haystackLower.indexOf(needleLower, from);
  while (i != -1) {
    final endExclusive = i + needleLower.length;
    if (endExclusive <= consumed.length) {
      var clean = true;
      for (var k = i; k < endExclusive; k++) {
        if (consumed[k]) {
          clean = false;
          break;
        }
      }
      if (clean) return i;
    }
    i = haystackLower.indexOf(needleLower, i + 1);
  }
  return -1;
}

/// Resolve raw `{originalText, suggestion}` issue payloads against the
/// current draft text. Returns one [ResolvedIssue] per matched issue,
/// preserving the original casing of the matched substring.
///
/// Audit A8: ranges are validated to not split a UTF-16 surrogate pair
/// (emoji etc.). A match that would split a pair is dropped.
/// Audit A9: each match is recorded in a "consumed" mask so two issues
/// pointing at the same word can't produce overlapping spans.
List<ResolvedIssue> resolveIssues({
  required String draftText,
  required Iterable<Map<dynamic, dynamic>> rawIssues,
}) {
  final lowerText = draftText.toLowerCase();
  final consumed = List<bool>.filled(draftText.length, false);
  final results = <ResolvedIssue>[];
  for (final raw in rawIssues) {
    final original = raw['originalText']?.toString() ?? '';
    final suggestion = raw['suggestion']?.toString() ?? '';
    if (original.isEmpty) continue;
    final needle = original.toLowerCase();
    final index = findFirstUnconsumed(
      haystackLower: lowerText,
      needleLower: needle,
      consumed: consumed,
    );
    if (index == -1) continue;
    final endExclusive = index + original.length;

    // Audit A8: bail if the start or end would split a surrogate pair.
    if (_splitsSurrogate(draftText, index) ||
        _splitsSurrogate(draftText, endExclusive)) {
      continue;
    }

    results.add(
      ResolvedIssue(
        start: index,
        end: endExclusive,
        originalText: draftText.substring(index, endExclusive),
        suggestion: suggestion,
      ),
    );
    for (var k = index; k < endExclusive; k++) {
      consumed[k] = true;
    }
  }
  return results;
}

bool _splitsSurrogate(String text, int index) {
  if (index <= 0 || index >= text.length) return false;
  final prev = text.codeUnitAt(index - 1);
  // High surrogate range 0xD800–0xDBFF
  return prev >= 0xD800 && prev <= 0xDBFF;
}
