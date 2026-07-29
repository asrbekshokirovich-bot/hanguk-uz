import 'package:flutter/material.dart';

class GrammarIssue {
  final int start;
  final int end;
  final String originalText;
  final String suggestion;

  GrammarIssue({
    required this.start,
    required this.end,
    required this.originalText,
    required this.suggestion,
  });
}

class AiHighlightingTextController extends TextEditingController {
  String? ghostText;

  /// Grammar/style issues from the AI supervisor. Network-bound, debounced,
  /// and rate-capped — they arrive seconds after typing, if at all.
  List<GrammarIssue> issues = [];

  /// Misspellings from the device's own dictionary. Offline and immediate, so
  /// these are what actually mark a word wrong as it is typed.
  ///
  /// Kept separate from [issues] rather than merged into it because the two
  /// arrive on completely different schedules: folding them together would
  /// mean each AI response wiped the spelling marks and each keystroke's
  /// spell check wiped the AI's.
  List<GrammarIssue> spellingIssues = [];

  AiHighlightingTextController({super.text});

  void setGhostText(String? text) {
    if (ghostText != text) {
      ghostText = text;
      notifyListeners();
    }
  }

  void setIssues(List<GrammarIssue> newIssues) {
    issues = newIssues;
    notifyListeners();
  }

  void setSpellingIssues(List<GrammarIssue> newIssues) {
    spellingIssues = newIssues;
    notifyListeners();
  }

  /// Everything to underline, ordered and non-overlapping.
  List<GrammarIssue> get visibleIssues => mergeIssues(issues, spellingIssues);

  /// Combines the two sources into a list [buildTextSpan] can walk safely.
  ///
  /// The renderer emits each issue as a slice of the source text and advances
  /// a cursor. Two issues covering the same characters — the AI flagging a
  /// phrase that contains a word the dictionary also rejects — would make it
  /// emit that overlap twice, so the student would watch letters *duplicate*
  /// inside the text field. Overlaps are therefore resolved here, before any
  /// of them reach the renderer.
  ///
  /// [ai] wins a contested range: it carries a real rewrite suggestion, while
  /// the dictionary only knows the single word is unrecognised.
  static List<GrammarIssue> mergeIssues(
    List<GrammarIssue> ai,
    List<GrammarIssue> spelling,
  ) {
    // Drop anything malformed up front rather than letting a negative or
    // inverted range corrupt the walk below.
    bool sane(GrammarIssue i) => i.start >= 0 && i.end > i.start;

    final merged = <GrammarIssue>[...ai.where(sane)]
      ..sort((a, b) => a.start.compareTo(b.start));

    for (final s in spelling.where(sane)) {
      final clashes = merged.any((a) => s.start < a.end && a.start < s.end);
      if (!clashes) merged.add(s);
    }

    merged.sort((a, b) => a.start.compareTo(b.start));
    return merged;
  }

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    List<InlineSpan> children = [];
    String sourceText = text;

    final sortedIssues = visibleIssues;

    if (sortedIssues.isEmpty) {
      children.add(TextSpan(style: style, text: sourceText));
    } else {
      int currentPos = 0;
      final int limit = sourceText.length;

      for (final issue in sortedIssues) {
        // Every range arriving here describes an older snapshot of the draft.
        // An AI response is seconds stale by the time it lands; a spell check
        // result races the next keystroke; and deleting a paragraph can leave
        // a range pointing past the end of the text entirely. So both bounds
        // are clamped into what actually exists and into what has not already
        // been emitted:
        //
        //   * unclamped, a range starting past the end threw a RangeError out
        //     of `substring` and took the whole text field down with it;
        //   * a range reaching back before `currentPos` re-emitted characters
        //     already written, and the student watched their text duplicate
        //     itself as they typed.
        final int startPos = issue.start.clamp(currentPos, limit);
        final int endPos = issue.end.clamp(startPos, limit);

        if (startPos > currentPos) {
          children.add(
            TextSpan(
              style: style,
              text: sourceText.substring(currentPos, startPos),
            ),
          );
          currentPos = startPos;
        }

        // Add the squiggly underlined issue.
        if (startPos < endPos) {
          children.add(
            TextSpan(
              style: style?.copyWith(
                decoration: TextDecoration.underline,
                decorationStyle: TextDecorationStyle.wavy,
                decorationColor: Colors.redAccent,
              ),
              text: sourceText.substring(startPos, endPos),
            ),
          );
          currentPos = endPos;
        }
      }

      if (currentPos < sourceText.length) {
        children.add(
          TextSpan(style: style, text: sourceText.substring(currentPos)),
        );
      }
    }

    // Audit A2: render ghost text at the cursor instead of always at
    // the end. Falls back to "append at end" when there's no valid
    // selection (e.g. on first build before focus).
    if (ghostText != null && ghostText!.isNotEmpty) {
      final cursor = selection.baseOffset;
      final cursorValid =
          cursor >= 0 && cursor <= sourceText.length && selection.isCollapsed;

      if (cursorValid && cursor < sourceText.length) {
        // Rebuild children, inserting the ghost span at the cursor.
        // We have to rewalk the existing children because each one is
        // a TextSpan whose `text` we cleared into substrings above.
        final rebuilt = <InlineSpan>[];
        var consumed = 0;
        for (final span in children) {
          final t = (span is TextSpan ? span.text : null) ?? '';
          final next = consumed + t.length;
          if (cursor < next && cursor >= consumed) {
            final splitAt = cursor - consumed;
            rebuilt.add(
              TextSpan(
                style: span is TextSpan ? span.style : null,
                text: t.substring(0, splitAt),
              ),
            );
            rebuilt.add(
              TextSpan(
                style: style?.copyWith(
                  color: Colors.white24,
                  fontStyle: FontStyle.italic,
                ),
                text: ghostText,
              ),
            );
            rebuilt.add(
              TextSpan(
                style: span is TextSpan ? span.style : null,
                text: t.substring(splitAt),
              ),
            );
          } else {
            rebuilt.add(span);
          }
          consumed = next;
        }
        return TextSpan(style: style, children: rebuilt);
      }

      children.add(
        TextSpan(
          style: style?.copyWith(
            color: Colors.white24, // Muted color for ghost text
            fontStyle: FontStyle.italic,
          ),
          text: ghostText,
        ),
      );
    }

    return TextSpan(style: style, children: children);
  }
}
