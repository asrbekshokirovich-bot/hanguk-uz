import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What the Universitetlar list shows next to each university: the admission
/// chance, the visa chance, or the universities as pins on the map.
enum UniMode { admission, visa, map }

class UniModeNotifier extends Notifier<UniMode> {
  @override
  UniMode build() => UniMode.admission;

  void set(UniMode mode) => state = mode;
}

final uniModeProvider = NotifierProvider<UniModeNotifier, UniMode>(UniModeNotifier.new);
