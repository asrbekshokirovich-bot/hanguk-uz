import '../../../l10n/app_localizations.dart';

/// `cycle_dates.event_type` → localized label. Same mapping as
/// VerifiedDeadlineCard, plus the two calendar-tail events the detail screen
/// surfaces.
///
/// Extracted from `institution_detail_screen.dart` so the compare grid and
/// the map detail sheet name a deadline the same way the detail screen does
/// — three copies of this switch would drift the first time the DB grows an
/// event type.
String eventLabel(AppLocalizations l, String eventType) => switch (eventType) {
  'apply_open' => l.eventApplyOpen,
  'apply_close' => l.eventApplyClose,
  'document_submission_deadline' => l.eventDocumentsDue,
  'first_stage_results' => l.eventFirstStageResults,
  'interview' => l.eventInterviewLabel,
  'practical_exam' => l.eventPracticalExam,
  'final_results' => l.eventFinalResults,
  'additional_admit' => l.eventAdditionalAdmit,
  'registration_open' => l.eventRegistrationOpen,
  'registration_close' => l.eventRegistrationClose,
  'orientation' => l.eventOrientation,
  'semester_start' => l.eventSemesterStart,
  // An event type the DB writes that this app does not model yet — the raw
  // value is the honest thing to show.
  _ => eventType.replaceAll('_', ' '),
};

/// `cycle_track` / `applicant_category` → localized label, raw value as
/// fallback. Same mapping as VerifiedDeadlineCard.
String? cycleLabel(AppLocalizations l, String? track) {
  if (track == null) return null;
  return switch (track) {
    'foreign' => l.cycleForeign,
    'overseas_korean_full' => l.cycleOverseasKoreanFull,
    'overseas_korean_partial' => l.cycleOverseasKoreanPartial,
    'susi' => l.cycleSusi,
    'jeongsi' => l.cycleJeongsi,
    'transfer' => l.cycleTransfer,
    'grad_general' => l.cycleGradGeneral,
    'grad_foreign' => l.cycleGradForeign,
    _ => track,
  };
}
