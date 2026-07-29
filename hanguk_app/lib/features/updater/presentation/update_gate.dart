import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../data/update_telemetry.dart';
import '../data/updater_repository.dart';
import 'update_dialog.dart';

/// Lifecycle-aware wrapper that:
///   1. Pings version telemetry on first build (after auth resolves).
///   2. Checks for updates on app launch + every foreground transition
///      (debounced by [UpdaterNotifier._checkDebounce]).
///   3. Renders [UpdateDialog] above the wrapped child whenever the
///      [updaterProvider] state is non-idle.
///
/// Wrap your app root: `MaterialApp(builder: (ctx, child) => UpdateGate(child: child!))`.
class UpdateGate extends ConsumerStatefulWidget {
  const UpdateGate({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends ConsumerState<UpdateGate>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndPing();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Returning from background — re-check (debounced).
      _checkAndPing();
    }
  }

  Future<void> _checkAndPing() async {
    if (!mounted) return;
    // Telemetry ping is fire-and-forget; never blocks the update check.
    unawaited(ref.read(updateTelemetryProvider).ping());
    await ref.read(updaterProvider.notifier).check();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(updaterProvider);
    return Stack(
      children: [
        widget.child,
        // Render the dialog as an overlay only when state is non-trivial.
        // The dialog is empty for Idle/Checking, so this Stack stays cheap.
        if (state is UpdateAvailable ||
            state is UpdateDownloading ||
            state is UpdateInstalling ||
            state is UpdateFailed)
          // Seoul Night scrim token (spec §2) instead of raw black54, so the
          // dim layer matches the orb dial's scrim everywhere else.
          const Positioned.fill(child: ColoredBox(color: SeoulColors.scrim)),
        if (state is UpdateAvailable ||
            state is UpdateDownloading ||
            state is UpdateInstalling ||
            state is UpdateFailed)
          const Center(child: UpdateDialog()),
      ],
    );
  }
}
