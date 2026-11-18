import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart';

import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import 'kakao_map_view.dart' show KakaoPin;

/// The Kakao Maps *Native app key* (`--dart-define=KAKAO_NATIVE_KEY=…`). With
/// it A04 uses Kakao's native Android map — no WebView, tiles cached on the
/// phone — otherwise the WebView map ([KakaoMapView]).
const kakaoNativeKey = String.fromEnvironment('KAKAO_NATIVE_KEY');

/// Starts the native Kakao SDK (once, at app start). False when there is no key
/// or the SDK refuses to start.
Future<bool> initKakaoNativeMap() async {
  if (kakaoNativeKey.isEmpty) return false;
  try {
    await KakaoMapSdk.instance.initialize(kakaoNativeKey);
    kakaoNativeStarted = true;
  } on Object {
    kakaoNativeStarted = false;
  }
  return kakaoNativeStarted;
}

/// The native SDK started: A04 draws the native map.
bool kakaoNativeStarted = false;

const _userId = '__me__';

/// A04's map on Kakao's native SDK: price pins as labels (their pictures are
/// drawn from Flutter widgets), the worker as a blue dot. A tap on a pin reports
/// its id (the business id). [onFailed] is called when the map reports an error
/// (the key or the key hash is refused, …) and the screen falls back.
class NativeKakaoMap extends StatefulWidget {
  const NativeKakaoMap({
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
  final double? userLat;
  final double? userLng;
  final ValueChanged<String> onPin;
  final VoidCallback onFailed;

  @override
  State<NativeKakaoMap> createState() => _NativeKakaoMapState();
}

class _NativeKakaoMapState extends State<NativeKakaoMap> {
  KakaoMapController? _controller;
  final _icons = <String, KImage>{};
  final _poiIds = <String>{};
  bool _syncing = false;
  bool _again = false;
  double? _centeredLat;
  double? _centeredLng;

  @override
  void didUpdateWidget(NativeKakaoMap old) {
    super.didUpdateWidget(old);
    _sync();
  }

  Future<KImage> _icon(String key, Widget child, Size size) async =>
      _icons[key] ??= await KImage.fromWidget(Directionality(textDirection: TextDirection.ltr, child: child), size, context: context);

  Widget _pill(String label, {required bool selected}) => Align(
        child: Container(
          height: selected ? 40 : 32,
          padding: EdgeInsets.symmetric(horizontal: selected ? 16 : 12),
          decoration: BoxDecoration(
            color: selected ? HiColors.lime : HiColors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: HiColors.ink, width: 1.5),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            maxLines: 1,
            style: hiStyle(selected ? 16 : 14, FontWeight.w800,
                color: selected ? HiColors.onLime : HiColors.ink, family: HiFamily.mono),
          ),
        ),
      );

  Future<void> _sync() async {
    final controller = _controller;
    if (controller == null) return;
    if (_syncing) {
      _again = true;
      return;
    }
    _syncing = true;
    try {
      do {
        _again = false;
        final layer = controller.labelLayer;
        for (final id in _poiIds.toList()) {
          final poi = layer.getPoi(id);
          if (poi != null) await layer.removePoi(poi);
        }
        _poiIds.clear();
        final lat = widget.userLat;
        final lng = widget.userLng;
        if (lat != null && lng != null) {
          final icon = await _icon(
            'me',
            Align(
              child: Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: HiColors.blue,
                  shape: BoxShape.circle,
                  border: Border.all(color: HiColors.white, width: 3),
                ),
              ),
            ),
            const Size(22, 22),
          );
          await layer.addPoi(LatLng(lat, lng),
              id: _userId, style: PoiStyle(icon: icon, anchor: const KPoint(0.5, 0.5)), rank: 1);
          _poiIds.add(_userId);
        }
        for (final pin in widget.pins) {
          final selected = pin.id == widget.selectedId;
          final width = (selected ? 36 : 28) + pin.label.length * (selected ? 10.5 : 9.0);
          final icon = await _icon(
            '${selected ? 's' : 'n'}|${pin.label}',
            _pill(pin.label, selected: selected),
            Size(width, selected ? 44 : 36),
          );
          await layer.addPoi(
            LatLng(pin.lat, pin.lng),
            id: pin.id,
            style: PoiStyle(icon: icon, anchor: const KPoint(0.5, 0.5)),
            rank: selected ? 3 : 2,
            onClick: () => widget.onPin(pin.id),
          );
          _poiIds.add(pin.id);
        }
        if (_centeredLat != widget.centerLat || _centeredLng != widget.centerLng) {
          _centeredLat = widget.centerLat;
          _centeredLng = widget.centerLng;
          await controller.moveCamera(CameraUpdate.newCenterPosition(LatLng(widget.centerLat, widget.centerLng)));
        }
      } while (_again);
    } on Object {
      // A failed overlay must not take the screen down; the pins stay as they were.
    } finally {
      _syncing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return KakaoMap(
      option: KakaoMapOption(position: LatLng(widget.centerLat, widget.centerLng), zoomLevel: 15),
      onMapReady: (controller) {
        _controller = controller;
        _centeredLat = widget.centerLat;
        _centeredLng = widget.centerLng;
        _sync();
      },
      onMapError: (_) => widget.onFailed(),
    );
  }
}
