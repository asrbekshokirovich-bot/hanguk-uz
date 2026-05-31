import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:webview_flutter/webview_flutter.dart';

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
      ..setBackgroundColor(const Color(0xFF0F1626))
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
      backgroundColor: const Color(0xFF0F1626),
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
              child: Container(
                color: const Color(0xFF0F1626).withValues(alpha: 0.92),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.threesixty,
                      color: Colors.white70,
                      size: 48,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      l.walkaroundInitErrorTitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l.walkaroundInitErrorSubtitle,
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

          // Back button.
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

          // Top-right name pill.
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
                  const Icon(Icons.threesixty, color: Colors.white, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    widget.institutionName,
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
