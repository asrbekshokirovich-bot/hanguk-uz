import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../data/quiz_controller.dart';
import '../data/quiz_repository.dart';
import '../domain/eligibility_engine.dart';
import '../domain/quiz_answers.dart';
import '../onboarding_routes.dart';
import 'result_texts.dart';
import 's01_s04_ui.dart';

/// S02 — "Viza imkoniyatim": one question per screen ([kQuizSteps]).
class QuizScreen extends ConsumerWidget {
  const QuizScreen({super.key});

  void _back(BuildContext context, WidgetRef ref) {
    if (!ref.read(quizProvider.notifier).back()) context.go('/welcome');
  }

  void _continue(BuildContext context, WidgetRef ref) {
    FocusScope.of(context).unfocus();
    if (!ref.read(quizProvider.notifier).next()) context.go(kQuizResultPath);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final state = ref.watch(quizProvider);
    final step = state.step;
    final a = state.answers;
    final q = _question(context, ref, l, step, a);
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back(context, ref);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0A1A),
        body: OnbBackground(
          child: OnbFillScroll(
            padding: EdgeInsets.fromLTRB(
              20,
              top + 10,
              20,
              bottom > 28 ? bottom : 28,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    OnbTap(
                      label: l.onbQuizBack,
                      onTap: () => _back(context, ref),
                      child: Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: OnbColors.glass,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: OnbColors.line),
                        ),
                        child: const OnbBackArrow(),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        '$step / $kQuizSteps',
                        textAlign: TextAlign.center,
                        style: onbText(15, FontWeight.w700),
                      ),
                    ),
                    const SizedBox(width: 44),
                  ],
                ),
                const SizedBox(height: 20),
                _Progress(value: step / kQuizSteps),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            child: Text(
                              q.title,
                              style: onbText(
                                26,
                                FontWeight.w800,
                                height: 1.15,
                                letterSpacingEm: -.02,
                              ),
                            ),
                          ),
                          if (q.hangul != null) ...[
                            const SizedBox(width: 10),
                            Text(
                              q.hangul!,
                              style: onbHangul().copyWith(
                                height: cssNormalLineHeight(12),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (q.hint != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          q.hint!,
                          style: onbText(
                            15,
                            FontWeight.w400,
                            height: 1.5,
                            color: OnbColors.text64,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                for (var i = 0; i < q.rows.length; i++) ...[
                  if (i > 0) const SizedBox(height: 10),
                  q.rows[i],
                ],
                const SizedBox(height: 20),
                const Spacer(),
                const SizedBox(height: 20),
                OnbPrimaryButton(
                  label: l.onbQuizContinue,
                  onPressed: a.isComplete(step)
                      ? () => _continue(context, ref)
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  _Question _question(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l,
    int step,
    QuizAnswers a,
  ) {
    void set(QuizAnswers Function(QuizAnswers) change) =>
        ref.read(quizProvider.notifier).update(change);

    _Option option(String label, bool selected, QuizAnswers Function(QuizAnswers) pick) =>
        _Option(label: label, selected: selected, onTap: () => set(pick));

    switch (step) {
      case 1:
        return _Question(
          l.onbQuizQ1,
          [
            for (final (r, label) in [
              (StudyRoute.languageCourse, l.onbQuizRouteCourse),
              (StudyRoute.bachelor, l.onbQuizRouteBachelor),
              (StudyRoute.master, l.onbQuizRouteMaster),
              (StudyRoute.college, l.onbQuizRouteCollege),
            ])
              option(label, a.route == r, (x) => x.copyWith(route: r)),
          ],
          hint: l.onbQuizQ1Hint,
        );
      case 2:
        return _Question(l.onbQuizAgeQ, [
          _AgeGrid(
            selected: a.age,
            lastLabel: '${kQuizAges.last}+',
            onSelect: (age) => set((x) => x.copyWith(age: age)),
          ),
        ]);
      case 3:
        final thisYear = DateTime.now().year;
        final years = [for (var y = thisYear; y > thisYear - 5; y--) y];
        // A master's applicant is asked about the bachelor's; everyone else
        // about the last school, whichever it was.
        final master = a.route == StudyRoute.master;
        return _Question(
          master ? l.onbQuizGradQMaster : l.onbQuizGradQ,
          [
            for (final y in years)
              option(
                y == years.last ? l.onbQuizGradYearOrEarlier('$y') : '$y',
                !a.stillStudying && a.gradYear == y,
                (x) => x.copyWith(gradYear: y, stillStudying: false),
              ),
            option(
              l.onbQuizStillStudying,
              a.stillStudying,
              (x) => x.copyWith(stillStudying: true, clearGradYear: true),
            ),
          ],
          hint: master ? null : l.onbQuizGradHint,
        );
      case 4:
        return _Question(
          l.onbQuizQ3,
          [
            for (final (k, label) in [
              (KoreanLevel.none, l.onbQuizKoreanNone),
              (KoreanLevel.learning, l.onbQuizKoreanLearning),
              (KoreanLevel.topik1, l.onbQuizKoreanTopik1),
              (KoreanLevel.topik2, l.onbQuizKoreanTopik2),
              (KoreanLevel.topik3, l.onbQuizKoreanTopik3),
              (KoreanLevel.topik4plus, l.onbQuizKoreanTopik4),
              (KoreanLevel.unknown, l.onbQuizKoreanUnknown),
            ])
              option(label, a.korean == k, (x) => x.copyWith(korean: k)),
          ],
          hangul: '한국어',
          hint: l.onbQuizQ3Hint,
        );
      case 5:
        return _Question(
          l.onbQuizIeltsQ,
          [
            for (final (e, label) in [
              (EnglishLevel.none, l.onbQuizIeltsNone),
              (EnglishLevel.ielts55, l.onbQuizIelts55),
              (EnglishLevel.ielts60, l.onbQuizIelts60),
              (EnglishLevel.ielts65plus, l.onbQuizIelts65),
              (EnglishLevel.unknown, l.onbQuizIeltsUnknown),
            ])
              option(label, a.english == e, (x) => x.copyWith(english: e)),
          ],
          hint: l.onbQuizIeltsHint,
        );
      case 6:
        return _Question(l.onbQuizPayerQ, [
          for (final (p, label) in [
            (Payer.parents, l.onbQuizPayerParentsOption),
            (Payer.self, l.onbQuizPayerSelfOption),
            (Payer.sponsor, l.onbQuizPayerSponsorOption),
          ])
            option(label, a.payer == p, (x) => x.copyWith(payer: p)),
        ]);
      case 7:
        return _Question(
          l.onbQuizQ5,
          [
            option(
              l.onbQuizIncomeYes,
              a.formalIncome == true,
              (x) => x.copyWith(formalIncome: true),
            ),
            option(
              l.onbQuizIncomeNo,
              a.formalIncome == false,
              (x) => x.copyWith(formalIncome: false),
            ),
          ],
          hint: l.onbQuizIncomeHint,
        );
      case 8:
        final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
        final route = a.route ?? StudyRoute.bachelor;
        final deposit = rules.kdbUsd(route);
        return _Question(
          l.onbQuizKdbQ,
          [
            for (final (k, label) in [
              (KdbDeposit.ready, l.onbQuizKdbReady),
              (KdbDeposit.byIntake, l.onbQuizKdbByIntake),
              (KdbDeposit.no, l.onbQuizKdbNo),
              (KdbDeposit.unknown, l.onbQuizKdbUnknown),
            ])
              option(label, a.kdb == k, (x) => x.copyWith(kdb: k)),
          ],
          hint: l.onbQuizKdbHint(
            usd(deposit.$1, space: '\u00A0'),
            usd(deposit.$2, space: '\u00A0'),
            '${rules.kdbHoldMonths(route)}',
          ),
        );
      case 9:
        return _Question(l.onbQuizRegionQ, [
          for (final r in kQuizRegions)
            option(r, a.region == r, (x) => x.copyWith(region: r)),
        ]);
      default:
        return _Question(l.onbQuizIntakeQ, [
          for (final (i, label) in [
            (Intake.spring2027, l.onbQuizIntakeSpring2027),
            (Intake.fall2027, l.onbQuizIntakeFall2027),
            (Intake.later, l.onbQuizIntakeLater),
          ])
            option(label, a.intake == i, (x) => x.copyWith(intake: i)),
        ]);
    }
  }
}

class _Question {
  const _Question(this.title, this.rows, {this.hangul, this.hint});

  final String title;
  final List<Widget> rows;

  /// Decorative hangul beside the title (Korean in every language).
  final String? hangul;
  final String? hint;
}

/// 6px track rgba(255,255,255,.12), lime fill.
class _Progress extends StatelessWidget {
  const _Progress({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 6,
        color: const Color.fromRGBO(255, 255, 255, .12),
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: value.clamp(0, 1),
          heightFactor: 1,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: OnbColors.lime,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ),
    );
  }
}

/// The option row: min 56px, radius 16, 1px border, 600 15px, the radio ring
/// 22px. Selected: lime border, rgba(212,233,76,.12) fill, lime ring + dot.
class _OptionFrame extends StatelessWidget {
  const _OptionFrame({required this.selected, required this.child});

  final bool selected;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      constraints: const BoxConstraints(minHeight: 56),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: selected
            ? const Color.fromRGBO(212, 233, 76, .12)
            : OnbColors.glass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: selected ? OnbColors.lime : OnbColors.line),
      ),
      child: Row(
        children: [
          _Radio(selected: selected),
          const SizedBox(width: 12),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? OnbColors.lime : OnbColors.text40,
          width: 2,
        ),
      ),
      child: Opacity(
        opacity: selected ? 1 : 0,
        child: Container(
          width: 10,
          height: 10,
          decoration: const BoxDecoration(
            color: OnbColors.lime,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

final TextStyle _optionStyle = onbText(15, FontWeight.w600);

class _Option extends StatelessWidget {
  const _Option({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      label: label,
      selected: selected,
      onTap: onTap,
      child: _OptionFrame(
        selected: selected,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(label, style: _optionStyle),
        ),
      ),
    );
  }
}

/// Question 2: the ages as tiles, four to a row, in the option style (min
/// 56px, radius 16, lime when chosen). One tap answers; no keyboard.
class _AgeGrid extends StatelessWidget {
  const _AgeGrid({
    required this.selected,
    required this.lastLabel,
    required this.onSelect,
  });

  final int? selected;

  /// The label of the last tile ("31+").
  final String lastLabel;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    const columns = 4;
    const gap = 10.0;
    final rows = <List<int>>[
      for (var i = 0; i < kQuizAges.length; i += columns)
        kQuizAges.sublist(i, (i + columns).clamp(0, kQuizAges.length)),
    ];
    return Column(
      children: [
        for (var r = 0; r < rows.length; r++) ...[
          if (r > 0) const SizedBox(height: gap),
          Row(
            children: [
              for (var c = 0; c < columns; c++) ...[
                if (c > 0) const SizedBox(width: gap),
                Expanded(
                  child: c < rows[r].length
                      ? _AgeTile(
                          label: rows[r][c] == kQuizAges.last ? lastLabel : '${rows[r][c]}',
                          selected: selected == rows[r][c],
                          onTap: () => onSelect(rows[r][c]),
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _AgeTile extends StatelessWidget {
  const _AgeTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      label: label,
      selected: selected,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? const Color.fromRGBO(212, 233, 76, .12)
              : OnbColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? OnbColors.lime : OnbColors.line),
        ),
        child: Text(
          label,
          style: onbText(
            17,
            FontWeight.w700,
            color: selected ? OnbColors.lime : Colors.white,
          ),
        ),
      ),
    );
  }
}
