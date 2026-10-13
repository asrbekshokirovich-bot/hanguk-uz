import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Whether the student has already swiped a card on the home screen. Until
/// then the first card nudges left and right and says "Surib ko'ring", so a
/// new visitor sees that the stack can be swiped; the first swipe (or ✕ / ♡)
/// ends it for good. Null while the stored answer is being read.
class DeckHintNotifier extends Notifier<bool?> {
  static const _key = 'deck_swiped_v1';
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
      debugPrint('[DeckHint] $e');
      if (ref.mounted && state == null) state = false;
    }
  }

  /// The student swiped, or used a button that does the same.
  void markSwiped() {
    if (state == true) return;
    state = true;
    _storage.write(key: _key, value: '1').catchError((Object e) => debugPrint('[DeckHint] $e'));
  }
}

final deckHintProvider = NotifierProvider<DeckHintNotifier, bool?>(DeckHintNotifier.new);
