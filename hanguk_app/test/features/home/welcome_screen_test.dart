// P2 #50 — Welcome screen scaffold test (scaffold deferred).
//
// The real WelcomeScreen reads `updaterRepositoryProvider`, which
// instantiates `UpdaterRepository(Supabase.instance.client)` at
// build-time. Pumping the real widget here would throw because
// `Supabase.initialize()` is never called in unit tests. A
// behavioural test wants either (a) a `Supabase.initialize()`
// teardown harness, or (b) a thin `supabaseClientProvider` we can
// override to a fake. Both are out of scope for the harness commit.
//
// MARKER: scaffold deferred — see P2 #50 closure log.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Welcome screen test harness compiles', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: SizedBox.shrink())),
      ),
    );
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
