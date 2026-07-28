import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';

/// The Seoul Night page shell (DESIGN_SPEC.md §1 "Background").
///
/// Paints the 150deg app gradient plus the two ambient glow blobs that
/// every screen shares, then lays [body] on top. The blobs are pure
/// decoration and never absorb a tap.
///
/// Every Seoul Night screen sits inside one of these — the gradient is
/// what makes the layered glass read as depth, so a screen that forgets
/// it will look flat and wrong rather than merely unstyled.
///
/// The scaffold is transparent, so a screen may still supply its own
/// [floatingActionButton] (Phase 1's `HanOrb`) or [bottomSheet]. It
/// deliberately exposes no `bottomNavigationBar` — spec §4: *no bottom
/// tab bar, ever*.
class SeoulNightScaffold extends StatelessWidget {
  const SeoulNightScaffold({
    super.key,
    required this.body,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.bottomSheet,
    this.safeArea = true,
    this.showAmbientGlow = true,
    this.resizeToAvoidBottomInset,
  });

  final Widget body;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Widget? bottomSheet;

  /// Wraps [body] in a [SafeArea]. Turn off for full-bleed content
  /// (e.g. the map canvas) and handle insets inside the screen.
  final bool safeArea;

  /// Ambient blobs can be dropped on screens that already carry a lot
  /// of glow (the map, the interview screen) to keep the lime rare.
  final bool showAmbientGlow;

  final bool? resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final content = safeArea ? SafeArea(child: body) : body;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Dark background, so status-bar glyphs must be light. The
      // navigation bar is transparent because the gradient runs behind it.
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: SnColors.bgStop3,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        resizeToAvoidBottomInset: resizeToAvoidBottomInset,
        floatingActionButton: floatingActionButton,
        floatingActionButtonLocation: floatingActionButtonLocation,
        bottomSheet: bottomSheet,
        body: DecoratedBox(
          decoration: const BoxDecoration(gradient: SnGradients.appBackground),
          child: Stack(
            children: [
              if (showAmbientGlow) const _AmbientGlow(),
              Positioned.fill(child: content),
            ],
          ),
        ),
      ),
    );
  }
}

/// The two decorative radial blobs. Sized in logical pixels straight
/// from the spec (380 / 360) and anchored so roughly a quarter of each
/// circle bleeds off-screen, matching the prototype.
class _AmbientGlow extends StatelessWidget {
  const _AmbientGlow();

  static const double _blueSize = 380;
  static const double _limeSize = 360;

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: Stack(
        children: [
          Positioned(
            top: -_blueSize * 0.35,
            left: -_blueSize * 0.3,
            width: _blueSize,
            height: _blueSize,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: SnGradients.ambientBlue,
              ),
            ),
          ),
          Positioned(
            bottom: -_limeSize * 0.3,
            right: -_limeSize * 0.3,
            width: _limeSize,
            height: _limeSize,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: SnGradients.ambientLime,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
