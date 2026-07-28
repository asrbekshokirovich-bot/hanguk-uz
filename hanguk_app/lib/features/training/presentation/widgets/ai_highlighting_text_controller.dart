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
  List<GrammarIssue> issues = [];

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

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    List<InlineSpan> children = [];
    String sourceText = text;

    if (issues.isEmpty) {
      children.add(TextSpan(style: style, text: sourceText));
    } else {
      // Sort issues by start index
      List<GrammarIssue> sortedIssues = List.from(issues)
        ..sort((a, b) => a.start.compareTo(b.start));
      int currentPos = 0;

      for (final issue in sortedIssues) {
        if (issue.start > currentPos) {
          children.add(
            TextSpan(
              style: style,
              text: sourceText.substring(currentPos, issue.start),
            ),
          );
        }

        // Add the squiggly underlined issue
        int endPos = issue.end > sourceText.length
            ? sourceText.length
            : issue.end;
        if (issue.start < endPos) {
          children.add(
            TextSpan(
              style: style?.copyWith(
                decoration: TextDecoration.underline,
                decorationStyle: TextDecorationStyle.wavy,
                decorationColor: Colors.redAccent,
              ),
              text: sourceText.substring(issue.start, endPos),
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
