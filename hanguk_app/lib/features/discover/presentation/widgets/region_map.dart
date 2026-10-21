import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../catalog/data/catalog_filters.dart';

/// Where each of the board's city groups sits on the map ("Boshqa" is the
/// rest of the country: shown over Gangwon, as "Gangwon+"). Seoul and
/// Gyeonggi are drawn a little apart — north of the capital and towards the
/// west coast — so their bubbles do not cover each other at this scale.
const Map<String, (double, double)> kRegionPoints = {
  CatalogRegion.seoul: (37.85, 127.05),
  CatalogRegion.gyeonggi: (36.95, 126.35),
  CatalogRegion.other: (37.70, 128.60),
  CatalogRegion.daejeon: (36.3504, 127.3845),
  CatalogRegion.daegu: (36.05, 128.55),
  CatalogRegion.gwangju: (35.1595, 126.8526),
  CatalogRegion.busan: (35.05, 129.20),
  CatalogRegion.jeju: (33.45, 126.55),
};

/// "Shahar · xaritadan tanlang" (design 2026-10-21): a real map of Korea
/// with a bubble per city group — how many universities the other choices
/// leave there — tapped to pick or drop it, picked ones lime. The map stays
/// still (no pan or zoom) so the board scrolls over it.
///
/// Where no web view can run (tests), the groups are plain choices.
class RegionMap extends StatefulWidget {
  const RegionMap({
    super.key,
    required this.counts,
    required this.selected,
    required this.labels,
    required this.onToggle,
    this.height = 260,
  });

  final Map<String, int> counts;
  final Set<String> selected;

  /// Each group's name in the app language.
  final String Function(String region) labels;
  final ValueChanged<String> onToggle;
  final double height;

  @override
  State<RegionMap> createState() => _RegionMapState();
}

class _RegionMapState extends State<RegionMap> {
  WebViewController? _controller;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    if (WebViewPlatform.instance == null) return;
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFE6EDF8))
      ..addJavaScriptChannel(
        'RegionChannel',
        onMessageReceived: (m) {
          if (mounted && kRegionPoints.containsKey(m.message)) widget.onToggle(m.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            _ready = true;
            _push();
          },
        ),
      )
      ..loadHtmlString(regionMapHtml, baseUrl: 'https://hanguk.uz');
  }

  @override
  void didUpdateWidget(RegionMap old) {
    super.didUpdateWidget(old);
    _push();
  }

  /// The bubbles' numbers, names and picks, into the page.
  void _push() {
    final c = _controller;
    if (c == null || !_ready) return;
    final data = [
      for (final r in kRegionPoints.keys)
        {'id': r, 'n': widget.counts[r] ?? 0, 'label': widget.labels(r), 'on': widget.selected.contains(r)},
    ];
    c.runJavaScript('setRegions(${jsonEncode(data)})');
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        height: widget.height,
        decoration: BoxDecoration(color: const Color(0xFFE6EDF8), borderRadius: BorderRadius.circular(14)),
        child: c != null
            ? WebViewWidget(controller: c)
            : Padding(
                padding: const EdgeInsets.all(12),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final r in kRegionPoints.keys)
                      IntrinsicWidth(
                        child: HardChoice(
                          label: '${widget.labels(r)} · ${widget.counts[r] ?? 0}',
                          height: 34,
                          radius: 999,
                          fontSize: 12,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          selected: widget.selected.contains(r),
                          onTap: () => widget.onToggle(r),
                        ),
                      ),
                  ],
                ),
              ),
      ),
    );
  }
}

@visibleForTesting
String get regionMapHtml {
  final points = jsonEncode({
    for (final e in kRegionPoints.entries) e.key: [e.value.$1, e.value.$2],
  });
  return '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #E6EDF8; }
  * { -webkit-tap-highlight-color: transparent; }
  .leaflet-container { background: #E6EDF8; font-family: Inter, -apple-system, Roboto, sans-serif; }
  .leaflet-control-attribution { font-size: 8px; background: rgba(255,255,255,0.6) !important; }
  /* The design's pale map: the tiles washed towards the page's blue. */
  .leaflet-tile { filter: saturate(0.15) brightness(1.15) contrast(0.7); }
  .rg { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); width: 96px; }
  .rg b {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%;
    background: #FFFFFF; color: #0A1A34; border: 1.5px solid #0A1A34;
    box-shadow: 2px 2px 0 #0A1A34; font-size: 13px; font-weight: 800;
  }
  .rg span {
    margin-top: 3px; padding: 1px 6px; border-radius: 6px;
    background: rgba(255,255,255,0.85); color: #0A1A34; font-size: 10px; font-weight: 700; white-space: nowrap;
  }
  .rg.on b { background: #CCFF00; }
  .rg.on span { background: #CCFF00; }
  .rg.none b { opacity: 0.45; box-shadow: none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var points = $points;
  var markers = {};
  var map = null;
  function init() {
    if (!window.L) { setTimeout(init, 150); return; }
    map = L.map('map', {
      zoomSnap: 0.1, zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      touchZoom: false, boxZoom: false, keyboard: false, tap: false, attributionControl: true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 12
    }).addTo(map);
    map.fitBounds([[33.0, 125.9], [38.3, 129.5]], { padding: [4, 4] });
    if (window.pending) setRegions(window.pending);
  }
  function setRegions(list) {
    if (!map) { window.pending = list; return; }
    list.forEach(function (r) {
      var p = points[r.id];
      if (!p) return;
      var cls = 'rg' + (r.on ? ' on' : '') + (r.n === 0 ? ' none' : '');
      var html = '<div class="' + cls + '"><b>' + r.n + '</b><span>' + r.label + '</span></div>';
      var icon = L.divIcon({ className: '', html: html, iconSize: [0, 0] });
      if (markers[r.id]) {
        markers[r.id].setIcon(icon);
      } else {
        var m = L.marker(p, { icon: icon, keyboard: false });
        m.on('click', function () { if (window.RegionChannel) RegionChannel.postMessage(r.id); });
        m.addTo(map);
        markers[r.id] = m;
      }
    });
  }
  init();
</script>
</body>
</html>
''';
}
