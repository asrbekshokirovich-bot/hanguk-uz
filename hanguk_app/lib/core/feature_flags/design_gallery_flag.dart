/// Dev flag for the Seoul Night design-system gallery (visual QA).
///
/// The gallery renders every design token and core widget for
/// side-by-side inspection. It is **off by default** so production
/// builds never expose it, and the `/dev/design-gallery` route is only
/// registered (and reachable pre-auth) when this flag is true.
///
/// Enable for a QA build:
///
///   flutter run --dart-define=DESIGN_GALLERY=true
///
/// See lib/design_system/seoul_night/gallery/seoul_night_gallery_screen.dart.
const bool kDesignGalleryEnabled = bool.fromEnvironment(
  'DESIGN_GALLERY',
  defaultValue: false,
);
