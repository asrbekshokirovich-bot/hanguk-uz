import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../../../design_system/seoul_night/seoul_night.dart';
import '../../../domain/university.dart';
import '../university_map_html.dart';

Widget buildMap({
  required BuildContext context,
  required List<University> universities,
  required void Function(University u) onMarkerClick,
}) {
  // Audit M19 (2026-05-12): capture the active locale once and thread
  // it into the WebView HTML generator so marker labels render in the
  // student's language. Default to 'en' if the Localizations widget
  // is missing (e.g. test harness).
  final localeCode = Localizations.maybeLocaleOf(context)?.languageCode ?? 'en';
  return _MobileMapWidget(
    universities: universities,
    onMarkerClick: onMarkerClick,
    locale: localeCode,
  );
}

class _MobileMapWidget extends StatefulWidget {
  final List<University> universities;
  final void Function(University u) onMarkerClick;
  final String locale;

  const _MobileMapWidget({
    required this.universities,
    required this.onMarkerClick,
    required this.locale,
  });

  @override
  State<_MobileMapWidget> createState() => _MobileMapWidgetState();
}

class _MobileMapWidgetState extends State<_MobileMapWidget> {
  late final WebViewController _controller;
  late Map<String, University> _uniById;

  @override
  void initState() {
    super.initState();
    _uniById = {for (final u in widget.universities) u.id: u};

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      // Matches the map card the WebView is clipped into, so the seam
      // between Flutter and the page never shows while tiles load.
      ..setBackgroundColor(SeoulColors.mapWater)
      ..addJavaScriptChannel(
        'HangukMapChannel',
        onMessageReceived: (JavaScriptMessage message) {
          final u = _uniById[message.message];
          if (u != null && mounted) {
            widget.onMarkerClick(u);
          }
        },
      )
      ..loadHtmlString(
        generateMapHtml(widget.universities, locale: widget.locale),
        baseUrl: 'https://hanguk.uz',
      );
  }

  /// Reload the page when the filtered set changes.
  ///
  /// Without this the markers were built once in initState and never again:
  /// searching or filtering updated the list, the count pill and the
  /// "no universities match" badge, while the map underneath still showed
  /// every pin — and `_uniById` stayed frozen, so tapping a pin that had been
  /// filtered out still opened its detail sheet. The card holds a stable
  /// ValueKey, so nothing else was going to rebuild this element.
  @override
  void didUpdateWidget(covariant _MobileMapWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final sameLocale = oldWidget.locale == widget.locale;
    if (sameLocale && _sameIds(oldWidget.universities, widget.universities)) {
      return;
    }
    _uniById = {for (final u in widget.universities) u.id: u};
    _controller.loadHtmlString(
      generateMapHtml(widget.universities, locale: widget.locale),
      baseUrl: 'https://hanguk.uz',
    );
  }

  /// Identity by id and order — reloading the WebView is expensive, so only
  /// do it when the set of pins actually differs.
  static bool _sameIds(List<University> a, List<University> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id != b[i].id) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(controller: _controller);
  }
}
