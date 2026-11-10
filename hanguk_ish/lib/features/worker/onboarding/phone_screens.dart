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

/// T1 «Telefon raqamingiz»: the Korean mobile number the code is sent to.
class PhoneEntryScreen extends ConsumerStatefulWidget {
  const PhoneEntryScreen({super.key, required this.onBack, required this.onSent});

  final VoidCallback onBack;

  /// The code is on its way to [phone] (as typed: 010-1234-5678).
  final ValueChanged<String> onSent;

  @override
  ConsumerState<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends ConsumerState<PhoneEntryScreen> {
  final _phone = TextEditingController();
  final _mask = DigitGroupsFormatter.koreanMobile();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  bool get _valid => KoreanPhone.toE164(_phone.text) != null;

  Future<void> _send() async {
    if (_sending || !_valid) return;
    final l10n = WorkerL10n.of(context);
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).sendCode(_phone.text);
      if (mounted) widget.onSent(_phone.text);
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
        HiFieldLabel(l10n.phoneLabel),
        const SizedBox(height: 8),
        HiInputField(
          controller: _phone,
          mono: true,
          placeholder: '010-0000-0000',
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
          inputFormatters: [_mask],
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() => _error = null),
          onSubmitted: (_) => _send(),
        ),
        const SizedBox(height: 8),
        HiText(l10n.phoneHint, style: hiStyle(14, FontWeight.w600, color: HiColors.textMuted)),
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
        subtitle: l10n.codeSentTo(KoreanPhone.display(phone)),
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
