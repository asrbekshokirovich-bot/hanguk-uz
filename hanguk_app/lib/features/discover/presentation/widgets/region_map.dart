import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../core/config/app_config.dart';
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
  CatalogRegion.jeju: (33.85, 126.25),
};

/// "Shahar · xaritadan tanlang" (design 2026-10-21): the app's Kakao map
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
    this.height = 300,
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
      ..setBackgroundColor(const Color(0xFF0C1830))
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
        decoration: BoxDecoration(color: const Color(0xFF0C1830), borderRadius: BorderRadius.circular(14)),
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
  // The same map as the Universitetlar list's (university_map_html.dart):
  // Kakao with its tiles pushed to the night palette, OpenStreetMap the same
  // way when Kakao does not load.
  return """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #0C1830; }
  * { -webkit-tap-highlight-color: transparent; }
  #map img[src*="map_2d"], .leaflet-tile {
    filter: invert(1) hue-rotate(190deg) saturate(0.55) brightness(0.80) contrast(1.05);
  }
  .leaflet-container { background: #0C1830; font-family: Inter, -apple-system, Roboto, sans-serif; }
  .leaflet-control-attribution { font-size: 8px; background: rgba(12,24,48,0.75) !important; color: rgba(255,255,255,0.4) !important; }
  .rg { display: flex; flex-direction: column; align-items: center; font-family: Inter, -apple-system, Roboto, sans-serif; cursor: pointer; }
  .rg b {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%;
    background: #FFFFFF; color: #0A1A34; border: 1.5px solid #0A1A34;
    box-shadow: 2px 2px 0 #0A1A34; font-size: 13px; font-weight: 800;
  }
  .rg span {
    margin-top: 3px; padding: 1px 6px; border-radius: 6px;
    background: rgba(255,255,255,0.9); color: #0A1A34; font-size: 10px; font-weight: 700; white-space: nowrap;
  }
  .rg.on b, .rg.on span { background: #CCFF00; }
  .rg.on b { box-shadow: 0 0 12px rgba(204,255,0,0.7), 2px 2px 0 #0A1A34; }
  .rg.none b { opacity: 0.5; box-shadow: none; }
  .lf { transform: translate(-50%, -50%); width: 96px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var points = $points;
  var south = 33.0, west = 125.9, north = 38.3, east = 129.5;
  var put = null;
  var pending = null;
  var nodes = {};

  function bubble(r, extra) {
    var el = document.createElement('div');
    el.className = 'rg' + (extra || '');
    el.innerHTML = '<b></b><span></span>';
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.RegionChannel) RegionChannel.postMessage(r);
    });
    return el;
  }

  function paint(el, r) {
    el.classList.toggle('on', !!r.on);
    el.classList.toggle('none', r.n === 0);
    el.querySelector('b').textContent = r.n;
    el.querySelector('span').textContent = r.label;
  }

  function setRegions(list) {
    if (!put) { pending = list; return; }
    list.forEach(function (r) {
      if (!points[r.id]) return;
      if (!nodes[r.id]) nodes[r.id] = put(r.id);
      paint(nodes[r.id], r);
    });
  }

  function initKakao() {
    var map = new kakao.maps.Map(document.getElementById('map'), {
      center: new kakao.maps.LatLng(35.9, 127.7), level: 13, draggable: false, scrollwheel: false,
      disableDoubleClick: true, disableDoubleClickZoom: true
    });
    map.setZoomable(false);
    // Kakao's levels are whole: the level that holds all of Korea, around
    // its middle.
    map.setLevel(14);
    map.setCenter(new kakao.maps.LatLng((south + north) / 2, (west + east) / 2));
    put = function (id) {
      var el = bubble(id);
      new kakao.maps.CustomOverlay({
        map: map, clickable: true, content: el, xAnchor: 0.5, yAnchor: 0.5,
        position: new kakao.maps.LatLng(points[id][0], points[id][1])
      });
      return el;
    };
  }

  function initLeaflet() {
    var map = L.map('map', {
      zoomSnap: 0.1, zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      touchZoom: false, boxZoom: false, keyboard: false, tap: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 12 }).addTo(map);
    map.fitBounds([[south, west], [north, east]], { padding: [4, 4] });
    put = function (id) {
      var el = bubble(id, ' lf');
      L.marker(points[id], { icon: L.divIcon({ className: '', html: el, iconSize: [0, 0] }), keyboard: false }).addTo(map);
      return el;
    };
  }

  var ready = false;
  function done() { ready = true; if (pending) { var p = pending; pending = null; setRegions(p); } }

  function bootLeaflet() {
    if (ready) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = function () { try { initLeaflet(); done(); } catch (e) {} };
    document.head.appendChild(s);
  }

  var k = document.createElement('script');
  k.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${AppConfig.kakaoJsKey}&autoload=false';
  k.onload = function () {
    if (typeof kakao === 'undefined' || !kakao.maps) { bootLeaflet(); return; }
    kakao.maps.load(function () { try { initKakao(); done(); } catch (e) { bootLeaflet(); } });
  };
  k.onerror = bootLeaflet;
  document.head.appendChild(k);
  setTimeout(function () { if (!ready) bootLeaflet(); }, 6000);
</script>
</body>
</html>
""";
}
