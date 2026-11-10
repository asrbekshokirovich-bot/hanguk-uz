import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/models/business.dart';

/// Kakao Map's route link to [business] (opens the app when installed, the
/// web map otherwise).
Uri directionsUri(Business business, String label) {
  final lat = business.lat;
  final lng = business.lng;
  if (lat == null || lng == null) {
    return Uri.https('map.kakao.com', '/', {'q': business.address.isNotEmpty ? business.address : label});
  }
  return Uri.parse('https://map.kakao.com/link/to/${Uri.encodeComponent(label)},$lat,$lng');
}

/// Kakao Map's route link to a point named [label].
Uri directionsUriTo(String label, double lat, double lng) =>
    Uri.parse('https://map.kakao.com/link/to/${Uri.encodeComponent(label)},$lat,$lng');

/// Opens a link outside the app; false when nothing could open it.
typedef LinkOpener = Future<bool> Function(Uri uri);

final linkOpenerProvider = Provider<LinkOpener>(
  (ref) => (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);
