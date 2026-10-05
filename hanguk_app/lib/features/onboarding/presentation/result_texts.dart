import '../../../l10n/app_localizations.dart';
import '../domain/eligibility_engine.dart';
import '../domain/quiz_answers.dart';

/// The result's words in the app language (S03), shared by the screen and
/// by [planText], which the Telegram bot sends (S04).

String routeLabel(AppLocalizations l, StudyRoute r) => switch (r) {
  StudyRoute.languageCourse => l.onbResultRouteLanguageCourse,
  StudyRoute.bachelor => l.onbResultRouteBachelor,
  StudyRoute.master => l.onbResultRouteMaster,
  StudyRoute.college => l.onbResultRouteCollege,
};

String intakeLabel(AppLocalizations l, Intake i) => switch (i) {
  Intake.spring2027 => l.onbResultIntakeSpring2027,
  Intake.fall2027 => l.onbResultIntakeFall2027,
  Intake.later => l.onbResultIntakeLater,
};

/// "Bakalavr · Farg'ona · 2027 bahor".
String contextLine(AppLocalizations l, QuizAnswers a) => [
  if (a.route != null) routeLabel(l, a.route!),
  if (a.region != null && a.region!.trim().isNotEmpty) a.region!.trim(),
  if (a.intake != null) intakeLabel(l, a.intake!),
].join(' · ');

String bandTitle(AppLocalizations l, EligibilityBand b) => switch (b) {
  EligibilityBand.high => l.onbResultBandHigh,
  EligibilityBand.mid => l.onbResultBandMid,
  EligibilityBand.low => l.onbResultBandLow,
};

String bandNote(AppLocalizations l, EligibilityBand b) => switch (b) {
  EligibilityBand.high => l.onbResultBandHighNote,
  EligibilityBand.mid => l.onbResultBandMidNote,
  EligibilityBand.low => l.onbResultBandLowNote,
};

String factorLabel(AppLocalizations l, FactorKind k) => switch (k) {
  FactorKind.koreanStrong => l.onbResultFactorKoreanStrong,
  FactorKind.koreanTopik2Degree => l.onbResultFactorKoreanTopik2Degree,
  FactorKind.koreanMissingDegree => l.onbResultFactorKoreanMissingDegree,
  FactorKind.koreanCollegeStrong => l.onbResultFactorKoreanCollegeStrong,
  FactorKind.koreanCollegeTopik2 => l.onbResultFactorKoreanCollegeTopik2,
  FactorKind.koreanCourseCertificate => l.onbResultFactorKoreanCourseCertificate,
  FactorKind.koreanCourseMissing => l.onbResultFactorKoreanCourseMissing,
  FactorKind.incomeYes => l.onbResultFactorIncomeYes,
  FactorKind.incomeNo => l.onbResultFactorIncomeNo,
  FactorKind.bankYes => l.onbResultFactorBankYes,
  FactorKind.bankNo => l.onbResultFactorBankNo,
  FactorKind.gradRecent => l.onbResultFactorGradRecent,
  FactorKind.gradGapLong => l.onbResultFactorGradGapLong,
  FactorKind.ageHigh => l.onbResultFactorAgeHigh,
  FactorKind.budgetLow => l.onbResultFactorBudgetLow,
};

String stepLabel(AppLocalizations l, NextStep s) => switch (s) {
  NextStep.topikPrep => l.onbResultStepTopikPrep,
  NextStep.bankStatement => l.onbResultStepBankStatement,
  NextStep.schoolDocs => l.onbResultStepSchoolDocs,
  NextStep.diplomaDocs => l.onbResultStepDiplomaDocs,
  NextStep.applyOnTime => l.onbResultStepApplyOnTime,
};

String pathTitle(AppLocalizations l, AlternativePath p) => switch (p) {
  AlternativePath.languageCourse => l.onbResultPathLanguageCourse,
  AlternativePath.college => l.onbResultPathCollege,
  AlternativePath.nextSeason => l.onbResultPathNextSeason,
};

String pathNote(AppLocalizations l, AlternativePath p) => switch (p) {
  AlternativePath.languageCourse => l.onbResultPathLanguageCourseNote,
  AlternativePath.college => l.onbResultPathCollegeNote,
  AlternativePath.nextSeason => l.onbResultPathNextSeasonNote,
};

