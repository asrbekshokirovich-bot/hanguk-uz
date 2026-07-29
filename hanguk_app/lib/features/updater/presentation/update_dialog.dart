import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/updater_repository.dart';

/// Sealed-state-driven update dialog. Wraps the `updaterProvider` and
/// renders one of: idle, available, downloading, installing, failed.
///
/// Seoul Night pass: each state renders inside [_SeoulDialog] — the raised
/// slice-of-app modal shell the AccountScreen dialogs already use — with a
/// 업 hangul glyph tile fronting the title. The forced-update path stays
/// forced: `PopScope(canPop: !forced)` blocks the back gesture, and callers
/// show it with `barrierDismissible: !versionInfo.effectivelyForced`.
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

// ── Shared shell ───────────────────────────────────────────────────────────

/// Modal shell for Seoul Night: the app background gradient behind a hero
/// hairline and shadow, so a dialog reads as a raised slice of the app
/// rather than a flat Material panel. Mirrors the AccountScreen dialogs —
/// one dialog style across the app, per the redesign brief.
class _SeoulDialog extends StatelessWidget {
  const _SeoulDialog({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
      child: Container(
        decoration: BoxDecoration(
          gradient: SeoulGradients.appBackground,
          borderRadius: SeoulRadii.heroR,
          border: Border.all(color: SeoulColors.heroBorder, width: 1),
          boxShadow: SeoulShadows.hero,
        ),
        child: ClipRRect(
          borderRadius: SeoulRadii.heroR,
          child: Padding(padding: const EdgeInsets.all(20), child: child),
        ),
      ),
    );
  }
}

/// Dialog header: 업 glyph tile + title with its 업데이트 hangul label.
/// The hangul is decorative and stays Korean in every locale (spec §1).
class _UpdateDialogHeader extends StatelessWidget {
  const _UpdateDialogHeader({required this.title, this.danger = false});

