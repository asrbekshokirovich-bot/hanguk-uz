/// Routes of the full design's guest flow. `/guest` stays the shell's path,
/// so every link already pointing there lands on the new home (screen 03).
const String kDiscoverPath = '/guest';

/// Screen 04, the search.
const String kDiscoverSearchPath = '/guest/search';

/// Screen 05, the filter board.
const String kDiscoverFilterPath = '/guest/filter';

/// The filter board's results (screen 06's list).
const String kDiscoverResultsPath = '/guest/results';

/// Screen 11, "Koreaga keta olamanmi o'zi?". `extra` may carry the
/// institution id the student started from.
const String kAssessmentPath = '/assess';

/// Screen 12, the report with the lead form.
const String kAssessmentReportPath = '/assess/report';

/// The lead form: name and phone, opened from the report.
const String kAssessmentLeadPath = '/assess/lead';

/// Screen 13, "Yuborildi".
const String kAssessmentSentPath = '/assess/sent';

/// Screen 10, a university's page.
String universityPath(String institutionId) => '/university/$institutionId';

/// Screen 07, "Bu yoki bu?": the duel that fills the empty slots.
const String kDiscoverDuelPath = '/guest/duel';

/// Screen 08, "Ajoyib tanlov": the slotted universities and the big question.
const String kDiscoverChosenPath = '/guest/chosen';

/// Screen 09, side by side. `extra` is the list of institution ids.
const String kDiscoverComparePath = '/guest/compare';

/// Screen 16, the saved universities.
const String kDiscoverSavedPath = '/guest/saved';

/// The home with one of its tabs open (0 Universitetlar, 1 xarita,
/// 2 Tayyorgarlik), for the bottom nav of a screen pushed over it.
String discoverTabPath(int tab) => tab == 0 ? kDiscoverPath : '$kDiscoverPath?tab=$tab';
