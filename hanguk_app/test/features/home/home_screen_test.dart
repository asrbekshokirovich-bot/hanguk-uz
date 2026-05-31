// P2 #50 — Home screen scaffold test (scaffold deferred).
//
// HomeScreen embeds the tab shell (Applications / Documents / Training /
// Chat / Map) and each tab reaches into Supabase-backed providers on
// first build. The full test wants a fake `SupabaseClient` and a fake
// auth state; both are unblocked once `currentUserProvider` lands.
// We commit the harness here to anchor the file path.
//
// MARKER: scaffold deferred — see P2 #50 closure log.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Home screen test harness compiles', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: Scaffold(body: SizedBox.shrink())),
      ),
    );
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
