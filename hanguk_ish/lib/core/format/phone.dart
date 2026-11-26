/// Korean mobile numbers: what people type (010-1234-5678) and what the SMS
/// service needs (+821012345678).
abstract final class KoreanPhone {
  // 010 numbers have eight digits after the prefix; old 011/016–019 seven or eight.
  static final _mobile = RegExp(r'^(010\d{8}|01[16789]\d{7,8})$');

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

/// A worker's sign-in number: a Korean mobile (+82) or an Uzbek one (+998)
/// (2026-11-26). The owners' app stays on [KoreanPhone].
abstract final class SignInPhone {
  // +998 and nine digits: the operator code (90, 91, 93, 33, 77, …) and the number.
  static final _uzbek = RegExp(r'^998[1-9]\d{8}$');

  /// `+821012345678` / `+998901234567`; null when it is neither.
  static String? toE164(String input) {
    final korean = KoreanPhone.toE164(input);
    if (korean != null) return korean;
    final digits = input.replaceAll(RegExp(r'\D'), '');
    return _uzbek.hasMatch(digits) ? '+$digits' : null;
  }

  /// `010-1234-5678` or `+998 90 123 45 67` for showing a number back.
  static String display(String number) {
    final e164 = toE164(number);
    if (e164 == null || !e164.startsWith('+998')) return KoreanPhone.display(number);
    final d = e164.substring(4);
    return '+998 ${d.substring(0, 2)} ${d.substring(2, 5)} ${d.substring(5, 7)} ${d.substring(7)}';
  }
}
