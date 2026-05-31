import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/map/data/map_analytics.dart';

/// Audit M20 (2026-05-12): contract test for the analytics sink. The
/// real production sink will be swapped in by overriding
/// [mapAnalyticsProvider]; we want to make sure (a) the provider has
/// a non-null default, (b) the four events accept the expected
/// arguments without throwing, and (c) an override is honored.
class _CapturingAnalytics implements MapAnalytics {
  final List<String> events = [];

  @override
  void mapMarkerClick(String institutionId) =>
      events.add('marker:$institutionId');

  @override
  void walkaroundOpen(String institutionId) =>
      events.add('walkaround:$institutionId');

  @override
  void virtualTourOpen(String institutionId, {String? sceneId}) =>
      events.add('tour:$institutionId/${sceneId ?? ""}');

  @override
  void universityWebsiteOpen(String institutionId, String url) =>
      events.add('website:$institutionId:$url');
}

void main() {
  test('default sink does not throw', () {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    final a = c.read(mapAnalyticsProvider);
    expect(a, isNotNull);
    a.mapMarkerClick('i1');
    a.walkaroundOpen('i2');
    a.virtualTourOpen('i3');
    a.virtualTourOpen('i4', sceneId: 'library');
    a.universityWebsiteOpen('i5', 'https://example.edu');
  });

  test('override captures events', () {
    final fake = _CapturingAnalytics();
    final c = ProviderContainer(
      overrides: [mapAnalyticsProvider.overrideWithValue(fake)],
    );
    addTearDown(c.dispose);

    final a = c.read(mapAnalyticsProvider);
    a.mapMarkerClick('snu');
    a.walkaroundOpen('yonsei');
    a.virtualTourOpen('yonsei', sceneId: 'main_gate');
    a.universityWebsiteOpen('kaist', 'https://kaist.ac.kr');

    expect(fake.events, [
      'marker:snu',
      'walkaround:yonsei',
      'tour:yonsei/main_gate',
      'website:kaist:https://kaist.ac.kr',
    ]);
  });
}
