import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../l10n/app_localizations.dart';
import 'app_events.dart';
import 'tracked.dart';

/// Seven taps on [child] within three seconds show this phone's device code,
/// which staff enter in the CRM (Ilova analitikasi → Sozlamalar) to mark it as
/// a test device (S10). Nothing on screen changes otherwise.
class DeviceCodeTaps extends StatefulWidget {
  const DeviceCodeTaps({super.key, required this.child});

  final Widget child;

  @override
  State<DeviceCodeTaps> createState() => _DeviceCodeTapsState();
}

class _DeviceCodeTapsState extends State<DeviceCodeTaps> {
  int _taps = 0;
  DateTime? _first;

  void _tap() {
    final now = DateTime.now();
    final first = _first;
    if (first == null || now.difference(first) > const Duration(seconds: 3)) {
      _first = now;
      _taps = 0;
    }
    if (++_taps >= 7) {
      _taps = 0;
      _first = null;
      showDeviceCode(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: tracked('device_code.title', _tap),
      child: widget.child,
    );
  }
}

/// The device code ("XXXX-XXXX") and the app's version, with a copy button.
Future<void> showDeviceCode(BuildContext context) async {
  final code = AppEvents.deviceCode;
  final version = AppEvents.appVersion;
  final l = AppLocalizations.of(context)!;
  AppEvents.track('device_code_view');
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l.deviceCodeTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SelectableText(
            code ?? '—',
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 2),
          ),
          const SizedBox(height: 8),
          Text(code == null ? l.deviceCodeNone : l.deviceCodeBody),
          if (version != null) ...[
            const SizedBox(height: 8),
            Text(l.deviceCodeVersion(version), style: Theme.of(ctx).textTheme.bodySmall),
          ],
        ],
      ),
      actions: [
        if (code != null)
          TextButton(
            onPressed: tracked('device_code.copy', () {
              Clipboard.setData(ClipboardData(text: code));
              Navigator.of(ctx).pop();
            }),
            child: Text(l.copyButton),
          ),
        TextButton(onPressed: tracked('device_code.close', () => Navigator.of(ctx).pop()), child: Text(l.ok)),
      ],
    ),
  );
}
