import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_update/in_app_update.dart';

import '../../../core/config/build_config.dart';

/// Google Play in-app updates for store builds.
///
/// Policy, decided once per check:
///
///   * Only Android store builds (`STORE_BUILD=true`) ask Play. Sideloaded and
///     test APKs are not installed by Play, so the Play API throws there, and
///     iOS has no equivalent.
///   * Update available + immediate allowed + (priority >= 4 or Play has known
///     about it for >= 2 days) → immediate (full-screen Play flow).
///   * Otherwise, if flexible is allowed → flexible download in the background.
///     When the download finishes, nothing is shown; the install
///     (`completeFlexibleUpdate`, which restarts the app) runs on the next
///     foreground or launch.
///   * At most one check per launch, and on foreground only after 6 hours.
///   * Every call is wrapped: a Play failure never blocks or crashes the app.
///
/// No UI text of its own — the only screens are Play's.
final playInAppUpdateProvider = Provider<PlayInAppUpdate>((ref) {
  return PlayInAppUpdate(
    api: const PluginPlayUpdateApi(),
    eligible: _isPlayStoreAndroid(),
  );
});

bool _isPlayStoreAndroid() {
  if (kIsWeb || !kIsStoreBuild) return false;
  try {
    return Platform.isAndroid;
  } catch (_) {
    return false;
  }
}

/// What the policy needs from Play's `AppUpdateInfo`.
@immutable
class PlayUpdateInfo {
  const PlayUpdateInfo({
    required this.updateAvailable,
    required this.immediateAllowed,
    required this.flexibleAllowed,
    this.downloaded = false,
    this.stalenessDays,
    this.priority = 0,
  });

  /// `UpdateAvailability.updateAvailable`.
  final bool updateAvailable;
  final bool immediateAllowed;
  final bool flexibleAllowed;

  /// A flexible update finished downloading earlier and waits to be installed.
  final bool downloaded;
  final int? stalenessDays;
  final int priority;
}

/// Thin seam over the `in_app_update` plugin so the policy can be tested.
abstract class PlayUpdateApi {
  Future<PlayUpdateInfo> check();

  /// Returns true when Play reports success.
  Future<bool> performImmediate();

  /// Completes when the download has finished; true on success.
  Future<bool> startFlexible();

  /// Installs a downloaded flexible update; Play restarts the app.
  Future<void> completeFlexible();
}

class PluginPlayUpdateApi implements PlayUpdateApi {
  const PluginPlayUpdateApi();

  @override
  Future<PlayUpdateInfo> check() async {
    final info = await InAppUpdate.checkForUpdate();
    return PlayUpdateInfo(
      updateAvailable:
          info.updateAvailability == UpdateAvailability.updateAvailable,
      immediateAllowed: info.immediateUpdateAllowed,
      flexibleAllowed: info.flexibleUpdateAllowed,
      downloaded: info.installStatus == InstallStatus.downloaded,
      stalenessDays: info.clientVersionStalenessDays,
      priority: info.updatePriority,
    );
  }

  @override
  Future<bool> performImmediate() async =>
      await InAppUpdate.performImmediateUpdate() == AppUpdateResult.success;

  @override
  Future<bool> startFlexible() async =>
      await InAppUpdate.startFlexibleUpdate() == AppUpdateResult.success;

  @override
  Future<void> completeFlexible() => InAppUpdate.completeFlexibleUpdate();
}

class PlayInAppUpdate {
  PlayInAppUpdate({
    required PlayUpdateApi api,
    required bool eligible,
    DateTime Function()? now,
  }) : _api = api,
       _eligible = eligible,
       _now = now ?? DateTime.now;

  static const foregroundInterval = Duration(hours: 6);
  static const immediatePriority = 4;
  static const immediateStalenessDays = 2;

  final PlayUpdateApi _api;
  final bool _eligible;
  final DateTime Function() _now;

  DateTime? _lastCheck;
  bool _busy = false;
  bool _flexibleReady = false;

  /// Call on first frame and on every resume. Never throws.
  Future<void> onForeground() async {
    if (!_eligible || _busy) return;
    _busy = true;
    try {
      // A flexible download finished while the app was in use: install now,
      // on the way back in, rather than interrupting the student mid-screen.
      if (_flexibleReady) {
        _flexibleReady = false;
        await _api.completeFlexible();
        return;
      }

      final last = _lastCheck;
      final now = _now();
      if (last != null && now.difference(last) < foregroundInterval) return;
      _lastCheck = now;

      final info = await _api.check();
      if (info.downloaded) {
        // Downloaded in an earlier session; this is the next launch.
        await _api.completeFlexible();
        return;
      }
      if (!info.updateAvailable) return;

      final urgent =
          info.priority >= immediatePriority ||
          (info.stalenessDays ?? 0) >= immediateStalenessDays;
      if (info.immediateAllowed && urgent) {
        await _api.performImmediate();
      } else if (info.flexibleAllowed) {
        _busy = false; // the download can take minutes; don't hold the lock.
        if (await _api.startFlexible()) _flexibleReady = true;
      }
    } catch (e) {
      debugPrint('[PlayInAppUpdate] skipped: $e');
    } finally {
      _busy = false;
    }
  }
}
