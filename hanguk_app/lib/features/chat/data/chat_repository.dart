import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/analytics/app_events.dart';
import '../../../core/config/app_config.dart';
import '../../../core/country/app_country.dart';
import '../../../l10n/app_localizations.dart';
import '../../discover/data/guest_ai_usage.dart';
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
      messages: [ChatMessage(role: 'assistant', content: _l.chatGreeting, local: true)],
    );
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMsg = ChatMessage(role: 'user', content: text);
    final newMessages = [...state.messages, userMsg];
    state = state.copyWith(messages: newMessages, isLoading: true, error: null);

    // `ai_chat`: how the answer came — its first words' wait, the whole
    // answer's, or the failure (the message itself is not sent).
    final clock = Stopwatch()..start();
    int? firstMs;
    int? status;
    var result = 'error';
    try {
      final client = Supabase.instance.client;

      // Build conversation history for context
      // Cap at last 10 turns to stay within Gemini token limits
      // (The last ten: `take(10)` sent the first ten, so after ten turns
      // the newest messages never reached the model.)
      final turns = state.messages.where((m) => m.role != 'system' && !m.local).toList();
      final history = turns
          .skip(turns.length > 10 ? turns.length - 10 : 0)
          .map((m) => {'role': m.role, 'content': m.content})
          .toList();

      final user = client.auth.currentUser;
      final language = _language;

      final url = Uri.parse(
        '${AppConfig.supabaseUrl}/functions/v1/hanguk-ai-chat',
      );
      // The publishable key goes in `apikey` only (it is not a JWT); the
      // bearer is the user's own token, or no Authorization header at all
      // for a visitor (hanguk-ai-chat runs with verify_jwt = false).
      final token = client.auth.currentSession?.accessToken;
      final bearer = token == null ? null : 'Bearer $token';
      final headers = {
        'Content-Type': 'application/json',
        'apikey': AppConfig.supabasePublishableKey,
        'Authorization': ?bearer,
      };

      final request = http.Request('POST', url);
      request.headers.addAll(headers);
      request.body = jsonEncode({
        'message': text,
        'conversationHistory': history,
        'user_id': user?.id ?? 'anonymous',
        'user_type': 'student',
        'language': language,
        // KG6: the assistant names the right embassy and contacts.
        'country': (ref.read(entryProvider).country ?? AppCountry.uz).code,
        // A guest's 10 questions a day are counted by the phone (D4).
        'install_id': ?AppEvents.installId,
      });

      final response = await http.Client().send(request);
      status = response.statusCode;

      if (response.statusCode >= 400) {
        final errorStr = await response.stream.bytesToString();
        throw Exception('Server error: ${response.statusCode} - $errorStr');
      }

      String assistantSoFar = '';

      void upsertAssistant(String chunk) {
        firstMs ??= clock.elapsedMilliseconds;
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
      result = assistantSoFar.isEmpty ? 'empty' : 'ok';
      if (assistantSoFar.isEmpty) {
        upsertAssistant(_l.chatNoResponse);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: ChatError.unreachable);
    } finally {
      AppEvents.track('ai_chat', props: {
        'result': result,
        'status': ?status,
        'first_ms': ?firstMs,
        'ms': clock.elapsedMilliseconds,
        'chars': text.length,
        'turn': newMessages.where((m) => m.role == 'user').length,
      });
      // The guest's "N questions left today" counts on the server; read it
      // again now that one was asked.
      ref.invalidate(guestAiUsageProvider);
    }
  }

  void clearChat() {
    state = ChatState(
      messages: [ChatMessage(role: 'assistant', content: _l.chatCleared, local: true)],
    );
  }
}

final chatProvider = NotifierProvider<ChatNotifier, ChatState>(() {
  return ChatNotifier();
});
