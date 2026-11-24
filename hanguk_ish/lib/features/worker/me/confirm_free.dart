import 'package:flutter/material.dart';

import '../../../l10n/gen/worker_l10n.dart';

/// «Are you really free?» before a time is marked free: job offers come for
/// it, so one tap by mistake should not say yes. [when] is what was tapped
/// («Yakshanba, Kechqurun», «Pay 26», «Har kuni kechqurun»).
Future<bool> confirmReallyFree(BuildContext context, String when) async {
  final l10n = WorkerL10n.of(context);
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l10n.freeConfirmTitle),
      content: Text(l10n.freeConfirmBody(when)),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(l10n.freeConfirmNo)),
        TextButton(onPressed: () => Navigator.of(context).pop(true), child: Text(l10n.freeConfirmYes)),
      ],
    ),
  );
  return ok == true;
}
