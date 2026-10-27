import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Whether the student has already been through one page's first-run tour.
/// Until then the page opens with it; its last step, or the end of its time,
/// ends it for good. Null while the stored answer is being read.
class TourSeenNotifier extends Notifier<bool?> {
  TourSeenNotifier(this.storageKey);

  final String storageKey;
  static const _storage = FlutterSecureStorage();

  @override
  bool? build() {
    _load();
    return null;
  }

  Future<void> _load() async {
    try {
      final seen = await _storage.read(key: storageKey) == '1';
      if (ref.mounted && state != true) state = seen;
    } catch (e) {
      debugPrint('[Tour $storageKey] $e');
      // A phone that cannot answer is not shown the tour on every launch.
      if (ref.mounted && state == null) state = true;
    }
  }

  void markSeen() {
    if (state == true) return;
    state = true;
    _storage.write(key: storageKey, value: '1').catchError((Object e) => debugPrint('[Tour $storageKey] $e'));
  }
}

/// The home board's tour (design 12a–12d).
class BoardTourNotifier extends TourSeenNotifier {
  BoardTourNotifier() : super('board_tour_seen_v1');
}

final NotifierProvider<TourSeenNotifier, bool?> boardTourProvider = NotifierProvider<TourSeenNotifier, bool?>(
  BoardTourNotifier.new,
);

/// Any other page's tour, by the page's name.
final tourSeenProvider = NotifierProvider.family<TourSeenNotifier, bool?, String>(
  (page) => TourSeenNotifier('${page}_tour_seen_v1'),
);
