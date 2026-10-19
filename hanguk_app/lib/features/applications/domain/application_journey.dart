/// The Ariza tab (design 7b list, 8a detail): each university the student
/// applies to as eight "passport stamps", read through
/// `my_application_journey()` (migration 20261019190000).
///
/// Everything here is pure — the screens only draw what it decides — so the
/// rules can be tested without a widget tree.
library;

import '../presentation/widgets/process_tracker.dart';

/// The eight stamps, in order.
enum JourneyStamp { contract, documents, translation, submission, interview, admission, visa, flight }

/// The five-part bar on a list card: Hujjat (the first three stamps),
/// Topshirish, Suhbat, Qabul, Viza (visa and flight).
enum JourneyPhase { documents, submission, interview, admission, visa }

const Map<JourneyPhase, List<JourneyStamp>> kPhaseStamps = {
  JourneyPhase.documents: [JourneyStamp.contract, JourneyStamp.documents, JourneyStamp.translation],
  JourneyPhase.submission: [JourneyStamp.submission],
  JourneyPhase.interview: [JourneyStamp.interview],
  JourneyPhase.admission: [JourneyStamp.admission],
  JourneyPhase.visa: [JourneyStamp.visa, JourneyStamp.flight],
};

enum StampState { done, current, ahead, refused }

/// What a stamp's date line says: an exact day ("24-okt"), a deadline
/// ("28-okt gacha"), or a month the guideline or the estimate expects.
enum StampDateKind { day, until, month }

class StampView {
  const StampView(this.stamp, this.state, {this.date, this.dateKind = StampDateKind.day});

  final JourneyStamp stamp;
  final StampState state;
  final DateTime? date;
  final StampDateKind dateKind;
}

/// The student-wide facts (contract, documents, Study Plan).
class JourneyFacts {
  const JourneyFacts({
    this.contractDate,
    this.docsComplete = false,
    this.docsAt,
    this.translationsComplete = false,
    this.translationsAt,
    this.studyPlanReady = false,
  });

  factory JourneyFacts.fromJson(Map<String, dynamic> j) => JourneyFacts(
    contractDate: _date(j['contract_date']),
    docsComplete: j['docs_complete'] == true,
    docsAt: _date(j['docs_at']),
    translationsComplete: j['translations_complete'] == true,
    translationsAt: _date(j['translations_at']),
    studyPlanReady: j['study_plan_ready'] == true,
  );

  final DateTime? contractDate;
  final bool docsComplete;
  final DateTime? docsAt;
  final bool translationsComplete;
  final DateTime? translationsAt;

  /// The Study Plan reached the AI analysis (the builder's last step).
  final bool studyPlanReady;
}

/// One university the student applies to.
class JourneyUniversity {
  const JourneyUniversity({
    required this.institutionId,
    required this.status,
    this.nameEn,
    this.nameKo,
    this.nameKoShort,
    this.city,
    this.intakeYear,
    this.semester,
    this.degree,
    this.onlineSubmittedAt,
    this.offlineSentAt,
    this.interviewAt,
    this.result,
    this.resultAt,
    this.finalAt,
    this.visaStatus,
    this.visaStatusAt,
    this.onlineDeadline,
    this.interviewRound,
    this.resultRound,
    this.admissionLetterRound,
    this.visaRound,
  });

  factory JourneyUniversity.fromJson(Map<String, dynamic> j) => JourneyUniversity(
    institutionId: j['institution_id'] as String,
    status: (j['status'] as String?) ?? '',
    nameEn: j['name_en'] as String?,
    nameKo: j['name_ko'] as String?,
    nameKoShort: j['name_ko_short'] as String?,
    city: j['city'] as String?,
    intakeYear: (j['intake_year'] as num?)?.toInt(),
    semester: j['semester'] as String?,
    degree: j['degree'] as String?,
    onlineSubmittedAt: _date(j['online_submitted_at']),
    offlineSentAt: _date(j['offline_sent_at']),
    interviewAt: _date(j['interview_at']),
    result: j['result'] as String?,
    resultAt: _date(j['result_at']),
    finalAt: _date(j['final_at']),
    visaStatus: j['visa_status'] as String?,
    visaStatusAt: _date(j['visa_status_at']),
    onlineDeadline: _date(j['online_deadline']),
    interviewRound: _date(j['interview_round']),
    resultRound: _date(j['result_round']),
    admissionLetterRound: _date(j['admission_letter_round']),
    visaRound: _date(j['visa_round']),
  );

