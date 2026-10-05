import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design_system/seoul_night/widgets/svg_path_icon.dart';
import '../../../l10n/app_localizations.dart';
import '../../entry/data/entry_store.dart';
import '../../entry/presentation/widgets/entry_fields.dart';
import '../data/quiz_controller.dart';
import '../data/quiz_repository.dart';
import '../domain/result_payload.dart';
import 'result_texts.dart';
import 's01_s04_ui.dart';

/// "Now", for the working-hours banner. Overridden in tests.
final contactSheetClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

/// Operators work Mon–Sat 09:40–18:00, Tashkent time (UTC+5, no DST).
bool isTashkentWorkingHours(DateTime now) {
  final t = now.toUtc().add(const Duration(hours: 5));
  if (t.weekday == DateTime.sunday) return false;
  final m = t.hour * 60 + t.minute;
  return m >= 9 * 60 + 40 && m < 18 * 60;
}

/// S04 — Ism va telefon (pastki oyna), opened over S03.
///
/// [openTelegramAfter] starts with the "Rejani Telegram'imga ham yuboring"
/// toggle on.
Future<void> showContactSheet(
  BuildContext context,
  WidgetRef ref, {
  bool openTelegramAfter = true,
}) async {
  final outcome = await showOnbSheet<_Outcome>(
    context,
    builder: (_) => _ContactSheet(openTelegramAfter: openTelegramAfter),
  );
  if (outcome == _Outcome.student && context.mounted) {
    // Already a client: the client-code sign-in, with the notice the old
    // sign-up step showed.
    context.push(
      '/login',
      extra: {
        'magic_code': true,
        'notice': AppLocalizations.of(context)!.entryStudentNotice,
      },
    );
  }
}

enum _Outcome { student }

enum _Error { name, phone, network }

class _ContactSheet extends ConsumerStatefulWidget {
  const _ContactSheet({required this.openTelegramAfter});

  final bool openTelegramAfter;

  @override
  ConsumerState<_ContactSheet> createState() => _ContactSheetState();
}

class _ContactSheetState extends ConsumerState<_ContactSheet> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  late bool _telegram = widget.openTelegramAfter;
  bool _sending = false;
  _Error? _error;

  @override
  void initState() {
    super.initState();
    // The number given last time, so the form is filled in.
    final saved = ref.read(entryProvider).phone;
    if (saved != null) {
      _phone.text = UzPhoneFormatter.format(UzPhoneFormatter.digitsOf(saved));
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context)!;
    final name = _name.text.trim();
    final digits = UzPhoneFormatter.digitsOf(_phone.text);
    if (name.isEmpty) return setState(() => _error = _Error.name);
    if (digits.length != kUzNationalDigits) {
      return setState(() => _error = _Error.phone);
    }
    final r = ref.read(eligibilityResultProvider).value;
    if (r == null) return setState(() => _error = _Error.network);

    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = null;
    });
    final answers = ref.read(quizProvider).answers;
    final repo = ref.read(quizRepositoryProvider);
    final res = await repo.submit(
      phoneE164: uzE164(digits),
      name: name,
      answers: answers.toJson(),
      result: resultPayload(r, answers, planText: planText(l, answers, r)),
    );
    if (!mounted) return;
    setState(() => _sending = false);

    switch (res.status) {
      case QuizSubmitStatus.ok:
        final phone = res.phone ?? uzE164(digits);
        await ref.read(entryProvider.notifier).setRegistered(phone);
        ref
            .read(quizProvider.notifier)
            .markSubmitted(phone: phone, name: name, linkCode: res.linkCode);
        // The success state has no Telegram button, so the plan's chat opens
        // straight away when the toggle asked for it.
        if (_telegram && res.linkCode != null) {
          await _openTelegram(repo, res.linkCode!);
        }
      case QuizSubmitStatus.student:
        if (mounted) Navigator.of(context).pop(_Outcome.student);
      case QuizSubmitStatus.invalidPhone:
        setState(() => _error = _Error.phone);
      case QuizSubmitStatus.invalidName:
        setState(() => _error = _Error.name);
      case QuizSubmitStatus.network:
        setState(() => _error = _Error.network);
    }
  }

  Future<void> _openTelegram(QuizRepository repo, String linkCode) async {
    final bot = await repo.botUsername();
    if (bot == null) return;
    try {
      await launchUrl(
        Uri.parse('https://t.me/$bot?start=L_$linkCode'),
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      debugPrint('telegram open failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final quiz = ref.watch(quizProvider);
    if (quiz.submitted) {
      return _Success(
        name: quiz.submittedName ?? '',
        phone: quiz.submittedPhone!,
      );
    }
    final l = AppLocalizations.of(context)!;
    final afterHours = !isTashkentWorkingHours(
      ref.watch(contactSheetClockProvider)(),
    );

    final children = <Widget>[
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.onbContactTitle,
            style: onbText(
              21,
              FontWeight.w800,
              height: 1.2,
              letterSpacingEm: -.02,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            l.onbContactSubtitle,
            style: onbText(
              14,
              FontWeight.w400,
              height: 1.45,
              color: OnbColors.text64,
            ),
          ),
        ],
      ),
      if (afterHours) _AfterHours(text: l.onbContactAfterHours),
      _Field(
        label: l.onbContactName,
        error: _error == _Error.name ? l.onbContactNameError : null,
        child: TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.givenName],
          style: _inputStyle,
          cursorColor: OnbColors.lime,
          decoration: InputDecoration.collapsed(
            hintText: l.onbContactName,
            hintStyle: _inputStyle.copyWith(color: OnbColors.text40),
          ),
          onChanged: (_) {
            if (_error == _Error.name) setState(() => _error = null);
          },
        ),
      ),
      _Field(
        label: l.onbContactPhone,
        error: _error == _Error.phone ? l.onbContactPhoneError : null,
        child: Row(
          children: [
            Text(
              '+998',
              style: _inputStyle.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.telephoneNumberNational],
                inputFormatters: const [UzPhoneFormatter()],
                style: _inputStyle,
                cursorColor: OnbColors.lime,
                decoration: InputDecoration.collapsed(
                  hintText: '__ ___ __ __',
                  hintStyle: _inputStyle.copyWith(color: OnbColors.text40),
                ),
                onChanged: (_) {
                  if (_error == _Error.phone) setState(() => _error = null);
                },
                onSubmitted: (_) => _sending ? null : _submit(),
              ),
            ),
          ],
        ),
      ),
      _TelegramToggle(
        label: l.onbContactTelegram,
        value: _telegram,
        onChanged: (v) => setState(() => _telegram = v),
      ),
      if (_error == _Error.network)
        Text(l.onbContactNetworkError, style: _errorStyle),
      OnbPrimaryButton(
        label: l.onbContactCta,
        loading: _sending,
        onPressed: _sending ? null : _submit,
      ),
      Text(
        l.onbContactHours,
        textAlign: TextAlign.center,
        style: onbText(
          12,
          FontWeight.w400,
          height: 1.45,
          color: OnbColors.text64,
        ),
      ),
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(height: 16),
          children[i],
        ],
      ],
    );
  }
}

