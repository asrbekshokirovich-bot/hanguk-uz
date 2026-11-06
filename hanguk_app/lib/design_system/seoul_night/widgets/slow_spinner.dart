import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/analytics/tracked.dart';
import '../../../l10n/app_localizations.dart';
import '../seoul_night.dart';
import 'fd_kit.dart';

/// A spinner that, when the wait runs long (a slow or lost connection), says
/// so — "Internetni tekshirib, qayta urinib ko'ring" — and offers "Qayta
/// urinish" if [onRetry] is given (plan R1.2: a slow request used to leave
/// only a spinner, with no way to try again). Both texts already exist in
/// the five languages.
class SlowSpinner extends StatefulWidget {
  const SlowSpinner({
    super.key,
    this.onRetry,
    this.retryName = 'slow_spinner.retry',
    this.after = const Duration(seconds: 8),
    this.color = FdColors.lime,
    this.textColor = FdColors.pageMuted,
    this.size,
    this.padding = EdgeInsets.zero,
  });

  final VoidCallback? onRetry;

  /// The retry tap's analytics name.
  final String retryName;
  final Duration after;
  final Color color;

  /// The note's colour: muted on the page, [FdColors.muted] on a white card.
  final Color textColor;

  /// The spinner's side; null for the default size.
  final double? size;
  final EdgeInsetsGeometry padding;

  @override
  State<SlowSpinner> createState() => _SlowSpinnerState();
}

class _SlowSpinnerState extends State<SlowSpinner> {
  Timer? _timer;
  bool _slow = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.after, () {
      if (mounted) setState(() => _slow = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final spinner = CircularProgressIndicator(color: widget.color, strokeWidth: widget.size == null ? 4 : 2);
    return Padding(
      padding: widget.padding,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.size == null) spinner else SizedBox.square(dimension: widget.size, child: spinner),
            if (_slow) ...[
              const SizedBox(height: 12),
              Text(
                l.checkConnectionRetry,
                textAlign: TextAlign.center,
                style: fdText(12, FontWeight.w500, widget.textColor),
              ),
              if (widget.onRetry != null) ...[
                const SizedBox(height: 8),
                SeoulOutlineButton(
                  label: l.commonRetry,
                  expand: false,
                  onPressed: tracked(widget.retryName, widget.onRetry),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
