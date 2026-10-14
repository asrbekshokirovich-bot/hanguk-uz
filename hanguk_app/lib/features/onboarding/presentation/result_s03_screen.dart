import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../data/quiz_controller.dart';
import '../domain/eligibility_engine.dart';
import '../domain/quiz_answers.dart';
import '../onboarding_routes.dart';
import 'contact_sheet_s04.dart';
import 'result_tariff_ui.dart';
import 'result_texts.dart';

/// S03 — Natija: the band, what affected it, the universities that fit (or,
/// for a low band, the paths that fit), the yearly cost, the next three steps,
/// the recommended tariff and the two calls to action.
class QuizResultScreen extends ConsumerWidget {
  const QuizResultScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final answers = ref.watch(quizProvider.select((s) => s.answers));
    final result = ref.watch(eligibilityResultProvider);

    if (!answers.isAllComplete) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go(kQuizPath);
      });
      return const _Loading();
    }

    final r = result.value;
    if (r == null) return const _Loading();

    return PopScope(
      canPop: false,
      // Back returns to the quiz, which still holds the answers and step 6.
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(kQuizPath);
      },
      child: OnbScaffold(
        child: _ResultBody(answers: answers, result: r),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return const OnbScaffold(
      child: Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 2.5, color: OnbColors.lime),
        ),
      ),
    );
  }
}

class _ResultBody extends ConsumerWidget {
  const _ResultBody({required this.answers, required this.result});

  final QuizAnswers answers;
  final EligibilityResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final r = result;
    final low = r.band == EligibilityBand.low;

    final children = <Widget>[
      // 1 — context line.
      Row(
        children: [
          Expanded(
            child: Text(
              contextLine(l, answers),
              style: onbText(13, FontWeight.w600, color: OnbColors.white64),
            ),
          ),
          const SizedBox(width: 8),
          const OnbHangulAccent('결과'),
        ],
      ),
      // 2 — band.
      _BandCard(band: r.band, lowReason: r.lowReason),
      // 3 — what affected it.
      if (r.factors.isNotEmpty) _FactorsCard(factors: r.factors),
      // 4 — universities, or paths for a low band.
      // A low band lists only the English-taught programmes its IELTS meets.
      if (r.universities.isNotEmpty) ...[
        _SectionTitle(l.onbResultUnisTitle, accent: '대학'),
        for (final m in r.universities) _UniversityCard(match: m),
      ],
      if (low && r.paths.isNotEmpty) ...[
        _SectionTitle(l.onbResultPathsTitle),
        for (final p in r.paths) _PathCard(path: p, result: r),
      ],
      // 5 — yearly cost and the KDB deposit.
      if (r.yearlyCostUsd != null) _CostCard(yearly: r.yearlyCostUsd!, bank: r.bankStatementUsd),
      // 6 — next three steps.
      if (r.steps.isNotEmpty) _StepsCard(result: r, route: answers.route ?? StudyRoute.bachelor),
      // 7 — the recommended tariff.
      Align(
        alignment: Alignment.centerLeft,
        child: OnbTap(
          onTap: () => context.push(tariffDetailPath(r.tariff.code)),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
            child: Text(
              l.onbResultTariffWhy(tariffName(l, r.tariff)),
              strutStyle: onbStrut(14),
              style: onbText(14, FontWeight.w600, color: OnbColors.lime),
            ),
          ),
        ),
      ),
      // 8 — calls to action.
      Column(
        children: [
          OnbPrimaryButton(
            label: l.onbResultCtaOperator,
            onTap: () => showContactSheet(context, ref, openTelegramAfter: false),
          ),
          const SizedBox(height: 10),
          OnbOutlineButton(
            label: l.onbResultCtaTelegram,
            onTap: () => showContactSheet(context, ref, openTelegramAfter: true),
          ),
        ],
      ),
      // 9 — disclaimer.
      Text(
        l.onbResultDisclaimer,
        textAlign: TextAlign.center,
        style: onbText(12, FontWeight.w400, color: OnbColors.white64, height: 1.45),
      ),
    ];

    return SingleChildScrollView(
      padding: onbScrollPadding(context),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: onbGapped(children, 16)),
    );
  }
}

class _BandCard extends StatelessWidget {
  const _BandCard({required this.band, this.lowReason});

