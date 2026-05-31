import 'dart:async';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:install_plugin/install_plugin.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_version_info.dart';
import 'version_compare.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Sealed UpdateState — every branch must be handled in the UI switch.
// ─────────────────────────────────────────────────────────────────────────────

sealed class UpdateState {
  const UpdateState();
}

final class UpdateIdle extends UpdateState {
  const UpdateIdle();
}

final class UpdateChecking extends UpdateState {
  const UpdateChecking();
}

final class UpdateAvailable extends UpdateState {
  const UpdateAvailable(this.info, {required this.belowMinSupported});
  final AppVersionInfo info;

  /// True if the local version is below `min_supported_version`. When this is
  /// true, the dialog must hide the "Later" button regardless of [info.forceUpdate].
  final bool belowMinSupported;

  bool get effectivelyForced => info.forceUpdate || belowMinSupported;
}

final class UpdateDownloading extends UpdateState {
  const UpdateDownloading({
    required this.info,
    required this.bytesDownloaded,
    required this.totalBytes,
  });
  final AppVersionInfo info;
  final int bytesDownloaded;
  final int totalBytes;

  double get progress => totalBytes > 0 ? bytesDownloaded / totalBytes : 0;
}

final class UpdateInstalling extends UpdateState {
  const UpdateInstalling(this.info);
  final AppVersionInfo info;
}

final class UpdateFailed extends UpdateState {
  const UpdateFailed(this.code, {this.detail, this.info});
  final UpdateErrorCode code;
  final String? detail;
  final AppVersionInfo? info;
}

enum UpdateErrorCode {
  networkError,
  hashMismatch,
  installDenied,
  storageError,
  unsupportedPlatform,
  unknown,
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

final updaterRepositoryProvider = Provider<UpdaterRepository>((ref) {
  return UpdaterRepository(Supabase.instance.client);
});

final updaterProvider = NotifierProvider<UpdaterNotifier, UpdateState>(
  () => UpdaterNotifier(),
);

// ─────────────────────────────────────────────────────────────────────────────
// Notifier — drives the UI through UpdateState transitions.
// ─────────────────────────────────────────────────────────────────────────────

class UpdaterNotifier extends Notifier<UpdateState> {
  DateTime? _lastCheckAt;
  static const Duration _checkDebounce = Duration(minutes: 30);

  @override
  UpdateState build() => const UpdateIdle();

  /// Check for updates. Debounced to once per [_checkDebounce] unless [force]
  /// is true. Safe to call from app-launch + every foreground transition.
  Future<void> check({bool force = false, String? channel}) async {
    if (!force &&
        _lastCheckAt != null &&
        DateTime.now().difference(_lastCheckAt!) < _checkDebounce) {
      return;
    }
    _lastCheckAt = DateTime.now();

    final repo = ref.read(updaterRepositoryProvider);
    state = const UpdateChecking();

    try {
      final result = await repo.checkForUpdate(channel: channel);
      state = result;
    } catch (e) {
      state = UpdateFailed(UpdateErrorCode.networkError, detail: e.toString());
    }
  }

  /// Begin downloading the update. On Android: pulls APK with progress, then
  /// verifies SHA-256, then hands off to PackageInstaller. On iOS: opens
  /// App Store deep-link. On web: triggers SW reload via the Dialog.
  Future<void> startUpdate(AppVersionInfo info) async {
    if (kIsWeb) {
      // Web flow handled in the dialog: reload after SW update event.
      return;
    }
    if (!Platform.isAndroid) {
      if (Platform.isIOS && info.iosAppStoreUrl != null) {
        final uri = Uri.tryParse(info.iosAppStoreUrl!);
        if (uri == null) {
          state = UpdateFailed(
            UpdateErrorCode.unknown,
            detail: 'Invalid App Store URL',
            info: info,
          );
          return;
        }
        try {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } catch (e) {
          state = UpdateFailed(
            UpdateErrorCode.unknown,
            detail: e.toString(),
            info: info,
          );
        }
        return;
      }
      state = UpdateFailed(UpdateErrorCode.unsupportedPlatform, info: info);
      return;
    }

    final repo = ref.read(updaterRepositoryProvider);
    try {
      await repo.downloadAndInstall(
        info,
        onProgress: (received, total) {
          state = UpdateDownloading(
            info: info,
            bytesDownloaded: received,
            totalBytes: total,
          );
        },
        onInstall: () {
          state = UpdateInstalling(info);
        },
      );
      // After OS install kicks in, the app is killed/replaced — no further state.
    } on _UpdaterException catch (e) {
      state = UpdateFailed(e.code, detail: e.detail, info: info);
    } catch (e) {
      state = UpdateFailed(
        UpdateErrorCode.unknown,
        detail: e.toString(),
        info: info,
      );
    }
  }

