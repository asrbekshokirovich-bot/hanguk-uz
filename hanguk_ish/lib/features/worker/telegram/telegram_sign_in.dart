import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../data/backend/backend.dart';
import '../../../data/repositories/shift_repository.dart' show ShiftActionException;
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';
import 'telegram_web_app.dart';

/// The Telegram mini app's sign-in (null on phones): run by the start screen
/// before it looks at the session.
final telegramSignInProvider = Provider<TelegramSignIn?>((ref) => null);

/// Signs the person in with their Telegram account (ish-telegram-auth): the
/// account they had (opened here before, or made in the phone app with the
/// same number), else a new one.
class TelegramSignIn {
  TelegramSignIn(this._client, this._app);

  final SupabaseClient _client;
  final TelegramWebApp _app;

  TelegramWebApp get app => _app;

  Future<void> run(BuildContext context) async {
    final current = _client.auth.currentUser;
    if (current != null) {
      // Already this Telegram account's session: nothing to do.
      if ('${current.appMetadata['telegram_id']}' == '${_app.userId}') return;
      await _client.auth.signOut(scope: SignOutScope.local);
    }
    var answer = await _call({'init_data': _app.initData});
    if (answer['need_contact'] == true) {
      final share = context.mounted && await _askToShare(context);
      final contact = share ? await _app.requestContact() : null;
      answer = await _call({'init_data': _app.initData, 'contact': contact});
    }
    final tokenHash = answer['token_hash'];
    if (tokenHash is! String || tokenHash.isEmpty) throw const ShiftActionException('AUTH_FAILED');
    await authCall(() => _client.auth.verifyOTP(
          tokenHash: tokenHash,
          type: answer['type'] == 'recovery' ? OtpType.recovery : OtpType.magiclink,
        ));
  }

  Future<Map<String, dynamic>> _call(Map<String, dynamic> body) => backendCall(() async {
        try {
          final res = await _client.functions.invoke(ishTelegramAuthFunction, body: body);
          final data = res.data;
          return data is Map<String, dynamic> ? data : <String, dynamic>{};
        } on FunctionException catch (e) {
          final details = e.details;
          final code = details is Map ? details['error'] : null;
          throw ShiftActionException(code is String && code.isNotEmpty ? code : 'AUTH_FAILED');
        }
      });

  Future<bool> _askToShare(BuildContext context) async {
    final share = await showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: HiColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        final l10n = WorkerL10n.of(context);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                HiText(l10n.tgShareTitle, style: hiStyle(18, FontWeight.w800, color: HiColors.ink)),
                const SizedBox(height: 8),
                HiText(l10n.tgShareBody, style: hiStyle(14, FontWeight.w500, height: 1.45, color: HiColors.inkMuted)),
                const SizedBox(height: 20),
                HiButton(label: l10n.tgShareButton, height: 48, fontSize: 16, onPressed: () => Navigator.pop(context, true)),
                const SizedBox(height: 8),
                HiButton(
                  label: l10n.tgShareSkip,
                  height: 48,
                  fontSize: 16,
                  style: HiButtonStyle.outline,
                  onPressed: () => Navigator.pop(context, false),
                ),
              ],
            ),
          ),
        );
      },
    );
    return share ?? false;
  }
}
