// `CupertinoPageTransitionsBuilder` lives in the cupertino library, not
// material — the iOS slide transition is the one Material default we keep.
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

import 'tokens/sn_colors.dart';
import 'tokens/sn_motion.dart';
import 'tokens/sn_radii.dart';
import 'tokens/sn_typography.dart';

/// The Material 3 [ThemeData] for Seoul Night.
///
/// Most of this design language is built from explicit widgets rather
/// than theme slots — `GlassCard` does not read `CardTheme`, `LimeButton`
/// does not read `ElevatedButtonTheme`. What the theme is for is
/// everything we *don't* hand-build: dialogs, snackbars, text selection,
/// the default cursor colour, sheets raised by plugins.
///
/// Not yet wired into `main.dart`. The app still runs on
/// `AppTheme.materialTheme` so unmigrated screens keep their current
/// look; the swap happens in Phase 1 when the nav shell lands. Until
/// then this is reachable from the design gallery only.
abstract final class SeoulNightTheme {
  static ThemeData get theme {
    const colorScheme = ColorScheme.dark(
      primary: SnColors.lime,
      onPrimary: SnColors.ink,
      primaryContainer: SnColors.limeFill,
      onPrimaryContainer: SnColors.lime,
      secondary: SnColors.royalBlue,
      onSecondary: SnColors.textPrimary,
      surface: SnColors.bgStop2,
      onSurface: SnColors.textPrimary,
      onSurfaceVariant: SnColors.textSecondary,
      error: SnColors.danger,
      onError: SnColors.textPrimary,
      outline: SnColors.glassBorder,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      // Transparent: `SeoulNightScaffold` owns the background gradient.
      // A screen that forgets the scaffold shows near-black rather than
      // a jarring mid-blue.
      scaffoldBackgroundColor: SnColors.bgStop3,
      canvasColor: SnColors.bgStop3,
      fontFamily: SnType.interFamily,
      fontFamilyFallback: const [SnType.hangulFamily],
      textTheme: SnType.textTheme,
      primaryTextTheme: SnType.textTheme,
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
      // Depth is gradient + glow, never a lighter flat panel — so M3's
      // surface elevation tint is switched off everywhere.
      applyElevationOverlayColor: false,

      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: SnType.title,
        iconTheme: const IconThemeData(color: SnColors.textPrimary),
      ),

      dividerTheme: const DividerThemeData(
        color: SnColors.glassBorder,
        thickness: 1,
        space: 1,
      ),

      iconTheme: const IconThemeData(color: SnColors.textPrimary, size: 20),

      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: SnColors.lime,
        selectionColor: SnColors.limeFill,
        selectionHandleColor: SnColors.lime,
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SnColors.glass,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        hintStyle: SnType.body.copyWith(color: SnColors.textFaint),
        labelStyle: SnType.caption,
        border: _inputBorder(SnColors.glassBorder),
        enabledBorder: _inputBorder(SnColors.glassBorder),
        focusedBorder: _inputBorder(SnColors.lime),
        errorBorder: _inputBorder(SnColors.danger),
        focusedErrorBorder: _inputBorder(SnColors.danger),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: SnColors.bgStop2,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(borderRadius: SnRadii.sheetR),
        titleTextStyle: SnType.title,
        contentTextStyle: SnType.body,
      ),

      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: SnColors.bgStop2,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: SnColors.bgStop2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(SnRadii.sheet),
          ),
        ),
        showDragHandle: true,
        dragHandleColor: SnColors.glassBorder,
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: SnColors.bgStop1,
        contentTextStyle: SnType.body,
        actionTextColor: SnColors.lime,
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: SnRadii.controlR),
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: SnColors.lime,
        linearTrackColor: SnColors.glass,
        circularTrackColor: SnColors.glass,
      ),

      // Material's own chips are not part of this design language —
      // use `StatusChip` / `SnFilterChip`. Themed anyway so a stray one
      // from a plugin does not render in default M3 purple.
      chipTheme: ChipThemeData(
        backgroundColor: SnColors.glass,
        selectedColor: SnColors.lime,
        side: const BorderSide(color: SnColors.glassBorder),
        labelStyle: SnType.caption,
        shape: const RoundedRectangleBorder(borderRadius: SnRadii.pillR),
      ),

      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),

      // Spec §4: no bottom tab bar, ever. Phase 1 deletes the
      // NavigationBar from the shell; this makes sure that nothing
      // re-introduces a themed one by accident in the meantime.
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        indicatorColor: SnColors.limeFill,
        elevation: 0,
      ),

      extensions: const [SnThemeExtension()],
    );
  }

  static OutlineInputBorder _inputBorder(Color color) => OutlineInputBorder(
    borderRadius: SnRadii.controlR,
    borderSide: BorderSide(color: color, width: 1),
  );
}

/// Carries the handful of Seoul Night values that widgets look up
/// through [Theme] rather than importing directly — mainly so a future
/// "reduce motion" or "high contrast" variant can override them in one
/// place instead of forking every widget.
@immutable
class SnThemeExtension extends ThemeExtension<SnThemeExtension> {
  const SnThemeExtension({
    this.glassBlur = 12,
    this.scrimBlur = 10,
    this.motionScale = 1.0,
  });

  /// Backdrop blur sigma for glass surfaces.
  final double glassBlur;

  /// Backdrop blur sigma for the speed-dial scrim.
  final double scrimBlur;

  /// Multiplier on [SnMotion] durations. Set to 0 to disable animation
  /// wholesale (accessibility, or deterministic golden tests).
  final double motionScale;

  Duration scale(Duration d) =>
      Duration(microseconds: (d.inMicroseconds * motionScale).round());

  @override
  SnThemeExtension copyWith({
    double? glassBlur,
    double? scrimBlur,
    double? motionScale,
  }) {
    return SnThemeExtension(
      glassBlur: glassBlur ?? this.glassBlur,
      scrimBlur: scrimBlur ?? this.scrimBlur,
      motionScale: motionScale ?? this.motionScale,
    );
  }

  @override
  SnThemeExtension lerp(SnThemeExtension? other, double t) {
    if (other == null) return this;
    return SnThemeExtension(
      glassBlur: lerpDouble(glassBlur, other.glassBlur, t),
      scrimBlur: lerpDouble(scrimBlur, other.scrimBlur, t),
      motionScale: lerpDouble(motionScale, other.motionScale, t),
    );
  }

  static double lerpDouble(double a, double b, double t) => a + (b - a) * t;
}
