// Reading the colours a text field actually paints, so a test can fail when
// its text would be invisible against what is behind it.
//
// The bug this guards against has bitten twice: a field whose text colour
// and background colour are both dark (the Study Plan box after the page
// turned dark blue in #432), and a white field left without a text style, so
// it took the app theme's white body text (the "change university" sheet).
// Both looked fine in code review; only the painted colours give them away.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// WCAG 2.1 contrast ratio between two colours: 1.0 (identical) to 21.0.
/// Body text needs 4.5, large text and non-text marks (a caret) need 3.0.
double contrastRatio(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/// The colour painted behind [field]'s text: its own fill when the effective
/// decoration is filled, then every ancestor surface (a decorated box, a
/// coloured box, a Material) until an opaque one, blended bottom-up so a
/// translucent fill over the page is judged as the colour the eye sees.
///
/// Returns null when nothing behind the field paints a colour.
Color? backgroundBehind(WidgetTester tester, Finder field) {
  final element = tester.element(field);
  final layers = <Color>[];

  final textField = tester.widget(field);
  if (textField is TextField) {
    final decoration = (textField.decoration ?? const InputDecoration())
        .applyDefaults(Theme.of(element).inputDecorationTheme);
    final fill = decoration.fillColor;
    if (decoration.filled == true && fill != null && fill.a > 0) layers.add(fill);
  }

  if (layers.isEmpty || layers.last.a < 1) {
    element.visitAncestorElements((ancestor) {
      final w = ancestor.widget;
      Color? c;
      if (w is DecoratedBox && w.decoration is BoxDecoration) {
        c = (w.decoration as BoxDecoration).color;
      } else if (w is ColoredBox) {
        c = w.color;
      } else if (w is Material && w.type != MaterialType.transparency) {
        c = w.color;
      }
      if (c != null && c.a > 0) layers.add(c);
      return layers.isEmpty || layers.last.a < 1;
    });
  }

  if (layers.isEmpty) return null;
  var painted = layers.last;
  for (final c in layers.reversed.skip(1)) {
    painted = Color.alphaBlend(c, painted);
  }
  return painted;
}

/// Fails unless the text typed into [field] (a TextField finder) is readable
/// against what is painted behind it: [min] contrast for the text, 3.0 for the
/// caret.
void expectReadableTextField(WidgetTester tester, Finder field, {double min = 4.5}) {
  final editable = tester.widget<EditableText>(
    find.descendant(of: field, matching: find.byType(EditableText)),
  );
  final background = backgroundBehind(tester, field);
  expect(background, isNotNull, reason: 'nothing paints a colour behind the field');

  final text = editable.style.color!;
  final ratio = contrastRatio(text, background!);
  expect(
    ratio,
    greaterThanOrEqualTo(min),
    reason: 'text $text on $background: contrast ${ratio.toStringAsFixed(2)} (need $min)',
  );

  final caret = contrastRatio(editable.cursorColor, background);
  expect(
    caret,
    greaterThanOrEqualTo(3.0),
    reason: 'caret ${editable.cursorColor} on $background: contrast ${caret.toStringAsFixed(2)}',
  );
}