  final EligibilityBand band;
  final LowReason? lowReason;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final color = switch (band) {
      EligibilityBand.high => OnbColors.green,
      EligibilityBand.mid => OnbColors.amber,
      EligibilityBand.low => OnbColors.red,
    };
    const titleSize = 24.0, lineHeight = 1.21, dot = 12.0;
    return OnbCard(
      padding: const EdgeInsets.all(18),
      radius: 22,
      fillColor: color.withValues(alpha: 0.1),
      borderColor: color.withValues(alpha: 0.45),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: (titleSize * lineHeight - dot) / 2),
                child: Container(
                  width: dot,
                  height: dot,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color,
                    boxShadow: [BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 12)],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  bandTitle(l, band),
                  style: onbText(
                    titleSize,
                    FontWeight.w800,
                    color: color,
                    height: lineHeight,
                    spacingEm: -0.02,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            bandNote(l, band, lowReason),
            style: onbText(14, FontWeight.w400, color: OnbColors.white85, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _FactorsCard extends StatelessWidget {
  const _FactorsCard({required this.factors});

  final List<EligibilityFactor> factors;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return OnbCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: onbGapped([
          Text(l.onbResultFactorsTitle, style: onbText(15, FontWeight.w700)),
          for (final f in factors)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                OnbSignBadge(
                  sign: f.positive ? '+' : '−',
                  color: f.positive ? OnbColors.green : OnbColors.red,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(factorLabel(l, f.kind), style: onbText(14, FontWeight.w400, height: 1.45)),
                ),
              ],
            ),
        ], 12),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {this.accent});

  final String text;
  final String? accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(child: Text(text, style: onbText(17, FontWeight.w700))),
          if (accent != null) ...[const SizedBox(width: 8), OnbHangulAccent(accent!)],
        ],
      ),
    );
  }
}

class _UniversityCard extends StatelessWidget {
  const _UniversityCard({required this.match});

  final MatchedUniversity match;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final m = match;
    final city = m.university.city;
    return OnbCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m.university.displayName, style: onbText(15, FontWeight.w700, height: 1.25)),
                    if (city != null && city.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(city, style: onbText(12.5, FontWeight.w400, color: OnbColors.white64)),
                    ],
                  ],
                ),
              ),
              if (m.partner || m.accredited) ...[
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (m.partner)
                      _Badge(label: l.onbResultPartner, color: OnbColors.lime),
                    if (m.partner && m.accredited) const SizedBox(height: 6),
                    if (m.accredited)
                      _Badge(label: l.onbResultAccredited, color: OnbColors.green),
                  ],
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _Cell(
                    label: l.onbResultTuitionLabel,
                    value: m.tuitionPerSemesterUsd == null ? '—' : usd(m.tuitionPerSemesterUsd!),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _Cell(
                    label: l.onbResultLanguageLabel,
                    value: languageRequirements(m).isEmpty ? '—' : languageRequirements(m).join('\n'),
                    maxLines: 2,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _Cell(
                    label: l.onbResultBankLabel,
                    value: m.bankStatementUsd == null ? '—' : usd(m.bankStatementUsd!),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.value, this.maxLines = 1});

  final String label;
  final String value;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: OnbColors.cellFill, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: onbText(10, FontWeight.w400, color: OnbColors.white64)),
          const SizedBox(height: 2),
          Text(value, maxLines: maxLines, overflow: TextOverflow.ellipsis, style: onbText(13, FontWeight.w700)),
        ],
      ),
    );
  }
}

class _PathCard extends StatelessWidget {
  const _PathCard({required this.path, required this.result});

  final AlternativePath path;
  final EligibilityResult result;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return OnbCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(pathTitle(l, path), style: onbText(15, FontWeight.w700, height: 1.25)),
          const SizedBox(height: 3),
          Text(
            pathNote(l, path, result),
            style: onbText(12.5, FontWeight.w400, color: OnbColors.white64, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _CostCard extends StatelessWidget {
  const _CostCard({required this.yearly, required this.bank});

  final (int, int) yearly;
  final int? bank;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return OnbCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: onbGapped([
          Text(l.onbResultYearlyCost, style: onbText(13, FontWeight.w400, color: OnbColors.white64)),
          Text(usdRange(yearly), style: onbText(26, FontWeight.w800, spacingEm: -0.02)),
          if (bank != null) ...[
            Container(height: 1, color: OnbColors.divider),
            Row(
              children: [
                Expanded(
                  child: Text(
                    l.onbResultBankLabel,
                    style: onbText(14, FontWeight.w400, color: OnbColors.white64),
                  ),
                ),
                Text(usd(bank!), style: onbText(14, FontWeight.w700)),
              ],
            ),
          ],
        ], 10),
      ),
    );
  }
}

class _StepsCard extends StatelessWidget {
  const _StepsCard({required this.result, required this.route});

  final EligibilityResult result;
  final StudyRoute route;

  List<NextStep> get steps => result.steps;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return OnbCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: onbGapped([
          Text(l.onbResultStepsTitle, style: onbText(15, FontWeight.w700)),
          for (var i = 0; i < steps.length && i < 3; i++)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: OnbColors.lime.withValues(alpha: 0.5)),
                  ),
                  child: Text('${i + 1}', style: onbText(13, FontWeight.w700, color: OnbColors.lime)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(stepLabel(l, steps[i], result, route), style: onbText(14, FontWeight.w400, height: 1.45)),
                  ),
                ),
              ],
            ),
        ], 12),
      ),
    );
  }
}

/// The pill in a university card's corner: 24px, 10.5/700, tinted [color].
class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 9),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: color.withValues(alpha: 0.14),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(label, style: onbText(10.5, FontWeight.w700, color: color)),
    );
  }
}
