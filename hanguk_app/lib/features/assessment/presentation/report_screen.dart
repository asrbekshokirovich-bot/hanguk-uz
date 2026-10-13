import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/presentation/widgets/sign_in_chrome.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../entry/data/entry_store.dart';
import '../../entry/presentation/widgets/entry_fields.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../data/assessment_controller.dart';
import '../domain/assessment.dart';
import 'assessment_widgets.dart';

/// The status circle of a report row (design `status()`): lime ✓ from 60,
/// amber ! from 40, red ✕ below.
({String glyph, Color bg, Color fg}) reportStatus(int percent) => percent >= 60
    ? (glyph: '✓', bg: FdColors.lime, fg: FdColors.onLime)
    : percent >= 40
    ? (glyph: '!', bg: FdColors.warn, fg: Colors.white)
    : (glyph: '✕', bg: FdColors.bad, fg: Colors.white);

/// The band as the report's single word and the circle it wears.
int bandPercent(EligibilityBand b) => switch (b) {
  EligibilityBand.high => 70,
  EligibilityBand.mid => 50,
  EligibilityBand.low => 30,
};

/// Design screen 12, "Hisobot + lid": the verdict (HA / BALKI / HOZIRCHA
/// YO'Q), the three checks, what to do, and the form that sends the report —
/// it creates the lead (`app_quiz_submit`), as the old quiz's S04 did.
class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final saved = ref.read(entryProvider).phone;
    if (saved != null) _phone.text = UzPhoneFormatter.format(UzPhoneFormatter.digitsOf(saved));
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit(AssessmentOutcome outcome) async {
    final l = AppLocalizations.of(context)!;
    final name = _name.text.trim();
    final digits = UzPhoneFormatter.digitsOf(_phone.text);
    if (name.isEmpty) return setState(() => _error = l.fdReportNameError);
    if (digits.length != kUzNationalDigits) return setState(() => _error = l.fdReportPhoneError);
    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });
    final input = ref.read(assessmentProvider);
    final res = await ref.read(quizRepositoryProvider).submit(
      phoneE164: uzE164(digits),
      name: name,
      answers: input.toAnswers(requiredBankKrw: outcome.requiredBankKrw),
      result: outcome.toResult(),
    );
    if (!mounted) return;
    setState(() => _sending = false);
    switch (res.status) {
      case QuizSubmitStatus.ok:
        final phone = res.phone ?? uzE164(digits);
        unawaited(ref.read(entryProvider.notifier).setRegistered(phone));
        ref.read(assessmentSentProvider.notifier).set((name: name, phone: phone, linkCode: res.linkCode));
        context.push(kAssessmentSentPath);
      case QuizSubmitStatus.student:
        context.push('/login', extra: const {'magic_code': true});
      case QuizSubmitStatus.invalidPhone:
        setState(() => _error = l.fdReportPhoneError);
      case QuizSubmitStatus.invalidName:
        setState(() => _error = l.fdReportNameError);
      case QuizSubmitStatus.network:
        setState(() => _error = l.fdReportNetworkError);
    }
  }

  String _shareText(AppLocalizations l, AssessmentOutcome o) => [
    '${l.fdAssessTitleLead} ${l.fdAssessTitleMark}',
    _verdict(l, o.band),
    for (final c in o.chances) '${c.university.displayName}: ${c.percent}%',
    '${l.fdVisa} D-2: ${o.visaPercent}%',
  ].join('\n');

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final outcome = ref.watch(assessmentOutcomeProvider);
    if (outcome == null) {
      return const Scaffold(
        backgroundColor: Colors.transparent,
        body: SignInBackdrop(child: Center(child: CircularProgressIndicator(color: SeoulColors.lime))),
      );
    }
    final best = outcome.chances.isEmpty ? 0 : outcome.chances.map((c) => c.percent).reduce((a, b) => a > b ? a : b);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SignInBackdrop(
        child: SafeArea(
          child: Stack(
            children: [
              Positioned(
                right: -10,
                top: -14,
                child: ExcludeSemantics(
                  child: Text('결과', style: fdText(100, FontWeight.w800, const Color(0x12FFFFFF), height: 1, letterSpacing: -4)),
                ),
              ),
              ListView(
                padding: const EdgeInsets.only(bottom: 16),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
                    child: Row(
                      children: [
                        HardIconButton(
                          glyph: LucideIcons.chevronLeft,
                          semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                          onTap: () => context.pop(),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${l.fdAssessTitleLead} ${l.fdAssessTitleMark}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: fdText(12, FontWeight.w700, FdColors.pageMuted),
                          ),
                        ),
                        HardIconButton(
                          glyph: LucideIcons.share2,
                          semanticLabel: l.fdShare,
                          onTap: () => Share.share(_shareText(l, outcome)),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        LimeMark(
                          _verdict(l, outcome.band),
                          style: fdText(54, FontWeight.w800, Colors.white, height: 1, letterSpacing: -2.16),
                        ),
                        const SizedBox(height: 4),
                        Text(_verdictNote(l, outcome.band), style: fdText(14, FontWeight.w700, Colors.white, height: 1.35)),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: _Checks(outcome: outcome, bestAdmission: best),
                  ),
                  if (outcome.fixes.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(l.fdReportFixesTitle, style: fdText(12, FontWeight.w800, FdColors.pageMuted)),
                          for (final f in outcome.fixes) ...[
                            const SizedBox(height: 5),
                            _FixRow(fix: f),
                          ],
                        ],
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 20, 14, 0),
                    child: _LeadForm(
                      name: _name,
                      phone: _phone,
                      sending: _sending,
                      error: _error,
                      onSend: () => _submit(outcome),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _verdict(AppLocalizations l, EligibilityBand b) => switch (b) {
  EligibilityBand.high => l.fdVerdictYes,
  EligibilityBand.mid => l.fdVerdictMaybe,
  EligibilityBand.low => l.fdVerdictNotYet,
};

String _verdictNote(AppLocalizations l, EligibilityBand b) => switch (b) {
  EligibilityBand.high => l.fdVerdictYesNote,
  EligibilityBand.mid => l.fdVerdictMaybeNote,
  EligibilityBand.low => l.fdVerdictNotYetNote,
};

/// The white card: Universitet qabul, D-2 viza, Koreada o'qish, joined by
/// an ink line.
class _Checks extends StatelessWidget {
  const _Checks({required this.outcome, required this.bestAdmission});

  final AssessmentOutcome outcome;
  final int bestAdmission;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final overall = reportStatus(bandPercent(outcome.band));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Step(
            status: reportStatus(bestAdmission),
            line: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(child: Text(l.fdReportAdmission, style: fdText(13, FontWeight.w800, FdColors.ink))),
                    Text(
                      l.fdReportOpenOf(outcome.chances.length, outcome.openCount),
                      style: fdText(11, FontWeight.w700, FdColors.muted),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 5,
                  runSpacing: 5,
                  children: [
                    for (final c in outcome.chances)
                      _Chip(
                        label: '${shortUniversityName(c.university.displayName)} ${c.percent}%',
                        status: reportStatus(c.percent),
                      ),
                  ],
                ),
              ],
            ),
          ),
          _Step(
            status: reportStatus(outcome.visaPercent),
            line: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(child: Text(l.fdReportVisa, style: fdText(13, FontWeight.w800, FdColors.ink))),
                    _VisaWord(percent: outcome.visaPercent),
                  ],
                ),
                const SizedBox(height: 6),
                SegmentMeter(percent: outcome.visaPercent, dark: false, height: 12, expand: true),
              ],
            ),
          ),
          Row(
            children: [
              _Circle(status: overall),
              const SizedBox(width: 12),
              Expanded(child: Text(l.fdReportStudy, style: fdText(13, FontWeight.w800, FdColors.ink))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: overall.bg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: FdColors.ink, width: 1.5),
                ),
                child: Text(_verdict(l, outcome.band), style: fdText(12, FontWeight.w800, overall.fg)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VisaWord extends StatelessWidget {
  const _VisaWord({required this.percent});

  final int percent;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final sg = segmentsOf(percent);
    final color = sg <= 2 ? segmentColor(percent) : FdColors.good;
    return Text('${segmentWord(l, percent)} · $percent%', style: fdText(11, FontWeight.w800, color));
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.status, required this.line, required this.child});

  final ({String glyph, Color bg, Color fg}) status;
  final bool line;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              _Circle(status: status),
              if (line)
                Expanded(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: 10),
                    child: ColoredBox(color: FdColors.ink, child: SizedBox(width: 1.5)),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(child: Padding(padding: const EdgeInsets.only(bottom: 10), child: child)),
        ],
      ),
    );
  }
}

