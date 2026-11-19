import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/dates.dart';
import '../../../data/models/account.dart';
import '../../../data/repositories/account_repository.dart';
import '../../../design/icons.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../l10n/gen/worker_l10n.dart';

/// The worker's puyl: spent to open a job's phone and address.
final coinsProvider = FutureProvider.autoDispose<CoinWallet>(
  (ref) => ref.watch(accountRepositoryProvider).coins(),
  retry: (count, error) => null,
);

/// One line of the history: what moved the coins.
String coinMoveText(WorkerL10n l10n, CoinMove move) => switch (move.reason) {
      CoinReason.unlock => l10n.coinApplied(move.shiftTitle ?? '–'),
      CoinReason.topup => l10n.coinTopup,
      CoinReason.bonus => l10n.coinBonus,
      CoinReason.staff => move.delta > 0 ? l10n.coinStaffAdded : l10n.coinStaffTaken,
    };

/// A11 «Coinlar»: the balance big, the rule, how to get coins, the last moves.
/// A balance that did not load is «—», never a made-up 0.
class CoinCard extends ConsumerWidget {
  const CoinCard({super.key, required this.lang});

  final String lang;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = WorkerL10n.of(context);
    final wallet = ref.watch(coinsProvider).value;
    final muted = hiStyle(14, FontWeight.w500, height: 1.45, color: HiColors.inkMuted);
    final history = wallet?.history.take(5).toList() ?? const <CoinMove>[];
    return Semantics(
      container: true,
      label: l10n.coinsTitle,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.circular(HiRadii.card),
          border: Border.fromBorderSide(HiBorders.ink),
          boxShadow: HiShadows.hard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(color: HiColors.lime, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: const HiIcon(HiIcons.wallet, size: 20, strokeWidth: 2, color: HiColors.onLime),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: HiText(l10n.coinsTitle, style: hiStyle(17, FontWeight.w800, color: HiColors.ink)),
                  ),
                ),
                HiText(
                  wallet == null ? '—' : l10n.coinsBalance(wallet.balance),
                  style: hiStyle(24, FontWeight.w800, color: HiColors.ink, family: HiFamily.mono),
                ),
              ],
            ),
            const SizedBox(height: 12),
            HiText(l10n.coinsRule, style: muted),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: HiColors.surface, borderRadius: BorderRadius.circular(14)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: HiIcon(HiIcons.info, size: 18, strokeWidth: 2, color: HiColors.ink),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: HiText(l10n.coinsHowToGet,
                        style: hiStyle(14, FontWeight.w600, height: 1.45, color: HiColors.ink)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            HiText(l10n.coinsHistory, style: hiStyle(15, FontWeight.w800, color: HiColors.ink)),
            const SizedBox(height: 6),
            if (wallet == null)
              HiText('—', style: muted)
            else if (history.isEmpty)
              HiText(l10n.coinsNoHistory, style: muted)
            else
              for (final move in history)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            HiText(coinMoveText(l10n, move),
                                style: hiStyle(15, FontWeight.w700, color: HiColors.ink)),
                            if (move.note.isNotEmpty)
                              HiText(move.note, style: hiStyle(13, FontWeight.w500, color: HiColors.inkMuted)),
                            HiText(HiDates.dayMonth(move.createdAt, lang),
                                style: hiStyle(13, FontWeight.w500, color: HiColors.inkMuted)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      HiText(
                        move.delta > 0 ? '+${move.delta}' : '${move.delta}',
                        style: hiStyle(17, FontWeight.w800,
                            color: move.delta > 0 ? HiColors.greenInk : HiColors.redInk, family: HiFamily.mono),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
