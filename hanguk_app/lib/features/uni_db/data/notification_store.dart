import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

class NotificationItem {
  NotificationItem({
    required this.title,
    required this.body,
    required this.receivedAt,
    this.data = const {},
    this.read = false,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      receivedAt: DateTime.tryParse(json['receivedAt'] as String? ?? '') ??
          DateTime.now(),
      data: (json['data'] as Map<String, dynamic>?) ?? const {},
      read: json['read'] as bool? ?? false,
    );
  }

  final String title;
  final String body;
  final DateTime receivedAt;
  final Map<String, dynamic> data;
  final bool read;

  NotificationItem copyWith({bool? read}) => NotificationItem(
        title: title,
        body: body,
        receivedAt: receivedAt,
        data: data,
        read: read ?? this.read,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'body': body,
        'receivedAt': receivedAt.toIso8601String(),
        'data': data,
        'read': read,
      };
}

const _maxItems = 50;

/// Plain file-backed storage. Has no Riverpod dependency so it can be used
/// from the FCM background isolate, where no ProviderContainer exists.
class NotificationStorage {
  NotificationStorage._();

  static Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/push_notifications.json');
  }

  static Future<List<NotificationItem>> load() async {
    try {
      final file = await _file();
      if (!await file.exists()) return const [];
      final raw = await file.readAsString();
      if (raw.trim().isEmpty) return const [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return decoded
          .whereType<Map>()
          .map((m) => NotificationItem.fromJson(Map<String, dynamic>.from(m)))
          .toList();
    } catch (e) {
      debugPrint('NotificationStorage load error: $e');
      return const [];
    }
  }

  static Future<void> save(List<NotificationItem> items) async {
    try {
      final file = await _file();
      await file.writeAsString(
        jsonEncode(items.map((n) => n.toJson()).toList()),
        flush: true,
      );
    } catch (e) {
      debugPrint('NotificationStorage save error: $e');
    }
  }

  static List<NotificationItem> prepend(
    List<NotificationItem> items,
    NotificationItem item,
  ) {
    final updated = [item, ...items];
    return updated.length > _maxItems ? updated.sublist(0, _maxItems) : updated;
  }

  /// Load → prepend → save, for callers without access to the provider.
  static Future<void> append(NotificationItem item) async {
    final items = await load();
    await save(prepend(items, item));
  }
}

class NotificationStore extends Notifier<List<NotificationItem>> {
  @override
  List<NotificationItem> build() {
    _load();
    return const [];
  }

  Future<void> _load() async {
    final items = await NotificationStorage.load();
    if (!ref.mounted) return;
    state = items;
  }

  /// Re-reads from disk. Called when the app returns to the foreground so
  /// notifications persisted by the background isolate become visible.
  Future<void> refresh() => _load();

  Future<void> add(NotificationItem item) async {
    state = NotificationStorage.prepend(state, item);
    await NotificationStorage.save(state);
  }

  Future<void> markAllRead() async {
    if (state.every((n) => n.read)) return;
    state = [for (final n in state) n.read ? n : n.copyWith(read: true)];
    await NotificationStorage.save(state);
  }

  /// Marks the one notification the student opened. Items carry no id, so
  /// they are matched on arrival time, which is unique in practice — the
  /// alternative, marking everything read on a single tap, would clear the
  /// unread dot on notifications the student has not looked at.
  Future<void> markRead(NotificationItem item) async {
    if (item.read) return;
    state = [
      for (final n in state)
        n.receivedAt == item.receivedAt && !n.read ? n.copyWith(read: true) : n,
    ];
    await NotificationStorage.save(state);
  }
}

final notificationStoreProvider =
    NotifierProvider<NotificationStore, List<NotificationItem>>(
  NotificationStore.new,
);
