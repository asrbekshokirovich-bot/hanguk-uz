import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Index of the shell section currently shown by [HomeScreen].
///
/// Lifted to a Notifier (not local widget state) so deep-linked CTAs —
/// e.g. "Apply to a university" from the interview-launcher empty
/// state — can switch sections without going through the widget tree.
///
/// Indices are defined by `SeoulSection` in home_screen.dart:
///   0 — Home           (default)
///   1 — Applications
///   2 — Map
///   3 — Documents
///
/// AI Interview, Study Plan and Personal Statement are pushed routes, not
/// sections, so they have no index here.
class HomeTabNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void setTab(int index) => state = index;
}

final homeTabProvider = NotifierProvider<HomeTabNotifier, int>(
  HomeTabNotifier.new,
);
