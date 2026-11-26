import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/digit_mask.dart';
import '../../../core/format/phone.dart';
import '../../../data/repositories/auth_repository.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/auth.dart';
import '../../../design/widgets/forms.dart';
import '../../../l10n/gen/worker_l10n.dart';

/// The sentence for a failed sign-in step.
String signInErrorText(WorkerL10n l10n, Object error) => switch (error) {
      ShiftActionException(code: 'CODE_INVALID') => l10n.errCodeInvalid,
      ShiftActionException(code: 'TOO_MANY_REQUESTS') => l10n.errTooManyRequests,
      ShiftActionException(code: 'PHONE_INVALID') => l10n.errPhoneInvalid,
      ShiftActionException(code: 'SMS_FAILED') => l10n.errSmsFailed,
      OfflineException() => l10n.errOffline,
      _ => l10n.errorGeneric,
    };

/// T1 «Telefon raqamingiz»: the mobile number the code is sent to — Korean
/// (+82) or Uzbek (+998, 2026-11-26).
class PhoneEntryScreen extends ConsumerStatefulWidget {
  const PhoneEntryScreen({super.key, required this.onBack, required this.onSent});

  final VoidCallback onBack;

  /// The code is on its way to [phone] (010-1234-5678 as typed, or +998901234567).
  final ValueChanged<String> onSent;

  @override
  ConsumerState<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends ConsumerState<PhoneEntryScreen> {
  final _phone = TextEditingController();
  final _koreanMask = DigitGroupsFormatter.koreanMobile();
  final _uzbekMask = DigitGroupsFormatter(const [2, 3, 2, 2]);
  bool _uzbek = false;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  /// The number as sent: as typed for Korea, +998 and the digits for Uzbekistan.
  String get _number => _uzbek ? '+998${_phone.text.replaceAll(RegExp(r'\D'), '')}' : _phone.text;

  bool get _valid => SignInPhone.toE164(_number) != null;

  void _country(bool uzbek) {
    if (uzbek == _uzbek) return;
    setState(() {
      _uzbek = uzbek;
      _phone.clear();
      _error = null;
    });
  }

  Future<void> _send() async {
    if (_sending || !_valid) return;
    final l10n = WorkerL10n.of(context);
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final number = _number;
      await ref.read(authRepositoryProvider).sendCode(number);
      if (mounted) widget.onSent(number);
    } catch (error) {
      if (mounted) setState(() => _error = signInErrorText(l10n, error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final error = _error;
    return HiAuthFrame(
      topTitle: l10n.phoneTopTitle,
      title: l10n.phoneTitle,
      subtitle: l10n.phoneSubtitle,
      onBack: widget.onBack,
      action: l10n.getCode,
      onAction: _valid ? _send : null,
      busy: _sending,
      children: [
        Wrap(
          spacing: 8,
          children: [
            ChoiceChip(
              label: Text(l10n.phoneCountryKorea),
              selected: !_uzbek,
              onSelected: (_) => _country(false),
            ),
            ChoiceChip(
              label: Text(l10n.phoneCountryUzbekistan),
              selected: _uzbek,
              onSelected: (_) => _country(true),
            ),
          ],
        ),
        const SizedBox(height: 12),
        HiFieldLabel(l10n.phoneLabel),
        const SizedBox(height: 8),
        HiInputField(
          key: ValueKey(_uzbek),
          controller: _phone,
          mono: true,
          placeholder: _uzbek ? '90-123-45-67' : '010-0000-0000',
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
          inputFormatters: [if (_uzbek) _uzbekMask else _koreanMask],
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() => _error = null),
          onSubmitted: (_) => _send(),
        ),
        const SizedBox(height: 8),
        HiText(_uzbek ? l10n.phoneHintUzbek : l10n.phoneHint, style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted)),
        if (error != null) ...[
          const SizedBox(height: 16),
          HiFormError(error),
        ],
      ],
    );
  }
}

/// T2 «Kodni kiriting» for the worker app.
class PhoneCodeScreen extends ConsumerWidget {
  const PhoneCodeScreen({super.key, required this.phone, required this.onBack, required this.onVerified});

  /// As typed on T1.
  final String phone;
  final VoidCallback onBack;
  final VoidCallback onVerified;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final auth = ref.read(authRepositoryProvider);
    return HiPhoneCodeScreen(
      texts: HiPhoneCodeTexts(
        topTitle: l10n.phoneTopTitle,
        title: l10n.codeTitle,
        subtitle: l10n.codeSentTo(SignInPhone.display(phone)),
        label: l10n.codeLabel,
        action: l10n.confirmCode,
        resend: l10n.resendCode,
        resendIn: l10n.resendIn,
        resent: l10n.codeResent,
      ),
      onBack: onBack,
      verify: (code) => auth.verifyCode(phone, code),
      resend: () => auth.sendCode(phone),
      errorText: (error) => signInErrorText(l10n, error),
      onVerified: onVerified,
    );
  }
}
