import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/app_events.dart';
import '../../../core/analytics/form_progress.dart';
import '../../../core/analytics/tracked.dart';
import '../../../core/country/app_country.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../discover/presentation/discover_routes.dart';
import '../../discover/presentation/widgets/assess_parts.dart';
import '../../entry/data/entry_store.dart';
import '../../entry/presentation/widgets/entry_fields.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../data/assessment_controller.dart';

/// Prototype screen 7, "Konsultant bog'lanadi": name, +998 phone and a dashed
/// note about the client code the SMS brings. Sending creates the lead
/// (`app_quiz_submit`, as the old quiz's S04 did) and opens "Yuborildi".
///
/// Set up for Kyrgyzstan (plan KG3, design «Lid formasi: +996 va rozilik»):
/// +996 and nine digits (700 123 456), and a consent box that has to be ticked
/// before «Yuborish». The Uzbek form is unchanged.
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

  /// «Kim uchun?» and «Bizni qayerdan topdingiz?» (how_heard keys, see
  /// lead_how_heard): optional; the person's own answer is the lead's source.
  String? _forWhom;
  String? _heard;

  /// Kyrgyzstan only: personal data sent to Hanguk and kept in Korea.
  bool _consent = false;

  AppCountry get _country => ref.read(entryProvider).country ?? AppCountry.uz;

  void _answer(String q, String? value) {
    setState(() {
      if (q == 'for_whom') {
        _forWhom = value;
      } else {
        _heard = value;
      }
    });
    AppEvents.track('question_answer', props: {'form': 'lead', 'q': q, 'band': value});
  }

  @override
  void initState() {
    super.initState();
    AppEvents.track('form_open', props: {'form': 'lead'});
    final saved = ref.read(entryProvider).phone;
    final phone = NationalPhone(_country);
    if (saved != null && phone.owns(saved)) _phone.text = phone.format(phone.digitsOf(saved));
  }

  /// `form_leave`: which of the four fields were filled when the page went.
  final _progress = FormProgress('lead');

  @override
  void dispose() {
    if (_name.text.trim().isNotEmpty) _progress.answered('name');
    if (NationalPhone(_country).digitsOf(_phone.text).length == kUzNationalDigits) _progress.answered('phone');
    if (_forWhom != null) _progress.answered('for_whom');
    if (_heard != null) _progress.answered('how_heard');
    _progress.leave(total: 4);
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context)!;
    final outcome = ref.read(assessmentOutcomeProvider);
    if (outcome == null) return;
    final name = _name.text.trim();
    final country = _country;
    final national = NationalPhone(country);
    final digits = national.digitsOf(_phone.text);
    if (country == AppCountry.kg && !_consent) return;
    if (name.isEmpty) {
      AppEvents.track('field_error', props: {'form': 'lead', 'field': 'name', 'code': 'empty'});
      return setState(() => _error = l.fdReportNameError);
    }
    if (digits.length != kUzNationalDigits) {
      AppEvents.track('field_error', props: {'form': 'lead', 'field': 'phone', 'code': digits.isEmpty ? 'empty' : 'short'});
      return setState(() => _error = l.fdReportPhoneError);
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });
    final input = ref.read(assessmentProvider);
    final res = await ref.read(quizRepositoryProvider).submit(
      phoneE164: national.e164(digits),
      country: country.code,
      name: name,
      answers: {
        ...input.toAnswers(requiredBankKrw: outcome.requiredBankKrw),
        'how_heard': ?_heard,
        'for_whom': ?_forWhom,
      },
      result: outcome.toResult(),
    );
    AppEvents.track('lead_submit', props: {'status': res.status.name});
    AppEvents.track('form_submit', props: {'form': 'lead', 'result': res.status.name});
    if (res.status == QuizSubmitStatus.ok) _progress.sent();
    if (res.status == QuizSubmitStatus.ok) AppEvents.linkLead(res.linkCode);
    if (!mounted) return;
    setState(() => _sending = false);
    switch (res.status) {
      case QuizSubmitStatus.ok:
        final phone = res.phone ?? national.e164(digits);
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
    final kg = (ref.watch(entryProvider.select((s) => s.country)) ?? AppCountry.uz) == AppCountry.kg;
    final phone = NationalPhone(kg ? AppCountry.kg : AppCountry.uz);
    final ready = !kg || _consent;
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
                    TrackedField(
                      form: 'lead',
                      field: 'name',
                      child: _Field(
                        controller: _name,
                        hint: l.fdReportName,
                        keyboard: TextInputType.name,
                        capitalization: TextCapitalization.words,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TrackedField(
                      form: 'lead',
                      field: 'phone',
                      child: _Field(
                        controller: _phone,
                        hint: phone.hint,
                        prefix: phone.code,
                        keyboard: TextInputType.phone,
                        formatters: [phone.formatter],
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!, style: fdText(13, FontWeight.w700, const Color(0xFFFF9B9B))),
                    ],
                    const SizedBox(height: 18),
                    _Question(
                      label: l.leadForWhomQ,
                      child: assessPills<String?>(
                        [
                          ('self', l.leadForWhomSelf),
                          ('child', l.leadForWhomChild),
                          ('relative', l.leadForWhomRelative),
                        ],
                        _forWhom,
                        trackedValue<String?>('lead.for_whom', (v) => _answer('for_whom', v))!,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _Question(
                      label: l.leadHowHeardQ,
                      child: assessPills<String?>(
                        [
                          ('instagram', l.leadHeardInstagram),
                          ('telegram', l.leadHeardTelegram),
                          ('friend', l.leadHeardFriend),
                          ('korea_friend', l.leadHeardKoreaFriend),
                          ('learning_center', l.leadHeardLearningCenter),
                          ('event', l.leadHeardEvent),
                          ('store', l.leadHeardStore),
                          ('other', l.leadHeardOther),
                        ],
                        _heard,
                        trackedValue<String?>('lead.how_heard', (v) => _answer('how_heard', v))!,
                      ),
                    ),
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
                    const SizedBox(height: 12),
                    Text(l.leadConsent, style: fdText(12, FontWeight.w600, FdColors.pageMuted, height: 1.45)),
                    if (kg) ...[
                      const SizedBox(height: 14),
                      _ConsentBox(
                        value: _consent,
                        label: l.leadKgConsent,
                        onChanged: (v) {
                          setState(() => _consent = v);
                          AppEvents.track('question_answer', props: {'form': 'lead', 'q': 'consent', 'band': v ? 'yes' : 'no'});
                        },
                      ),
                    ],
                  ],
                ),
              ),
              FdBottomBar(
                // Kyrgyzstan: off until the consent box is ticked (design).
                child: IgnorePointer(
                  ignoring: !ready,
                  child: AnimatedOpacity(
                    opacity: ready ? 1 : 0.45,
                    duration: const Duration(milliseconds: 150),
                    child: HardButton(label: l.fdReportSend, loading: _sending, onPressed: tracked('lead.report_send', _submit)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The consent box of the Kyrgyz form: a 24px lime check and its text;
/// tapping the text ticks it too.
class _ConsentBox extends StatelessWidget {
  const _ConsentBox({required this.value, required this.label, required this.onChanged});

  final bool value;
  final String label;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    // One node for a screen reader: the box's state and the text.
    return MergeSemantics(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: tracked('lead.consent_text', () => onChanged(!value)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox.square(
              dimension: 24,
              child: Checkbox(
                value: value,
                onChanged: trackedValue<bool?>('lead.consent', (v) => onChanged(v ?? false)),
                activeColor: FdColors.lime,
                checkColor: FdColors.ink,
                side: const BorderSide(color: Colors.white, width: 1.5),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: fdText(13, FontWeight.w600, Colors.white, height: 1.45))),
          ],
        ),
      ),
    );
  }
}

/// A question of the form: its label, the answers under it.
class _Question extends StatelessWidget {
  const _Question({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: fdText(14, FontWeight.w800, FdColors.onPage)),
        const SizedBox(height: 8),
        child,
      ],
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
