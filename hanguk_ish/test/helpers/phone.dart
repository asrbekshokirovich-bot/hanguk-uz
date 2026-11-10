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
