import 'package:flutter/foundation.dart';

@immutable
class ChatMessage {
  final String? id; // DB row id when persisted
  final String role; // 'user' | 'assistant'
  final String content;

  const ChatMessage({this.id, required this.role, required this.content});
}
