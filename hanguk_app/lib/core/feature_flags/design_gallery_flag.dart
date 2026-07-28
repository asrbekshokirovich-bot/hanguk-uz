/// Exposure flag for the Seoul Night design gallery (`/dev/design-gallery`).
///
/// The gallery renders every token and widget in the design system on one
/// scrollable page so a change to `lib/design_system/seoul_night/` can be
/// eyeballed against the HTML prototype without navigating the real app.
/// It is a QA surface, not a product screen.
///
/// Defaults to `!kReleaseMode`, so it is present in debug and profile
/// builds and compiled out of release. Two escape hatches:
///
///   * `--dart-define=DESIGN_GALLERY=true` — force it on in a release
///     build (useful when reviewing a TestFlight / internal-track build
///     on a real device, where the blur and the OLED bottom-out are the
///     things actually worth checking).
///   * `--dart-define=DESIGN_GALLERY=false` — force it off in debug.
///
/// Same shape as `uni_db_flag.dart`; the route is registered as a plain
/// `GoRoute` so flipping this does not require running build_runner.
library;

import 'package:flutter/foundation.dart';

const bool _kGalleryOverride = bool.fromEnvironment(
  'DESIGN_GALLERY',
  defaultValue: false,
);

const bool _kGalleryOverrideSet = bool.hasEnvironment('DESIGN_GALLERY');

/// Whether `/dev/design-gallery` is registered on the router.
final bool kDesignGalleryEnabled = _kGalleryOverrideSet
    ? _kGalleryOverride
    : !kReleaseMode;
