import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart' show WebViewPlatform;

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

/// Where the Kakao map stands.
enum KakaoMapStatus { loading, ready, failed }

/// The one Kakao map of the app: its WebView starts as soon as the worker is
/// signed in (the shell reads [kakaoMapHostProvider]), so the SDK and the first
/// tiles are loaded — and cached by the WebView — before A04 is opened. The
/// map tab then just shows the ready WebView.
class KakaoMapHost {
  KakaoMapHost() {
    try {
      if (WebViewPlatform.instance == null) throw StateError('no WebView');
      controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF0E1A4C))
        ..addJavaScriptChannel('Pin', onMessageReceived: (m) => onPin?.call(m.message))
        ..addJavaScriptChannel('MapState', onMessageReceived: (m) {
          if (m.message == 'ready') {
            status.value = KakaoMapStatus.ready;
            _flush();
          } else {
            status.value = KakaoMapStatus.failed;
          }
        })
        ..setNavigationDelegate(NavigationDelegate(onWebResourceError: (e) {
          if (e.isForMainFrame ?? false) status.value = KakaoMapStatus.failed;
        }))
        ..loadHtmlString(_html(), baseUrl: 'https://hanguk.uz');
    } on Object {
      // No WebView on this platform (tests, desktop): the stylised map.
      status.value = KakaoMapStatus.failed;
    }
  }

  WebViewController? controller;
  final ValueNotifier<KakaoMapStatus> status = ValueNotifier(KakaoMapStatus.loading);

  /// Set by the map screen that is showing the map.
  ValueChanged<String>? onPin;

  Map<String, Object?>? _wanted;

  /// Shows [state] (center, user, pins, selection) on the map; kept until the
  /// map is ready.
  void show(Map<String, Object?> state) {
    _wanted = state;
    _flush();
  }

  void _flush() {
    final c = controller;
    final state = _wanted;
    if (c == null || state == null || status.value != KakaoMapStatus.ready) return;
    c.runJavaScript('window.setMapState(${jsonEncode(state)});');
    // `recenter` applies once per request.
    _wanted = {...state, 'recenter': false};
  }

  /// The WebView was just put on screen: the map takes its real size.
  void relayout() {
    if (status.value == KakaoMapStatus.ready) controller?.runJavaScript('if (map) map.relayout();');
  }

  void dispose() => status.dispose();
}

/// Reading this starts the map's WebView; the worker shell does it at once.
final kakaoMapHostProvider = Provider<KakaoMapHost>((ref) {
  final host = KakaoMapHost();
  ref.onDispose(host.dispose);
  return host;
});

/// A04's real map: the app's Kakao map with the shifts' price pins as
/// overlays. While it loads, [placeholder] is shown. When it cannot start (no
/// WebView, no network, the key is refused) [onFailed] is called and the
/// screen falls back to the stylised map.
class KakaoMapView extends ConsumerStatefulWidget {
  const KakaoMapView({
    super.key,
    required this.pins,
    required this.selectedId,
    required this.centerLat,
    required this.centerLng,
    this.userLat,
    this.userLng,
    required this.placeholder,
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
  final Widget placeholder;
  final ValueChanged<String> onPin;
  final VoidCallback onFailed;

  @override
  ConsumerState<KakaoMapView> createState() => _KakaoMapViewState();
}

class _KakaoMapViewState extends ConsumerState<KakaoMapView> {
  late final KakaoMapHost _host;
  double? _lastCenterLat;
  double? _lastCenterLng;

  @override
  void initState() {
    super.initState();
    _host = ref.read(kakaoMapHostProvider);
    _host.status.addListener(_statusChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _statusChanged();
      _host.relayout();
    });
  }

  void _statusChanged() {
    if (!mounted) return;
    if (_host.status.value == KakaoMapStatus.failed) widget.onFailed();
    if (_host.status.value == KakaoMapStatus.ready) _host.relayout();
    setState(() {});
  }

  @override
  void dispose() {
    _host.status.removeListener(_statusChanged);
    if (_host.onPin == widget.onPin) _host.onPin = null;
    super.dispose();
  }

  void _show() {
    final recenter = _lastCenterLat != widget.centerLat || _lastCenterLng != widget.centerLng;
    _lastCenterLat = widget.centerLat;
    _lastCenterLng = widget.centerLng;
    _host.onPin = widget.onPin;
    _host.show({
      'center': {'lat': widget.centerLat, 'lng': widget.centerLng},
      'recenter': recenter,
      'user': widget.userLat == null || widget.userLng == null ? null : {'lat': widget.userLat, 'lng': widget.userLng},
      'selected': widget.selectedId,
      'pins': [
        for (final p in widget.pins) {'id': p.id, 'lat': p.lat, 'lng': p.lng, 'label': p.label},
      ],
    });
  }

  @override
  Widget build(BuildContext context) {
    _show();
    final controller = _host.controller;
    if (controller == null) return widget.placeholder;
    return Stack(
      fit: StackFit.expand,
      children: [
        WebViewWidget(controller: controller),
        // Until the map is drawn, the stylised map stands in for it.
        if (_host.status.value != KakaoMapStatus.ready) Positioned.fill(child: widget.placeholder),
      ],
    );
  }
}

String _html() => '''
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<link rel="preconnect" href="https://dapi.kakao.com">
<link rel="preconnect" href="https://t1.daumcdn.net">
<link rel="dns-prefetch" href="https://t1.daumcdn.net">
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
  window.addEventListener('resize', function () { if (map) map.relayout(); });
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
