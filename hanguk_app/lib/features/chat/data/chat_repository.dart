import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../l10n/app_localizations.dart';
import '../../entry/data/entry_store.dart';
import '../domain/chat_message.dart';

/// Why the last request failed. The chat sheet turns it into words in the
/// app language.
enum ChatError { unreachable }

class ChatState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final ChatError? error;

  const ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.error,
  });

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    ChatError? error,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ChatNotifier extends Notifier<ChatState> {
  /// The language chosen in the app. The assistant's own lines are written
  /// in it and the backend is asked to answer in it.
  String get _language => ref.read(entryProvider).languageCode ?? 'en';

  AppLocalizations get _l => lookupAppLocalizations(Locale(_language));

  @override
  ChatState build() {
    // Rebuilt (and the greeting re-said) when the app language changes.
    ref.watch(entryProvider.select((s) => s.languageCode));
    return ChatState(
      messages: [ChatMessage(role: 'assistant', content: _l.chatGreeting)],
    );
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMsg = ChatMessage(role: 'user', content: text);
    final newMessages = [...state.messages, userMsg];
    state = state.copyWith(messages: newMessages, isLoading: true, error: null);

    try {
      final client = Supabase.instance.client;

      // Build conversation history for context
      // Cap at last 10 turns to stay within Gemini token limits
      final history = state.messages
          .where((m) => m.role != 'system')
          .take(10)
          .map((m) => {'role': m.role, 'content': m.content})
          .toList();

      final user = client.auth.currentUser;
      final language = _language;

      final url = Uri.parse(
        'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/hanguk-ai-chat',
      );
      final headers = {
        'Content-Type': 'application/json',
        'Authorization':
            'Bearer ${client.auth.currentSession?.accessToken ?? ''}',
      };

      final request = http.Request('POST', url);
      request.headers.addAll(headers);
      request.body = jsonEncode({
        'message': text,
        'conversationHistory': history,
        'user_id': user?.id ?? 'anonymous',
        'user_type': 'student',
        'language': language,
      });

      final response = await http.Client().send(request);

      if (response.statusCode >= 400) {
        final errorStr = await response.stream.bytesToString();
        throw Exception('Server error: ${response.statusCode} - $errorStr');
      }

      String assistantSoFar = '';

      void upsertAssistant(String chunk) {
        assistantSoFar += chunk;

        final messagesList = List<ChatMessage>.from(state.messages);

        // Ensure we find the specifically added uncompleted assistant message
        if (messagesList.isNotEmpty &&
            messagesList.last.role == 'assistant' &&
            !state.isLoading) {
          // We already have a streaming assistant message, replace it
          messagesList[messagesList.length - 1] = ChatMessage(
            role: 'assistant',
            content: assistantSoFar,
          );
        } else {
          // This is the first chunk, append the message
          messagesList.add(
            ChatMessage(role: 'assistant', content: assistantSoFar),
          );
        }

        state = state.copyWith(
          messages: messagesList,
          isLoading: false, // Turn off loading when first token arrives
        );
      }

      await for (final line
          in response.stream
              .transform(utf8.decoder)
              .transform(const LineSplitter())) {
        final trimmed = line.trim();
        if (trimmed.isEmpty || !trimmed.startsWith('data: ')) continue;

        final jsonStr = trimmed.substring(6).trim();
        if (jsonStr == '[DONE]') break;

        try {
          final data = jsonDecode(jsonStr);
          final content = data['choices']?[0]?['delta']?['content'] as String?;
          if (content != null) {
            upsertAssistant(content);
          }
        } catch (e) {
          // Ignore parsing errors for partial chunks
        }
      }

      // If empty response (no streaming chunks)
      if (assistantSoFar.isEmpty) {
        upsertAssistant(_l.chatNoResponse);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: ChatError.unreachable);
    }
  }

  void clearChat() {
    state = ChatState(
      messages: [ChatMessage(role: 'assistant', content: _l.chatCleared)],
    );
  }
}

final chatProvider = NotifierProvider<ChatNotifier, ChatState>(() {
  return ChatNotifier();
});
