import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/core/analytics/app_events.dart';
import 'package:hanguk_app/core/analytics/device_code.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

void main() {
  setUp(AppEvents.debugReset);

  testWidgets('seven quick taps show the device code; fewer do nothing', (t) async {
    final seen = <String>[];
    AppEvents.debugOnTrack = (e) => seen.add(e.event);
    addTearDown(() => AppEvents.debugOnTrack = null);
    await t.pumpWidget(
      const MaterialApp(
        locale: Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: Center(child: DeviceCodeTaps(child: Text('Tayyorgarlik')))),
      ),
    );
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    for (var i = 0; i < 6; i++) {
      await t.tap(find.text('Tayyorgarlik'));
      await t.pump(const Duration(milliseconds: 100));
    }
    expect(find.text(l.deviceCodeTitle), findsNothing);
    await t.tap(find.text('Tayyorgarlik'));
    await t.pumpAndSettle();
    expect(find.text(l.deviceCodeTitle), findsOneWidget);
    // Recording has not started in a test: no code yet, said so.
    expect(find.text(l.deviceCodeNone), findsOneWidget);
    expect(seen, contains('device_code_view'));
    await t.tap(find.text(l.ok));
    await t.pumpAndSettle();
    expect(find.text(l.deviceCodeTitle), findsNothing);
  });
}
