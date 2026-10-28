// What the student actually sees: a screen rendered to pixels, with the
// app's real fonts and a keyboard covering the bottom when one is open.
//
// The Study Plan box has shipped twice with text nobody could read. Checking
// colours in code missed it; these helpers read the painted pixels instead,
// so a test fails exactly when a person looking at the phone would see
// nothing — dark text on a dark field, a field under the keyboard, the round
// BAHOLASH button over the line being typed.
//
// Every capture is also written to build/test_screens/<name>.png; CI keeps
// that folder, so the screens can be looked at by a person too.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'contrast.dart';

/// Wraps the app under test; [capture] reads it.
final GlobalKey shotKey = GlobalKey(debugLabel: 'screen');

/// A phone of 360×780 logical pixels (a common Android size) at 3×.
void usePhone(WidgetTester t) {
  t.view.physicalSize = const Size(360 * 3, 780 * 3);
  t.view.devicePixelRatio = 3;
  addTearDown(t.view.reset);
}

/// The keyboard's height in logical pixels while it is open.
const double kKeyboard = 300;

void openKeyboard(WidgetTester t) => t.view.viewInsets = const FakeViewPadding(bottom: kKeyboard * 3);

void closeKeyboard(WidgetTester t) => t.view.viewInsets = FakeViewPadding.zero;

/// The app's own fonts (Inter, Noto Sans KR) instead of the test font's
/// boxes, so screenshots read like the phone.
Future<void> loadAppFonts() async {
  Future<void> family(String name, List<String> files) async {
    final loader = FontLoader(name);
    for (final f in files) {
      loader.addFont(Future.value(ByteData.sublistView(File('assets/fonts/$f').readAsBytesSync())));
    }
    await loader.load();
  }

  await family('Inter', [for (final w in const [400, 500, 600, 700, 800, 900]) 'Inter-$w.ttf']);
  await family('NotoSansKR', const ['NotoSansKR-500.ttf', 'NotoSansKR-700.ttf', 'NotoSansKR-900.ttf']);
}

/// A dark grey slab where the keyboard is, drawn over everything like the
/// real one (put it in `MaterialApp.builder`).
class FakeKeyboard extends StatelessWidget {
  const FakeKeyboard({super.key, required this.child});

  final Widget child;

  static const Color colour = Color(0xFF3C3C3C);

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.viewInsetsOf(context).bottom;
    return Stack(
      children: [
        child,
        if (h > 0)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: h,
            child: const IgnorePointer(child: ColoredBox(color: colour)),
          ),
      ],
    );
  }
}

/// The screen as pixels.
class Shot {
  Shot(this.image, this.rgba, this.ratio);

  final ui.Image image;
  final ByteData rgba;

  /// Image pixels per logical pixel.
  final double ratio;

  Color pixel(int x, int y) {
    final i = (y * image.width + x) * 4;
    return Color.fromARGB(rgba.getUint8(i + 3), rgba.getUint8(i), rgba.getUint8(i + 1), rgba.getUint8(i + 2));
  }

  /// [r] (logical, global) in image pixels, clipped to the image.
  Rect toImage(Rect r) => Rect.fromLTRB(
    (r.left * ratio).clamp(0, image.width.toDouble()),
    (r.top * ratio).clamp(0, image.height.toDouble()),
    (r.right * ratio).clamp(0, image.width.toDouble()),
    (r.bottom * ratio).clamp(0, image.height.toDouble()),
  );
}

/// Renders the app (everything under [shotKey]) and saves it as [name].png.
Future<Shot> capture(WidgetTester t, String name, {double ratio = 2}) async {
  final boundary = t.renderObject<RenderRepaintBoundary>(find.byKey(shotKey));
  late Shot shot;
  await t.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: ratio);
    final rgba = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
    final png = (await image.toByteData(format: ui.ImageByteFormat.png))!;
    final dir = Directory('build/test_screens')..createSync(recursive: true);
    File('${dir.path}/$name.png').writeAsBytesSync(png.buffer.asUint8List());
    shot = Shot(image, rgba, ratio);
  });
  return shot;
}