final TextStyle _inputStyle = onbText(16, FontWeight.w400);
final TextStyle _errorStyle = onbText(
  12.5,
  FontWeight.w600,
  color: OnbColors.error,
);

/// Label 12px 600 .64, then the 54px glass box; [error] turns the border
/// #F87171 and is written under it.
class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child, this.error});

  final String label;
  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: onbText(12, FontWeight.w600, color: OnbColors.text64),
        ),
        const SizedBox(height: 6),
        Container(
          height: 54,
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: OnbColors.glass,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: error != null ? OnbColors.error : OnbColors.line,
            ),
          ),
          child: child,
        ),
        if (error != null) ...[
          const SizedBox(height: 6),
          Text(error!, style: _errorStyle),
        ],
      ],
    );
  }
}

/// radius 16, amber .1 fill, amber .45 border, 8px amber dot, 13px text.
class _AfterHours extends StatelessWidget {
  const _AfterHours({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color.fromRGBO(245, 196, 81, .1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color.fromRGBO(245, 196, 81, .45)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(
              color: OnbColors.amber,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: onbText(13, FontWeight.w400, height: 1.45)),
          ),
        ],
      ),
    );
  }
}

/// min 44px row, 14px label, 50×30 switch (lime on / .2 off, 24px knob).
class _TelegramToggle extends StatelessWidget {
  const _TelegramToggle({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onChanged(!value),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Row(
            children: [
              Expanded(
                child: ExcludeSemantics(
                  child: Text(label, style: onbText(14, FontWeight.w400)),
                ),
              ),
              const SizedBox(width: 12),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                width: 50,
                height: 30,
                decoration: BoxDecoration(
                  color: value
                      ? OnbColors.lime
                      : const Color.fromRGBO(255, 255, 255, .2),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Stack(
                  children: [
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOut,
                      top: 3,
                      left: value ? 23 : 3,
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "S04 · muvaffaqiyat".
class _Success extends StatelessWidget {
  const _Success({required this.name, required this.phone});

  final String name;

  /// `+998XXXXXXXXX`.
  final String phone;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final national = UzPhoneFormatter.format(UzPhoneFormatter.digitsOf(phone));
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 20, 8, 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color.fromRGBO(74, 222, 128, .14),
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color.fromRGBO(74, 222, 128, .45),
              ),
            ),
            child: const SvgPathIcon(
              paths: ['M5 12l5 5L20 7'],
              size: 32,
              color: OnbColors.green,
              strokeWidth: 2.6,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l.onbContactSuccess(name),
            textAlign: TextAlign.center,
            style: onbText(
              21,
              FontWeight.w800,
              height: 1.3,
              letterSpacingEm: -.02,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '+998 $national',
            textAlign: TextAlign.center,
            style: onbText(14, FontWeight.w400, color: OnbColors.text64),
          ),
          const SizedBox(height: 16 + 8),
          SizedBox(
            width: double.infinity,
            child: OnbOutlineButton(
              label: l.onbContactBackToResult,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
        ],
      ),
    );
  }
}
