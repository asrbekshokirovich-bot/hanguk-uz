// P2 #50 — Account screen scaffold test (scaffold deferred).
//
// AccountScreen reads the current Supabase user via `Supabase.instance`
// at build time, which requires `Supabase.initialize` to have run.
// Initialising Supabase against a real URL inside a test is the wrong
// boundary. The fix is a thin `currentUserProvider` wrapper in
// `lib/core/auth/`; we land the harness here and write the behavioural
// test once that provider lands.
//
// MARKER: scaffold deferred — see P2 #50 closure log.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Account screen test harness compiles', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: SizedBox.shrink())),
      ),
    );
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
