import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

/// A single university admission announcement (a crawled official notice).
/// Sourced from the `v_institution_announcements` view, which exposes the
/// public columns of the admin-only `announcements` table (see migration
/// 20260728130000). Titles are in Korean (the source language); the value for
/// the student is the official link.
class UniversityAnnouncement {
  final String id;
  final String title;
  final String? url;
  final DateTime? postedAt;

  UniversityAnnouncement({
    required this.id,
    required this.title,
    this.url,
    this.postedAt,
  });

  factory UniversityAnnouncement.fromMap(Map<String, dynamic> map) {
    final rawDate = (map['posted_at'] ?? map['detected_at']) as String?;
    final title = (map['title_ko'] as String?)?.trim();
    return UniversityAnnouncement(
      id: map['id'] as String,
      title: (title != null && title.isNotEmpty) ? title : 'Announcement',
      url: map['url_ko'] as String?,
      postedAt: (rawDate != null && rawDate.isNotEmpty)
          ? DateTime.tryParse(rawDate)
          : null,
    );
  }
}

class UniversityAnnouncementsState {
  final List<UniversityAnnouncement> announcements;
  final bool isLoading;
  final String? error;

  const UniversityAnnouncementsState({
    this.announcements = const [],
    this.isLoading = false,
    this.error,
  });

  UniversityAnnouncementsState copyWith({
    List<UniversityAnnouncement>? announcements,
    bool? isLoading,
    String? error,
  }) {
    return UniversityAnnouncementsState(
      announcements: announcements ?? this.announcements,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Loads the "News" feed for one institution. Mirrors
/// [UniversityEventsController]: a plain ChangeNotifier that fetches once on
/// construction and notifies listeners. `institutionId` is the same id carried
/// by `StudentApplication.universityId` (institutions.id).
class UniversityAnnouncementsController extends ChangeNotifier {
  UniversityAnnouncementsState state;
  final String institutionId;

  UniversityAnnouncementsController(this.institutionId)
    : state = const UniversityAnnouncementsState(isLoading: true) {
    _fetch();
  }

  void _setState(UniversityAnnouncementsState newState) {
    state = newState;
    notifyListeners();
  }

  Future<void> _fetch() async {
    if (institutionId.isEmpty) {
      _setState(state.copyWith(announcements: const [], isLoading: false));
      return;
    }
    try {
      final data = await Supabase.instance.client
          .from('v_institution_announcements')
          .select('id, title_ko, url_ko, posted_at, detected_at')
          .eq('institution_id', institutionId)
          .order('posted_at', ascending: false, nullsFirst: false)
          .limit(50);

      final list = (data as List)
          .map((e) => UniversityAnnouncement.fromMap(e as Map<String, dynamic>))
          .toList();

      _setState(state.copyWith(announcements: list, isLoading: false));
    } catch (e, st) {
      debugPrint('[UniversityAnnouncementsController] Error: $e\n$st');
      _setState(state.copyWith(error: e.toString(), isLoading: false));
    }
  }
}
