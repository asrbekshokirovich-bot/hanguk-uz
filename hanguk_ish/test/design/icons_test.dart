import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/design/icons.dart';

void main() {
  test('every prototype icon builds a path inside its 24×24 grid', () {
    final icons = <String, HiIconData>{
      'check': HiIcons.check,
      'smartphone': HiIcons.smartphone,
      'send': HiIcons.send,
      'chevronLeft': HiIcons.chevronLeft,
      'chevronRight': HiIcons.chevronRight,
      'chevronDown': HiIcons.chevronDown,
      'mapPin': HiIcons.mapPin,
      'mapPinOff': HiIcons.mapPinOff,
      'star': HiIcons.star,
      'bell': HiIcons.bell,
      'moon': HiIcons.moon,
      'wallet': HiIcons.wallet,
      'calendar': HiIcons.calendar,
      'clock': HiIcons.clock,
      'x': HiIcons.x,
      'plus': HiIcons.plus,
      'minus': HiIcons.minus,
      'search': HiIcons.search,
      'download': HiIcons.download,
      'house': HiIcons.house,
      'users': HiIcons.users,
    };
    icons.forEach((name, icon) {
      final bounds = icon.path.getBounds();
      // A straight line (minus) has zero height, so only require some extent.
      expect(bounds.width > 0 || bounds.height > 0, isTrue, reason: name);
      expect(const Rect.fromLTRB(-0.5, -0.5, 24.5, 24.5).contains(bounds.topLeft), isTrue, reason: '$name $bounds');
      expect(bounds.right <= 24.5 && bounds.bottom <= 24.5, isTrue, reason: '$name $bounds');
    });
  });

  test('the path of an icon is built once and reused', () {
    expect(identical(HiIcons.check.path, HiIcons.check.path), isTrue);
  });
}
