import 'dart:math' as math;

import 'package:flutter/services.dart';

/// Formats digits into dash-separated groups while typing, e.g. a Korean
/// mobile number `010-1234-5678` (groups 3-4-4) or a business registration
/// number `123-45-67890` (3-2-5). Anything that is not a digit is dropped and
/// input stops at the total length of the groups.
class DigitGroupsFormatter extends TextInputFormatter {
  DigitGroupsFormatter(this.groups) : assert(groups.isNotEmpty);

  /// Korean mobile number: 010-0000-0000.
  factory DigitGroupsFormatter.koreanMobile() =>
      DigitGroupsFormatter(const [3, 4, 4]);

  /// 사업자등록번호: 000-00-00000.
  factory DigitGroupsFormatter.businessNumber() =>
      DigitGroupsFormatter(const [3, 2, 5]);

  final List<int> groups;

  int get maxDigits => groups.fold(0, (a, b) => a + b);

  /// [digits] (already digits only) with dashes between the groups.
  String format(String digits) {
    final out = StringBuffer();
    var start = 0;
    for (final size in groups) {
      if (start >= digits.length) break;
      final end = math.min(start + size, digits.length);
      if (start > 0) out.write('-');
      out.write(digits.substring(start, end));
      start = end;
    }
    return out.toString();
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length > maxDigits) digits = digits.substring(0, maxDigits);
    final text = format(digits);
    // Keep the caret after the same number of digits as before formatting.
    final caret =
        math.max(0, math.min(newValue.selection.end, newValue.text.length));
    final digitsBeforeCaret =
        newValue.text.substring(0, caret).replaceAll(RegExp(r'\D'), '').length;
    var offset = 0;
    var seen = 0;
    while (offset < text.length && seen < digitsBeforeCaret) {
      if (text.codeUnitAt(offset) != 0x2D) seen++;
      offset++;
    }
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: offset),
    );
  }
}

/// Groups digits by thousands with commas while typing (`10,500`), as the
/// employer app writes amounts. Non-digits are dropped; at most [maxDigits].
class ThousandsFormatter extends TextInputFormatter {
  ThousandsFormatter({this.maxDigits = 7});

  final int maxDigits;

  /// `10500` → `10,500`.
  static String format(String digits) {
    final out = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
      out.write(digits[i]);
    }
    return out.toString();
  }

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    digits = digits.replaceFirst(RegExp(r'^0+(?=\d)'), '');
    if (digits.length > maxDigits) digits = digits.substring(0, maxDigits);
    final text = format(digits);
    final caret = math.max(0, math.min(newValue.selection.end, newValue.text.length));
    final digitsAfterCaret = newValue.text.substring(caret).replaceAll(RegExp(r'\D'), '').length;
    var offset = text.length;
    var seen = 0;
    while (offset > 0 && seen < digitsAfterCaret) {
      offset--;
      if (text.codeUnitAt(offset) != 0x2C) seen++;
    }
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: offset));
  }
}
