import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/models/shift.dart';

/// Kakao Map's route link to where [shift] is (opens the app when installed,
/// the web map otherwise): its point, else a search for its address.
Uri directionsUri(ShiftListing shift, String label) {
  final lat = shift.lat ?? shift.business.lat;
  final lng = shift.lng ?? shift.business.lng;
  if (lat == null || lng == null) {
    // The Korean original: what Kakao Map finds best.
    final own = shift.address.trim();
    final address = own.isNotEmpty ? own : shift.business.address.trim();
    return Uri.https('map.kakao.com', '/', {'q': address.isNotEmpty ? address : label});
  }
  return directionsUriTo(label, lat, lng);
}

/// Kakao Map's route link to a point named [label].
Uri directionsUriTo(String label, double lat, double lng) =>
    Uri.parse('https://map.kakao.com/link/to/${Uri.encodeComponent(label)},$lat,$lng');

/// Opens a link outside the app; false when nothing could open it.
typedef LinkOpener = Future<bool> Function(Uri uri);

final linkOpenerProvider = Provider<LinkOpener>(
  (ref) => (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);
