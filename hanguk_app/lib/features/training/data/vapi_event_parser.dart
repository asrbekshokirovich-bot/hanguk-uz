/// Pure-Dart parsers for Vapi WebRTC event payloads.
///
/// Lifted out of `interview_active_view.dart` so the logic is testable
/// without a Flutter widget tree. The active view's private
/// `_isEndCallTool` now delegates here.
///
/// Audit B7 / tests target — Vapi has shipped at least four event
/// shapes for the `endCall` tool invocation. The parser matches all of
/// them; the test suite asserts each shape.
library;

/// Returns true when a Vapi `'message'` event with `type ==
/// 'tool-calls'` or `'function-call'` represents the AI invoking the
/// built-in `endCall` tool.
bool isEndCallTool(Map<dynamic, dynamic> eventValue) {
  final candidates = <dynamic>[
    eventValue['toolCalls'],
    eventValue['functionCall'],
    eventValue['tool_calls'],
    eventValue['function_call'],
  ];
  for (final c in candidates) {
    if (c == null) continue;
    if (c is List) {
      for (final item in c) {
        if (_extractName(item) == 'endCall') return true;
      }
    } else {
      if (_extractName(c) == 'endCall') return true;
    }
  }
  return false;
}

String? _extractName(dynamic node) {
  if (node is Map) {
    final fn = node['function'];
    if (fn is Map) {
      final n = fn['name'];
      if (n is String) return n;
    }
    final n = node['name'];
    if (n is String) return n;
  }
  return null;
}
