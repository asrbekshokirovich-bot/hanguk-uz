import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../../../../design_system/theme/app_colors.dart';
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
    Key? key,
    required this.universities,
    required this.onMarkerClick,
    required this.locale,
  }) : super(key: key);

  @override
  State<_MobileMapWidget> createState() => _MobileMapWidgetState();
}

class _MobileMapWidgetState extends State<_MobileMapWidget> {
  late final WebViewController _controller;
  late final Map<String, University> _uniById;

  @override
  void initState() {
    super.initState();
    _uniById = {for (final u in widget.universities) u.id: u};

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.backgroundNavy)
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

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(controller: _controller);
  }
}
