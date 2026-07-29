import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class ChannelMessage {
  final String id;
  final String channelId;
  final String content;
  final String senderId;
  final DateTime createdAt;

  // Custom metadata (if we join user table for avatars/names)
  final String? senderName;
  final String? senderAvatar;

  ChannelMessage({
    required this.id,
    required this.channelId,
    required this.content,
    required this.senderId,
    required this.createdAt,
    this.senderName,
    this.senderAvatar,
  });

  factory ChannelMessage.fromMap(Map<String, dynamic> map) {
    return ChannelMessage(
      id: map['id'],
      channelId: map['channel_id'],
      content: map['content'],
      senderId: map['sender_id'],
      createdAt: DateTime.parse(map['created_at']),
      senderName: map['sender_name'],
      senderAvatar: map['sender_avatar'],
    );
  }
}

class UniversityChatState {
  final List<ChannelMessage> messages;
  final bool isLoading;
  final String? error;
  final String? channelId; // Required to send messages

  const UniversityChatState({
    this.messages = const [],
    this.isLoading = false,
    this.error,
    this.channelId,
  });

  UniversityChatState copyWith({
    List<ChannelMessage>? messages,
    bool? isLoading,
    String? error,
    String? channelId,
  }) {
    return UniversityChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      channelId: channelId ?? this.channelId,
    );
  }
}

class UniversityChatController extends ChangeNotifier {
  UniversityChatState state;
  final String universityId;
  RealtimeChannel? _subscription;

  UniversityChatController(this.universityId)
    : state = const UniversityChatState(isLoading: true) {
    _initializeChannel(universityId);
  }

  /// Set once `dispose()` has run.
  ///
  /// `_initializeChannel` makes three awaited round-trips before it has a
  /// subscription to cancel, so a student who opens Discussion and swipes the
  /// sheet away inside that window used to leave a realtime channel
  /// subscribed for the life of the process — with a callback still holding
  /// this controller. On a flaky connection they accumulate.
  bool _disposed = false;

  void _setState(UniversityChatState newState) {
    // Same window: notifying a disposed ChangeNotifier throws in debug and
    // is silently wrong in release.
    if (_disposed) return;
    state = newState;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _subscription?.unsubscribe();
    super.dispose();
  }

  Future<void> _initializeChannel(String universityId) async {
    try {
      final client = Supabase.instance.client;

      // 1. Fetch Room ID for this university safely
      final roomData = await client
          .from('university_rooms')
          .select('id')
          .eq('university_id', universityId)
          .maybeSingle();

      if (roomData == null) {
        _setState(
          state.copyWith(error: 'University room not found.', isLoading: false),
        );
        return;
      }

      final roomId = roomData['id'];

      // 2. Fetch the Discussion Channel for this Room
      final channelData = await client
          .from('room_channels')
          .select('id')
          .eq('room_id', roomId)
          .eq('channel_type', 'discussion')
          .maybeSingle();

      if (channelData == null) {
        _setState(
          state.copyWith(
            error: 'Discussion channel not found for this room.',
            isLoading: false,
          ),
        );
        return;
      }

      final channelId = channelData['id'];

      // Update state with channel ID
      _setState(state.copyWith(channelId: channelId));

      // 3. Fetch past messages (without postgREST embedded join)
      final messagesData = await client
          .from('channel_messages')
          .select('*')
          .eq('channel_id', channelId)
          .order('created_at', ascending: false) // Fetch newest first
          .limit(100);

      // Extract unique sender IDs safely
      final Set<String> senderIds = {};
      for (var msg in messagesData as List) {
        if (msg['sender_id'] != null) {
          senderIds.add(msg['sender_id'].toString());
        }
      }

      // Fetch profiles manually to bypass missing PostgREST schema constraints
      final Map<String, dynamic> profilesMap = {};
      if (senderIds.isNotEmpty) {
        try {
          // Using raw filter 'in' for backwards-compatible arrays
          final profilesData = await client
              .from('profiles')
              .select('user_id, full_name, avatar_url')
              .filter('user_id', 'in', '(${senderIds.join(',')})');

          for (var p in profilesData as List) {
            profilesMap[p['user_id'].toString()] = p;
          }
        } catch (e) {
          debugPrint(
            '[UniversityChatNotifier] Failed to load profiles manually: $e',
          );
        }
      }

      // We maintain the list reversed so ListView.builder(reverse: true) loads smoothly
      final List<ChannelMessage> messagesList = (messagesData as List).map((
        map,
      ) {
        final profile = profilesMap[map['sender_id']?.toString()];
        return ChannelMessage(
          id: map['id'],
          channelId: map['channel_id'],
          content: map['content'],
          senderId: map['sender_id'],
          createdAt: DateTime.parse(map['created_at']),
          senderName: profile?['full_name'],
          senderAvatar: profile?['avatar_url'],
        );
      }).toList();

      _setState(state.copyWith(messages: messagesList, isLoading: false));

      // 4. Subscribe to new messages — unless the sheet closed while the
      // three fetches above were in flight, in which case there is nobody
      // left to deliver to.
      if (_disposed) return;
      _subscription = client
          .channel('public:channel_messages:channel_id=eq.$channelId')
          .onPostgresChanges(
            event: PostgresChangeEvent.insert,
            schema: 'public',
            table: 'channel_messages',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'channel_id',
              value: channelId,
            ),
            callback: (payload) {
              final newMsgMap = payload.newRecord;
              final newMessage = ChannelMessage.fromMap(newMsgMap);

              // Prepend to messages (since list is reversed)
              // NOTE: Supabase realtime payload does not include joined rows.
              // So senderName/Avatar won't exist directly.
              // To handle this, we just insert the message without profile metadata, or we re-fetch the profile.
              _setState(
                state.copyWith(messages: [newMessage, ...state.messages]),
              );
            },
          )
          .subscribe();

      // dispose() can land between the check above and here; it would have
      // found `_subscription` still null, so tear it down now.
      if (_disposed) {
        _subscription?.unsubscribe();
        _subscription = null;
      }
    } catch (e, st) {
      debugPrint('[UniversityChatNotifier] Error: $e\n$st');
      _setState(
        state.copyWith(
          error: 'Failed to connect to discussion: $e',
          isLoading: false,
        ),
      );
    }
  }

  Future<void> sendMessage(String content) async {
    if (content.trim().isEmpty || state.channelId == null) return;

    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) {
      _setState(state.copyWith(error: 'Not authenticated.'));
      return;
    }

    try {
      await client.from('channel_messages').insert({
        'channel_id': state.channelId,
        'content': content.trim(),
        'sender_id': user.id,
        'message_type': 'text',
      });
      // the real-time subscription will dynamically push the message into our list
    } catch (e, st) {
      debugPrint('[UniversityChatNotifier] Failed to send message: $e\n$st');
      _setState(state.copyWith(error: 'Failed to send message: $e'));
    }
  }
}
