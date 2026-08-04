import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/update_telemetry.dart';

/// Pings version telemetry on first build and on every foreground transition.
///
/// It used to also run the APK self-updater: check `app_versions`, download a
/// build from Supabase Storage, and hand it to the OS installer. That is gone.
///
/// Two reasons, either of which is enough:
///
///   * Play blocked version 2041 over `REQUEST_INSTALL_PACKAGES` — an app may
///     only hold it if installing apps is its core purpose — and rolled users
///     back to the previous version. The permission is now stripped from the
///     manifest, so the installer step cannot succeed in any build.
///   * `build_config.dart` says this gate "is bypassed at the MaterialApp
///     .builder level" for store builds. It never was: main.dart mounted it
///     unconditionally, so the self-updater ran on Play installs too — the
///     exact behaviour the policy forbids, and the reason students saw
///     "Yangilanish amalga oshmadi" on a build that had nothing to update to.
///
/// Updates come from Play now, through
/// `features/updater/data/play_in_app_update.dart`. The repository, dialog and
/// error codes are left in the tree for the non-store distribution path they
/// were written for; nothing mounts them.
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
    // Fire-and-forget: nothing waits on it, and a failed ping must never be
    // visible to the student.
    unawaited(ref.read(updateTelemetryProvider).ping());
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
