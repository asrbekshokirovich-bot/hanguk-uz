import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/form_progress.dart';

void main() {
  test('form_leave says how far the form got, once', () {
    final seen = <TrackedEvent>[];
    AppEvents.debugOnTrack = seen.add;
    addTearDown(() => AppEvents.debugOnTrack = null);

    final p = FormProgress('visa');
    p.compare({'gpa': 4.0, 'age': 19}, {'gpa': 4.5, 'age': 19});
    p.compare({'gpa': 4.5, 'age': 19}, {'gpa': 5.0, 'age': 20});
    p.answered('gpa');
    p.leave(total: 12);
    p.leave(total: 12);

    final leaves = seen.where((e) => e.event == 'form_leave').toList();
    expect(leaves, hasLength(1));
    expect(leaves.single.props, {'form': 'visa', 'answered': 2, 'total': 12, 'sent': false});
  });
}
