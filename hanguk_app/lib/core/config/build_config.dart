/// Compile-time flags for distribution channel.
///
/// Set `STORE_BUILD=true` when building for Google Play or the Apple
/// App Store:
///
///   flutter build appbundle --release --dart-define=STORE_BUILD=true
///   flutter build ipa       --release --dart-define=STORE_BUILD=true
///
/// Default (`false`) keeps the existing direct-APK self-distribution
/// flow alive (the auto-updater downloads + installs APKs from
/// Supabase Storage, which is incompatible with both store policies).
///
/// When [kIsStoreBuild] is true:
///   - The in-app auto-updater (`UpdateGate`) is bypassed at the
///     `MaterialApp.builder` level.
///   - Any attempt to call into the `install_plugin` install path
///     throws `UnsupportedError` (the import stays alive so the
///     non-store build still works).
///
/// The `install_plugin` dependency is intentionally retained in
/// `pubspec.yaml`. A future Play-specific build flavor may strip the
/// `REQUEST_INSTALL_PACKAGES` permission from a flavored manifest; the
/// compile-time flag remains the primary defense.
const bool kIsStoreBuild = bool.fromEnvironment(
  'STORE_BUILD',
  defaultValue: false,
);
