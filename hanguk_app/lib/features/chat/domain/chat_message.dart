import 'dart:convert';

import 'package:flutter/foundation.dart';

@immutable
class ChatMessage {
  final String? id; // DB row id when persisted
  final String role; // 'user' | 'assistant'
  final String content;

  /// The app's own line (the greeting, "chat cleared") — not an AI answer,
  /// so there is nothing to report on it.
  final bool local;

  const ChatMessage({this.id, required this.role, required this.content, this.local = false});
}

/// The AI's multiple-choice question (hanguk-ai-chat `clarify.ts`): the model
/// answers an ambiguous request with only
/// `{"type":"clarify","question":…,"options":[…]}`, which the app shows as a
/// question with tappable answers instead of raw JSON.
@immutable
class ClarifyReply {
  const ClarifyReply(this.question, this.options);

  final String question;
  final List<String> options;

  /// Null when [content] is not such an envelope (an ordinary answer).
  static ClarifyReply? parse(String content) {
    var t = content.trim();
    if (t.startsWith('```')) {
      t = t.replaceFirst(RegExp(r'^```[a-zA-Z]*\s*'), '').replaceFirst(RegExp(r'\s*```$'), '');
    }
    if (!t.startsWith('{')) return null;
    try {
      final j = jsonDecode(t);
      if (j is! Map || j['type'] != 'clarify') return null;
      final q = j['question'];
      final o = j['options'];
      if (q is! String || q.trim().isEmpty) return null;
      final options = [
        if (o is List)
          for (final x in o)
            if (x is String && x.trim().isNotEmpty) x.trim(),
      ];
      return ClarifyReply(q.trim(), options);
    } catch (_) {
      return null;
    }
  }

  /// Still streaming in: starts like the envelope but is not whole yet. The
  /// bubble waits rather than flashing half a JSON object.
  static bool isPartial(String content) {
    final t = content.trimLeft();
    return (t.startsWith('{') || t.startsWith('```json')) && parse(content) == null;
  }
}
