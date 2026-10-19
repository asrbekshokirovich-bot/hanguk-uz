import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../applications/data/journey_repository.dart';
import '../../../applications/domain/application_journey.dart';
import '../../../training/presentation/study_plan_builder_screen.dart';

/// Shared by the Ariza list (design 7b) and a university's page (8a): the
/// words each state is shown with, the tile, and "Imzolash".

String journeyDay(BuildContext context, DateTime d) =>
    DateFormat.MMMd(AppLocalizations.of(context)!.localeName).format(d);

/// "fevral": Uzbek months are written small inside a sentence, as the
/// design does; intl capitalises them.
String journeyMonth(BuildContext context, DateTime d) {
  final locale = AppLocalizations.of(context)!.localeName;
  final m = DateFormat.MMMM(locale).format(d);
  return locale.startsWith('uz') ? m.toLowerCase() : m;
}

String journeyTime(BuildContext context, DateTime d) =>
    DateFormat.Hm(AppLocalizations.of(context)!.localeName).format(d);

/// A stamp's date line: "24-okt", "28-okt gacha" or "noyabr".
String? stampDate(BuildContext context, StampView v) {
  final d = v.date;
  if (d == null) return null;
  return switch (v.dateKind) {
    StampDateKind.day => journeyDay(context, d),
    StampDateKind.until => AppLocalizations.of(context)!.ajUntil(journeyDay(context, d)),
    StampDateKind.month => journeyMonth(context, d),
  };
}

String stampLabel(AppLocalizations l, JourneyStamp s, JourneyUniversity u) => switch (s) {
  JourneyStamp.contract => l.ajStampContract,
  JourneyStamp.documents => l.ajStampDocuments,
  JourneyStamp.translation => l.ajStampTranslation,
  JourneyStamp.submission => l.ajStampSubmission,
  JourneyStamp.interview => l.ajStampInterview,
  JourneyStamp.admission => l.ajStampAdmission,
  JourneyStamp.visa => l.ajStampVisa(u.visaType),
  JourneyStamp.flight => l.ajStampFlight,
};

String phaseLabel(AppLocalizations l, JourneyPhase p) => switch (p) {
  JourneyPhase.documents => l.ajPhaseDocuments,
  JourneyPhase.submission => l.ajPhaseSubmission,
  JourneyPhase.interview => l.ajPhaseInterview,
  JourneyPhase.admission => l.ajPhaseAdmission,
  JourneyPhase.visa => l.ajPhaseVisa,
};

/// Where the university stands in a few words: under the name on the card,
/// and HOLAT on the boarding pass ([ticket]), which also names what is
/// awaited from the student and the interview day.
String journeyState(BuildContext context, UniversityProgress p, DateTime now, {bool ticket = false}) {
  final l = AppLocalizations.of(context)!;
  final u = p.university;
  if (ticket && p.needsStudyPlan) return l.ajStatusSignPending;
  if (p.rejected) return l.ajChipRejected;
  if (p.finished) return l.ajChipDone;
  return switch (p.current) {
    JourneyStamp.contract || JourneyStamp.documents || JourneyStamp.translation || null => l.ajStateDocuments,
    JourneyStamp.submission => u.submitted ? l.ajStateReviewing : l.ajStatePreparing,
    JourneyStamp.interview =>
      ticket && p.upcomingInterview(now) ? l.ajChipInterview(journeyDay(context, u.interviewAt!)) : l.ajStateInterview,
    JourneyStamp.admission => l.ajStateResult,
    JourneyStamp.visa => u.accepted && u.finalAt == null ? l.ajChipAccepted : l.ajStateVisa,
    JourneyStamp.flight => l.ajStateFlight,
  };
}

/// The line at the foot of a card. [strong] lines are something happening
/// or wanted; the others are waiting.
({String text, bool strong}) journeyLine(BuildContext context, UniversityProgress p, DateTime now) {
  final line = _journeyLine(context, p, now);
  // "28-okt" stays on one line: a word joiner after the hyphen.
  return (text: line.text.replaceAll('-', '-\u2060'), strong: line.strong);
}

