import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/university.dart';
import 'roadview_html.dart';

/// Audit K5 / M6 (2026-05-11): the Roadview WebView posts state
/// transitions through `window.HangukRoadviewChannel`. This screen
/// attaches a JavaScript channel of that name, maintains a sealed
/// state, and renders a localized overlay on top of the WebView
/// when the state is anything other than `loading` or `ready`. The
/// HTML keeps English fallback copy in case the bridge isn't wired
/// (defensive), but the Dart overlay paints over it.
sealed class _RoadviewState {
  const _RoadviewState();
}

final class _RvLoading extends _RoadviewState {
  const _RvLoading();
}

final class _RvReady extends _RoadviewState {
  const _RvReady();
}

final class _RvNoPano extends _RoadviewState {
  const _RvNoPano();
}

final class _RvSdkBlocked extends _RoadviewState {
  const _RvSdkBlocked();
}

final class _RvNetwork extends _RoadviewState {
  const _RvNetwork();
}

final class _RvInitError extends _RoadviewState {
  const _RvInitError();
}

class UniversityRoadviewScreen extends StatefulWidget {
  final University university;

  const UniversityRoadviewScreen({super.key, required this.university});

  @override
  State<UniversityRoadviewScreen> createState() =>
      _UniversityRoadviewScreenState();
}

class _UniversityRoadviewScreenState extends State<UniversityRoadviewScreen> {
  late final WebViewController _controller;
  _RoadviewState _state = const _RvLoading();

  @override
  void initState() {
    super.initState();

    final lat = widget.university.latitude;
    final lng = widget.university.longitude;

    // No coordinates → do NOT fall back to the centre of Korea (36.5, 127.8),
    // which shows a random rural location that looks nothing like the campus.
    // Create an empty controller and surface the "no street view" state.
    if (lat == null || lng == null) {
      _controller = WebViewController();
      _state = const _RvNoPano();
      return;
    }

    final htmlContent = generateRoadviewHtml(lat, lng, widget.university.name);

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(SeoulColors.mapWater)
      ..addJavaScriptChannel(
        'HangukRoadviewChannel',
        onMessageReceived: _onChannelMessage,
      )
      // baseUrl gives the WebView a real origin so the Kakao JS-key domain
      // allowlist accepts it — same fix as map_mobile.dart and
      // virtual_tour_screen.dart (see docs/runbooks/kakao.md). Without it
      // the SDK script fails to load and the user sees "sdk_blocked"/"network".
      ..loadHtmlString(htmlContent, baseUrl: 'https://hanguk.uz');
  }

  void _onChannelMessage(JavaScriptMessage message) {
    if (!mounted) return;
    final next = switch (message.message) {
      'ready' => const _RvReady(),
      'no_pano' => const _RvNoPano(),
      'sdk_blocked' => const _RvSdkBlocked(),
      'network' => const _RvNetwork(),
      'init_error' => const _RvInitError(),
      _ => _state,
    };
    setState(() => _state = next);
  }

  ({String title, String subtitle})? _overlayCopy(AppLocalizations l) {
    return switch (_state) {
      _RvLoading() => (
        title: l.walkaroundLoadingTitle,
        subtitle: l.walkaroundLoadingSubtitle,
      ),
      _RvReady() => null,
      _RvNoPano() => (
        title: l.walkaroundNoPanoTitle,
        subtitle: l.walkaroundNoPanoSubtitle,
      ),
      _RvSdkBlocked() => (
        title: l.walkaroundBlockedTitle,
        subtitle: l.walkaroundBlockedSubtitle,
      ),
      _RvNetwork() => (
        title: l.walkaroundNetworkTitle,
        subtitle: l.walkaroundNetworkSubtitle,
      ),
      _RvInitError() => (
        title: l.walkaroundInitErrorTitle,
        subtitle: l.walkaroundInitErrorSubtitle,
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final overlay = _overlayCopy(l);
    return Scaffold(
      backgroundColor: SeoulColors.mapWater,
      body: Stack(
        children: [
          // EagerGestureRecognizer prevents WebView gestures from
          // bubbling up to Flutter — fixes the panning friction
          // common to Kakao Roadview inside a Flutter app.
          WebViewWidget(
            controller: _controller,
            gestureRecognizers: {
              Factory<OneSequenceGestureRecognizer>(
                () => EagerGestureRecognizer(),
              ),
            },
          ),

          if (overlay != null)
            Positioned.fill(
              child: IgnorePointer(
                ignoring: _state is _RvReady,
                child: ColoredBox(
                  color: SeoulColors.mapWater.withValues(alpha: 0.92),
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: GlassCard(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 28,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _state is _RvLoading
                                  ? Icons.hourglass_top
                                  : Icons.directions_walk_outlined,
                              color: SeoulColors.lime,
                              size: 40,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              overlay.title,
                              textAlign: TextAlign.center,
                              style: SeoulType.title,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              overlay.subtitle,
                              textAlign: TextAlign.center,
                              style: SeoulType.bodySecondary,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // Back button overlay — glass back-circle, spec §2.
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: SeoulSizes.screenPadding,
            child: _GlassBackButton(onTap: () => Navigator.of(context).pop()),
          ),

          // Label overlay (top-right pill). Top-right, so it never lands
          // under the bottom-right 한 orb.
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            right: SeoulSizes.screenPadding,
            child: _CampusPill(
              icon: Icons.directions_walk,
              label: widget.university.name,
              ko: '캠퍼스',
            ),
          ),
        ],
      ),
    );
  }
}

/// 44px glass circle with a back chevron — the header affordance the spec
/// gives every pushed screen (§2).
class _GlassBackButton extends StatelessWidget {
  const _GlassBackButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      label: l.a11yTooltipBack,
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: SeoulSizes.minTapTarget,
          height: SeoulSizes.minTapTarget,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: SeoulColors.glass,
            shape: BoxShape.circle,
            border: Border.all(color: SeoulColors.glassBorder, width: 1),
            boxShadow: SeoulShadows.card,
          ),
          child: const Icon(
            Icons.arrow_back_rounded,
            color: SeoulColors.textPrimary,
            size: 20,
          ),
        ),
      ),
    );
  }
}

/// Glass pill naming what the full-bleed WebView is showing.
class _CampusPill extends StatelessWidget {
  const _CampusPill({
    required this.icon,
    required this.label,
    required this.ko,
  });

  final IconData icon;
  final String label;
  final String ko;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.6,
      ),
      child: GlassCard(
        radius: 999,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: SeoulColors.lime, size: 15),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.caption.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: SeoulColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(ko, style: SeoulType.hangulLabel),
          ],
        ),
      ),
    );
  }
}
