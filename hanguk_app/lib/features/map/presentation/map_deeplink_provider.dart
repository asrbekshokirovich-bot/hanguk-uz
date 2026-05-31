import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Audit M11 (2026-05-11): the deep-link route `/map/:institutionId`
/// switches the home-tab to Map and raises the detail bottom sheet
/// for the matched university. The route handler writes the
/// institution id into this provider; `MapTab` watches it, raises
/// the sheet, then clears the provider so the sheet doesn't reopen
/// on rebuild.
class PendingMapDetailNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void set(String? id) => state = id;
}

final pendingMapDetailProvider =
    NotifierProvider<PendingMapDetailNotifier, String?>(
      PendingMapDetailNotifier.new,
    );
