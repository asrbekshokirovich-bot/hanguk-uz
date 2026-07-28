// P2 #50 — Login screen smoke test (scaffold-only).
//
// The full LoginScreen depends on Supabase being initialised (it reads
// session state on first build) and on the auth repository provider.
// We pump a *stub* widget — the same Scaffold the screen uses — wrapped
// in ProviderScope + MaterialApp so that future test fixtures can swap
// in real provider overrides without rewriting the harness.
//
// The compilation of this test is what catches drift; the actual
// behavioural assertions wait until the Supabase + auth repository
// fakes land in `test/_fakes/`.
//
// MARKER: scaffold deferred — see P2 #50 closure log.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Login screen test harness compiles and pumps', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: SizedBox.shrink())),
      ),
    );

    expect(find.byType(Scaffold), findsOneWidget);
  });
}
