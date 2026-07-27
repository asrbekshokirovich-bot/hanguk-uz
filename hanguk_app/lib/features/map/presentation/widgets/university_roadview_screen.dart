import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

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
      ..setBackgroundColor(const Color(0xFF0F1626))
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
      backgroundColor: const Color(0xFF0F1626),
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
                child: Container(
                  color: const Color(0xFF0F1626).withValues(alpha: 0.92),
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _state is _RvLoading
                                ? Icons.hourglass_top
                                : Icons.directions_walk_outlined,
                            color: Colors.white70,
                            size: 48,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            overlay.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            overlay.subtitle,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // Back button overlay.
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            child: Semantics(
              label: 'Back',
              button: true,
              child: InkWell(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Icon(
                    Icons.arrow_back,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
            ),
          ),

          // Label overlay (top-right pill).
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white24),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.directions_walk,
                    color: Colors.white,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    widget.university.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
