import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The universities a student kept with ♡ on the card stack (design screen
/// 03) — the "Saqlanganlar" list of screen 16. Kept on the phone, in the same
/// secure store as the chosen language, so a guest keeps them too.
class SavedUniversitiesNotifier extends Notifier<List<String>> {
  static const _key = 'saved_universities_v1';
  static const _storage = FlutterSecureStorage();

  @override
  List<String> build() {
    _load();
    return const [];
  }

  Future<void> _load() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null || !ref.mounted) return;
      final ids = (jsonDecode(raw) as List).whereType<String>().toList();
      // Anything saved before the stored list arrived stays, newest first.
      state = [...state, ...ids.where((id) => !state.contains(id))];
    } catch (e) {
      debugPrint('[Saved] $e');
    }
  }

  bool contains(String institutionId) => state.contains(institutionId);

  /// Newest first; saving one already kept does nothing.
  void save(String institutionId) {
    if (state.contains(institutionId)) return;
    state = [institutionId, ...state];
    _persist();
  }

  void remove(String institutionId) {
    state = [for (final id in state) if (id != institutionId) id];
    _persist();
  }

  void toggle(String institutionId) => contains(institutionId) ? remove(institutionId) : save(institutionId);

  Future<void> _persist() async {
    try {
      await _storage.write(key: _key, value: jsonEncode(state));
    } catch (e) {
      debugPrint('[Saved] $e');
    }
  }
}

final savedUniversitiesProvider = NotifierProvider<SavedUniversitiesNotifier, List<String>>(
  SavedUniversitiesNotifier.new,
);
