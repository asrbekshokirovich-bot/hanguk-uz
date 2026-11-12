/// Korean won amounts as the two apps print them.
///
/// The prototype groups thousands with a space in the worker app
/// (`10 500 ₩`) and with a comma in the Korean employer app (`10,500원`).
/// The worker app uses NO-BREAK SPACE (U+00A0) so an amount never wraps
/// across two lines.
abstract final class Won {
  static const _nbsp = ' ';

  /// `10 500 ₩` (worker app).
  static String worker(int amount) => '${group(amount, _nbsp)}$_nbsp₩';

  /// `10 500` without the sign (worker app, when ₩ is drawn separately).
  static String workerDigits(int amount) => group(amount, _nbsp);

  /// `10,500원` (employer app).
  static String employer(int amount) => '${group(amount, ',')}원';

  /// `10,500` without the unit (employer app).
  static String employerDigits(int amount) => group(amount, ',');

  /// Digits of [amount] in groups of three joined by [separator].
  static String group(int amount, String separator) {
    final negative = amount < 0;
    final digits = (negative ? -amount : amount).toString();
    final out = StringBuffer(negative ? '-' : '');
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) out.write(separator);
      out.write(digits[i]);
    }
    return out.toString();
  }
}

/// Pay arithmetic shared by both apps and the backend tests.
abstract final class Pay {
  /// Pay for [minutes] of work at [hourlyWon]: whole won, fractions of a won
  /// dropped (원 미만 절사).
  static int forMinutes(int hourlyWon, int minutes) {
    if (hourlyWon <= 0 || minutes <= 0) return 0;
    return (hourlyWon * minutes) ~/ 60;
  }
}
