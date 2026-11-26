import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/links/directions.dart' show linkOpenerProvider;
import '../../../data/repositories/pyol_repository.dart';
import '../../../data/repositories/shift_repository.dart' show OfflineException, ShiftActionException;
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart' show HiTopBar;
import '../../../l10n/gen/worker_l10n.dart';
import '../telegram/telegram_web_app.dart';

final _paymentDetailsProvider = FutureProvider.autoDispose<PaymentDetails>(
  (ref) => ref.watch(pyolRepositoryProvider).paymentDetails(),
  retry: (count, error) => null,
);

final _myTopupsProvider = FutureProvider.autoDispose<List<TopupOrder>>(
  (ref) => ref.watch(pyolRepositoryProvider).myTopups(),
  retry: (count, error) => null,
);

/// The screen's route in the worker app (web: hanpyol-tg.vercel.app/#/pyol).
const bankTopupPath = '/pyol';

String _won(int won) => '₩${NumberFormat.decimalPattern('en').format(won)}';

/// Buying puyl by Korean bank transfer (계좌이체) — the web app and the
/// Telegram mini app only (2026-11-26): 1. a pack, 2. the transfer with the
/// order's code as the sender's name, 3. «Pul o'tkazdim»; the staff check and
/// the puyl come with a notice. The account is the staff's setting (CRM).
class BankTopupScreen extends ConsumerStatefulWidget {
  const BankTopupScreen({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  ConsumerState<BankTopupScreen> createState() => _BankTopupScreenState();
}

class _BankTopupScreenState extends ConsumerState<BankTopupScreen> {
  int _pack = 100;
  TopupOrder? _order;
  bool _busy = false;

  void _say(String text) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));

  String _errorText(WorkerL10n l10n, Object error) => switch (error) {
        ShiftActionException(code: 'TOO_MANY') => l10n.bankTooMany,
        ShiftActionException(code: 'EXPIRED') => l10n.bankExpiredError,
        OfflineException() => l10n.offlineTitle,
        _ => l10n.errorGeneric,
      };

  Future<void> _run(Future<TopupOrder> Function() call) async {
    if (_busy) return;
    final l10n = WorkerL10n.of(context);
    setState(() => _busy = true);
    try {
      final order = await call();
      if (!mounted) return;
      setState(() => _order = order);
      ref.invalidate(_myTopupsProvider);
    } on Object catch (error) {
      if (mounted) _say(_errorText(l10n, error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _copy(String text) {
    Clipboard.setData(ClipboardData(text: text));
    _say(WorkerL10n.of(context).bankCopied);
  }

  void _open(String url) {
    final link = url.startsWith('@') ? 'https://t.me/${url.substring(1)}' : url;
    final telegram = telegramWebApp();
    if (telegram != null) {
      telegram.openLink(link);
    } else {
      ref.read(linkOpenerProvider)(Uri.parse(link));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final details = ref.watch(_paymentDetailsProvider);
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: HiTopBar(title: l10n.bankTitle, onBack: widget.onBack),
              ),
              Expanded(
                child: details.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (error, _) => _Message(
                    text: _errorText(l10n, error),
                    action: l10n.retry,
                    onAction: () => ref.invalidate(_paymentDetailsProvider),
                  ),
                  data: (d) => _body(l10n, d),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(WorkerL10n l10n, PaymentDetails d) {
    final account = d.methods['bank_account'] ?? '';
    final contact = d.methods['contact'] ?? '';
    if (account.isEmpty) return _Message(text: l10n.bankNotReady);
    final packs = d.packs.isEmpty
        ? const [PyolPack(pyols: 30, won: 3300), PyolPack(pyols: 100, won: 9900), PyolPack(pyols: 300, won: 24000)]
        : d.packs;
    final order = _order;
    final orders = ref.watch(_myTopupsProvider).value ?? const <TopupOrder>[];
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _Card(children: [
          _title(l10n.bankHowTitle),
          const SizedBox(height: 6),
          HiText(l10n.bankHow, style: _body14),
        ]),
        const SizedBox(height: 12),
        if (order == null || !order.open)
          _Card(children: [
            _title(l10n.bankStep1),
            const SizedBox(height: 12),
            for (final p in packs) ...[
              _PackTile(pack: p, selected: p.pyols == _pack, onTap: () => setState(() => _pack = p.pyols)),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 4),
            HiButton(
              label: l10n.bankContinue,
              height: 50,
              fontSize: 16,
              style: HiButtonStyle.ink,
              onPressed: _busy ? null : () => _run(() => ref.read(pyolRepositoryProvider).startTopup(_pack)),
            ),
          ])
        else ...[
          _Card(children: [
            _title(l10n.bankStep2),
            const SizedBox(height: 12),
            _Row(label: l10n.bankName, value: d.methods['bank_name'] ?? ''),
            _Row(label: l10n.bankAccount, value: account, onCopy: () => _copy(account)),
            _Row(label: l10n.bankHolder, value: d.methods['bank_holder'] ?? ''),
            _Row(label: l10n.bankAmount, value: _won(order.won), onCopy: () => _copy('${order.won}')),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: HiColors.amberSoft,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: HiColors.amber),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  HiText(l10n.bankCode, style: hiStyle(13, FontWeight.w700, color: HiColors.ink)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          order.code,
                          style: hiStyle(28, FontWeight.w800, color: HiColors.ink).copyWith(letterSpacing: 3),
                        ),
                      ),
                      IconButton(
                        tooltip: l10n.bankCopied,
                        icon: const Icon(Icons.copy, color: HiColors.ink),
                        onPressed: () => _copy(order.code),
                      ),
                    ],
                  ),
                  HiText(l10n.bankCodeHint, style: hiStyle(13, FontWeight.w500, height: 1.4, color: HiColors.ink)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            HiText(l10n.bankExpires, style: _small),
          ]),
          const SizedBox(height: 12),
          _Card(children: [
            _title(l10n.bankStep3),
            const SizedBox(height: 12),
            if (order.status == 'pending')
              _StatusBox(text: l10n.bankWaiting, color: HiColors.greenSoft, ink: HiColors.greenInk)
            else
              HiButton(
                label: l10n.bankPaid,
                height: 52,
                fontSize: 17,
                onPressed: _busy ? null : () => _run(() => ref.read(pyolRepositoryProvider).topupPaid(order.id)),
              ),
          ]),
        ],
        if (orders.isNotEmpty) ...[
          const SizedBox(height: 20),
          HiText(l10n.bankOrders, style: hiStyle(16, FontWeight.w800, color: HiColors.white)),
          const SizedBox(height: 8),
          for (final o in orders)
            _OrderTile(
              order: o,
              status: _statusText(l10n, o.status),
              onTap: o.open ? () => setState(() => _order = o) : null,
            ),
        ],
        if (contact.isNotEmpty) ...[
          const SizedBox(height: 16),
          HiButton(
            label: l10n.bankHelp,
            height: 48,
            fontSize: 15,
            style: HiButtonStyle.ghost,
            onPressed: () => _open(contact),
          ),
        ],
      ],
    );
  }

  static String _statusText(WorkerL10n l10n, String status) => switch (status) {
        'unpaid' => l10n.bankStatusUnpaid,
        'pending' => l10n.bankStatusPending,
        'approved' => l10n.bankStatusApproved,
        'rejected' => l10n.bankStatusRejected,
        _ => l10n.bankStatusExpired,
      };

  Widget _title(String text) => HiText(text, style: hiStyle(17, FontWeight.w800, color: HiColors.ink));
}

final _body14 = hiStyle(14, FontWeight.w500, height: 1.5, color: HiColors.inkMuted);
final _small = hiStyle(12.5, FontWeight.w500, height: 1.4, color: HiColors.inkMuted);

class _Card extends StatelessWidget {
  const _Card({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: HiColors.white, borderRadius: BorderRadius.circular(HiRadii.card)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      );
}

class _PackTile extends StatelessWidget {
  const _PackTile({required this.pack, required this.selected, required this.onTap});

