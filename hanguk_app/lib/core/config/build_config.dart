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
///   - The in-app auto-updater (`UpdateGate`) returns its child
///     untouched — no update check, no dialog.
///   - `UpdaterRepository.downloadAndInstall` throws `UnsupportedError`
///     instead of sideloading an APK (the import stays alive so the
///     non-store build still works).
///   - `PlayInAppUpdater.checkAndPrompt()` is the intended replacement
///     path, though nothing calls it yet — Play already updates the
///     app on its own, so wiring it in is optional.
///
/// The `store` Gradle flavor (see android/app/build.gradle.kts) strips
/// `REQUEST_INSTALL_PACKAGES` from the manifest at the native layer;
/// this flag is the Dart-side defense in depth.
const bool kIsStoreBuild = bool.fromEnvironment(
  'STORE_BUILD',
  defaultValue: false,
);
