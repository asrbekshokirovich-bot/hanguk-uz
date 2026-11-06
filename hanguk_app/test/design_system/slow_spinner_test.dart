import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/widgets/slow_spinner.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

void main() {
  testWidgets('a long wait says to check the connection and offers a retry', (t) async {
    var retries = 0;
    await t.pumpWidget(
      MaterialApp(
        locale: const Locale('uz'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        home: Scaffold(body: SlowSpinner(onRetry: () => retries++)),
      ),
    );
    final l = await AppLocalizations.delegate.load(const Locale('uz'));
    await t.pump(const Duration(seconds: 2));
    expect(find.text(l.checkConnectionRetry), findsNothing);
    expect(find.text(l.commonRetry), findsNothing);

    await t.pump(const Duration(seconds: 7));
    expect(find.text(l.checkConnectionRetry), findsOneWidget);
    await t.tap(find.text(l.commonRetry));
    await t.pump();
    expect(retries, 1);
  });
}
