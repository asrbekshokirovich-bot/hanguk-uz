import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:in_app_review/in_app_review.dart';

import '../analytics/app_events.dart';

/// The store's own rating sheet (ushlab qolish P24): asked once, after a good
/// moment (the report is on screen), from the second day the phone has the
/// app — no question of ours before it and no button for it. The OS decides
/// whether the sheet actually shows (Play and App Store limit it).
abstract final class ReviewPrompt {
  static const _storage = FlutterSecureStorage();
  static const _firstKey = 'review_first_day_v1';
  static const _askedKey = 'review_asked_v1';

  @visibleForTesting
  static Future<String?> Function(String key) read = (k) => _storage.read(key: k);
  @visibleForTesting
  static Future<void> Function(String key, String value) write = (k, v) => _storage.write(key: k, value: v);

  /// The rule: not asked before, and the first day was at least one day ago.
  static bool shouldAsk({required DateTime? firstDay, required bool asked, required DateTime now}) {
    if (asked || firstDay == null) return false;
    final today = DateTime(now.year, now.month, now.day);
    return today.difference(firstDay).inDays >= 1;
  }

  /// Notes the first day; call on every start.
  static Future<void> noteStart([DateTime? now]) async {
    try {
      if (await read(_firstKey) != null) return;
      final n = now ?? DateTime.now();
      await write(_firstKey, DateTime(n.year, n.month, n.day).toIso8601String());
    } catch (_) {}
  }

  /// After a good moment; [context] tells whether a sheet is already up.
  static Future<void> maybeAsk(BuildContext context) async {
    try {
      final first = DateTime.tryParse(await read(_firstKey) ?? '');
      final asked = (await read(_askedKey)) == '1';
      if (!shouldAsk(firstDay: first, asked: asked, now: DateTime.now())) return;
      if (!context.mounted || !(ModalRoute.of(context)?.isCurrent ?? false)) return;
      final review = InAppReview.instance;
      if (!await review.isAvailable()) return;
      await write(_askedKey, '1');
      AppEvents.track('sheet_open', props: {'name': 'store_review'});
      await review.requestReview();
    } catch (e) {
      debugPrint('ReviewPrompt: $e');
    }
  }
}
