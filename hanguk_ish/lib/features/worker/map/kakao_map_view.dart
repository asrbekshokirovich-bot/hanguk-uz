import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// The Kakao Maps JavaScript key (a *JS* key, bound to the allowed domain
/// `https://hanguk.uz` in the Kakao console — the student app uses the same
/// one, `hanguk_app/lib/core/config/app_config.dart`). Override at build time
/// with `--dart-define=KAKAO_JS_KEY=…`.
const kakaoJsKey = String.fromEnvironment('KAKAO_JS_KEY', defaultValue: 'c695b428933e192ca1d8582e3aab14a4');

/// One price pin on the Kakao map.
class KakaoPin {
  const KakaoPin({required this.id, required this.lat, required this.lng, required this.label});

  final String id;
  final double lat;
  final double lng;
  final String label;
}

/// A04's real map: Kakao Maps in a WebView, with the shifts' price pins as
/// overlays. A tap on a pin reports its id. When the map cannot start (no
/// WebView, no network, the key is refused) [onFailed] is called once and the
/// screen falls back to the stylised map.
class KakaoMapView extends StatefulWidget {
  const KakaoMapView({
    super.key,
    required this.pins,
    required this.selectedId,
    required this.centerLat,
    required this.centerLng,
    this.userLat,
    this.userLng,
    required this.onPin,
    required this.onFailed,
  });

  final List<KakaoPin> pins;
  final String? selectedId;
  final double centerLat;
  final double centerLng;

  /// The worker's own position, when known.
  final double? userLat;
  final double? userLng;
  final ValueChanged<String> onPin;
  final VoidCallback onFailed;

  @override
  State<KakaoMapView> createState() => _KakaoMapViewState();
}

class _KakaoMapViewState extends State<KakaoMapView> {
  WebViewController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _recenter = true;

  @override
  void initState() {
    super.initState();
    try {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF0E1A4C))
        ..addJavaScriptChannel('Pin', onMessageReceived: (m) => widget.onPin(m.message))
        ..addJavaScriptChannel('MapState', onMessageReceived: (m) {
          if (m.message == 'ready') {
            _ready = true;
            _push();
          } else {
            _fail();
          }
        })
        ..setNavigationDelegate(NavigationDelegate(onWebResourceError: (e) {
          if (e.isForMainFrame ?? false) _fail();
        }))
        ..loadHtmlString(_html(), baseUrl: 'https://hanguk.uz');
    } on Object {
      // No WebView on this platform (tests, desktop): the stylised map.
      WidgetsBinding.instance.addPostFrameCallback((_) => _fail());
    }
  }

  void _fail() {
    if (_failed) return;
    _failed = true;
    if (mounted) widget.onFailed();
  }

  @override
  void didUpdateWidget(KakaoMapView old) {
    super.didUpdateWidget(old);
    if (old.centerLat != widget.centerLat || old.centerLng != widget.centerLng) _recenter = true;
    _push();
  }

  void _push() {
    final controller = _controller;
    if (controller == null || !_ready || _failed) return;
    final state = {
      'center': {'lat': widget.centerLat, 'lng': widget.centerLng},
      'recenter': _recenter,
      'user': widget.userLat == null || widget.userLng == null ? null : {'lat': widget.userLat, 'lng': widget.userLng},
      'selected': widget.selectedId,
      'pins': [
        for (final p in widget.pins) {'id': p.id, 'lat': p.lat, 'lng': p.lng, 'label': p.label},
      ],
    };
    _recenter = false;
    controller.runJavaScript('window.setMapState(${jsonEncode(state)});');
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) return const SizedBox.shrink();
    return WebViewWidget(controller: controller);
  }
}

String _html() => '''
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0E1A4C; overflow: hidden; }
  .pin { transform: translate(-50%, -50%); font: 800 14px/34px 'Roboto Mono', ui-monospace, monospace; height: 34px;
         padding: 0 12px; border-radius: 17px; border: 1.5px solid #0B1230; background: #fff; color: #0B1230;
         box-shadow: 3px 3px 0 #0B1230; white-space: nowrap; }
  .pin.sel { background: #C8F600; font-size: 16px; height: 44px; line-height: 44px; border-radius: 22px; padding: 0 16px; }
  .me { width: 14px; height: 14px; border-radius: 50%; background: #2447D6; border: 2px solid #fff;
        box-shadow: 0 0 0 8px rgba(36,71,214,.35); transform: translate(-50%, -50%); }
</style>
</head><body>
<div id="map"></div>
<script>
  var map = null, overlays = [], meOverlay = null, pending = null;
  function fail() { MapState.postMessage('failed'); }
  window.onerror = function () { fail(); };
  var timer = setTimeout(fail, 10000);
  function build(state) {
    overlays.forEach(function (o) { o.setMap(null); });
    overlays = [];
    if (meOverlay) { meOverlay.setMap(null); meOverlay = null; }
    if (state.recenter) map.setCenter(new kakao.maps.LatLng(state.center.lat, state.center.lng));
    if (state.user) {
      meOverlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(state.user.lat, state.user.lng),
        content: '<div class="me"></div>', zIndex: 1 });
      meOverlay.setMap(map);
    }
    state.pins.forEach(function (p) {
      var sel = p.id === state.selected;
      var el = document.createElement('div');
      el.className = 'pin' + (sel ? ' sel' : '');
      el.textContent = p.label;
      el.addEventListener('click', function () { Pin.postMessage(p.id); });
      var o = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(p.lat, p.lng), content: el, zIndex: sel ? 3 : 2 });
      o.setMap(map);
      overlays.push(o);
    });
  }
  window.setMapState = function (state) { if (map) build(state); else pending = state; };
  var s = document.createElement('script');
  s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=$kakaoJsKey&autoload=false';
  s.onerror = fail;
  s.onload = function () {
    try {
      kakao.maps.load(function () {
        clearTimeout(timer);
        map = new kakao.maps.Map(document.getElementById('map'),
          { center: new kakao.maps.LatLng(37.5563, 126.9368), level: 5 });
        MapState.postMessage('ready');
        if (pending) { build(pending); pending = null; }
      });
    } catch (e) { fail(); }
  };
  document.head.appendChild(s);
</script>
</body></html>
''';
