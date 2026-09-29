import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Compare mode of the university catalogue — the same in guest Explore and
/// in a student's Applications list.
///
/// There are exactly two ways in: the "Taqqoslash" chip, or a long press on a
/// card, which also selects that card. Only two universities can be chosen;
/// once both slots are taken the rest cannot be picked until one is removed.
@immutable
class CatalogCompareState {
  const CatalogCompareState({this.active = false, this.ids = const []});

  static const int maxSlots = 2;

  final bool active;

  /// Institution ids, in the order they were picked.
  final List<String> ids;

  bool get full => ids.length >= maxSlots;

  bool contains(String id) => ids.contains(id);
}

class CatalogCompareNotifier extends Notifier<CatalogCompareState> {
  @override
  CatalogCompareState build() => const CatalogCompareState();

  /// The chip: turn compare mode on, keeping whatever is already picked.
  void enter() => state = CatalogCompareState(active: true, ids: state.ids);

  /// The chip's ✕: leave compare mode and forget the picks.
  void exit() => state = const CatalogCompareState();

  /// A tap on a card while compare mode is on.
  void toggle(String id) {
    if (!state.active) return;
    if (state.contains(id)) {
      remove(id);
    } else if (!state.full) {
      state = CatalogCompareState(active: true, ids: [...state.ids, id]);
    }
  }

  /// A long press on a card: compare mode on, and that card picked if there
  /// is room for it.
  void startWith(String id) {
    final ids = state.contains(id) || state.full ? state.ids : [...state.ids, id];
    state = CatalogCompareState(active: true, ids: ids);
  }

  /// The ✕ on a column of the compare screen, or a second tap on a card.
  void remove(String id) => state = CatalogCompareState(
    active: state.active,
    ids: [...state.ids]..remove(id),
  );
}

final catalogCompareProvider =
    NotifierProvider<CatalogCompareNotifier, CatalogCompareState>(CatalogCompareNotifier.new);
