import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/analytics/app_events.dart';

/// How many universities the student narrows the choice down to (design
/// screens 06–08).
const int kSlotCount = 3;

/// The three slots: the universities the student is applying with, in their
/// order. Null is an empty slot. Kept on the phone like the saved list.
class SlotsNotifier extends Notifier<List<String?>> {
  static const _key = 'university_slots_v1';
  static const _storage = FlutterSecureStorage();

  @override
  List<String?> build() {
    _load();
    return List<String?>.filled(kSlotCount, null);
  }

  Future<void> _load() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null || !ref.mounted) return;
      final stored = (jsonDecode(raw) as List).map((e) => e is String ? e : null).toList();
      // Anything put in a slot before the stored ones arrived stays.
      final next = [...state];
      for (var i = 0; i < kSlotCount && i < stored.length; i++) {
        final id = stored[i];
        if (next[i] == null && id != null && !next.contains(id)) next[i] = id;
      }
      state = next;
    } catch (e) {
      debugPrint('[Slots] $e');
    }
  }

  /// The slot [institutionId] is in, or -1.
  int indexOf(String institutionId) => state.indexOf(institutionId);

  bool get isFull => !state.contains(null);

  /// Into the first empty slot; false when all three are taken.
  bool add(String institutionId) {
    if (state.contains(institutionId)) return true;
    final i = state.indexOf(null);
    if (i < 0) return false;
    _set(i, institutionId);
    return true;
  }

  /// Dropped on slot [index]: it takes that slot, moving out of the one it
  /// was in; whatever was there before moves to that old slot (or out).
  void place(int index, String institutionId) {
    final next = [...state];
    final from = next.indexOf(institutionId);
    final previous = next[index];
    if (from >= 0) next[from] = previous;
    next[index] = institutionId;
    state = next;
    _persist();
    AppEvents.track('slot_set', props: {'institution_id': institutionId, 'slot': index + 1});
  }

  void remove(String institutionId) {
    if (state.contains(institutionId)) AppEvents.track('slot_remove', props: {'institution_id': institutionId});
    state = [for (final id in state) id == institutionId ? null : id];
    _persist();
  }

  void _set(int i, String id) {
    final next = [...state];
    next[i] = id;
    state = next;
    _persist();
    AppEvents.track('slot_set', props: {'institution_id': id, 'slot': i + 1});
  }

  Future<void> _persist() async {
    try {
      await _storage.write(key: _key, value: jsonEncode(state));
    } catch (e) {
      debugPrint('[Slots] $e');
    }
  }
}

final slotsProvider = NotifierProvider<SlotsNotifier, List<String?>>(SlotsNotifier.new);

/// Wins a university needs in "Bu yoki bu?" (design screen 07) to become a
/// champion and take a slot.
const int kChampionWins = 2;

/// "Bu yoki bu?": two universities side by side, the student picks one. The
/// one picked stays and meets the next; the other leaves. Two wins in a row
/// make a champion, which takes the next empty slot, and two new ones come
/// up. When the list runs out, a last one standing takes a slot too.
@immutable
class Duel {
  const Duel({
    required this.queue,
    required this.a,
    required this.b,
    required this.winsA,
    required this.winsB,
    required this.compared,
    required this.champions,
    required this.open,
  });

  /// Starts from [candidates] (best first), filling [open] slots.
  factory Duel.start(List<String> candidates, {required int open}) {
    final q = [...candidates];
    final a = q.isEmpty ? null : q.removeAt(0);
    final b = q.isEmpty ? null : q.removeAt(0);
    return Duel(queue: q, a: a, b: b, winsA: 0, winsB: 0, compared: 0, champions: const [], open: open)._settle();
  }

  /// Not yet shown.
  final List<String> queue;

  /// The two on screen; null when there is no one left for that place.
  final String? a;
  final String? b;
  final int winsA;
  final int winsB;

  /// "4 ta solishtirildi".
  final int compared;

  /// In the order they won, each taking the next empty slot.
  final List<String> champions;

  /// Slots still to fill.
  final int open;

  /// Every slot filled, or no one left.
  bool get done => champions.length >= open || (a == null && b == null);

  /// The student picked [a] (true) or [b].
  Duel pick({required bool first}) {
    if (done || a == null || b == null) return this;
    final winner = first ? a! : b!;
    final wins = (first ? winsA : winsB) + 1;
    final q = [...queue];
    if (wins >= kChampionWins) {
      // A champion: both places get new ones.
      final na = q.isEmpty ? null : q.removeAt(0);
      final nb = q.isEmpty ? null : q.removeAt(0);
      return Duel(
        queue: q,
        a: na,
        b: nb,
        winsA: 0,
        winsB: 0,
        compared: compared + 1,
        champions: [...champions, winner],
        open: open,
      )._settle();
    }
    final next = q.isEmpty ? null : q.removeAt(0);
    return Duel(
      queue: q,
      a: first ? winner : next,
      b: first ? next : winner,
      winsA: first ? wins : 0,
      winsB: first ? 0 : wins,
      compared: compared + 1,
      champions: champions,
      open: open,
    )._settle();
  }

  /// One left with no one to meet: it takes a slot.
  Duel _settle() {
    if (champions.length >= open) return this;
    if ((a == null) != (b == null)) {
      final last = a ?? b!;
      return Duel(
        queue: queue,
        a: null,
        b: null,
        winsA: 0,
        winsB: 0,
        compared: compared,
        champions: [...champions, last],
        open: open,
      );
    }
    return this;
  }
}
