import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../entry/data/entry_store.dart';
import '../../entry/presentation/widgets/entry_fields.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../data/assessment_controller.dart';

/// Prototype screen 7, "Konsultant bog'lanadi": name, +998 phone and a dashed
/// note about the client code the SMS brings. Sending creates the lead
/// (`app_quiz_submit`, as the old quiz's S04 did) and opens "Yuborildi".
class LeadScreen extends ConsumerStatefulWidget {
  const LeadScreen({super.key});

  @override
  ConsumerState<LeadScreen> createState() => _LeadScreenState();
}

class _LeadScreenState extends ConsumerState<LeadScreen> {
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

  Future<void> _submit() async {
    final l = AppLocalizations.of(context)!;
    final outcome = ref.read(assessmentOutcomeProvider);
    if (outcome == null) return;
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
    AppEvents.track('lead_submit', props: {'status': res.status.name});
    if (res.status == QuizSubmitStatus.ok) AppEvents.linkLead(res.linkCode);
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

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final jobs = ref.watch(assessmentOutcomeProvider)?.fixes.length ?? 0;
    return Scaffold(
      backgroundColor: FdColors.page,
      body: FdPage(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 0),
                child: Row(
                  children: [
                    HardIconButton(
                      glyph: LucideIcons.chevronLeft,
                      size: 38,
                      semanticLabel: MaterialLocalizations.of(context).backButtonTooltip,
                      onTap: tracked('lead.back', () => context.pop()),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l.fdLeadTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: fdText(24, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.5),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
                  children: [
                    Text(l.fdLeadSub(jobs), style: fdText(15, FontWeight.w400, FdColors.pageMuted, height: 1.45)),
                    const SizedBox(height: 14),
                    _Field(
                      controller: _name,
                      hint: l.fdReportName,
                      keyboard: TextInputType.name,
                      capitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: 12),
                    _Field(
                      controller: _phone,
                      hint: '90 ··· ·· ··',
                      prefix: '+998',
                      keyboard: TextInputType.phone,
                      formatters: [UzPhoneFormatter()],
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!, style: fdText(13, FontWeight.w700, const Color(0xFFFF9B9B))),
                    ],
                    const SizedBox(height: 12),
                    _CodeHint(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: l.fdLeadHintA),
                            TextSpan(text: l.fdLeadHintB, style: const TextStyle(fontWeight: FontWeight.w900)),
                            TextSpan(text: l.fdLeadHintC),
                          ],
                        ),
                        style: fdText(13, FontWeight.w700, FdColors.blue, height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
              FdBottomBar(
                child: HardButton(label: l.fdReportSend, loading: _sending, onPressed: tracked('lead.report_send', _submit)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A white 52px field with an ink border; lime while it has focus.
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    required this.keyboard,
    this.prefix,
    this.formatters = const [],
    this.capitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String hint;
  final TextInputType keyboard;
  final String? prefix;
  final List<TextInputFormatter> formatters;
  final TextCapitalization capitalization;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide(color: c, width: w),
    );
    return SizedBox(
      height: 52,
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        inputFormatters: formatters,
        textCapitalization: capitalization,
        cursorColor: FdColors.ink,
        style: fdText(17, FontWeight.w800, FdColors.ink),
        decoration: InputDecoration(
          filled: true,
          fillColor: FdColors.card,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          prefixIcon: prefix == null
              ? null
              : Padding(
                  padding: const EdgeInsets.only(left: 16, right: 10),
                  child: Text(prefix!, style: fdText(17, FontWeight.w800, FdColors.ink)),
                ),
          prefixIconConstraints: const BoxConstraints(),
          hintText: hint,
          hintStyle: fdText(17, FontWeight.w600, FdColors.muted),
          border: border(FdColors.ink, 1.5),
          enabledBorder: border(FdColors.ink, 1.5),
          focusedBorder: border(FdColors.lime, 2.5),
        ),
      ),
    );
  }
}

/// The white note with a dashed blue border.
class _CodeHint extends StatelessWidget {
  const _CodeHint({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => CustomPaint(
    foregroundPainter: const _DashedBorder(color: FdColors.blue, radius: 16),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(color: FdColors.card, borderRadius: BorderRadius.circular(16)),
      child: child,
    ),
  );
}

class _DashedBorder extends CustomPainter {
  const _DashedBorder({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(0.75));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 7) {
        canvas.drawPath(m.extractPath(d, (d + 4).clamp(0, m.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color || old.radius != radius;
}
