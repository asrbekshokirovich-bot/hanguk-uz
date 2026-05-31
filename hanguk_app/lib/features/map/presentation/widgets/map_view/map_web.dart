import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../domain/university.dart';
import '../university_map_html.dart';

Widget buildMap({
  required BuildContext context,
  required List<University> universities,
  required void Function(University u) onMarkerClick,
}) {
  // Audit M19 (2026-05-12): see map_mobile.dart for rationale.
  final localeCode = Localizations.maybeLocaleOf(context)?.languageCode ?? 'en';
  return _WebMapWidget(
    universities: universities,
    onMarkerClick: onMarkerClick,
    locale: localeCode,
  );
}

class _WebMapWidget extends StatefulWidget {
  final List<University> universities;
  final void Function(University u) onMarkerClick;
  final String locale;

  const _WebMapWidget({
    Key? key,
    required this.universities,
    required this.onMarkerClick,
    required this.locale,
  }) : super(key: key);

  @override
  State<_WebMapWidget> createState() => _WebMapWidgetState();
}

class _WebMapWidgetState extends State<_WebMapWidget> {
  late final String _viewId;
  late final Map<String, University> _uniById;

  @override
  void initState() {
    super.initState();
    _uniById = {for (final u in widget.universities) u.id: u};
    _viewId = 'kakao-map-${DateTime.now().millisecondsSinceEpoch}';

    final htmlTemplate = generateMapHtml(
      widget.universities,
      locale: widget.locale,
    );

    final iframe = html.IFrameElement()
      ..style.border = 'none'
      ..style.height = '100%'
      ..style.width = '100%'
      ..srcdoc = htmlTemplate;

    ui_web.platformViewRegistry.registerViewFactory(
      _viewId,
      (int viewId) => iframe,
    );

    html.window.onMessage.listen((event) {
      if (event.data != null && event.data is Map) {
        final data = event.data as Map;
        if (data['type'] == 'HangukMapClick') {
          final id = data['id'];
          final u = _uniById[id];
          if (u != null && mounted) {
            widget.onMarkerClick(u);
          }
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewId);
  }
}