  final PyolPack pack;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: selected ? HiColors.lime : HiColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: selected ? HiColors.ink : Colors.transparent, width: 1.5),
            ),
            child: Row(
              children: [
                Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: HiColors.ink, size: 20),
                const SizedBox(width: 12),
                Expanded(child: HiText('${pack.pyols} P', style: hiStyle(18, FontWeight.w800, color: HiColors.ink))),
                HiText(_won(pack.won), style: hiStyle(16, FontWeight.w700, color: HiColors.ink)),
              ],
            ),
          ),
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.onCopy});

  final String label;
  final String value;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          children: [
            SizedBox(width: 110, child: HiText(label, style: hiStyle(13, FontWeight.w600, color: HiColors.inkMuted))),
            Expanded(child: SelectableText(value, style: hiStyle(15, FontWeight.w700, color: HiColors.ink))),
            if (onCopy != null)
              IconButton(icon: const Icon(Icons.copy, size: 18, color: HiColors.ink), onPressed: onCopy),
          ],
        ),
      );
}

class _StatusBox extends StatelessWidget {
  const _StatusBox({required this.text, required this.color, required this.ink});

  final String text;
  final Color color;
  final Color ink;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)),
        child: HiText(text, style: hiStyle(14, FontWeight.w600, height: 1.45, color: ink)),
      );
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order, required this.status, this.onTap});

  final TopupOrder order;
  final String status;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (bg, ink) = switch (order.status) {
      'approved' => (HiColors.greenSoft, HiColors.greenInk),
      'rejected' => (HiColors.redSoft, HiColors.redInk),
      'pending' || 'unpaid' => (HiColors.amberSoft, HiColors.ink),
      _ => (HiColors.surface, HiColors.inkMuted),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: HiColors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      HiText('${order.pyols} P · ${_won(order.won)}', style: hiStyle(15, FontWeight.w800, color: HiColors.ink)),
                      HiText(
                        '${order.code} · ${DateFormat('MM.dd HH:mm').format(order.createdAt)}',
                        style: hiStyle(12.5, FontWeight.w500, color: HiColors.inkMuted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(HiRadii.pill)),
                  child: HiText(status, style: hiStyle(12.5, FontWeight.w700, color: ink)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, this.action, this.onAction});

  final String text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              HiText(text, textAlign: TextAlign.center, style: hiStyle(16, FontWeight.w600, height: 1.5, color: HiColors.white)),
              if (action != null && onAction != null) ...[
                const SizedBox(height: 16),
                HiButton(label: action!, onPressed: onAction, height: 48, fontSize: 16, horizontalPadding: 24),
              ],
            ],
          ),
        ),
      );
}