  final String institutionId;

  /// `applications.status` — the CRM keeps it in step with the columns below
  /// and it still carries the older statuses set by hand.
  final String status;
  final String? nameEn;
  final String? nameKo;
  final String? nameKoShort;
  final String? city;
  final int? intakeYear;

  /// 'bahor' | 'kuz'.
  final String? semester;

  /// 'bakalavr' | 'transfer' | 'magistratura' | 'doktorantura' | 'til_kursi'.
  final String? degree;
  final DateTime? onlineSubmittedAt;
  final DateTime? offlineSentAt;
  final DateTime? interviewAt;

  /// 'accepted' | 'rejected' | null while waiting.
  final String? result;
  final DateTime? resultAt;
  final DateTime? finalAt;

  /// 'process' | 'waiting' | 'received', on the final university only.
  final String? visaStatus;
  final DateTime? visaStatusAt;
  final DateTime? onlineDeadline;
  final DateTime? interviewRound;
  final DateTime? resultRound;
  final DateTime? admissionLetterRound;
  final DateTime? visaRound;

  String get name => (nameEn?.trim().isNotEmpty ?? false) ? nameEn!.trim() : (nameKo ?? '');

  bool get submitted => onlineSubmittedAt != null || offlineSentAt != null;
  bool get rejected => result == 'rejected' || status == 'rejected';
  bool get accepted => result == 'accepted';

  /// The hangul on the blue tile: "계명" for 계명대학교.
  String get tileText {
    final short = nameKoShort?.trim() ?? '';
    if (short.isNotEmpty) return short.length > 2 ? short.substring(0, 2) : short;
    var ko = (nameKo ?? '').trim().replaceAll(RegExp(r'\s+'), '');
    for (final suffix in ['대학교', '대학원', '대학']) {
      final i = ko.indexOf(suffix);
      if (i > 0) {
        ko = ko.substring(0, i);
        break;
      }
    }
    if (ko.isNotEmpty) return ko.length > 2 ? ko.substring(0, 2) : ko;
    final words = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty && w[0] == w[0].toUpperCase()).toList();
    return words.take(2).map((w) => w[0]).join().toUpperCase();
  }

  /// "Gyeongsan (Gyeongsangbuk-do)" → "Gyeongsan".
  String? get cityShort {
    final c = city?.replaceAll(RegExp(r'\s*\(.*\)'), '').trim();
    return (c == null || c.isEmpty) ? null : c;
  }

  /// D-4 for the language course, D-2 for a degree.
  String get visaType => degree == 'til_kursi' ? 'D-4' : 'D-2';

  /// When the student is expected to fly: ten days before the semester —
  /// 1 March for spring, 1 September for autumn. An estimate from the
  /// guideline's intake, null without one.
  DateTime? get departureEstimate {
    final y = intakeYear;
    if (y == null) return null;
    return switch (semester) {
      'bahor' => DateTime(y, 2, 20),
      'kuz' => DateTime(y, 8, 20),
      _ => null,
    };
  }
}

class ApplicationJourney {
  const ApplicationJourney({required this.facts, required this.universities});

  factory ApplicationJourney.fromJson(Map<String, dynamic> j) => ApplicationJourney(
    facts: JourneyFacts.fromJson(j),
    universities: [
      for (final u in (j['universities'] as List? ?? const []))
        JourneyUniversity.fromJson(Map<String, dynamic>.from(u as Map)),
    ],
  );

  final JourneyFacts facts;
  final List<JourneyUniversity> universities;
}

DateTime? _date(Object? v) {
  if (v is! String || v.isEmpty) return null;
  final d = DateTime.tryParse(v);
  return d?.isUtc ?? false ? d!.toLocal() : d;
}

DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

/// Whole days from [now] to [d] by the calendar (0 = today).
int daysUntil(DateTime d, DateTime now) => _day(d).difference(_day(now)).inDays;

/// Where one university stands, stamp by stamp.
class UniversityProgress {
  UniversityProgress._(this.university, this.stamps, this.needsStudyPlan);

