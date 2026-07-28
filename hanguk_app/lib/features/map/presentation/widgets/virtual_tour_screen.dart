import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';

/// Audit M17 (2026-05-12) — Pannellum-backed curated walkaround.
///
/// Loads `assets/virtual_tour/pannellum.html` into a WebView, hands
/// it the institution's `virtual_tour` JSONB (passed via constructor)
/// using a `runJavaScript` call against the `window.HangukTour`
/// surface, and listens for state transitions on
/// `window.HangukTourChannel`.
///
/// The tour spec shape is documented in
/// `supabase/migrations/20260512120000_institutions_virtual_tour.sql`.
/// In short: `{ default_scene, scenes: [{ id, panorama_url, title,
/// title_ko?, title_uz?, hotspots: [...] }] }`.
class VirtualTourScreen extends StatefulWidget {
  final String institutionName;
  final Map<String, dynamic> tourSpec;

  const VirtualTourScreen({
    super.key,
    required this.institutionName,
    required this.tourSpec,
  });

  @override
  State<VirtualTourScreen> createState() => _VirtualTourScreenState();
}

class _VirtualTourScreenState extends State<VirtualTourScreen> {
  late final WebViewController _controller;
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(SeoulColors.mapWater)
      ..addJavaScriptChannel(
        'HangukTourChannel',
        onMessageReceived: _onChannelMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(onPageFinished: (_) => _injectSpec()),
      );
    _loadAsset();
  }

  Future<void> _loadAsset() async {
    final html = await rootBundle.loadString(
      'assets/virtual_tour/pannellum.html',
    );
    // baseUrl gives the WebView a real origin so external panorama
    // URLs (Pannellum CDN, Supabase Storage public bucket) load
    // without mixed-content issues.
    await _controller.loadHtmlString(html, baseUrl: 'https://hanguk.uz');
  }

  Future<void> _injectSpec() async {
    final l = AppLocalizations.of(context);
    if (l != null) {
      final labels = jsonEncode({
        'loading': l.walkaroundLoadingTitle,
        'loadingSubtitle': l.walkaroundLoadingSubtitle,
        'error': l.walkaroundInitErrorTitle,
        'errorSubtitle': l.walkaroundInitErrorSubtitle,
        'scenePrefix': '',
      });
      await _controller.runJavaScript('window.HangukTour.setLabels($labels);');
    }
    final localeCode =
        // ignore: use_build_context_synchronously
        Localizations.maybeLocaleOf(context)?.languageCode ?? 'en';
    final spec = jsonEncode(widget.tourSpec);
    // Pass the spec as a JSON-encoded *string* through JS — encoding
    // it twice is the cleanest way to keep Pannellum's hotspot
    // `text` fields readable and avoid quoting hell.
    final specJsArg = jsonEncode(spec);
    await _controller.runJavaScript(
      'window.HangukTour.setTourSpec($specJsArg, ${jsonEncode(localeCode)});',
    );
  }

  void _onChannelMessage(JavaScriptMessage message) {
    if (!mounted) return;
    final raw = message.message;
    final state = raw.contains('|') ? raw.split('|').first : raw;
    switch (state) {
      case 'ready':
      case 'scene':
        setState(() {
          _ready = true;
          _failed = false;
        });
        break;
      case 'error':
      case 'no_scenes':
      case 'parse_error':
        setState(() {
          _failed = true;
        });
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: SeoulColors.mapWater,
      body: Stack(
        children: [
          WebViewWidget(
            controller: _controller,
            gestureRecognizers: {
              Factory<OneSequenceGestureRecognizer>(
                () => EagerGestureRecognizer(),
              ),
            },
          ),

          // Dart-side fallback overlay if the WebView reports a hard
          // failure. The HTML has its own status overlay too — this
          // wins because the WebView background is opaque.
          if (_failed && l != null)
            Positioned.fill(
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
                          const Icon(
                            Icons.threesixty,
                            color: SeoulColors.lime,
                            size: 40,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            l.walkaroundInitErrorTitle,
                            textAlign: TextAlign.center,
                            style: SeoulType.title,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            l.walkaroundInitErrorSubtitle,
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

          // Back button — glass back-circle, spec §2.
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: SeoulSizes.screenPadding,
            child: _TourBackButton(onTap: () => Navigator.of(context).pop()),
          ),

          // Top-right name pill. Top-right, so it never lands under the
          // bottom-right 한 orb.
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            right: SeoulSizes.screenPadding,
            child: _TourPill(label: widget.institutionName),
          ),
        ],
      ),
    );
  }
}

/// 44px glass circle with a back chevron (spec §2).
class _TourBackButton extends StatelessWidget {
  const _TourBackButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Semantics(
      label: l?.a11yTooltipBack,
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

/// Glass pill naming the campus the panorama belongs to.
class _TourPill extends StatelessWidget {
  const _TourPill({required this.label});

  final String label;

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
            const Icon(Icons.threesixty, color: SeoulColors.lime, size: 15),
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
            const Text('가상 투어', style: SeoulType.hangulLabel),
          ],
        ),
      ),
    );
  }
}
