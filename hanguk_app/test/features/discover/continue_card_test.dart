import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/discover/presentation/widgets/continue_card.dart';
import 'package:hanguk_app/l10n/app_localizations.dart';

Future<String> dayIn(WidgetTester t, String lang, DateTime d) async {
  late String out;
  await t.pumpWidget(MaterialApp(
    locale: Locale(lang),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Builder(builder: (context) {
      out = continueDay(context, d);
      return const SizedBox();
    }),
  ));
  return out;
}

void main() {
  testWidgets('the D7 deadline reads «20-noyabrgacha» in Uzbek', (t) async {
    final d = DateTime(2026, 11, 20);
    expect(await dayIn(t, 'uz', d), '20-noyabr');
    expect(await dayIn(t, 'en', d), 'November 20');
  });

  testWidgets('the D7 title counts the universities', (t) async {
    await t.pumpWidget(MaterialApp(
      locale: const Locale('uz'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(builder: (context) {
        final l = AppLocalizations.of(context)!;
        return Column(children: [
          Text(l.continueTitleCount('3')),
          Text(l.continueNearestLine('Jeonbuk', continueDay(context, DateTime(2026, 11, 20)))),
        ]);
      }),
    ));
    expect(find.text('Baholashingiz saqlangan: 3 ta universitet'), findsOneWidget);
    expect(find.text('Eng yaqin muddat: Jeonbuk — online ariza 20-noyabrgacha'), findsOneWidget);
  });
}
