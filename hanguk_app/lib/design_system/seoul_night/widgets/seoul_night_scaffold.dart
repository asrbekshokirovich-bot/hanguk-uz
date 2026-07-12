import 'package:flutter/material.dart';

import '../tokens/sn_colors.dart';
import '../tokens/sn_gradients.dart';

/// The Seoul Night base surface for every screen (see `DESIGN_SPEC.md`
/// §1 Background).
///
/// Paints the 150° app-background gradient and two purely-decorative
/// ambient glow blobs (top-left blue, bottom-right lime), then hosts a
/// transparent [Scaffold] on top. The blobs never intercept touches.
///
/// This does not add global navigation — the 한 Orb (§2) is composed
/// separately by feature shells.
class SeoulNightScaffold extends StatelessWidget {
  const SeoulNightScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.bottomNavigationBar,
    this.extendBodyBehindAppBar = true,
    this.extendBody = true,
    this.resizeToAvoidBottomInset = true,
    this.safeArea = true,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Widget? bottomNavigationBar;
  final bool extendBodyBehindAppBar;
  final bool extendBody;
  final bool resizeToAvoidBottomInset;

  /// Wrap [body] in a [SafeArea]. Screens that draw their own edge
  /// bleed can set this to false.
  final bool safeArea;

  @override
  Widget build(BuildContext context) {
    final content = safeArea ? SafeArea(child: body) : body;

    return DecoratedBox(
      decoration: const BoxDecoration(gradient: SNGradients.appBackground),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Ambient glow blobs — decoration only.
          const Positioned.fill(child: _AmbientGlow()),
          Scaffold(
            backgroundColor: Colors.transparent,
            appBar: appBar,
            body: content,
            floatingActionButton: floatingActionButton,
            floatingActionButtonLocation: floatingActionButtonLocation,
            bottomNavigationBar: bottomNavigationBar,
            extendBodyBehindAppBar: extendBodyBehindAppBar,
            extendBody: extendBody,
            resizeToAvoidBottomInset: resizeToAvoidBottomInset,
          ),
        ],
      ),
    );
  }
}

/// The two ambient radial glow blobs. Non-interactive; sits under the
/// scaffold content.
class _AmbientGlow extends StatelessWidget {
  const _AmbientGlow();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          // Top-left: 380px blue radial.
          Positioned(
            left: -120,
            top: -100,
            child: _blob(380, SNColors.ambientBlue),
          ),
          // Bottom-right: 360px lime radial.
          Positioned(
            right: -110,
            bottom: -90,
            child: _blob(360, SNColors.ambientLime),
          ),
        ],
      ),
    );
  }

  Widget _blob(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0)],
          stops: const [0.0, 0.7],
        ),
      ),
    );
  }
}
