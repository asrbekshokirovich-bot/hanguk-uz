/// Line breaking as Chrome does it, where Flutter's ICU rules differ.
///
/// Chrome never breaks a line right after a slash that a letter or digit
/// follows («12 000 ₩/soat», «a/b»); ICU, which Flutter uses, does. An
/// invisible word joiner (U+2060) after such a slash keeps the two together
/// in Flutter too, so a sentence wraps where the prototype wraps it.
String keepSlashTogether(String text) => text.replaceAllMapped(_slashBeforeWord, (match) => '/⁠');

final _slashBeforeWord = RegExp(r'/(?=[\p{L}\p{N}])', unicode: true);

/// «Haeundae · 0,3 km»: the parts that have text, joined by a middle dot.
///
/// A business registered with only its number has no area or address yet;
/// the line then reads «0,3 km», not «· 0,3 km».
String dotJoin(Iterable<String> parts) => parts.where((p) => p.trim().isNotEmpty).join(' · ');
