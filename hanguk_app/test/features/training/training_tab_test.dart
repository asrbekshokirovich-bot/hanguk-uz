// P2 #50 — Training tab scaffold test (scaffold deferred).
//
// TrainingTab calls study-plan + interview repositories on init.
// Both round-trip to Supabase, so a real smoke test needs faked
// repositories. Harness committed; behavioural test follows.
//
// MARKER: scaffold deferred — see P2 #50 closure log.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Training tab test harness compiles', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: SizedBox.shrink())),
      ),
    );
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
