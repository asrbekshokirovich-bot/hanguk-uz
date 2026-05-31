/// Server-published metadata for a single platform/channel app release.
/// Mirrors the `public.app_versions` row.
class AppVersionInfo {
  const AppVersionInfo({
    required this.id,
    required this.latestVersion,
    required this.downloadUrl,
    required this.forceUpdate,
    this.sha256,
    this.sizeBytes,
    this.releaseNotes,
    this.minSupportedVersion,
    this.iosAppStoreUrl,
    this.channel = 'stable',
    this.rolloutPercentage = 100,
    this.forceFullReinstall = false,
  });

  /// Platform identifier: `'android'` | `'ios'` | `'web'`.
  final String id;

  /// `'1.0.19+2032'` style.
  final String latestVersion;

  /// Direct URL to the artifact (APK on Android; ignored on iOS — see
  /// [iosAppStoreUrl]; ignored on web — service worker handles update).
  final String downloadUrl;

  /// If true, the user can't dismiss the update dialog.
  final bool forceUpdate;

  /// Hex-encoded SHA-256 of the artifact at [downloadUrl]. The client
  /// MUST verify this before invoking install.
  final String? sha256;

  /// Total size of the artifact in bytes — used for the progress UI and
  /// the "you're on cellular" warning.
  final int? sizeBytes;

  /// Markdown-ish release notes, displayed in the update dialog.
  final String? releaseNotes;

  /// Hard floor: any local version below this is force-updated regardless
  /// of [forceUpdate].
  final String? minSupportedVersion;

  /// App Store deep-link, e.g. `https://apps.apple.com/app/idXXXXXXXXX`.
  final String? iosAppStoreUrl;

  /// Release channel: `'stable'`, `'beta'`, or `'canary'`.
  final String channel;

  /// 0..100. Devices with `hash(deviceId+version) % 100 < rolloutPercentage`
  /// see the update; the rest are kept on the previous version.
  final int rolloutPercentage;

  /// One-shot flag for the cert-rotation transition (debug-keys → upload-keys).
  /// When true, the dialog warns the user they'll be logged out and have to
  /// re-enter their magic code after the install.
  final bool forceFullReinstall;

  factory AppVersionInfo.fromMap(Map<String, dynamic> map) {
    return AppVersionInfo(
      id: map['id'] as String? ?? '',
      latestVersion: map['latest_version'] as String? ?? '',
      downloadUrl: map['download_url'] as String? ?? '',
      forceUpdate: map['force_update'] == true,
      sha256: map['sha256'] as String?,
      sizeBytes: (map['size_bytes'] as num?)?.toInt(),
      releaseNotes: map['release_notes'] as String?,
      minSupportedVersion: map['min_supported_version'] as String?,
      iosAppStoreUrl: map['ios_app_store_url'] as String?,
      channel: map['channel'] as String? ?? 'stable',
      rolloutPercentage: (map['rollout_percentage'] as num?)?.toInt() ?? 100,
      forceFullReinstall: map['force_full_reinstall'] == true,
    );
  }
}