({String text, bool strong}) _journeyLine(BuildContext context, UniversityProgress p, DateTime now) {
  final l = AppLocalizations.of(context)!;
  final u = p.university;
  if (p.needsStudyPlan) {
    final d = u.onlineDeadline;
    return (text: d == null ? l.ajLineStudyPlanNoDate : l.ajLineStudyPlan(journeyDay(context, d)), strong: true);
  }
  if (p.rejected) return (text: l.ajLineRejected, strong: false);
  if (p.finished) return (text: l.ajChipDone, strong: true);
  switch (p.current) {
    case JourneyStamp.contract || JourneyStamp.documents || JourneyStamp.translation || null:
      return (text: l.ajLineDocuments, strong: false);
    case JourneyStamp.submission:
      if (u.submitted) {
        final r = u.resultRound;
        return (text: r == null ? l.ajLineReviewingNoDate : l.ajLineReviewing(journeyDay(context, r)), strong: false);
      }
      final d = u.onlineDeadline;
      return (text: d == null ? l.ajStatePreparing : l.ajLineSubmitBy(journeyDay(context, d)), strong: false);
    case JourneyStamp.interview:
      if (p.upcomingInterview(now)) {
        final at = u.interviewAt!;
        return (text: l.ajLineInterview(journeyDay(context, at), journeyTime(context, at)), strong: true);
      }
      return (text: l.ajStateInterview, strong: false);
    case JourneyStamp.admission:
      if (u.interviewAt != null) return (text: l.ajLineInterviewDone, strong: false);
      final r = u.resultRound;
      return (text: r == null ? l.ajLineReviewingNoDate : l.ajLineReviewing(journeyDay(context, r)), strong: false);
    case JourneyStamp.visa:
      if (u.accepted && u.finalAt == null) return (text: l.ajLineAccepted, strong: true);
      return switch (u.visaStatus) {
        'waiting' => (text: l.ajLineVisaWaiting, strong: false),
        _ => (text: l.ajLineVisaProcess, strong: true),
      };
    case JourneyStamp.flight:
      return (text: l.ajLineVisaReceived, strong: true);
  }
}

enum JourneyChipKind { action, interview, waiting, accepted, rejected, done }

({String text, JourneyChipKind kind}) journeyChip(BuildContext context, UniversityProgress p, DateTime now) {
  final l = AppLocalizations.of(context)!;
  if (p.needsStudyPlan) return (text: l.ajChipActionNeeded, kind: JourneyChipKind.action);
  if (p.rejected) return (text: l.ajChipRejected, kind: JourneyChipKind.rejected);
  if (p.finished) return (text: l.ajChipDone, kind: JourneyChipKind.done);
  if (p.upcomingInterview(now)) {
    return (text: l.ajChipInterview(journeyDay(context, p.university.interviewAt!)), kind: JourneyChipKind.interview);
  }
  if (p.university.accepted) return (text: l.ajChipAccepted, kind: JourneyChipKind.accepted);
  return (text: l.ajChipWaiting, kind: JourneyChipKind.waiting);
}

class JourneyChip extends StatelessWidget {
  const JourneyChip({super.key, required this.text, required this.kind});

  final String text;
  final JourneyChipKind kind;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (kind) {
      JourneyChipKind.action => (FdColors.lime, FdColors.onLime, FdColors.ink),
      JourneyChipKind.interview => (FdColors.tint, FdColors.blue, null),
      JourneyChipKind.accepted || JourneyChipKind.done => (const Color(0xFFDCFCE7), FdColors.good, null),
      JourneyChipKind.rejected => (const Color(0xFFFEE2E2), FdColors.bad, null),
      JourneyChipKind.waiting => (const Color(0xFFEDF0F5), FdColors.muted, null),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: border == null ? null : Border.all(color: border, width: 1.5),
      ),
      child: Text(text, maxLines: 1, style: fdText(11, FontWeight.w800, fg, height: 1.1)),
    );
  }
}

/// The blue square with the university's hangul ("계명").
class UniversityTile extends StatelessWidget {
  const UniversityTile({super.key, required this.text, this.size = 44});

  final String text;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: FdColors.blue,
      borderRadius: BorderRadius.circular(size * 0.24),
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [FdColors.blue, FdColors.blueDeep],
      ),
    ),
    child: Text(text, maxLines: 1, style: fdText(size * 0.34, FontWeight.w800, Colors.white, height: 1)),
  );
}

/// "Imzolash": the Study Plan builder. The journey is read again on the way
/// back, so a finished plan clears "Sizdan kerak" at once.
Future<void> openStudyPlan(BuildContext context, WidgetRef ref) async {
  await Navigator.of(context).push(
    MaterialPageRoute<void>(
      settings: const RouteSettings(name: 'study_plan'),
      builder: (_) => const StudyPlanBuilderScreen(),
    ),
  );
  ref.invalidate(applicationJourneyProvider);
}
