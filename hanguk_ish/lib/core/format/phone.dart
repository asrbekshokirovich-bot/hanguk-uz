/// Korean mobile numbers: what people type (010-1234-5678) and what the SMS
/// service needs (+821012345678).
abstract final class KoreanPhone {
  static final _mobile = RegExp(r'^01[016789]\d{7,8}$');

  /// `+821012345678` for a Korean mobile number typed with or without dashes,
  /// spaces or the +82 prefix; null when it is not one.
  static String? toE164(String input) {
    var digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('82')) digits = '0${digits.substring(2)}';
    if (!_mobile.hasMatch(digits)) return null;
    return '+82${digits.substring(1)}';
  }

  /// `010-1234-5678` for showing a number back (T2 «… raqamiga yuborildi»).
  static String display(String number) {
    final e164 = toE164(number);
    if (e164 == null) return number;
    final local = '0${e164.substring(3)}';
    final middle = local.length == 11 ? 4 : 3;
    return '${local.substring(0, 3)}-${local.substring(3, 3 + middle)}-${local.substring(3 + middle)}';
  }
}
