import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../../catalog/domain/catalog_models.dart';

/// A city on the map: where it lies and, for the seven the design places by
/// hand, where on the panel its pin goes (percent of the panel, the pin's
/// tip).
@immutable
class MapCity {
  const MapCity(this.name, this.lat, this.lon, {this.x, this.y});

  final String name;
  final double lat;
  final double lon;

  /// The design's own place on the panel, for its seven hubs.
  final double? x;
  final double? y;
}

/// The seven pins the design draws, at the places it draws them.
const List<MapCity> kMapHubs = [
  MapCity('Seul', 37.5665, 126.9780, x: 40, y: 16),
  MapCity('Daejeon', 36.3504, 127.3845, x: 45, y: 42),
  MapCity('Jeonju', 35.8242, 127.1480, x: 36, y: 57),
  MapCity('Daegu', 35.8714, 128.6014, x: 66, y: 54),
  MapCity('Gwangju', 35.1595, 126.8526, x: 36, y: 71),
  MapCity('Busan', 35.1796, 129.0756, x: 74, y: 68),
  MapCity('Jeju', 33.4996, 126.5312, x: 30, y: 78),
];

/// Every city the catalogue names, by the first word of the Excel's `shahar`
/// ("Gyeongsan (Gyeongsangbuk-do)" is "gyeongsan").
const Map<String, (double, double)> kCityCoords = {
  'seoul': (37.5665, 126.9780),
  'daejeon': (36.3504, 127.3845),
  'gwangju': (35.1595, 126.8526),
  'daegu': (35.8714, 128.6014),
  'busan': (35.1796, 129.0756),
  'gyeongsan': (35.8251, 128.7414),
  'pohang': (36.0190, 129.3435),
  'hwaseong': (37.1996, 126.8313),
  'ansan': (37.3219, 126.8309),
  'seongnam': (37.4201, 127.1267),
  'incheon': (37.4563, 126.7052),
  'suwon': (37.2636, 127.0286),
  'jeonju': (35.8242, 127.1480),
  'cheongju': (36.6424, 127.4890),
  'suncheon': (34.9506, 127.4875),
  'siheung': (37.3800, 126.8030),
  'yangpyeong': (37.4914, 127.4874),
  'mungyeong': (36.5865, 128.1867),
  'jeju': (33.4996, 126.5312),
  'eumseong': (36.9400, 127.6900),
  'ulsan': (35.5384, 129.3114),
  'anseong': (37.0080, 127.2797),
  'yongin': (37.2411, 127.1776),
  'nonsan': (36.1872, 127.0987),
  'jinju': (35.1800, 128.1076),
  'sejong': (36.4800, 127.2890),
  'changwon': (35.2280, 128.6811),
  'bucheon': (37.5034, 126.7660),
  'chuncheon': (37.8813, 127.7298),
  'anyang': (37.3943, 126.9568),
  'paju': (37.7600, 126.7800),
  'chungju': (36.9910, 127.9260),
  'gongju': (36.4465, 127.1190),
  'gangneung': (37.7519, 128.8761),
  'yangju': (37.7853, 127.0457),
  'asan': (36.7898, 127.0019),
  'yeonggwang': (35.2771, 126.5120),
  'namyangju': (37.6360, 127.2165),
  'mokpo': (34.8118, 126.3922),
  'gimpo': (37.6152, 126.7156),
};

/// The first word of a `shahar` ("Seoul / Sejong" is "seoul").
String cityKey(String city) {
  final m = RegExp(r'^[A-Za-z]+').firstMatch(city.trim());
  return (m?.group(0) ?? city).toLowerCase();
}

/// One pin of the map: a hub or a city of its own, with the universities
/// that belong to it.
@immutable
class MapPin {
  const MapPin({required this.label, required this.x, required this.y, required this.universities});

  final String label;

  /// Percent of the panel's width and height.
  final double x;
  final double y;
  final List<CatalogUniversity> universities;

  int get count => universities.length;
}

/// A city within this many kilometres of a hub is drawn under the hub's pin.
const double kHubRadiusKm = 90;

/// Pixels-per-degree fit of latitude and longitude onto the design's panel,
/// least squares over the design's seven hand-placed pins.
double mapX(double lat, double lon) => 0.376 * lat + 17.309 * lon - 2173.826;
double mapY(double lat, double lon) => -16.075 * lat + 3.686 * lon + 157.987;

double _km(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(lat2 - lat1);
  final dLon = rad(lon2 - lon1);
  final a =
      math.pow(math.sin(dLat / 2), 2) + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.pow(math.sin(dLon / 2), 2);
  return 2 * r * math.asin(math.sqrt(a));
}

/// The pins for [universities], biggest first. A city near one of the
/// design's seven hubs goes under that hub's pin ("Seul" holds Suwon and
/// Incheon); any other city has its own pin, placed from its coordinates. A
/// university whose city is unknown has no pin.
List<MapPin> clusterPins(List<CatalogUniversity> universities) {
  final byHub = <String, List<CatalogUniversity>>{};
  final byCity = <String, ({String label, double lat, double lon, List<CatalogUniversity> list})>{};
  for (final u in universities) {
    final city = u.city;
    if (city == null) continue;
    final key = cityKey(city);
    final at = kCityCoords[key];
    if (at == null) continue;
    MapCity? hub;
    var best = double.infinity;
    for (final h in kMapHubs) {
      final d = _km(at.$1, at.$2, h.lat, h.lon);
      if (d < best) {
        best = d;
        hub = h;
      }
    }
    if (hub != null && best <= kHubRadiusKm) {
      byHub.putIfAbsent(hub.name, () => []).add(u);
    } else {
      final own = byCity.putIfAbsent(key, () => (label: _title(key), lat: at.$1, lon: at.$2, list: []));
      own.list.add(u);
    }
  }
  final pins = <MapPin>[
    for (final h in kMapHubs)
      if (byHub[h.name] != null) MapPin(label: h.name, x: h.x!, y: h.y!, universities: byHub[h.name]!),
    for (final c in byCity.values)
      MapPin(
        label: c.label,
        x: mapX(c.lat, c.lon).clamp(8, 92).toDouble(),
        y: mapY(c.lat, c.lon).clamp(8, 90).toDouble(),
        universities: c.list,
      ),
  ];
  pins.sort((a, b) => b.count != a.count ? b.count.compareTo(a.count) : a.label.compareTo(b.label));
  return pins;
}

String _title(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
