import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../domain/chat_message.dart';

class ChatState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final String? error;

  const ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.error,
  });

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    String? error,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class ChatNotifier extends Notifier<ChatState> {
  @override
  ChatState build() {
    return const ChatState(
      messages: [
        ChatMessage(
          role: 'assistant',
          content:
              "Salom! 👋 Men Hanguk AI yordamchisiman. Hujjatlar, universitetlar, ariza jarayoni haqida har qanday savolingizga javob beraman!",
        ),
      ],
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
      final language =
          'en'; // By default, but the backend detects Uzbek automatically

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
        upsertAssistant('Sorry, I could not generate a response.');
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Could not reach Hanguk AI. Check your connection.',
      );
    }
  }

  void clearChat() {
    state = const ChatState(
      messages: [
        ChatMessage(
          role: 'assistant',
          content: "Chat cleared. How can I help you?",
        ),
      ],
    );
  }
}

final chatProvider = NotifierProvider<ChatNotifier, ChatState>(() {
  return ChatNotifier();
});
