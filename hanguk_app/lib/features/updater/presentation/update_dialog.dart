import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/theme/app_colors.dart';
import '../data/updater_repository.dart';

/// Sealed-state-driven update dialog. Wraps the `updaterProvider` and
/// renders one of: idle, available, downloading, installing, failed.
class UpdateDialog extends ConsumerWidget {
  const UpdateDialog({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(updaterProvider);
    return switch (state) {
      UpdateIdle() || UpdateChecking() => const SizedBox.shrink(),
      UpdateAvailable(:final info, :final effectivelyForced) => _AvailableView(
        info: info,
        forced: effectivelyForced,
      ),
      UpdateDownloading() => _DownloadingView(state: state),
      UpdateInstalling() => const _InstallingView(),
      UpdateFailed(:final code, :final detail, :final info) => _FailedView(
        code: code,
        detail: detail,
        info: info,
      ),
    };
  }
}

// ── Available ──────────────────────────────────────────────────────────────

class _AvailableView extends ConsumerWidget {
  const _AvailableView({required this.info, required this.forced});
  final dynamic info; // AppVersionInfo, but kept dynamic to avoid import cycle
  final bool forced;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(updaterProvider.notifier);
    final sizeMB = info.sizeBytes != null
        ? (info.sizeBytes / (1024 * 1024)).toStringAsFixed(1)
        : null;

    return PopScope(
      canPop: !forced,
      child: AlertDialog(
        backgroundColor: AppColors.darkSlate,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(Icons.system_update, color: AppColors.vibrantLime),
            SizedBox(width: 12),
            Text(
              'Update Available',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Version ${info.latestVersion} is ready to install.',
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            if (sizeMB != null) ...[
              const SizedBox(height: 4),
              Text(
                'Size: $sizeMB MB',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
            if (info.releaseNotes != null && info.releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  info.releaseNotes,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ),
            ],
            if (info.forceFullReinstall == true) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orangeAccent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Colors.orangeAccent.withValues(alpha: 0.4),
                  ),
                ),
                child: const Text(
                  'This update changes the app signing key. After installing you will need to log in again with your magic code.',
                  style: TextStyle(color: Colors.orangeAccent, fontSize: 12),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (!forced)
            TextButton(
              onPressed: () {
                notifier.dismiss();
                Navigator.of(context, rootNavigator: true).maybePop();
              },
              child: const Text(
                'Later',
                style: TextStyle(color: Colors.white54),
              ),
            ),
          ElevatedButton(
            onPressed: () => notifier.startUpdate(info),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.vibrantLime,
              foregroundColor: Colors.black,
            ),
            child: const Text('Update Now'),
          ),
        ],
      ),
    );
  }
}

// ── Downloading ────────────────────────────────────────────────────────────

class _DownloadingView extends StatelessWidget {
  const _DownloadingView({required this.state});
  final UpdateDownloading state;

  @override
  Widget build(BuildContext context) {
    final mb = (state.bytesDownloaded / (1024 * 1024)).toStringAsFixed(1);
    final totalMb = state.totalBytes > 0
        ? (state.totalBytes / (1024 * 1024)).toStringAsFixed(1)
        : '?';
    return PopScope(
      canPop: false,
      child: AlertDialog(
        backgroundColor: AppColors.darkSlate,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Downloading Update',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: state.totalBytes > 0 ? state.progress : null,
                minHeight: 8,
                backgroundColor: Colors.white12,
                color: AppColors.vibrantLime,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '$mb MB / $totalMb MB',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Installing ─────────────────────────────────────────────────────────────

class _InstallingView extends StatelessWidget {
  const _InstallingView();

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        backgroundColor: AppColors.darkSlate,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.vibrantLime,
              ),
            ),
            SizedBox(width: 16),
            Flexible(
              child: Text(
                'Verifying and installing…',
                style: TextStyle(color: Colors.white, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Failed ─────────────────────────────────────────────────────────────────

class _FailedView extends ConsumerWidget {
  const _FailedView({required this.code, this.detail, this.info});
  final UpdateErrorCode code;
  final String? detail;
  final dynamic info;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(updaterProvider.notifier);
    return AlertDialog(
      backgroundColor: AppColors.darkSlate,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: const [
          Icon(Icons.error_outline, color: Colors.redAccent),
          SizedBox(width: 12),
          Text(
            'Update Failed',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: Text(
        _humanMessage(code),
        style: const TextStyle(color: Colors.white70, fontSize: 14),
      ),
      actions: [
        TextButton(
          onPressed: () {
            notifier.dismiss();
            Navigator.of(context, rootNavigator: true).maybePop();
          },
          child: const Text('Close', style: TextStyle(color: Colors.white54)),
        ),
        if (info != null)
          ElevatedButton(
            onPressed: () => notifier.startUpdate(info),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.vibrantLime,
              foregroundColor: Colors.black,
            ),
            child: const Text('Try Again'),
          ),
      ],
    );
  }

  String _humanMessage(UpdateErrorCode code) {
    return switch (code) {
      UpdateErrorCode.networkError =>
        'Could not download the update. Please check your internet connection and try again.',
      UpdateErrorCode.hashMismatch =>
        'The downloaded file failed integrity verification. Please try again — if the problem repeats, contact your counsellor.',
      UpdateErrorCode.installDenied =>
        'Installation was blocked by your device. Please grant "Install unknown apps" permission for Hanguk in your phone settings, then try again.',
      UpdateErrorCode.storageError =>
        'Not enough storage to download the update. Please free up some space and try again.',
      UpdateErrorCode.unsupportedPlatform =>
        'Updates are not available on this platform yet.',
      UpdateErrorCode.unknown =>
        'Update failed. Please try again, or contact your counsellor.',
    };
  }
}
