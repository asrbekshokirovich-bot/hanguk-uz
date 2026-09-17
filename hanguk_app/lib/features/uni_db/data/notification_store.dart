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
  bool read;

  Map<String, dynamic> toJson() => {
        'title': title,
        'body': body,
        'receivedAt': receivedAt.toIso8601String(),
        'data': data,
        'read': read,
      };
}

const _maxItems = 50;

class NotificationStore extends StateNotifier<List<NotificationItem>> {
  NotificationStore() : super(const []) {
    _load();
  }

  File? _file;

  Future<File> _getFile() async {
    if (_file != null) return _file!;
    final dir = await getApplicationDocumentsDirectory();
    _file = File('${dir.path}/push_notifications.json');
    return _file!;
  }

  Future<void> _load() async {
    try {
      final file = await _getFile();
      if (!file.existsSync()) return;
      final raw = await file.readAsString();
      final list = (jsonDecode(raw) as List)
          .cast<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList();
      state = list;
    } catch (e) {
      debugPrint('NotificationStore load error: $e');
    }
  }

  Future<void> _save() async {
    try {
      final file = await _getFile();
      await file.writeAsString(jsonEncode(state.map((n) => n.toJson()).toList()));
    } catch (e) {
      debugPrint('NotificationStore save error: $e');
    }
  }

  Future<void> add(NotificationItem item) async {
    final updated = [item, ...state];
    if (updated.length > _maxItems) {
      state = updated.sublist(0, _maxItems);
    } else {
      state = updated;
    }
    await _save();
  }

  Future<void> markAllRead() async {
    state = [
      for (final n in state)
        if (n.read) n else (n..read = true),
    ];
    await _save();
  }

  int get unreadCount => state.where((n) => !n.read).length;
}

final notificationStoreProvider =
    StateNotifierProvider<NotificationStore, List<NotificationItem>>(
  (ref) => NotificationStore(),
);
