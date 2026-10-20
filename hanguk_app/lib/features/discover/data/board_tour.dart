import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Whether the student has already been through the home board's four-step
/// tour (design 12a–12d). Until then the board opens with it; "O'tkazish" or
/// "Boshlash" ends it for good. Null while the stored answer is being read.
class BoardTourNotifier extends Notifier<bool?> {
  static const _key = 'board_tour_seen_v1';
  static const _storage = FlutterSecureStorage();

  @override
  bool? build() {
    _load();
    return null;
  }

  Future<void> _load() async {
    try {
      final seen = await _storage.read(key: _key) == '1';
      if (ref.mounted && state != true) state = seen;
    } catch (e) {
      debugPrint('[BoardTour] $e');
      // A phone that cannot answer is not shown the tour on every launch.
      if (ref.mounted && state == null) state = true;
    }
  }

  void markSeen() {
    if (state == true) return;
    state = true;
    _storage.write(key: _key, value: '1').catchError((Object e) => debugPrint('[BoardTour] $e'));
  }
}

final boardTourProvider = NotifierProvider<BoardTourNotifier, bool?>(BoardTourNotifier.new);
