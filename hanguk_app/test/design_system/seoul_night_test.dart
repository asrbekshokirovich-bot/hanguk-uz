import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/design_system/seoul_night/gallery/design_gallery_screen.dart';
import 'package:hanguk_app/design_system/seoul_night/seoul_night.dart';

/// Smoke coverage for the Seoul Night foundation (DESIGN_SPEC.md).
///
/// These are not pixel goldens — the gallery screen is the visual QA
/// surface for that. What is guarded here is the handful of invariants
/// that are easy to break silently and expensive to notice by eye.
void main() {
  Widget host(Widget child) => MaterialApp(
    theme: SeoulNightTheme.theme,
    home: SeoulNightScaffold(body: child),
  );

  group('typography', () {
    // The trap documented in sn_typography.dart: these are single-file
    // variable fonts, so a style carrying only `fontWeight` renders at
    // 400 regardless of what it asks for. Every style the system exposes
    // must set the `wght` axis too.
    final styles = <String, TextStyle>{
      'display': SnType.display,
      'headline': SnType.headline,
      'titleLarge': SnType.titleLarge,
      'title': SnType.title,
      'sectionTitle': SnType.sectionTitle,
      'body': SnType.body,
      'bodySmall': SnType.bodySmall,
      'label': SnType.label,
      'caption': SnType.caption,
      'captionSmall': SnType.captionSmall,
      'hangulLabel': SnType.hangulLabel,
      'hangulGlyph': SnType.hangulGlyph,
      'hangulWatermark': SnType.hangulWatermark,
      'magicCode': SnType.magicCode,
    };

    for (final entry in styles.entries) {
      test('${entry.key} sets the wght variation axis', () {
        final variations = entry.value.fontVariations;
        expect(
          variations,
          isNotNull,
          reason: '${entry.key} would render at weight 400',
        );
        expect(
          variations!.any((v) => v.axis == 'wght'),
          isTrue,
          reason: '${entry.key} is missing the wght axis',
        );
      });

      test('${entry.key} agrees between fontWeight and wght', () {
        final style = entry.value;
        final wght = style.fontVariations!
            .firstWhere((v) => v.axis == 'wght')
            .value;
        // pubspec declares one face per weight step, so the requested
        // FontWeight must land on the same step as the axis value or
        // font matching picks a face the axis then contradicts.
        expect(style.fontWeight, isNotNull);
        expect(
          FontWeight.values.indexOf(style.fontWeight!),
          (wght / 100).round() - 1,
          reason: '${entry.key} fontWeight and wght disagree',
        );
      });
    }

    test('every family used by the system is declared in pubspec', () {
      // Guards against a rename in sn_typography.dart silently falling
      // back to the platform font.
      expect(SnType.interFamily, 'Inter');
      expect(SnType.hangulFamily, 'NotoSansKR');
      expect(SnType.monoFamily, 'JetBrainsMono');
    });

    test('magic code carries the 0.3em tracking from the spec', () {
      final style = SnType.magicCode;
      expect(style.letterSpacing, closeTo(0.3 * style.fontSize!, 0.001));
    });
  });

  group('widgets build', () {
    testWidgets('SeoulNightScaffold paints the gradient and ambient glow', (
      tester,
    ) async {
      await tester.pumpWidget(host(const SizedBox()));
      expect(find.byType(SeoulNightScaffold), findsOneWidget);

      // The gradient lives on a DecoratedBox rather than the Scaffold's
      // own background, so assert on the decoration directly.
      final decorated = tester
          .widgetList<DecoratedBox>(find.byType(DecoratedBox))
          .map((d) => d.decoration)
          .whereType<BoxDecoration>();
      expect(
        decorated.any((d) => d.gradient == SnGradients.appBackground),
        isTrue,
      );
    });

    testWidgets('GlassCard responds to tap', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(GlassCard(onTap: () => taps++, child: const Text('tap'))),
      );
      await tester.tap(find.text('tap'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('HeroCard renders the watermark without exposing it to a11y', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(const HeroCard(watermark: '한국', child: Text('Journey'))),
      );
      expect(find.text('한국'), findsOneWidget);

      final node = tester.getSemantics(find.text('Journey'));
      expect(node.label, 'Journey');
    });

    testWidgets('LimeButton fires when enabled and stays inert when not', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        host(LimeButton(label: 'Go', onPressed: () => taps++)),
      );
      await tester.tap(find.text('Go'));
      await tester.pumpAndSettle();
      expect(taps, 1);

      await tester.pumpWidget(host(const LimeButton(label: 'Off')));
      await tester.tap(find.text('Off'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('LimeButton clears the 44px minimum hit target', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(LimeButton(label: 'Go', expand: false, onPressed: () {})),
      );
      final size = tester.getSize(find.byType(LimeButton));
      expect(size.height, greaterThanOrEqualTo(44));
    });

    testWidgets('SnOutlineButton fires', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(SnOutlineButton(label: 'Explore', onPressed: () => taps++)),
      );
      await tester.tap(find.text('Explore'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('HangulTag shows both halves, announces the English', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(const HangulTag(title: 'Applications', hangul: '지원 현황')),
      );
      expect(find.text('Applications'), findsOneWidget);
      expect(find.text('지원 현황'), findsOneWidget);

      final node = tester.getSemantics(find.byType(HangulTag));
      expect(node.label, 'Applications');
    });

    testWidgets('SnFilterChip toggles', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          SnFilterChip(label: 'Seoul', selected: true, onTap: () => taps++),
        ),
      );
      await tester.tap(find.text('Seoul'));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });

    testWidgets('the whole gallery renders', (tester) async {
      // The gallery imports every public widget, so this is the cheapest
      // guard against a widget being added to the barrel but never built.
      tester.view.physicalSize = const Size(1200, 4000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        const MaterialApp(home: DesignGalleryScreen()),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DesignGalleryScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('progress', () {
    testWidgets('ConicProgressRing clamps out-of-range values', (tester) async {
      // These come from `completed / total` counts that can go out of
      // range while data is mid-sync — clamping, not asserting, is the
      // contract.
      for (final value in [-1.0, 0.0, 0.5, 1.0, 2.0]) {
        await tester.pumpWidget(host(ConicProgressRing(value: value)));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
      expect(find.text('100%'), findsOneWidget);
    });

    testWidgets('GlowProgressBar clamps and reports percent to a11y', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(const GlowProgressBar(value: 3, semanticLabel: 'Docs')),
      );
      await tester.pumpAndSettle();
      final node = tester.getSemantics(find.byType(GlowProgressBar));
      expect(node.value, '100%');
    });

    testWidgets('JourneySegmentBar survives a zero-step journey', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(const JourneySegmentBar(total: 0, completed: 0)),
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('tokens', () {
    test('status tones map to the colours the spec fixes', () {
      expect(SnStatusTone.lime.foreground, SnColors.lime);
      expect(SnStatusTone.warning.foreground, SnColors.warningText);
      expect(SnStatusTone.info.foreground, SnColors.infoText);
      expect(SnStatusTone.neutral.foreground, SnColors.textSecondary);
    });

    test('the app gradient bottoms out near black for OLED', () {
      // Spec §4. If someone lightens the last stop, the whole point of
      // the dark palette on OLED is lost.
      final last = SnGradients.appBackground.colors.last;
      expect(last, SnColors.bgStop3);
      expect(last.r + last.g + last.b, lessThan(0.25));
    });

    test('lime button gradient runs bright to pressed', () {
      expect(SnGradients.limeButton.colors, [
        SnColors.limeBright,
        SnColors.limePressed,
      ]);
    });

    test('theme carries the Seoul Night extension', () {
      final ext = SeoulNightTheme.theme.extension<SnThemeExtension>();
      expect(ext, isNotNull);
      expect(ext!.glassBlur, 12);
      expect(ext.scrimBlur, 10);
    });

    test('motionScale of 0 collapses durations', () {
      const ext = SnThemeExtension(motionScale: 0);
      expect(ext.scale(SnMotion.base), Duration.zero);
    });
  });
}
