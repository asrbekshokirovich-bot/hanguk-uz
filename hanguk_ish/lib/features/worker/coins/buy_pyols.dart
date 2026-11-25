import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/won.dart';
import '../../../data/repositories/pyol_repository.dart';
import '../../../data/repositories/shift_repository.dart' show OfflineException, ShiftActionException;
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';

final paymentDetailsProvider = FutureProvider.autoDispose<PaymentDetails>(
  (ref) => ref.watch(pyolRepositoryProvider).paymentDetails(),
  retry: (count, error) => null,
);

final referralProvider = FutureProvider.autoDispose<Referral?>(
  (ref) => ref.watch(pyolRepositoryProvider).referral(),
  retry: (count, error) => null,
);

/// «Buy puyl»: the packs, where to send the money, the request; and the
/// invite code below.
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
  int? _pyols;
  String? _method;
  final _payer = TextEditingController();
  final _friendCode = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _payer.dispose();
    _friendCode.dispose();
    super.dispose();
  }

  void _say(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  String _errorText(WorkerL10n l10n, Object error) => error is OfflineException ? l10n.offlineTitle : l10n.errorGeneric;

  Future<void> _send() async {
    final l10n = WorkerL10n.of(context);
    final pyols = _pyols;
    final method = _method;
    if (pyols == null || method == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(pyolRepositoryProvider).requestTopup(pyols: pyols, method: method, payerName: _payer.text.trim());
      ref.invalidate(paymentDetailsProvider);
      if (mounted) _say(l10n.buyPyolsSent);
    } on Object catch (error) {
      if (mounted) _say(_errorText(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

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
      if (mounted) _say(_errorText(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _methodName(WorkerL10n l10n, String method) => switch (method) {
        'kakaopay' => l10n.payKakao,
        'toss' => l10n.payToss,
        _ => l10n.payBank,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final details = ref.watch(paymentDetailsProvider);
    final referral = ref.watch(referralProvider).value;
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
              const SizedBox(height: 6),
              HiText(l10n.buyPyolsHow, style: body),
              const SizedBox(height: 14),
              details.when(
                loading: () => const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
                error: (error, _) => HiText(_errorText(l10n, error), style: body),
                data: (d) {
                  final methods = [for (final m in const ['bank', 'kakaopay', 'toss']) if (d.methods.containsKey(m)) m];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final pack in d.packs)
                            ChoiceChip(
                              label: Text(l10n.buyPyolsPack(pack.pyols, Won.worker(pack.won))),
                              selected: _pyols == pack.pyols,
                              onSelected: (_) => setState(() => _pyols = pack.pyols),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      if (methods.isEmpty)
                        HiText(l10n.buyPyolsNoDetails, style: body)
                      else ...[
                        HiText(l10n.buyPyolsMethod, style: strong),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final m in methods)
                              ChoiceChip(
                                label: Text(_methodName(l10n, m)),
                                selected: _method == m,
                                onSelected: (_) => setState(() => _method = m),
                              ),
                          ],
                        ),
                        if (_method != null) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration:
                                BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(14)),
                            child: Row(
                              children: [
                                Expanded(child: SelectableText(d.methods[_method] ?? '', style: strong)),
                                IconButton(
                                  icon: const Icon(Icons.copy, size: 18),
                                  onPressed: () => Clipboard.setData(ClipboardData(text: d.methods[_method] ?? '')),
                                ),
                              ],
                            ),
                          ),
                          if ((d.methods['note'] ?? '').isNotEmpty) ...[
                            const SizedBox(height: 6),
                            HiText(d.methods['note']!, style: body),
                          ],
                        ],
                        const SizedBox(height: 10),
                        TextField(
                          controller: _payer,
                          maxLength: 100,
                          decoration: InputDecoration(labelText: l10n.buyPyolsPayer, counterText: ''),
                        ),
                        const SizedBox(height: 12),
                        HiButton(
                          label: l10n.buyPyolsSend,
                          height: 48,
                          fontSize: 16,
                          onPressed: _busy || _pyols == null || _method == null ? null : _send,
                        ),
                      ],
                      if (d.pending.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        HiText(l10n.buyPyolsPending, style: strong),
                        for (final p in d.pending)
                          HiText('${p.pyols} P · ${Won.worker(p.won)} · ${_methodName(l10n, p.method)}', style: body),
                      ],
                    ],
                  );
                },
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
