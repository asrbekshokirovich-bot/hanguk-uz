// P2 #50 — Map tab scaffold test (scaffold deferred).
//
// MapTab watches `universitiesProvider` (Supabase-backed) on first
// build. Behavioural test waits on a `FakeMapRepository` override.
//
// MARKER: scaffold deferred — see P2 #50 closure log.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Map tab test harness compiles', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: SizedBox.shrink())),
      ),
    );
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
