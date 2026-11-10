import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/phone.dart';
import '../../../data/repositories/auth_repository.dart';
import '../../../design/widgets/auth.dart';
import '../ko.dart';

/// T2 for owners: the SMS code after BA0 «시작하기».
class Ba0CodeScreen extends ConsumerWidget {
  const Ba0CodeScreen({super.key, required this.phone, required this.onBack, required this.onVerified});

  /// As typed on BA0.
  final String phone;
  final VoidCallback onBack;
  final VoidCallback onVerified;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.read(authRepositoryProvider);
    return HiPhoneCodeScreen(
      texts: HiPhoneCodeTexts(
        topTitle: Ko.codeTopTitle,
        title: Ko.codeTitle,
        subtitle: Ko.codeSentTo(KoreanPhone.display(phone)),
        label: Ko.codeLabel,
        action: Ko.codeConfirm,
        resend: Ko.codeResend,
        resendIn: Ko.codeResendIn,
        resent: Ko.codeResent,
      ),
      watermark: '사장님',
      onBack: onBack,
      verify: (code) => auth.verifyCode(phone, code),
      resend: () => auth.sendCode(phone),
      errorText: Ko.error,
      onVerified: onVerified,
    );
  }
}