  factory UniversityProgress.of(JourneyUniversity u, JourneyFacts f, DateTime now) {
    final step = ProcessTracker.stepFor(u.status);
    final completed = ProcessTracker.isCompleted(u.status) && u.visaStatus == null;
    final interviewPassed = u.interviewAt != null && daysUntil(u.interviewAt!, now) < 0;
    final visaReceived = u.visaStatus == 'received' || (completed && u.finalAt == null);

    // Furthest stamp each source of truth vouches for; every stamp before the
    // furthest one is done too, even when its own record is missing (a
    // student submitted without a contract date entered, say).
    final done = <JourneyStamp>{
      if (f.contractDate != null) JourneyStamp.contract,
      if (f.docsComplete) JourneyStamp.documents,
      if (f.translationsComplete) JourneyStamp.translation,
    };
    var furthest = -1;
    void reach(JourneyStamp s) => furthest = s.index > furthest ? s.index : furthest;
    if (step >= 2 || u.submitted) reach(JourneyStamp.translation);
    // Submitted counts as done once the university has moved it on: an
    // interview, an answer, or a later status.
    if (u.interviewAt != null || u.result != null || step >= 4) reach(JourneyStamp.submission);
    if (interviewPassed || u.result != null || (step >= 5 && step != 9) || u.finalAt != null) {
      reach(JourneyStamp.interview);
    }
    if (u.accepted || u.finalAt != null || (step >= 8 && !u.rejected)) reach(JourneyStamp.admission);
    if (visaReceived) reach(JourneyStamp.visa);
    if (completed && u.finalAt == null) reach(JourneyStamp.flight);
    for (final s in JourneyStamp.values) {
      if (s.index <= furthest) done.add(s);
    }

    final rejected = u.rejected && !u.accepted;
    final needsStudyPlan = !f.studyPlanReady && !u.submitted && step < 2 && !rejected;

    final departure = u.departureEstimate;
    final views = <StampView>[];
    var currentGiven = false;
    for (final s in JourneyStamp.values) {
      final isDone = done.contains(s);
      StampState state;
      if (isDone) {
        state = StampState.done;
      } else if (rejected) {
        state = s == JourneyStamp.admission ? StampState.refused : StampState.ahead;
      } else if (!currentGiven) {
        state = StampState.current;
        currentGiven = true;
      } else {
        state = StampState.ahead;
      }
      views.add(switch (s) {
        JourneyStamp.contract => StampView(s, state, date: f.contractDate),
        JourneyStamp.documents => StampView(s, state, date: f.docsAt),
        JourneyStamp.translation => StampView(s, state, date: f.translationsAt),
        JourneyStamp.submission =>
          u.onlineSubmittedAt != null || u.offlineSentAt != null
              ? StampView(s, state, date: u.onlineSubmittedAt ?? u.offlineSentAt)
              : StampView(s, state, date: u.onlineDeadline, dateKind: StampDateKind.until),
        JourneyStamp.interview =>
          u.interviewAt != null
              ? StampView(s, state, date: u.interviewAt)
              : StampView(s, state, date: u.interviewRound, dateKind: StampDateKind.month),
        JourneyStamp.admission =>
          u.resultAt != null && u.result != null
              ? StampView(s, state, date: u.resultAt)
              : StampView(s, state, date: u.admissionLetterRound ?? u.resultRound, dateKind: StampDateKind.month),
        JourneyStamp.visa =>
          u.visaStatus == 'received' && u.visaStatusAt != null
              ? StampView(s, state, date: u.visaStatusAt)
              : StampView(
                  s,
                  state,
                  date: u.visaRound ?? (departure == null ? null : DateTime(departure.year, departure.month - 2)),
                  dateKind: StampDateKind.month,
                ),
        JourneyStamp.flight => StampView(s, state, date: departure, dateKind: StampDateKind.month),
      });
    }
    return UniversityProgress._(u, views, needsStudyPlan);
  }

  final JourneyUniversity university;
  final List<StampView> stamps;

  /// "Sizdan kerak": the Study Plan is not written and the university is
  /// still waiting for the application.
  final bool needsStudyPlan;

  int get doneCount => stamps.where((s) => s.state == StampState.done).length;
  bool get hasCurrent => stamps.any((s) => s.state == StampState.current);
  JourneyStamp? get current => stamps.where((s) => s.state == StampState.current).map((s) => s.stamp).firstOrNull;
  bool get rejected => stamps.any((s) => s.state == StampState.refused);
  bool get finished => doneCount == JourneyStamp.values.length;

  StampView view(JourneyStamp s) => stamps[s.index];

  /// Share of the journey: a stamp in progress counts half.
  double get progress => (doneCount + (hasCurrent ? 0.5 : 0)) / JourneyStamp.values.length;