/// In [region] (image pixels): the most common colour (what is behind) and
/// the share of pixels that stand out from it by at least [min] contrast
/// (glyphs a person can read).
({Color background, double readable}) inkIn(Shot s, Rect region, {double min = 3.0}) {
  final counts = <int, int>{};
  final pixels = <Color>[];
  for (var y = region.top.floor(); y < region.bottom.floor(); y++) {
    for (var x = region.left.floor(); x < region.right.floor(); x++) {
      final c = s.pixel(x, y);
      pixels.add(c);
      // Bucketed so antialiasing does not split the background in many.
      final key = ((c.r * 255).round() >> 3) << 10 | ((c.g * 255).round() >> 3) << 5 | ((c.b * 255).round() >> 3);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  if (pixels.isEmpty) return (background: const Color(0x00000000), readable: 0);
  final top = counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
  final background = pixels.firstWhere((c) {
    final key = ((c.r * 255).round() >> 3) << 10 | ((c.g * 255).round() >> 3) << 5 | ((c.b * 255).round() >> 3);
    return key == top;
  });
  final readable = pixels.where((c) => contrastRatio(c, background) >= min).length / pixels.length;
  return (background: background, readable: readable);
}

EditableTextState _editable(WidgetTester t, Finder field) =>
    t.state<EditableTextState>(find.descendant(of: field, matching: find.byType(EditableText)));

/// Where the text of [field] is on screen, line by line (logical, global),
/// cut to what the field shows.
List<Rect> textLines(WidgetTester t, Finder field) {
  final re = _editable(t, field).renderEditable;
  final text = re.text?.toPlainText() ?? '';
  if (text.isEmpty) return const [];
  final clip = MatrixUtils.transformRect(re.getTransformTo(null), Offset.zero & re.size);
  final lines = <Rect>[];
  for (final b in re.getBoxesForSelection(TextSelection(baseOffset: 0, extentOffset: text.length))) {
    final r = MatrixUtils.transformRect(re.getTransformTo(null), b.toRect()).intersect(clip);
    if (r.width > 4 && r.height > 4) lines.add(r);
  }
  return lines;
}

/// The caret of [field] (logical, global).
Rect caret(WidgetTester t, Finder field) {
  final re = _editable(t, field).renderEditable;
  final pos = _editable(t, field).textEditingValue.selection.extent;
  return MatrixUtils.transformRect(re.getTransformTo(null), re.getLocalRectForCaret(pos));
}

/// Fails unless what was typed into [field] can be read on [shot]: some of
/// it is on screen, above the keyboard, and on every line shown the glyphs
/// stand out from the field (at least [min] contrast), and nothing is drawn
/// over the caret.
void expectTypedTextVisible(WidgetTester t, Shot shot, Finder field, {double min = 3.0, String? where}) {
  final at = where == null ? '' : ' ($where)';
  final screen = t.view.physicalSize / t.view.devicePixelRatio;
  final keyboardTop = screen.height - t.view.viewInsets.bottom / t.view.devicePixelRatio;
  final shown = Rect.fromLTRB(0, 0, screen.width, keyboardTop);

  final lines = [for (final r in textLines(t, field)) r.intersect(shown)].where((r) => r.width > 4 && r.height > 4).toList();
  expect(lines, isNotEmpty, reason: 'none of the typed text is on screen above the keyboard$at');

  for (final line in lines) {
    final ink = inkIn(shot, shot.toImage(line), min: min);
    expect(
      ink.readable,
      greaterThan(0.04),
      reason:
          'typed text$at at $line is not readable: only ${(ink.readable * 100).toStringAsFixed(1)}% of its pixels '
          'stand out from ${ink.background} (see build/test_screens)',
    );
  }

  final c = caret(t, field);
  expect(c.bottom, lessThanOrEqualTo(keyboardTop + 0.5), reason: 'the caret is under the keyboard$at: $c');
  expect(c.top, greaterThanOrEqualTo(0), reason: 'the caret is above the screen$at: $c');

  // Whatever takes a tap on the caret is what is drawn on top there: it must
  // be the field itself, not the round button, a bar or a sheet.
  final result = HitTestResult();
  WidgetsBinding.instance.hitTestInView(result, c.center, t.view.viewId);
  final re = _editable(t, field).renderEditable;
  final first = result.path.map((e) => e.target).whereType<RenderObject>().firstOrNull;
  var cur = first;
  var inside = false;
  while (cur != null) {
    if (identical(cur, re) || identical(cur, t.renderObject(field))) {
      inside = true;
      break;
    }
    cur = cur.parent;
  }
  expect(inside, isTrue, reason: 'something is drawn over the caret$at: ${first.runtimeType}');
}

/// Fails unless the text of [finder] (a Text) stands out from what is behind
/// it on [shot].
void expectLabelVisible(WidgetTester t, Shot shot, Finder finder, {double min = 3.0}) {
  final r = t.getRect(finder);
  final ink = inkIn(shot, shot.toImage(r), min: min);
  expect(ink.readable, greaterThan(0.04), reason: '"${(t.widget(finder) as Text).data}" at $r is not readable');
}
