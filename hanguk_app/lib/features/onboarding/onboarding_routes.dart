/// Paths of the "Viza imkoniyatim" flow (S01–S06). S01 is `/welcome`.
const String kQuizPath = '/quiz';
const String kQuizResultPath = '/quiz/result';
const String kTariffsPath = '/tariffs';

/// S06 for one tariff: `/tariffs/premium`, `/tariffs/no_risk`, …
String tariffDetailPath(String code) => '$kTariffsPath/$code';

/// Paths a visitor without a session may open.
bool isOnboardingPath(String loc) =>
    loc == kQuizPath || loc.startsWith('$kQuizPath/') || loc == kTariffsPath || loc.startsWith('$kTariffsPath/');
