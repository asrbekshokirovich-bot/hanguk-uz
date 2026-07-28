/// Edge-Function contract documentation + Dart parsers for the
/// training-related Supabase Edge Functions.
///
/// The Edge Function source itself lives in the Lovable function repo
/// (out of this codebase). These types document what the Dart side
/// expects and provide a safe `parse` boundary so a shape change in the
/// function fails loudly with a typed error instead of silently nulling
/// fields downstream.
///
/// Audit B1/B4 (docs/audits/training_audit_2026-05-10.md).
library;

import 'dart:convert';

/// Wire format for the `study-plan-trainer` Edge Function, `action:
/// 'draft_supervise'`:
///
/// ```jsonc
/// {
///   "response": "{ \"ghostText\": \"...\", \"issues\": [...] }",
///   // OR error path:
///   "error": "<message>"
/// }
/// ```
class SuperviseResult {
  const SuperviseResult({required this.ghostText, required this.issues});

  /// Inline completion shown as italic gray text after the cursor.
  final String ghostText;

  /// Grammar / style issues flagged in the current draft.
  final List<SuperviseIssue> issues;

  static SuperviseResult? parse(Object? envelope) {
    if (envelope is! Map) return null;
    if (envelope['error'] != null) return null;
    final body = envelope['response'];
    if (body is! String) return null;
    final trimmed = body.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    try {
      final decoded = jsonDecode(trimmed);
      if (decoded is! Map<String, dynamic>) return null;
      final ghost = decoded['ghostText'] as String? ?? '';
      final raw = (decoded['issues'] as List?) ?? const [];
      final issues = raw
          .whereType<Map>()
          .map(SuperviseIssue._fromMap)
          .whereType<SuperviseIssue>()
          .toList(growable: false);
      return SuperviseResult(ghostText: ghost, issues: issues);
    } on FormatException {
      return null;
    }
  }
}

class SuperviseIssue {
  const SuperviseIssue({required this.originalText, required this.suggestion});

  final String originalText;
  final String suggestion;

  static SuperviseIssue? _fromMap(Map<dynamic, dynamic> m) {
    final original = m['originalText']?.toString() ?? '';
    final suggestion = m['suggestion']?.toString() ?? '';
    if (original.isEmpty) return null;
    return SuperviseIssue(originalText: original, suggestion: suggestion);
  }
}

/// Wire format for the `study-plan-trainer` Edge Function, `action:
/// 'analyze'`. The function returns either a plain prose narrative
/// (legacy) or a structured JSON envelope (current shape). Both are
/// accepted; structured fields are extracted when present.
///
/// ```jsonc
/// {
///   "response": "{
///      \"overall_score\": 78,        // 0–100 (or 0–10 legacy; UI normalizes)
///      \"grammar_errors\": [...],    // jsonb list
///      \"content_feedback\": \"...\",
///      \"strengths\": [\"...\"],     // jsonb list
///      \"improvements\": [\"...\"],
///      \"narrative\": \"...\"        // optional human-readable summary
///   }"
/// }
/// ```
class AnalyzeResult {
  const AnalyzeResult({
    required this.aiResponseText,
    this.overallScore,
    this.grammarErrors,
    this.contentFeedback,
    this.strengths,
    this.improvements,
    this.narrative,
  });

  /// The raw `response` field, preserved for backwards compat.
  final String aiResponseText;
  final num? overallScore;
  final List<dynamic>? grammarErrors;
  final String? contentFeedback;
  final List<dynamic>? strengths;
  final List<dynamic>? improvements;
  final String? narrative;

  static AnalyzeResult parse(Object? envelope) {
    final empty = AnalyzeResult(aiResponseText: '');
    if (envelope is! Map) return empty;
    if (envelope['error'] != null) return empty;
    final body = envelope['response'];
    if (body is! String) return empty;
    final trimmed = body.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      return AnalyzeResult(aiResponseText: body);
    }
    try {
      final m = jsonDecode(trimmed);
      if (m is! Map<String, dynamic>) {
        return AnalyzeResult(aiResponseText: body);
      }
      return AnalyzeResult(
        aiResponseText: body,
        overallScore: m['overall_score'] is num
            ? m['overall_score'] as num
            : null,
        grammarErrors: m['grammar_errors'] is List
            ? m['grammar_errors'] as List
            : null,
        contentFeedback: m['content_feedback'] as String?,
        strengths: m['strengths'] is List ? m['strengths'] as List : null,
        improvements: m['improvements'] is List
            ? m['improvements'] as List
            : null,
        narrative: m['narrative'] as String?,
      );
    } on FormatException {
      return AnalyzeResult(aiResponseText: body);
    }
  }
}

/// Wire format for the `interview-feedback` Edge Function:
///
/// ```jsonc
/// {
///   "feedback": {
///     "overall_score": 8,            // 1–10 per DB CHECK constraint
///     "communication_score": 7,
///     "confidence_score": 9,
///     "content_score": 8,
///     "language_score": 7,
///     "strengths": [...],            // jsonb list
///     "improvements": [...],
///     "message_scores": [            // per-utterance
///       { "score": 8, "ideal_hint": "..." }
///     ],
///     "detailed_feedback": "..."
///   }
/// }
/// ```
///
/// The Edge Function also UPSERTs to `public.interview_feedback`
/// (UNIQUE on `session_id`). The Dart side has a defensive backup INSERT
/// (audit F15) in case the function returns success without persisting.
class InterviewFeedback {
  const InterviewFeedback({
    required this.raw,
    this.overallScore,
    this.communicationScore,
    this.confidenceScore,
    this.contentScore,
    this.languageScore,
    this.strengths,
    this.improvements,
    this.messageScores,
    this.detailedFeedback,
  });

  final Map<String, dynamic> raw;
  final num? overallScore;
  final num? communicationScore;
  final num? confidenceScore;
  final num? contentScore;
  final num? languageScore;
  final List<dynamic>? strengths;
  final List<dynamic>? improvements;
  final List<dynamic>? messageScores;
  final String? detailedFeedback;

  static InterviewFeedback? parse(Object? envelope) {
    if (envelope is! Map) return null;
    final fb = envelope['feedback'];
    if (fb is! Map) return null;
    final raw = Map<String, dynamic>.from(fb);
    return InterviewFeedback(
      raw: raw,
      overallScore: raw['overall_score'] is num
          ? raw['overall_score'] as num
          : null,
      communicationScore: raw['communication_score'] is num
          ? raw['communication_score'] as num
          : null,
      confidenceScore: raw['confidence_score'] is num
          ? raw['confidence_score'] as num
          : null,
      contentScore: raw['content_score'] is num
          ? raw['content_score'] as num
          : null,
      languageScore: raw['language_score'] is num
          ? raw['language_score'] as num
          : null,
      strengths: raw['strengths'] is List ? raw['strengths'] as List : null,
      improvements: raw['improvements'] is List
          ? raw['improvements'] as List
          : null,
      messageScores: raw['message_scores'] is List
          ? raw['message_scores'] as List
          : null,
      detailedFeedback: raw['detailed_feedback'] as String?,
    );
  }
}
