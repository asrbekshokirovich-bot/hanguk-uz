import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../data/quiz_controller.dart';
import '../domain/quiz_answers.dart';
import '../onboarding_routes.dart';
import 's01_s04_ui.dart';

/// S02 — "Viza imkoniyatim", 6 savol: one question per screen.
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
        return _Question(l.onbQuizQ1, [
          for (final (r, label) in [
            (StudyRoute.languageCourse, l.onbQuizRouteCourse),
            (StudyRoute.bachelor, l.onbQuizRouteBachelor),
            (StudyRoute.master, l.onbQuizRouteMaster),
            (StudyRoute.college, l.onbQuizRouteCollege),
          ])
            option(label, a.route == r, (x) => x.copyWith(route: r)),
        ]);
      case 2:
        final thisYear = DateTime.now().year;
        return _Question(l.onbQuizQ2, [
          _AgeRow(
            label: l.onbQuizAge,
            age: a.age,
            onChanged: (age) => set((x) => _withAge(x, age)),
          ),
          _Option(
            label: l.onbQuizGradYear,
            value: a.gradYear == null
                ? null
                : (a.gradYear! <= thisYear - 4
                      ? l.onbQuizGradYearOrEarlier('${a.gradYear}')
                      : '${a.gradYear}'),
            selected: a.gradYear != null,
            onTap: () async {
              final years = [for (var y = thisYear; y > thisYear - 5; y--) y];
              final picked = await _pick<int>(context, [
                for (final y in years)
                  (
                    y,
                    y == years.last ? l.onbQuizGradYearOrEarlier('$y') : '$y',
                  ),
              ], a.gradYear);
              if (picked != null) {
                set((x) => x.copyWith(gradYear: picked, stillStudying: false));
              }
            },
          ),
          option(
            l.onbQuizStillStudying,
            a.stillStudying,
            (x) => x.copyWith(stillStudying: true, clearGradYear: true),
          ),
        ]);
      case 3:
        return _Question(
          l.onbQuizQ3,
          [
            for (final (k, label) in [
              (KoreanLevel.none, l.onbQuizKoreanNone),
              (KoreanLevel.learning, l.onbQuizKoreanLearning),
              (KoreanLevel.topik1, l.onbQuizKoreanTopik1),
              (KoreanLevel.topik2, l.onbQuizKoreanTopik2),
              (KoreanLevel.topik3plus, l.onbQuizKoreanTopik3),
              (KoreanLevel.unknown, l.onbQuizKoreanUnknown),
            ])
              option(label, a.korean == k, (x) => x.copyWith(korean: k)),
          ],
          hangul: '한국어',
          hint: l.onbQuizQ3Hint,
        );
      case 4:
        return _Question(l.onbQuizQ4, [
          for (final (b, label) in [
            (Budget.under3k, l.onbQuizBudgetUnder3),
            (Budget.from3to6k, l.onbQuizBudget3to6),
            (Budget.from6to10k, l.onbQuizBudget6to10),
            (Budget.over10k, l.onbQuizBudgetOver10),
          ])
            option(label, a.budget == b, (x) => x.copyWith(budget: b)),
          _PayerRow(
            label: l.onbQuizPayer,
            choices: [
              (Payer.parents, l.onbQuizPayerParents),
              (Payer.self, l.onbQuizPayerSelf),
              (Payer.sponsor, l.onbQuizPayerSponsor),
            ],
            selected: a.payer,
            onSelect: (p) => set((x) => x.copyWith(payer: p)),
          ),
        ]);
      case 5:
        return _Question(l.onbQuizQ5, [
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
          option(
            l.onbQuizBankYes,
            a.bankStatement == true,
            (x) => x.copyWith(bankStatement: true),
          ),
          option(
            l.onbQuizBankNo,
            a.bankStatement == false,
            (x) => x.copyWith(bankStatement: false),
          ),
        ]);
      default:
        return _Question(l.onbQuizQ6, [
          _Option(
            label: l.onbQuizRegion,
            value: a.region ?? l.onbQuizRegionChoose,
            dropdown: true,
            selected: a.region != null,
            onTap: () async {
              final picked = await _pick<String>(context, [
                for (final r in kQuizRegions) (r, r),
              ], a.region);
              if (picked != null) set((x) => x.copyWith(region: picked));
            },
          ),
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

/// [a] with [age] set or cleared (`copyWith` cannot clear a field).
QuizAnswers _withAge(QuizAnswers a, int? age) => QuizAnswers(
  route: a.route,
  age: age,
  gradYear: a.gradYear,
  stillStudying: a.stillStudying,
  korean: a.korean,
  budget: a.budget,
  payer: a.payer,
  formalIncome: a.formalIncome,
  bankStatement: a.bankStatement,
  region: a.region,
  intake: a.intake,
);

/// A list of choices in the question's own option style, in the S04 sheet.
Future<T?> _pick<T>(
  BuildContext context,
  List<(T, String)> choices,
  T? current,
) {
  return showOnbSheet<T>(
    context,
    builder: (sheetContext) => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < choices.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          _Option(
            label: choices[i].$2,
            selected: choices[i].$1 == current,
            onTap: () => Navigator.of(sheetContext).pop(choices[i].$1),
          ),
        ],
      ],
    ),
  );
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
    this.value,
    this.dropdown = false,
  });

  final String label;

  /// Shown after [label] ("Viloyat: Toshkent").
  final String? value;

  /// A trailing ▾ after [value].
  final bool dropdown;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = value == null ? label : '$label $value';
    return OnbTap(
      label: text,
      selected: selected,
      onTap: onTap,
      child: _OptionFrame(
        selected: selected,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text.rich(
            TextSpan(
              text: text,
              children: [
                if (dropdown)
                  const WidgetSpan(
                    alignment: PlaceholderAlignment.middle,
                    child: Padding(
                      padding: EdgeInsets.only(left: 4),
                      child: _DownTriangle(),
                    ),
                  ),
              ],
            ),
            style: _optionStyle,
          ),
        ),
      ),
    );
  }
}

