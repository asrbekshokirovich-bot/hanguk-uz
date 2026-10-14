import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// "So'nggi qidiruvlar" (design screen 04): the last texts a student searched
/// for and acted on, newest first, kept on the phone.
class RecentSearchesNotifier extends Notifier<List<String>> {
  static const _key = 'recent_searches_v1';
  static const _storage = FlutterSecureStorage();
  static const max = 6;

  @override
  List<String> build() {
    _load();
    return const [];
  }

  Future<void> _load() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null || !ref.mounted) return;
      final stored = (jsonDecode(raw) as List).whereType<String>();
      state = [...state, ...stored.where((s) => !state.contains(s))].take(max).toList();
    } catch (e) {
      debugPrint('[Recent] $e');
    }
  }

  void add(String text) {
    final t = text.trim();
    if (t.length < 2) return;
    state = [t, ...state.where((s) => s.toLowerCase() != t.toLowerCase())].take(max).toList();
    _storage.write(key: _key, value: jsonEncode(state)).catchError((Object e) => debugPrint('[Recent] $e'));
  }
}

final recentSearchesProvider = NotifierProvider<RecentSearchesNotifier, List<String>>(
  RecentSearchesNotifier.new,
);
