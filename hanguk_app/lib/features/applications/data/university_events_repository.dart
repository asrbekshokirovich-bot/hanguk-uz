import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class UniversityEvent {
  final String id;
  final String roomId;
  final String title;
  final String? description;
  final DateTime eventDate;
  final String eventType;

  UniversityEvent({
    required this.id,
    required this.roomId,
    required this.title,
    this.description,
    required this.eventDate,
    required this.eventType,
  });

  factory UniversityEvent.fromMap(Map<String, dynamic> map) {
    return UniversityEvent(
      id: map['id'],
      roomId: map['room_id'],
      title: map['title_en'] ?? map['title_uz'] ?? 'Event',
      description: map['description_en'] ?? map['description_uz'],
      eventDate: DateTime.parse(map['event_date']),
      eventType: map['event_type'] ?? 'other',
    );
  }
}

class UniversityEventsState {
  final List<UniversityEvent> events;
  final bool isLoading;
  final String? error;

  const UniversityEventsState({
    this.events = const [],
    this.isLoading = false,
    this.error,
  });

  UniversityEventsState copyWith({
    List<UniversityEvent>? events,
    bool? isLoading,
    String? error,
  }) {
    return UniversityEventsState(
      events: events ?? this.events,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class UniversityEventsController extends ChangeNotifier {
  UniversityEventsState state;
  final String universityId;

  UniversityEventsController(this.universityId)
    : state = const UniversityEventsState(isLoading: true) {
    _fetchEvents(universityId);
  }

  void _setState(UniversityEventsState newState) {
    state = newState;
    notifyListeners();
  }

  Future<void> _fetchEvents(String universityId) async {
    try {
      final client = Supabase.instance.client;

      // 1. Fetch Room ID securely
      final roomData = await client
          .from('university_rooms')
          .select('id')
          .eq('university_id', universityId)
          .maybeSingle();

      if (roomData == null) {
        _setState(state.copyWith(error: 'Room not found.', isLoading: false));
        return;
      }
      final roomId = roomData['id'];

      // 2. Fetch Events
      final eventsData = await client
          .from('university_events')
          .select('*')
          .eq('room_id', roomId)
          .order('event_date', ascending: true);

      final List<UniversityEvent> eventsList = (eventsData as List)
          .map((e) => UniversityEvent.fromMap(e))
          .toList();

      _setState(state.copyWith(events: eventsList, isLoading: false));
    } catch (e, st) {
      debugPrint('[UniversityEventsNotifier] Error: $e\n$st');
      _setState(state.copyWith(error: e.toString(), isLoading: false));
    }
  }
}
