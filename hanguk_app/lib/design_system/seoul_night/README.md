# Seoul Night design system

Premium dark design language for hanguk_app. Binding spec:
`DESIGN_SPEC.md` (repo root of the redesign package).

This is the **foundation only** — tokens + core widgets + a visual-QA
gallery. No feature screens are built or modified here, and every
existing route keeps working. Nothing in this folder is wired into the
global `AppTheme`, so it cannot regress current screens.

## Import

```dart
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';
```

## Tokens (`tokens/`)

| File | Exposes |
|---|---|
| `sn_colors.dart` | `SNColors` — royalBlue, lime/limeBright/limePressed, ink, glass/glassBorder, text 100/55/40%, hero + ambient + status colours |
| `sn_radii.dart` | `SNRadii` — 14 / 16 / 18 / 22 / 24 (+ `Radius` / `BorderRadius` helpers) |
| `sn_shadows.dart` | `SNShadows` — `card`, `hero`, `limeGlow` (+ soft variants) |
| `sn_gradients.dart` | `SNGradients` — `appBackground` (150°), `heroCard` (140°), `limeButton` (145°), ambient blobs |
| `sn_motion.dart` | `SNMotion` — 300ms base, `springOutBack` (nav/dial), `easeOut` (fades), pulse + stagger |
| `sn_typography.dart` | `SNTypography` — Inter / Noto Sans KR / JetBrains Mono roles + a Material `TextTheme` builder |

Fonts are provided by `google_fonts` (fetched once, cached, graceful
offline fallback).

## Core widgets (`widgets/`)

- `SeoulNightScaffold` — gradient background + two ambient glow blobs.
- `GlassCard` — 12px blur, hairline border, soft shadow.
- `HeroCard` — hero gradient + inset highlight + optional lime glow blob
  + faint 한국 watermark.
- `LimeButton` / `OutlineButton` — press-scale 0.97, min height 52.
- `HangulTag` — EN title + small lime KR accent (inline or stacked).
- `StatusChip` — `SNStatus` presets (완료 / 대기 / 잠김 / 선택 / 할 일 /
  In Review / Docs) or custom.
- `GlowProgressBar` — lime gradient fill + glow.
- `ConicProgressRing` — lime conic sweep + glow, optional centre widget.

## Visual QA gallery

`gallery/seoul_night_gallery_screen.dart` renders every token and widget.
It is **dev-flagged off** by default. Enable and open it with:

```bash
flutter run --dart-define=DESIGN_GALLERY=true
# then navigate to /dev/design-gallery (reachable pre-auth)
```

The route is registered only when `kDesignGalleryEnabled`
(`lib/core/feature_flags/design_gallery_flag.dart`) is true.
