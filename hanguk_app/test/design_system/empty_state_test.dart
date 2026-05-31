// P2 #50 — EmptyState widget smoke test.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/adaptive/empty_state.dart';

void main() {
  testWidgets('renders headline + subhead without a CTA', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EmptyState(
            icon: Icons.inbox_outlined,
            headline: 'No items',
            subhead: 'Start by adding your first item.',
          ),
        ),
      ),
    );

    expect(find.text('No items'), findsOneWidget);
    expect(find.text('Start by adding your first item.'), findsOneWidget);
    expect(find.byType(ElevatedButton), findsNothing);
  });

  testWidgets('renders CTA when both ctaLabel and onCta provided',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EmptyState(
            icon: Icons.inbox_outlined,
            headline: 'No items',
            subhead: 'Start by adding your first item.',
            ctaLabel: 'Add',
            onCta: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.byType(ElevatedButton), findsOneWidget);
    await tester.tap(find.byType(ElevatedButton));
    expect(tapped, isTrue);
  });
}
