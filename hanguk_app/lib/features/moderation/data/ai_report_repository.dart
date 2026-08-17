import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Which generative surface an [AiReportRepository.report] call is about.
///
/// The values are the `surface` check constraint in
/// `supabase/migrations/20260817090000_ai_content_reports.sql`; adding a case
/// here without adding it there fails the insert.
enum AiSurface {
  chat('chat'),
  interview('interview'),
  studyPlan('study_plan');

  const AiSurface(this.wire);

  /// The string stored in the column.
  final String wire;
}

final aiReportRepositoryProvider = Provider<AiReportRepository>((ref) {
  return AiReportRepository(Supabase.instance.client);
});

/// Stores a student's report of an AI answer.
///
/// The app has two open-ended generative surfaces — the Hanguk AI chat and the
/// AI mock interview — and until 2026-08-17 there was no way to flag a bad
/// answer from either. App Review guideline 1.2 expects an app showing
/// generated content to give the user a way to report objectionable output;
/// more practically, an AI quoting the wrong TOPIK requirement is a consulting
/// problem nobody was finding out about.
///
/// Nothing here hides or deletes anything. Staff triage the rows.
class AiReportRepository {
  const AiReportRepository(this._client);

  final SupabaseClient _client;

  /// Column caps from the migration. Enforced here too so an over-long
  /// message is trimmed into a valid report rather than rejected outright —
  /// a student who hit "report" should not be told their complaint is too
  /// big to file.
  static const int maxReportedText = 8000;
  static const int maxReason = 2000;

  /// Files a report. Returns null on success, or a short reason it failed.
  ///
  /// Never throws: this is called from a sheet the student opened in
  /// frustration, and an exception on top of a bad answer is not the moment
  /// to be pedantic.
  Future<String?> report({
    required AiSurface surface,
    required String reportedText,
    String? reason,
    Map<String, dynamic> context = const {},
  }) async {
    final text = reportedText.trim();
    if (text.isEmpty) return 'empty';

    final trimmedReason = reason?.trim();

    try {
      await _client.from('ai_content_reports').insert({
        // reporter_user_id is left to the column default (auth.uid()) so the
        // client never names the reporter, and RLS checks the same thing.
        'surface': surface.wire,
        'reported_text': text.length > maxReportedText
            ? text.substring(0, maxReportedText)
            : text,
        if (trimmedReason != null && trimmedReason.isNotEmpty)
          'reason': trimmedReason.length > maxReason
              ? trimmedReason.substring(0, maxReason)
              : trimmedReason,
        'context': context,
      });
      return null;
    } on PostgrestException catch (e) {
      return e.message;
    } catch (e) {
      return e.toString();
    }
  }
}
