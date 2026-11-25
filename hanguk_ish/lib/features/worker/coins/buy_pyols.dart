import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/pyol_repository.dart';
import '../../../data/repositories/shift_repository.dart' show OfflineException, ShiftActionException;
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../l10n/gen/worker_l10n.dart';
import 'coins.dart' show coinsProvider;

final referralProvider = FutureProvider.autoDispose<Referral?>(
  (ref) => ref.watch(pyolRepositoryProvider).referral(),
  retry: (count, error) => null,
);

/// «Puyl olish»: the balance, how puyl comes for free, and the invite code.
///
/// No payment details, no outside link: Google Play and the App Store sell
/// digital coins only through their own billing (2026-11-25). Puyl bought
/// elsewhere still arrives here (the staff approve a top-up request).
Future<void> showBuyPyolsSheet(BuildContext context) => showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: HiColors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => const BuyPyolsSheet(),
    );

class BuyPyolsSheet extends ConsumerStatefulWidget {
  const BuyPyolsSheet({super.key});

  @override
  ConsumerState<BuyPyolsSheet> createState() => _BuyPyolsSheetState();
}

class _BuyPyolsSheetState extends ConsumerState<BuyPyolsSheet> {
  final _friendCode = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _friendCode.dispose();
    super.dispose();
  }

  void _say(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _saveFriendCode() async {
    final l10n = WorkerL10n.of(context);
    final code = _friendCode.text.trim();
    if (code.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(pyolRepositoryProvider).setReferrer(code);
      ref.invalidate(referralProvider);
      if (mounted) _say(l10n.inviteSaved);
    } on ShiftActionException catch (error) {
      if (mounted) _say(error.code == 'NOT_FOUND' ? l10n.inviteEnter : l10n.errorGeneric);
    } on Object catch (error) {
      if (mounted) _say(error is OfflineException ? l10n.offlineTitle : l10n.errorGeneric);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final referral = ref.watch(referralProvider).value;
    final balance = ref.watch(coinsProvider).value?.balance;
    final title = hiStyle(18, FontWeight.w800, color: HiColors.ink);
    final body = hiStyle(14, FontWeight.w500, height: 1.45, color: HiColors.inkMuted);
    final strong = hiStyle(15, FontWeight.w700, color: HiColors.ink);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HiText(l10n.buyPyols, style: title),
              if (balance != null) ...[
                const SizedBox(height: 8),
                HiText('$balance P', style: hiStyle(28, FontWeight.w800, color: HiColors.ink)),
              ],
              const SizedBox(height: 6),
              HiText(l10n.buyPyolsHow, style: body),
              const SizedBox(height: 24),
              HiText(l10n.inviteTitle, style: title),
              const SizedBox(height: 6),
              HiText(l10n.inviteBody, style: body),
              if (referral != null && referral.code.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: HiText(l10n.inviteYourCode(referral.code), style: strong)),
                    IconButton(
                      icon: const Icon(Icons.copy, size: 18),
                      onPressed: () => Clipboard.setData(ClipboardData(text: referral.code)),
                    ),
                  ],
                ),
              ],
              if (referral != null && !referral.invitedBy) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _friendCode,
                        textCapitalization: TextCapitalization.characters,
                        maxLength: 12,
                        decoration: InputDecoration(labelText: l10n.inviteEnter, counterText: ''),
                      ),
                    ),
                    const SizedBox(width: 8),
                    TextButton(onPressed: _busy ? null : _saveFriendCode, child: Text(l10n.inviteSave)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