String tariffName(AppLocalizations l, Tariff t) => switch (t) {
  Tariff.standart => l.onbTariffNameStandart,
  Tariff.premium => l.onbTariffNamePremium,
  Tariff.noRisk => l.onbTariffNameNoRisk,
  Tariff.hanbox => l.onbTariffNameHanbox,
};

/// "$12 500" — a space between thousands, as the design writes money.
/// [space] is a no-break space on screen so an amount never wraps.
String usd(int v, {String space = ' '}) => '\$${_group(v, space)}';

/// "$6 800–9 400".
String usdRange((int, int) r, {String space = ' '}) =>
    r.$1 == r.$2 ? usd(r.$1, space: space) : '${usd(r.$1, space: space)}–${_group(r.$2, space)}';

String _group(int v, String space) {
  final s = v.abs().toString();
  final b = StringBuffer(v < 0 ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(space);
    b.write(s[i]);
  }
  return b.toString();
}

/// The "TOPIK talabi" cell: "3+", or a dash when the guideline has none.
String topikValue(int? min) => min == null ? '—' : '$min+';

const int _kPlanMaxChars = 3500;

/// The whole plan as plain text, for the Telegram bot: the same words S03
/// shows, in the app language.
String planText(AppLocalizations l, QuizAnswers a, EligibilityResult r) {
  const sp = ' ';
  final out = <String>[];
  final ctx = contextLine(l, a);
  if (ctx.isNotEmpty) out.add(ctx);

  out.add('${bandTitle(l, r.band)}\n${bandNote(l, r.band)}');

  if (r.factors.isNotEmpty) {
    out.add(
      [
        l.onbResultFactorsTitle,
        for (final f in r.factors) '${f.positive ? '+' : '−'} ${factorLabel(l, f.kind)}',
      ].join('\n'),
    );
  }

  if (r.band == EligibilityBand.low) {
    if (r.paths.isNotEmpty) {
      out.add(
        [
          l.onbResultPathsTitle,
          for (final p in r.paths) '• ${pathTitle(l, p)} — ${pathNote(l, p)}',
        ].join('\n'),
      );
    }
  } else if (r.universities.isNotEmpty) {
    out.add(
      [
        l.onbResultUnisTitle,
        for (final m in r.universities.take(3)) ...[
          [
            '• ${m.university.displayName}',
            if ((m.university.city ?? '').isNotEmpty) ' (${m.university.city})',
            if (m.accredited) ' — ${l.onbResultAccredited}',
          ].join(),
          '  ${l.onbResultTuitionLabel}: ${m.tuitionPerSemesterUsd == null ? '—' : usd(m.tuitionPerSemesterUsd!, space: sp)}'
              ' · ${l.onbResultTopikLabel}: ${topikValue(m.topikMin)}'
              ' · ${l.onbResultBankLabel}: ${m.bankStatementUsd == null ? '—' : usd(m.bankStatementUsd!, space: sp)}',
        ],
      ].join('\n'),
    );
  }

  final money = [
    if (r.yearlyCostUsd != null) '${l.onbResultYearlyCost}: ${usdRange(r.yearlyCostUsd!, space: sp)}',
    if (r.bankStatementUsd != null) '${l.onbResultBankLabel}: ${usd(r.bankStatementUsd!, space: sp)}',
  ];
  if (money.isNotEmpty) out.add(money.join('\n'));

  if (r.steps.isNotEmpty) {
    out.add(
      [
        l.onbResultStepsTitle,
        for (var i = 0; i < r.steps.length && i < 3; i++) '${i + 1}. ${stepLabel(l, r.steps[i])}',
      ].join('\n'),
    );
  }

  out.add(l.onbResultPlanTariff(tariffName(l, r.tariff)));
  final disclaimer = l.onbResultDisclaimer;

  var text = '${out.join('\n\n')}\n\n$disclaimer';
  if (text.length > _kPlanMaxChars) {
    final room = _kPlanMaxChars - disclaimer.length - 3;
    text = '${text.substring(0, room).trimRight()}…\n\n$disclaimer';
  }
  return text;
}
