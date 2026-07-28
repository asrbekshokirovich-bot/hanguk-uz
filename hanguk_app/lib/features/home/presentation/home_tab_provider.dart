import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Index of each persistent section in the shell's `IndexedStack`.
///
/// Lives here rather than in `home_screen.dart` so the Home tab, the router
/// and the shell can all name the same constant without importing the screen
/// that renders them. There is exactly one source of truth for these numbers.
///
/// AI Interview, Study Plan and Personal Statement are pushed routes, not
/// sections, so they have no index here.
class SeoulSection {
  const SeoulSection._();

  static const int home = 0;
  static const int applications = 1;
  static const int map = 2;
  static const int documents = 3;

  static const int count = 4;
}

/// Index of the shell section currently shown by `HomeScreen`.
///
/// Lifted to a Notifier (not local widget state) so deep-linked CTAs —
/// e.g. "Apply to a university" from the interview-launcher empty
/// state — can switch sections without going through the widget tree.
class HomeTabNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void setTab(int index) => state = index;
}

final homeTabProvider = NotifierProvider<HomeTabNotifier, int>(
  HomeTabNotifier.new,
);
