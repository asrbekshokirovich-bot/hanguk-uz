import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

/// A phone the tests render on.
class TestPhone {
  const TestPhone(this.name, this.size, {this.top = 0, this.bottom = 0, this.dpr = 2});

  /// The prototype's frame: 390×844 with a 47 px status bar and a 34 px home
  /// indicator. Renders on it must match the prototype pixel for pixel.
  static const prototype = TestPhone('prototype', Size(390, 844), top: 47, bottom: 34);

  /// A common Android size with a 24 dp status bar and gesture navigation.
  static const android = TestPhone('android', Size(360, 800), top: 24, bottom: 24);

  /// A short Android screen, where content has to scroll instead of overflow.
  static const small = TestPhone('small', Size(360, 640), top: 24, bottom: 48);

  final String name;
  final Size size;
  final double top;
  final double bottom;
  final double dpr;
}

/// Sizes the test view like [phone] (including status bar and navigation
/// insets) for the rest of the test.
void usePhone(WidgetTester tester, [TestPhone phone = TestPhone.prototype]) {
  final view = tester.view;
  view.physicalSize = phone.size * phone.dpr;
  view.devicePixelRatio = phone.dpr;
  final padding = FakeViewPadding(top: phone.top * phone.dpr, bottom: phone.bottom * phone.dpr);
  view.padding = padding;
  view.viewPadding = padding;
  addTearDown(view.reset);
}

/// Key of the boundary the screen renders are taken from.
const screenKey = ValueKey('screen');

/// Wraps [app] so the whole screen can be captured with [matchesGoldenFile].
Widget capture(Widget app) => RepaintBoundary(key: screenKey, child: app);

/// Writes the captured screen at [pixelRatio]× to `build/screens2x/<name>.png`
/// — a sharper copy of the golden for reviewing details against the
/// prototype rendered at the same scale.
Future<void> saveHiRes(WidgetTester tester, String name, {double pixelRatio = 2}) async {
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(screenKey));
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: pixelRatio);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    final file = File('build/screens2x/$name.png');
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes!.buffer.asUint8List());
  });
}

/// The golden at 1× (compared with the prototype) plus the 2× copy and
/// the layout probe.
Future<void> expectScreen(WidgetTester tester, String name) async {
  await expectLater(find.byKey(screenKey), matchesGoldenFile('goldens/$name.png'));
  await saveHiRes(tester, name);
  dumpLayout(tester, name);
}

/// Writes `build/layout/<name>.json`: every visible text's first line — its
/// start x and baseline y in logical pixels — for comparing positions with
/// the prototype's (tool/layout_diff.py) rather than eyeballing pixels.
void dumpLayout(WidgetTester tester, String name) {
  final items = <Map<String, Object>>[];
  for (final paragraph in tester.renderObjectList<RenderParagraph>(find.byType(RichText))) {
    if (!paragraph.hasSize) continue;
    final text = paragraph.text.toPlainText(includeSemanticsLabels: false);
    final trimmed = text.trimLeft();
    if (trimmed.isEmpty) continue;
    final lead = text.length - trimmed.length;
    final baseline = paragraph.computeDistanceToActualBaseline(TextBaseline.alphabetic) ?? 0;
    final caret = paragraph.getOffsetForCaret(TextPosition(offset: lead), Rect.zero);
    final at = paragraph.localToGlobal(Offset(caret.dx, baseline));
    final parent = paragraph.parent;
    final box = parent is RenderBox && parent.runtimeType.toString() == '_RenderCssLines' ? parent : paragraph;
    items.add({
      'text': trimmed.split('\n').first,
      'x': double.parse(at.dx.toStringAsFixed(2)),
      'y': double.parse(at.dy.toStringAsFixed(2)),
      'h': double.parse(box.size.height.toStringAsFixed(2)),
      'size': paragraph.text.style?.fontSize ?? 0,
    });
  }
  final file = File('build/layout/$name.json');
  file.parent.createSync(recursive: true);
  file.writeAsStringSync(const JsonEncoder.withIndent(' ').convert(items));
}
