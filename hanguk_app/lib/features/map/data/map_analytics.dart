import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Audit M20 (2026-05-12): lightweight analytics surface for the map
/// feature. Four events:
///
///   - [mapMarkerClick]      a marker was tapped on the map
///   - [walkaroundOpen]      "Virtual Walkaround" (Kakao Roadview) opened
///   - [virtualTourOpen]     curated Pannellum "Virtual Tour" opened
///   - [universityWebsiteOpen] official website link opened
///
/// The default implementation [_DebugMapAnalytics] just logs via
/// `debugPrint`. A future iteration will swap in a real sink that
/// writes to a `usage_events` Supabase table (or Sentry breadcrumbs)
/// by overriding [mapAnalyticsProvider] at the composition root —
/// no caller change required.
abstract interface class MapAnalytics {
  void mapMarkerClick(String institutionId);

  void walkaroundOpen(String institutionId);

  void virtualTourOpen(String institutionId, {String? sceneId});

  void universityWebsiteOpen(String institutionId, String url);
}

class _DebugMapAnalytics implements MapAnalytics {
  const _DebugMapAnalytics();

  @override
  void mapMarkerClick(String institutionId) {
    debugPrint('[MapAnalytics] marker_click id=$institutionId');
  }

  @override
  void walkaroundOpen(String institutionId) {
    debugPrint('[MapAnalytics] walkaround_open id=$institutionId');
  }

  @override
  void virtualTourOpen(String institutionId, {String? sceneId}) {
    debugPrint(
      '[MapAnalytics] virtual_tour_open id=$institutionId scene=${sceneId ?? '<default>'}',
    );
  }

  @override
  void universityWebsiteOpen(String institutionId, String url) {
    debugPrint(
      '[MapAnalytics] university_website_open id=$institutionId url=$url',
    );
  }
}

/// Riverpod provider — override at the composition root to swap in a
/// real sink. The Riverpod-shape (not a singleton) means tests can
/// override per-test to assert events without coupling to a global.
final mapAnalyticsProvider = Provider<MapAnalytics>((ref) {
  return const _DebugMapAnalytics();
});
