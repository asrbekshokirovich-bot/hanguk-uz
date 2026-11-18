import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/digit_mask.dart';
import '../../../core/money/won.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/forms.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../my_shifts/my_shifts_providers.dart';
import '../notifications/unread.dart' show notificationsProvider;

/// «Maosh to'landimi?» after a finished shift: the worker says they were paid
/// in full, or less and how much. The answer goes to the server and the amount
/// counts in A09 «Daromad» at once. Returns true when something was saved.
Future<bool> showPaymentSheet(
  BuildContext context,
  WidgetRef ref, {
  required String applicationId,
  required int pay,
  int? received,
}) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _PaymentSheet(applicationId: applicationId, pay: pay, received: received),
  );
  if (saved != true) return false;
  ref.invalidate(myShiftsProvider);
  ref.invalidate(myShiftProvider(applicationId));
  ref.invalidate(notificationsProvider);
  if (context.mounted) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(WorkerL10n.of(context).payAskSaved)));
  }
  return true;
}

class _PaymentSheet extends ConsumerStatefulWidget {
  const _PaymentSheet({required this.applicationId, required this.pay, this.received});

  final String applicationId;
  final int pay;
  final int? received;

  @override
  ConsumerState<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<_PaymentSheet> {
  late final TextEditingController _amount;
  bool _less = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final received = widget.received;
    _less = received != null && received < widget.pay;
    _amount = TextEditingController(text: _less ? ThousandsFormatter.format('$received') : '');
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  int get _typed => int.tryParse(_amount.text.replaceAll(RegExp(r'\D'), '')) ?? 0;

  Future<void> _save(int amount) async {
    final l10n = WorkerL10n.of(context);
    if (amount > widget.pay) {
      setState(() => _error = l10n.payAskTooMuch);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(shiftRepositoryProvider).confirmPayment(widget.applicationId, amount);
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error is OfflineException ? l10n.errOffline : l10n.errorGeneric;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final media = MediaQuery.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: HiColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(top: HiBorders.ink),
        ),
        padding: EdgeInsets.fromLTRB(18, 10, 22, HiInsets.bottom(context, 30)),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(color: const Color(0xFFC9D3E6), borderRadius: BorderRadius.circular(HiRadii.pill)),
                ),
              ),
              const SizedBox(height: 16),
              Semantics(
                header: true,
                child: HiText(l10n.payAskTitle, style: hiStyle(24, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02, color: HiColors.ink)),
              ),
              const SizedBox(height: 8),
              HiText(
                l10n.payAskExpected(Won.worker(widget.pay)),
                style: hiStyle(16, FontWeight.w700, color: HiColors.inkMuted),
              ),
              const SizedBox(height: 16),
              HiButton(
                label: l10n.payAskFull,
                height: 52,
                onPressed: _busy ? null : () => _save(widget.pay),
              ),
              const SizedBox(height: 10),
              if (!_less)
                HiButton(
                  label: l10n.payAskLess,
                  style: HiButtonStyle.outline,
                  height: 52,
                  onPressed: _busy ? null : () => setState(() => _less = true),
                )
              else ...[
                HiFieldLabel(l10n.payAskAmountLabel),
                const SizedBox(height: 8),
                HiInputField(
                  controller: _amount,
                  mono: true,
                  placeholder: '0',
                  keyboardType: TextInputType.number,
                  inputFormatters: [ThousandsFormatter(maxDigits: 9), FilteringTextInputFormatter.allow(RegExp(r'[0-9,]'))],
                  textInputAction: TextInputAction.done,
                  onChanged: (_) => setState(() => _error = null),
                ),
                const SizedBox(height: 12),
                HiButton(
                  label: l10n.payAskSave,
                  style: HiButtonStyle.ink,
                  height: 52,
                  onPressed: _busy || _amount.text.isEmpty ? null : () => _save(_typed),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                HiText(_error!, style: hiStyle(14, FontWeight.w600, height: 1.4, color: HiColors.redInk)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
