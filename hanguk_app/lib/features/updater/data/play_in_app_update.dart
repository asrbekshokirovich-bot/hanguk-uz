// P2 #48 — Play In-App Updates wrapper.
//
// Replaces the bundled APK auto-updater (`updater_repository.dart`) on
// store builds. On Android, calls `InAppUpdate.checkForUpdate()` at app
// launch and, if an update is available, triggers a *flexible* update
// (downloads in the background while the user keeps using the app, then
// prompts to install). Flexible was chosen over Immediate so a forced
// flow doesn't surprise users; switch to `performImmediateUpdate` if
// the next release ships a hard-gating change.
//
// On iOS and web, the wrapper is a no-op.

import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:in_app_update/in_app_update.dart';

import '../../../core/config/build_config.dart';

class PlayInAppUpdater {
  const PlayInAppUpdater();

  /// Probe for a Play-side update and, if one is available, start a
  /// flexible download. Safe to call unconditionally — short-circuits
  /// on non-Android / non-store / web platforms.
  Future<void> checkAndPrompt() async {
    if (!kIsStoreBuild) {
      // Self-host APK build path retains the bundled updater.
      return;
    }
    if (kIsWeb) {
      return;
    }
    if (!Platform.isAndroid) {
      return;
    }

    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.updateAvailability != UpdateAvailability.updateAvailable) {
        return;
      }
      // Flexible: background download, in-app install prompt later.
      await InAppUpdate.startFlexibleUpdate();
      // The result is observed elsewhere via `InAppUpdate.completeFlexibleUpdate()`
      // once `installStatus` reaches `downloaded`. For v1 we let the
      // OS-default "install now?" flow drive completion.
    } on Object catch (err, stack) {
      // Don't crash app launch over an update probe.
      if (kDebugMode) {
        debugPrint('[play_in_app_update] check failed: $err\n$stack');
      }
    }
  }
}
