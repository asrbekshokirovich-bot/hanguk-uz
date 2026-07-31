import 'package:flutter/material.dart';

import '../seoul_night_tokens.dart';

/// The Seoul Night background: a 150deg four-stop gradient plus two ambient
/// glow blobs (DESIGN_SPEC §1 Background).
///
/// The blobs are pure decoration — they sit in an [IgnorePointer] so they can
/// never swallow a tap.
class SeoulNightScaffold extends StatelessWidget {
  const SeoulNightScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
    this.bottomSheet,
    this.safeArea = true,
    this.resizeToAvoidBottomInset = true,
    this.extendBodyBehindAppBar = true,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;
  final Widget? bottomSheet;

  /// Wrap [body] in a [SafeArea]. Off for screens that paint edge-to-edge
  /// (the map, a full-bleed WebView).
  final bool safeArea;

  final bool resizeToAvoidBottomInset;
  final bool extendBodyBehindAppBar;

  @override
  Widget build(BuildContext context) {
    final content = safeArea ? SafeArea(child: body) : body;

    return Scaffold(
      // The gradient below is the background; the Scaffold itself must not
      // paint over it.
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: extendBodyBehindAppBar,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      floatingActionButtonLocation: floatingActionButtonLocation,
      bottomSheet: bottomSheet,
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: SeoulGradients.appBackground),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _GlowBlobs())),
            content,
          ],
        ),
      ),
    );
  }
}

/// Top-left blue blob and bottom-right lime blob. Both extend past the edges
/// so only the falloff is visible.
class _GlowBlobs extends StatelessWidget {
  const _GlowBlobs();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: const [
        Positioned(
          left: -140,
          top: -120,
          child: _Blob(size: 380, gradient: SeoulGradients.glowBlue),
        ),
        Positioned(
          right: -130,
          bottom: -110,
          child: _Blob(size: 360, gradient: SeoulGradients.glowLime),
        ),
      ],
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.size, required this.gradient});

  final double size;
  final RadialGradient gradient;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: DecoratedBox(
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: gradient),
      ),
    );
  }
}
