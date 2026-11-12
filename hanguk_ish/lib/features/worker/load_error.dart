import 'package:flutter/material.dart';

import '../../data/repositories/shift_repository.dart';
import '../../design/icons.dart';
import '../../design/widgets/navigation.dart';
import '../../l10n/gen/worker_l10n.dart';

/// A screen whose data could not load: no connection, or the server said
/// no. «Qayta urinish» loads it again. The A03 «Internet yo'q» message.
class WorkerLoadError extends StatelessWidget {
  const WorkerLoadError({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final offline = error is OfflineException;
    return HiStatusMessage(
      icon: offline ? HiIcons.wifiOff : HiIcons.triangleAlert,
      title: offline ? l10n.offlineTitle : l10n.errorGeneric,
      text: offline ? l10n.offlineText : '',
      textMaxWidth: 300,
      action: l10n.retry,
      actionIcon: HiIcons.refreshCw,
      onAction: onRetry,
    );
  }
}

/// Pull-to-refresh of [future]. A failure keeps the list as it was and says
/// why in a snack bar; the indicator itself has no error state.
Future<void> refreshOrSay(BuildContext context, Future<Object?> future) async {
  try {
    await future;
  } on Object catch (error) {
    if (!context.mounted) return;
    final l10n = WorkerL10n.of(context);
    (ScaffoldMessenger.of(context)..hideCurrentSnackBar()).showSnackBar(
      SnackBar(content: Text(error is OfflineException ? l10n.offlineTitle : l10n.errorGeneric)),
    );
  }
}
