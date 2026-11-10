/// 사업자등록번호 check (국세청 rule): the first nine digits weighted
/// 1 3 7 1 3 7 1 3 5, plus the tens of the ninth digit × 5; the tenth digit
/// brings the sum to a multiple of ten. Dashes and spaces are ignored.
bool isValidBusinessNumber(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  if (digits.length != 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  var sum = 0;
  for (var i = 0; i < 9; i++) {
    sum += (digits.codeUnitAt(i) - 48) * weights[i];
  }
  sum += (digits.codeUnitAt(8) - 48) * 5 ~/ 10;
  return (10 - sum % 10) % 10 == digits.codeUnitAt(9) - 48;
}