class _Circle extends StatelessWidget {
  const _Circle({required this.status});

  final ({String glyph, Color bg, Color fg}) status;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: status.bg,
        shape: BoxShape.circle,
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Text(status.glyph, style: fdText(16, FontWeight.w800, status.fg, height: 1)),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.status});

  final String label;
  final ({String glyph, Color bg, Color fg}) status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: status.bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Text(label, style: fdText(11, FontWeight.w800, status.fg)),
    );
  }
}

class _FixRow extends StatelessWidget {
  const _FixRow({required this.fix});

  final AssessmentFix fix;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final label = switch (fix.kind) {
      FixKind.bank => l.fdFixBank(l.fdMln((fix.value / 1000000).round())),
      FixKind.topik => l.fdFixTopik(fix.value),
    };
    final gain = switch (fix.kind) {
      FixKind.bank => l.fdGainVisa(fix.gain),
      FixKind.topik => l.fdGainAdmission(fix.gain),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: FdColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: fdText(12, FontWeight.w700, FdColors.ink))),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(5)),
            child: Text(gain, style: fdText(11, FontWeight.w800, FdColors.onLime)),
          ),
        ],
      ),
    );
  }
}

/// "Hisobotni bepul yuboramiz": name, phone, Yuborish.
class _LeadForm extends StatelessWidget {
  const _LeadForm({
    required this.name,
    required this.phone,
    required this.sending,
    required this.error,
    required this.onSend,
  });