  final String title;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const HangulGlyphTile(glyph: '업', size: 40),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: danger
                    ? SeoulType.subtitle.copyWith(color: SeoulColors.dangerText)
                    : SeoulType.subtitle,
              ),
              const SizedBox(height: 2),
              Text(
                '업데이트',
                style: danger
                    ? SeoulType.hangulLabel.copyWith(
                        color: SeoulColors.dangerText,
                      )
                    : SeoulType.hangulLabel,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Available ──────────────────────────────────────────────────────────────

class _AvailableView extends ConsumerWidget {
  const _AvailableView({required this.info, required this.forced});
  final dynamic info; // AppVersionInfo, but kept dynamic to avoid import cycle
  final bool forced;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final notifier = ref.read(updaterProvider.notifier);
    final sizeMB = info.sizeBytes != null
        ? (info.sizeBytes / (1024 * 1024)).toStringAsFixed(1)
        : null;

    // Forced updates must stay forced: no back-gesture escape here, and the
    // callers pass `barrierDismissible: !effectivelyForced` so there is no
    // outside-tap escape either.
    return PopScope(
      canPop: !forced,
      child: _SeoulDialog(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _UpdateDialogHeader(title: l10n.updateAvailableTitle),
            const SizedBox(height: 14),
            // Scrollable middle: release notes plus the OS's largest font
            // settings can outgrow the dialog — the buttons must stay
            // reachable, especially when the update cannot be dismissed.
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.updateVersionReady('${info.latestVersion}'),
                      style: SeoulType.bodySecondary,
                    ),
                    if (sizeMB != null) ...[
                      const SizedBox(height: 4),
                      Text(l10n.updateSizeMb(sizeMB), style: SeoulType.caption),
                    ],
                    if (info.releaseNotes != null &&
                        info.releaseNotes.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      GlassCard(
                        blur: false,
                        showShadow: false,
                        radius: SeoulRadii.control,
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          '${info.releaseNotes}',
                          style: SeoulType.bodySecondary.copyWith(fontSize: 13),
                        ),
                      ),
                    ],
                    if (info.forceFullReinstall == true) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: SeoulColors.warningFill,
                          borderRadius: SeoulRadii.controlR,
                          border: Border.all(
                            color: SeoulColors.warning.withValues(alpha: 0.45),
                          ),
                        ),
                        child: Text(
                          l10n.updateSigningKeyWarning,
                          style: SeoulType.caption.copyWith(
                            color: SeoulColors.warningText,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            // Stacked, not side-by-side: the Russian/Vietnamese labels run
            // long, and each button keeps its full 52px-high 44px-min target.
            LimeButton(
              icon: Icons.system_update_alt_rounded,
              label: l10n.updateNow,
              onPressed: () => notifier.startUpdate(info),
            ),
            if (!forced) ...[
              const SizedBox(height: 10),
              SeoulOutlineButton(
                label: l10n.updateLater,
                onPressed: () {
                  notifier.dismiss();
                  Navigator.of(context, rootNavigator: true).maybePop();
                },
              ),
            ],
          ],
        ),
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
    final l10n = AppLocalizations.of(context)!;
    final mb = (state.bytesDownloaded / (1024 * 1024)).toStringAsFixed(1);
    final totalMb = state.totalBytes > 0
        ? (state.totalBytes / (1024 * 1024)).toStringAsFixed(1)
        : '?';
    return PopScope(
      canPop: false,
      child: _SeoulDialog(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _UpdateDialogHeader(title: l10n.updateDownloadingTitle),
            const SizedBox(height: 18),
            if (state.totalBytes > 0)
              GlowProgressBar(value: state.progress, height: 8, animate: false)
            else
              // Indeterminate — GlowProgressBar needs a value, so fall back
              // to a token-tinted Material bar in the same pill silhouette.
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: const LinearProgressIndicator(
                  minHeight: 8,
                  backgroundColor: SeoulColors.neutralFill,
                  color: SeoulColors.lime,
                ),
              ),
            const SizedBox(height: 12),
            Text(
              l10n.updateDownloadProgress(mb, totalMb),
              style: SeoulType.caption,
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
    final l10n = AppLocalizations.of(context)!;
    return PopScope(
      canPop: false,
      child: _SeoulDialog(
        child: Row(
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
              ),
            ),
            const SizedBox(width: 16),
            Flexible(
              child: Text(l10n.updateInstallingLabel, style: SeoulType.body),
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
    final l10n = AppLocalizations.of(context)!;
    final notifier = ref.read(updaterProvider.notifier);
    return _SeoulDialog(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _UpdateDialogHeader(title: l10n.updateFailedTitle, danger: true),
          const SizedBox(height: 14),
          Flexible(
            child: SingleChildScrollView(
              child: Text(
                _humanMessage(l10n, code),
                style: SeoulType.bodySecondary,
              ),
            ),
          ),
          const SizedBox(height: 20),
          if (info != null) ...[
            LimeButton(
              icon: Icons.refresh_rounded,
              label: l10n.commonRetry,
              onPressed: () => notifier.startUpdate(info),
            ),
            const SizedBox(height: 10),
          ],
          SeoulOutlineButton(
            label: l10n.ok,
            onPressed: () {
              notifier.dismiss();
              Navigator.of(context, rootNavigator: true).maybePop();
            },
          ),
        ],
      ),
    );
  }

  String _humanMessage(AppLocalizations l10n, UpdateErrorCode code) {
    return switch (code) {
      UpdateErrorCode.networkError => l10n.updateErrorNetwork,
      UpdateErrorCode.hashMismatch => l10n.updateErrorHashMismatch,
      UpdateErrorCode.installDenied => l10n.updateErrorInstallDenied,
      UpdateErrorCode.storageError => l10n.updateErrorStorage,
      UpdateErrorCode.unsupportedPlatform =>
        l10n.updateErrorUnsupportedPlatform,
      UpdateErrorCode.unknown => l10n.updateErrorUnknown,
    };
  }
}