  /// User dismissed the dialog (only allowed when not effectively forced).
  void dismiss() {
    state = const UpdateIdle();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository — pure data layer, no UI / state transitions.
// ─────────────────────────────────────────────────────────────────────────────

class UpdaterRepository {
  UpdaterRepository(this._client, {Dio? dio}) : _dio = dio ?? Dio();

  final SupabaseClient _client;
  final Dio _dio;

  /// Check the `app_versions` table for the appropriate platform/channel row,
  /// compare against the local version, apply the rollout dice, and return
  /// the resulting [UpdateState].
  Future<UpdateState> checkForUpdate({String? channel}) async {
    final platform = _platformId();
    if (platform == null) {
      return const UpdateIdle();
    }

    final selectedChannel = channel ?? 'stable';

    final pkg = await PackageInfo.fromPlatform();
    final localVersion = '${pkg.version}+${pkg.buildNumber}';

    final response = await _client
        .from('app_versions')
        .select()
        .eq('id', platform)
        .eq('channel', selectedChannel)
        .maybeSingle();

    if (response == null) return const UpdateIdle();

    final info = AppVersionInfo.fromMap(response);

    // 1. Min-supported floor: if local is below floor, force update.
    final belowMin =
        info.minSupportedVersion != null &&
        isBelowFloor(floor: info.minSupportedVersion!, candidate: localVersion);

    // 2. Newer-than check: if local already >= latest, nothing to do.
    if (!isNewerVersion(current: localVersion, candidate: info.latestVersion)) {
      return const UpdateIdle();
    }

    // 3. Rollout dice: deterministic per-device. If we're outside the bucket,
    //    pretend the update doesn't exist — UNLESS we're below the min
    //    supported floor (then we always show, regardless of rollout %).
    if (!belowMin &&
        !_isInRolloutBucket(info, deviceFingerprint: pkg.appName)) {
      return const UpdateIdle();
    }

    return UpdateAvailable(info, belowMinSupported: belowMin);
  }

  /// Download → SHA-256 verify → handoff to OS installer. Throws
  /// [_UpdaterException] on any failure.
  Future<void> downloadAndInstall(
    AppVersionInfo info, {
    required void Function(int received, int total) onProgress,
    required void Function() onInstall,
  }) async {
    if (info.downloadUrl.isEmpty) {
      throw const _UpdaterException(
        UpdateErrorCode.unknown,
        'Download URL is empty',
      );
    }

    // 1. Download to temp dir.
    final tempDir = await getTemporaryDirectory();
    final filename =
        'hanguk_app_${info.latestVersion.replaceAll('+', '_')}.apk';
    final filePath = '${tempDir.path}/$filename';

    try {
      await _dio.download(
        info.downloadUrl,
        filePath,
        onReceiveProgress: onProgress,
        options: Options(
          // Server may not return Content-Length; clamp timeouts so a stalled
          // connection doesn't hang the dialog forever.
          receiveTimeout: const Duration(minutes: 10),
          sendTimeout: const Duration(seconds: 30),
        ),
      );
    } on DioException catch (e) {
      throw _UpdaterException(
        UpdateErrorCode.networkError,
        e.message ?? e.type.name,
      );
    } catch (e) {
      throw _UpdaterException(UpdateErrorCode.storageError, e.toString());
    }

    // 2. SHA-256 verify if the server supplied a hash.
    if (info.sha256 != null && info.sha256!.isNotEmpty) {
      final ok = await _verifySha256(filePath, info.sha256!);
      if (!ok) {
        try {
          await File(filePath).delete();
        } catch (_) {}
        throw const _UpdaterException(
          UpdateErrorCode.hashMismatch,
          'Downloaded file failed integrity check',
        );
      }
    } else {
      debugPrint(
        '[Updater] WARNING: app_versions row has no sha256 — '
        'skipping integrity verification. This is unsafe; populate the column.',
      );
    }

    // 3. Hand off to the OS installer (Android-only path; iOS handled upstream).
    onInstall();
    try {
      final result = await InstallPlugin.installApk(filePath);
      // install_plugin returns a PlatformException-like map on failure;
      // success path is the OS taking over.
      if (result.toString().toLowerCase().contains('error') ||
          result.toString().toLowerCase().contains('denied')) {
        throw _UpdaterException(
          UpdateErrorCode.installDenied,
          result.toString(),
        );
      }
    } catch (e) {
      throw _UpdaterException(UpdateErrorCode.installDenied, e.toString());
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// Returns the platform key for the [app_versions.id] column, or null on
  /// platforms we don't auto-update (desktop, etc.).
  String? _platformId() {
    if (kIsWeb) return 'web';
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    return null; // desktop targets — out of scope this round
  }

  /// Deterministic per-device dice. Same device + same version always produces
  /// the same answer, so rollout decisions don't flap.
  bool _isInRolloutBucket(
    AppVersionInfo info, {
    required String deviceFingerprint,
  }) {
    if (info.rolloutPercentage >= 100) return true;
    if (info.rolloutPercentage <= 0) return false;
    final input = '$deviceFingerprint:${info.latestVersion}';
    final digest = sha256.convert(input.codeUnits).bytes;
    // Take the first 4 bytes as an unsigned int.
    final n =
        (digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3];
    final pct = (n.abs() % 100);
    return pct < info.rolloutPercentage;
  }

  Future<bool> _verifySha256(String filePath, String expectedHex) async {
    try {
      final file = File(filePath);
      // Stream the file so we don't load the whole APK into memory (50+ MB).
      // `sha256.bind()` returns a Stream<Digest> that emits exactly one digest
      // when the source stream completes.
      final digest = await sha256.bind(file.openRead()).first;
      final actual = digest.toString();
      return actual.toLowerCase() == expectedHex.toLowerCase().trim();
    } catch (e) {
      debugPrint('[Updater] SHA-256 verification crashed: $e');
      return false;
    }
  }
}

class _UpdaterException implements Exception {
  const _UpdaterException(this.code, this.detail);
  final UpdateErrorCode code;
  final String detail;
}