  final TextEditingController name;
  final TextEditingController phone;
  final bool sending;
  final String? error;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FdColors.navy,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
        boxShadow: const [BoxShadow(color: FdColors.lime, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '${l.fdReportFormLead} '),
                TextSpan(text: l.fdReportFormFree, style: const TextStyle(color: FdColors.lime)),
                TextSpan(text: ' ${l.fdReportFormTail}'),
              ],
            ),
            style: fdText(15, FontWeight.w800, Colors.white),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _Input(
                  controller: name,
                  hint: l.fdReportName,
                  keyboard: TextInputType.name,
                  capitalization: TextCapitalization.words,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Input(
                  controller: phone,
                  hint: '90 ···',
                  prefix: '+998',
                  keyboard: TextInputType.phone,
                  formatters: [UzPhoneFormatter()],
                  focusedBorder: FdColors.lime,
                ),
              ),
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: fdText(12, FontWeight.w700, const Color(0xFFFF9B9B))),
          ],
          const SizedBox(height: 8),
          SizedBox(
            height: 46,
            child: Semantics(
              button: true,
              child: GestureDetector(
                onTap: sending ? null : onSend,
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: FdColors.lime,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: FdColors.ink, width: 1.5),
                  ),
                  child: sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2.2, color: FdColors.onLime),
                        )
                      : Text(l.fdReportSend, style: fdText(15, FontWeight.w800, FdColors.onLime)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Input extends StatelessWidget {
  const _Input({
    required this.controller,
    required this.hint,
    required this.keyboard,
    this.prefix,
    this.formatters = const [],
    this.capitalization = TextCapitalization.none,
    this.focusedBorder,
  });

  final TextEditingController controller;
  final String hint;
  final TextInputType keyboard;
  final String? prefix;
  final List<TextInputFormatter> formatters;
  final TextCapitalization capitalization;
  final Color? focusedBorder;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: FdColors.ink, width: 1.5),
    );
    return SizedBox(
      height: 42,
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        inputFormatters: formatters,
        textCapitalization: capitalization,
        cursorColor: FdColors.ink,
        style: fdText(13, FontWeight.w700, FdColors.ink),
        decoration: InputDecoration(
          filled: true,
          fillColor: FdColors.card,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          // Always shown, not only while focused: the design writes "+998"
          // in the empty field.
          prefixIcon: prefix == null
              ? null
              : Padding(
                  padding: const EdgeInsets.only(left: 12, right: 6),
                  child: Text(prefix!, style: fdText(13, FontWeight.w800, FdColors.ink)),
                ),
          prefixIconConstraints: const BoxConstraints(),
          hintText: hint,
          hintStyle: fdText(13, FontWeight.w600, FdColors.muted),
          border: border,
          enabledBorder: border,
          focusedBorder: border.copyWith(
            borderSide: BorderSide(color: focusedBorder ?? FdColors.ink, width: focusedBorder == null ? 1.5 : 2),
          ),
        ),
      ),
    );
  }
}
