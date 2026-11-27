import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/repositories/pyol_repository.dart';
import '../../../data/repositories/pyol_store.dart';
import '../../../data/repositories/shift_repository.dart' show OfflineException, ShiftActionException;
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';
import 'bank_topup_screen.dart' show bankTopupPath;
import 'coins.dart' show coinsProvider;

/// The HanPyol bot's username (`--dart-define=ISH_TG_BOT=…`, set by the
/// web build); empty: no invite link.
const ishTelegramBot = String.fromEnvironment('ISH_TG_BOT');

/// The link a worker shares: t.me/<bot>?start=<code>.
String inviteLink(String code) => 'https://t.me/$ishTelegramBot?start=$code';

final storeProductsProvider = FutureProvider.autoDispose<List<StoreProduct>>(
  (ref) => ref.watch(pyolStoreProvider).products(),
  retry: (count, error) => null,
);

final referralProvider = FutureProvider.autoDispose<Referral?>(
  (ref) => ref.watch(pyolRepositoryProvider).referral(),
  retry: (count, error) => null,
);

/// «Puyl olish»: the balance, the packs to buy in Google Play / the App
/// Store (their own payment sheet), how puyl comes for free, and the invite
/// code. No bank details or outside links (store rules, 2026-11-25).
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
  bool _buying = false;
  StreamSubscription<StoreResult>? _results;

  @override
  void initState() {
    super.initState();
    _results = ref.read(pyolStoreProvider).results.listen(_onResult);
  }

  @override
  void dispose() {
    _results?.cancel();
    _friendCode.dispose();
    super.dispose();
  }

  void _onResult(StoreResult result) {
    if (!mounted) return;
    final l10n = WorkerL10n.of(context);
    setState(() => _buying = result is StorePending);
    switch (result) {
      case StoreCredited(:final pyols, :final balance):
        ref.invalidate(coinsProvider);
        _say(l10n.storeCredited(pyols, balance));
      case StorePending():
        _say(l10n.storePending);
      case StoreFailed():
        _say(l10n.storeFailed);
      case StoreCancelled():
        break;
    }
  }

  Future<void> _buy(StoreProduct product) async {
    setState(() => _buying = true);
    try {
      await ref.read(pyolStoreProvider).buy(product);
    } on Object {
      if (mounted) {
        setState(() => _buying = false);
        _say(WorkerL10n.of(context).storeFailed);
      }
    }
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
              const SizedBox(height: 14),
              if (kIsWeb)
                // The web app / Telegram mini app: no store — bank transfer.
                HiButton(
                  label: l10n.bankBuyButton,
                  height: 48,
                  fontSize: 16,
                  onPressed: () {
                    final router = GoRouter.of(context);
                    Navigator.of(context).pop();
                    router.push(bankTopupPath);
                  },
                )
              else
              ref.watch(storeProductsProvider).when(
                    loading: () => const Center(
                        child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator())),
                    error: (_, _) => HiText(l10n.storeUnavailable, style: body),
                    data: (products) => products.isEmpty
                        ? HiText(l10n.storeUnavailable, style: body)
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              for (final p in products) ...[
                                HiButton(
                                  label: l10n.storeBuy(p.pyols, p.price),
                                  height: 48,
                                  fontSize: 16,
                                  style: p.pyols == 100 ? HiButtonStyle.lime : HiButtonStyle.outline,
                                  onPressed: _buying ? null : () => _buy(p),
                                ),
                                const SizedBox(height: 8),
                              ],
                            ],
                          ),
                  ),
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
                if (ishTelegramBot.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  // The link opens the HanPyol bot with the code; the friend's
                  // app fills it in by itself (2026-11-27).
                  HiButton(
                    label: l10n.inviteLinkCopy,
                    height: 44,
                    fontSize: 15,
                    style: HiButtonStyle.outline,
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: inviteLink(referral.code)));
                      _say(l10n.inviteLinkCopied);
                    },
                  ),
                ],
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