/// ▾ — the bundled Inter subset has no U+25BE, so it is drawn.
class _DownTriangle extends StatelessWidget {
  const _DownTriangle();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: const Size(9, 9), painter: _TrianglePainter());
  }
}

class _TrianglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final path = Path()
      ..moveTo(w * .1, size.height * .3)
      ..lineTo(w * .9, size.height * .3)
      ..lineTo(w * .5, size.height * .8)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(_TrianglePainter oldDelegate) => false;
}

/// "Yosh: N" — the age, typed (the only question with a keyboard).
class _AgeRow extends StatefulWidget {
  const _AgeRow({
    required this.label,
    required this.age,
    required this.onChanged,
  });

  final String label;
  final int? age;
  final ValueChanged<int?> onChanged;

  @override
  State<_AgeRow> createState() => _AgeRowState();
}

class _AgeRowState extends State<_AgeRow> {
  late final TextEditingController _c = TextEditingController(
    text: widget.age?.toString() ?? '',
  );
  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return OnbTap(
      label: widget.label,
      selected: widget.age != null,
      onTap: _focus.requestFocus,
      child: _OptionFrame(
        selected: widget.age != null,
        child: Row(
          children: [
            Text(widget.label, style: _optionStyle),
            const SizedBox(width: 4),
            Expanded(
              child: TextField(
                controller: _c,
                focusNode: _focus,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(2),
                ],
                style: _optionStyle,
                cursorColor: OnbColors.lime,
                decoration: const InputDecoration.collapsed(hintText: null),
                onChanged: (v) {
                  final n = int.tryParse(v);
                  widget.onChanged(n != null && n >= 10 ? n : null);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "To‘lovchi: ota-ona / o‘zim / homiy" — one row, each payer tappable; the
/// chosen one turns lime.
class _PayerRow extends StatelessWidget {
  const _PayerRow({
    required this.label,
    required this.choices,
    required this.selected,
    required this.onSelect,
  });

  final String label;
  final List<(Payer, String)> choices;
  final Payer? selected;
  final ValueChanged<Payer> onSelect;

  @override
  Widget build(BuildContext context) {
    return _OptionFrame(
      selected: selected != null,
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Text('$label ', style: _optionStyle),
          ),
          for (var i = 0; i < choices.length; i++) ...[
            if (i > 0) Text(' / ', style: _optionStyle),
            OnbTap(
              label: choices[i].$2,
              selected: choices[i].$1 == selected,
              onTap: () => onSelect(choices[i].$1),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  choices[i].$2,
                  style: _optionStyle.copyWith(
                    color: choices[i].$1 == selected ? OnbColors.lime : null,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
