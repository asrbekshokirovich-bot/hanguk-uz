import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/format/digit_mask.dart';

TextEditingValue _type(TextInputFormatter f, String text) => f.formatEditUpdate(
      TextEditingValue.empty,
      TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length)),
    );

void main() {
  test('Korean mobile number 3-4-4', () {
    final f = DigitGroupsFormatter.koreanMobile();
    expect(_type(f, '010').text, '010');
    expect(_type(f, '0101').text, '010-1');
    expect(_type(f, '01012345678').text, '010-1234-5678');
    expect(_type(f, '010-1234-5678').text, '010-1234-5678');
    expect(_type(f, '010123456789').text, '010-1234-5678', reason: 'stops at 11 digits');
    expect(_type(f, '+82 10 ab').text, '821-0');
  });

  test('business registration number 3-2-5', () {
    final f = DigitGroupsFormatter.businessNumber();
    expect(_type(f, '1234567890').text, '123-45-67890');
    expect(_type(f, '1234').text, '123-4');
  });

  test('caret stays after the same digit', () {
    final f = DigitGroupsFormatter.koreanMobile();
    final v = f.formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(text: '0101234', selection: TextSelection.collapsed(offset: 4)),
    );
    expect(v.text, '010-1234');
    expect(v.selection.baseOffset, 5); // after "010-1"
  });
}
