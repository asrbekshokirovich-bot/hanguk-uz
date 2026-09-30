import '../../../../l10n/app_localizations.dart';

/// The words for a training session's stored status code
/// (`study_plan_sessions.status` / `interview_sessions.status`), in the app
/// language. The code itself (`in_progress`, `active`, …) is never shown.
String trainingStatusLabel(AppLocalizations l, String status) {
  switch (status) {
    case 'completed':
      return l.trainingStatusCompleted;
    case 'abandoned':
      return l.trainingStatusAbandoned;
    default:
      // 'in_progress' (study plans), 'active' (interviews), or anything not
      // finished yet.
      return l.trainingStatusInProgress;
  }
}
