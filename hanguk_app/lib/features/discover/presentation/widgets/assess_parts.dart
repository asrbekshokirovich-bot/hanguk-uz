import 'package:flutter/material.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../core/analytics/tracked.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../assessment/domain/assessment.dart';

/// The parts the assessment pages share: the university's ("Baholash") and
/// "Vizam chiqadimi?".

/// Records `question_answer` for each answer [after] changes from [before]:
/// the question, and the answer as a range (see
/// [AssessmentInput.answerBands]). [form] is 'visa' or 'university'.
void trackAnswers(String form, AssessmentInput before, AssessmentInput after) {
  final was = before.answerBands();
  for (final e in after.answerBands().entries) {
    if (was[e.key] != e.value) {
      AppEvents.track('question_answer', props: {'form': form, 'q': e.key, 'band': e.value});
    }
  }
}

/// The answers as pills, the picked one lime.
Widget assessPills<T>(List<(T, String)> options, T value, ValueChanged<T> onPick) => Wrap(
  spacing: 6,
  runSpacing: 6,
  children: [
    for (final (v, label) in options)
      IntrinsicWidth(
        child: HardChoice(
          label: label,
          selected: v == value,
          height: 34,
          radius: 999,
          fontSize: 13,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          onTap: tracked('assess.pill', () => onPick(v), props: {'value': v}),
        ),
      ),
  ],
);

/// One question: its label, what answer changes nothing, and the answers.
class AssessQuestion {
  const AssessQuestion(this.label, this.neutral, this.answer);

  final String label;

  /// The same answers with this one set to what changes nothing.
  final AssessmentInput Function(AssessmentInput) neutral;
  final Widget answer;
}

/// What an answer does: "viza +8% · qabul +10%" in green, a loss in red,
/// "ta'sir yo'q" in blue.
class AssessImpact extends StatelessWidget {
  const AssessImpact({super.key, this.visa = 0, this.admission = 0});

  final int visa;
  final int admission;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    String part(int n, String Function(int) up, String Function(int) down) => n > 0 ? up(n) : down(-n);
    final parts = [
      if (visa != 0) part(visa, l.uaVisaUp, l.uaVisaDown),
      if (admission != 0) part(admission, l.uaImpactUp, l.uaImpactDown),
    ];
    final color = parts.isEmpty
        ? FdColors.blue
        : visa < 0 || admission < 0
        ? FdColors.bad
        : FdColors.good;
    return Text(parts.isEmpty ? l.uaImpactNone : parts.join(' · '), style: fdText(11, FontWeight.w800, color));
  }
}

class AssessQuestionHead extends StatelessWidget {
  const AssessQuestionHead({super.key, required this.label, required this.impact});

  final String label;
  final Widget impact;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(child: Text(label, style: fdText(13, FontWeight.w800, FdColors.ink, height: 1.25))),
      const SizedBox(width: 8),
      Padding(padding: const EdgeInsets.only(top: 1), child: impact),
    ],
  );
}

/// A white group card: its icon tile and title, what the group adds (or a
/// dash to fold it), and the questions.
class AssessSection extends StatelessWidget {
  const AssessSection({
    super.key,
    required this.glyph,
    required this.title,
    required this.children,
    required this.open,
    this.trailing,
    this.onToggle,
    this.highlight = false,
    this.subtitle,
  });

  /// Lime, on a blue hard shadow, so it stands out from the white sections
  /// (owner, 2026-10-22: the tests must catch the student's eye).
  final bool highlight;

  /// A line under the title.
  final String? subtitle;

  final LucideGlyph glyph;
  final String title;
  final Widget? trailing;
  final bool open;
  final VoidCallback? onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
    decoration: BoxDecoration(
      color: highlight ? FdColors.lime : FdColors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: FdColors.ink, width: highlight ? 2 : 1.5),
      boxShadow: highlight ? const [BoxShadow(color: FdColors.blue, offset: Offset(4, 4))] : null,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          onTap: tracked('assess_parts.assess_section_toggle', onToggle),
          behavior: HitTestBehavior.opaque,
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: highlight ? FdColors.card : FdColors.tint,
                  borderRadius: BorderRadius.circular(9),
                  border: highlight ? Border.all(color: FdColors.ink, width: 1.5) : null,
                ),
                child: Lucide(glyph, size: 16, color: FdColors.navy),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(title, style: fdText(15, FontWeight.w800, highlight ? FdColors.onLime : FdColors.ink)),
              ),
              trailing ??
                  (onToggle == null
                      ? const SizedBox.shrink()
                      : Lucide(open ? LucideIcons.minus : LucideIcons.plus, size: 16, color: FdColors.muted)),
            ],
          ),
        ),
        if (subtitle case final s?) ...[
          const SizedBox(height: 6),
          Text(s, style: fdText(12, FontWeight.w600, highlight ? FdColors.onLime : FdColors.muted, height: 1.35)),
        ],
        SizedBox(height: open ? 14 : 12),
        if (open) ...children,
      ],
    ),
  );
}

/// A slider's value beside it: "3.5 / 5", "19 yosh" — lime, inked, lifted.
class AssessValue extends StatelessWidget {
  const AssessValue(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: FdColors.lime,
      borderRadius: BorderRadius.circular(9),
      border: Border.all(color: FdColors.ink, width: 1.5),
      boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))],
    ),
    child: Text(text, style: fdText(13, FontWeight.w800, FdColors.onLime, height: 1.1)),
  );
}