  StampState phaseState(JourneyPhase p) {
    final states = [for (final s in kPhaseStamps[p]!) view(s).state];
    if (states.every((s) => s == StampState.done)) return StampState.done;
    if (states.contains(StampState.current)) return StampState.current;
    if (states.contains(StampState.refused)) return StampState.refused;
    if (states.contains(StampState.done)) return StampState.current;
    return StampState.ahead;
  }

  JourneyPhase? get currentPhase {
    for (final p in JourneyPhase.values) {
      final s = phaseState(p);
      if (s == StampState.current || s == StampState.refused) return p;
    }
    return null;
  }

  /// An interview still ahead (today included).
  bool upcomingInterview(DateTime now) =>
      university.interviewAt != null && daysUntil(university.interviewAt!, now) >= 0 && university.result == null;
}

/// The header of the list: "3 universitet · 4 / 8 bosqich", the ring and the
/// nearest dated thing to do.
class JourneySummary {
  JourneySummary._(this.count, this.bestDone, this.percent, this.nearest);

  factory JourneySummary.of(List<UniversityProgress> all, DateTime now) {
    final live = all.where((p) => !p.rejected).toList();
    final pool = live.isEmpty ? all : live;
    final best = pool.isEmpty ? 0 : pool.map((p) => p.doneCount).reduce((a, b) => a > b ? a : b);
    final avg = pool.isEmpty ? 0.0 : pool.map((p) => p.progress).reduce((a, b) => a + b) / pool.length;
    NearestEvent? nearest;
    for (final p in live) {
      final u = p.university;
      final candidates = <NearestEvent>[
        if (p.upcomingInterview(now)) NearestEvent(JourneyStamp.interview, daysUntil(u.interviewAt!, now)),
        if (p.current == JourneyStamp.submission && !u.submitted && u.onlineDeadline != null &&
            daysUntil(u.onlineDeadline!, now) >= 0)
          NearestEvent(JourneyStamp.submission, daysUntil(u.onlineDeadline!, now)),
      ];
      for (final c in candidates) {
        if (nearest == null || c.days < nearest.days) nearest = c;
      }
    }
    return JourneySummary._(all.length, best, (avg * 100).round(), nearest);
  }

  final int count;

  /// Stamps of the furthest-along university.
  final int bestDone;

  /// Average share across the universities still in play.
  final int percent;
  final NearestEvent? nearest;
}

class NearestEvent {
  const NearestEvent(this.stamp, this.days);

  final JourneyStamp stamp;
  final int days;
}

/// The arrival airport for a university's city — the nearest one with
/// scheduled flights. Seoul and anything not listed land at Incheon.
String airportFor(String? city) {
  final c = (city ?? '').toLowerCase();
  bool has(List<String> keys) => keys.any(c.contains);
  if (has(['jeju', '제주'])) return 'CJU';
  if (has(['busan', 'pusan', '부산', 'gimhae', '김해', 'changwon', '창원', 'jinju', '진주', 'gyeongsangnam', 'gyeongnam', '경남'])) {
    return 'PUS';
  }
  if (has(['ulsan', '울산'])) return 'USN';
  if (has(['pohang', '포항'])) return 'KPO';
  if (has(['daegu', '대구', 'gyeongsan', '경산', 'gumi', '구미', 'andong', '안동', 'gyeongju', '경주', 'gyeongsangbuk', 'gyeongbuk', '경북'])) {
    return 'TAE';
  }
  if (has(['gwangju', '광주', 'mokpo', '목포', 'suncheon', '순천', 'muan', '무안', 'yeosu', '여수', 'jeollanam', 'jeonnam', '전남'])) {
    return 'KWJ';
  }
  if (has(['jeonju', '전주', 'iksan', '익산', 'gunsan', '군산', 'jeollabuk', 'jeonbuk', '전북'])) return 'KUV';
  if (has([
    'cheongju', '청주', 'asan', '아산', 'cheonan', '천안', 'daejeon', '대전', 'sejong', '세종', 'gongju', '공주',
    'chungcheong', 'chungbuk', 'chungnam', '충북', '충남', '충청', 'chungju', '충주',
  ])) {
    return 'CJJ';
  }
  return 'ICN';
}

/// The city an airport code is named after, as printed under the code.
const Map<String, String> kAirportCity = {
  'ICN': 'Incheon',
  'PUS': 'Busan',
  'USN': 'Ulsan',
  'KPO': 'Pohang',
  'TAE': 'Daegu',
  'KWJ': 'Gwangju',
  'KUV': 'Gunsan',
  'CJJ': 'Cheongju',
  'CJU': 'Jeju',
};
