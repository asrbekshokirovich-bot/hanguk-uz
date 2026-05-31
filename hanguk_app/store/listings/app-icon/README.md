# App icon

## Apple App Store

**Required size:** 1024 × 1024 PNG, **no alpha channel**.

Apple is strict about the alpha channel — a transparent corner will
fail validation. Re-export from your source SVG / Sketch / Figma with
"Flatten transparency" enabled.

File name: `hanguk_appstore_icon_1024x1024.png`.

The build-time `flutter_launcher_icons` config generates all device-
class variants from `assets/app_icon2.png`; this 1024×1024 is for the
App Store Connect upload form only.

## Google Play

**Required size:** 512 × 512 PNG (alpha allowed).

File name: `hanguk_play_icon_512x512.png`.

The Play Console also wants:

- The same launcher icon you ship in the AAB (already generated).
- A 32-bit PNG; no JPEG, no SVG.

## Adaptive icon (Android 8+, optional but recommended)

In `pubspec.yaml`, configure `flutter_launcher_icons`:

```yaml
flutter_launcher_icons:
  android: "launcher_icon"
  ios: true
  image_path: "assets/app_icon2.png"
  adaptive_icon_background: "#0A0A1A"
  adaptive_icon_foreground: "assets/app_icon2_fg.png"
  min_sdk_android: 21
```

The foreground PNG must be transparent and centered within a
108 × 108 dp safe zone (or 432 × 432 px at xxxhdpi).

## Source format

Original art should live in `store/listings/app-icon/source/` as an
SVG or Figma export. Don't commit the source if it's a proprietary
file format.
