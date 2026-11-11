import 'package:flutter/widgets.dart';

import '../../core/format/dates.dart';
import '../../core/money/won.dart';
import '../../core/time/kst.dart';
import '../../data/repositories/shift_repository.dart';
import '../../l10n/gen/worker_l10n.dart';
import '../worker/settings/app_language.dart';

/// Texts of the employer app («Hanguk Ish 사장님») in the app's four
/// languages (P43): Korean as in the prototype — copied from it screen by
/// screen; texts for states it does not show (empty lists, errors,
/// confirmations) follow its wording — and Uzbek, Russian and English, for
/// people who give one another work too. The messages are WorkerL10n's
/// `biz…`; the language is the app's ([appLanguageProvider]): [EmployerApp]
/// sets it with [use] and redraws every screen when it changes.
abstract final class Biz {
  static WorkerL10n _l = lookupWorkerL10n(const Locale('ko'));
  static String _lang = 'ko';

  /// The language the texts are in ('ko', 'uz', 'ru', 'en').
  static String get lang => _lang;

  static bool get _ko => _lang == 'ko';

  /// Speak [language] from now on.
  static void use(AppLanguage language) {
    _l = lookupWorkerL10n(language.locale);
    _lang = language.code;
  }

  static const phonePlaceholder = '010-0000-0000';
  static const bizNoPlaceholder = '000-00-00000';

  static String get ownerBadge => _l.bizOwnerBadge;
  static String get loginSubtitle => _l.bizLoginSubtitle;
  static String get phoneLabel => _l.bizPhoneLabel;
  static String get bizNoLabel => _l.bizBizNoLabel;
  static String get bizNoHint => _l.bizBizNoHint;
  static String get start => _l.bizStart;
  static String get termsPrefix => _l.bizTermsPrefix;
  static String get termsLink => _l.bizTermsLink;
  static String get termsSuffix => _l.bizTermsSuffix;
  static String get loginIncomplete => _l.bizLoginIncomplete;
  static String get bizNoInvalid => _l.bizBizNoInvalid;
  static String get codeTopTitle => _l.bizCodeTopTitle;
  static String get codeTitle => _l.bizCodeTitle;
  static String codeSentTo(String phone) => _l.bizCodeSentTo(phone);
  static String get codeLabel => _l.bizCodeLabel;
  static String get codeConfirm => _l.bizCodeConfirm;
  static String get codeResend => _l.bizCodeResend;
  static String codeResendIn(String time) => _l.bizCodeResendIn(time);
  static String get codeResent => _l.bizCodeResent;
  static String get navHome => _l.bizNavHome;
  static String get navWorkers => _l.bizNavWorkers;
  static String get navCreate => _l.bizNavCreate;
  static String get navReport => _l.bizNavReport;
  static String get menuLabel => _l.bizMenuLabel;
  static String get todayTitle => _l.bizTodayTitle;
  static String get storeSwitch => _l.bizStoreSwitch;
  static String get attentionTitle => _l.bizAttentionTitle;
  static String get checkApplicants => _l.bizCheckApplicants;
  static String get checkShift => _l.bizCheckShift;
  static String get todaySummary => _l.bizTodaySummary;
  static String get attentionLabel => _l.bizAttentionLabel;
  static String get statShifts => _l.bizStatShifts;
  static String get statConfirmed => _l.bizStatConfirmed;
  static String get statOpen => _l.bizStatOpen;
  static String get statNoShow => _l.bizStatNoShow;
  static String get unitCount => _l.bizUnitCount;
  static String get unitPeople => _l.bizUnitPeople;
  static String get today => _l.bizToday;
  static String get upcoming => _l.bizUpcoming;
  static String get noShiftsToday => _l.bizNoShiftsToday;
  static String get noShiftsTodayHint => _l.bizNoShiftsTodayHint;
  static String get stateDone => _l.bizStateDone;
  static String get stateInProgress => _l.bizStateInProgress;
  static String get stateUrgent => _l.bizStateUrgent;
  static String get stateScheduled => _l.bizStateScheduled;
  static String get stateRecruiting => _l.bizStateRecruiting;
  static String get stateCancelled => _l.bizStateCancelled;
  static String urgentSlots(int n) => _l.bizUrgentSlots(n);
  static String recruitingSlots(int n) => _l.bizRecruitingSlots(n);
  static String get createTitle => _l.bizCreateTitle;
  static String get editTitle => _l.bizEditTitle;
  static String get close => _l.bizClose;
  static String get template => _l.bizTemplate;
  static String get templateContent => _l.bizTemplateContent;
  static String get shiftContent => _l.bizShiftContent;
  static String get shiftName => _l.bizShiftName;
  static String get edit => _l.bizEdit;
  static String get duties => _l.bizDuties;
  static String get dress => _l.bizDress;
  static String get address => _l.bizAddress;
  static String get date => _l.bizDate;
  static String get tomorrow => _l.bizTomorrow;
  static String get otherDay => _l.bizOtherDay;
  static String get pickDate => _l.bizPickDate;
  static String get time => _l.bizTime;
  static String get startTime => _l.bizStartTime;
  static String get endTime => _l.bizEndTime;
  static String get wage => _l.bizWage;
  static String get won => _l.bizWon;
  static String get headcount => _l.bizHeadcount;
  static String get fewer => _l.bizFewer;
  static String get more => _l.bizMore;
  static String get autoConfirm => _l.bizAutoConfirm;
  static String get autoConfirmHint => _l.bizAutoConfirmHint;
  static String get post => _l.bizPost;
  static String get save => _l.bizSave;
  static String get posted => _l.bizPosted;
  static String get saved => _l.bizSaved;
  static String get templateSaved => _l.bizTemplateSaved;
  static String get editTemplate => _l.bizEditTemplate;
  static String get cancel => _l.bizCancel;
  static String get timeLocked => _l.bizTimeLocked;
  static String slotsLocked(int n) => _l.bizSlotsLocked(n);
  static String people(int n) => _l.bizPeople(n);
  static String get back => _l.bizBack;
  static String applicants(int n) => _l.bizApplicants(n);
  static String get decideYourself => _l.bizDecideYourself;
  static String get reject => _l.bizReject;
  static String get confirm => _l.bizConfirm;
  static String completedCount(int n) => _l.bizCompletedCount(n);
  static String get attendance => _l.bizAttendance;
  static String get noCrew => _l.bizNoCrew;
  static String get notInYet => _l.bizNotInYet;
  static String get atWork => _l.bizAtWork;
  static String late(int m) => _l.bizLate(m);
  static String missing(int m) => _l.bizMissing(m);
  static String get noShow => _l.bizNoShow;
  static String get beforeStart => _l.bizBeforeStart;
  static String get leftWork => _l.bizLeftWork;
  static String get qrTitle => _l.bizQrTitle;
  static String get qrNote => _l.bizQrNote;
  static String get qrShare => _l.bizQrShare;
  static String qrShareText(String business, String title, String when) => _l.bizQrShareText(business, title, when);
  static String confirmed(String name) => _l.bizConfirmed(name);
  static String rejected(String name) => _l.bizRejected(name);
  static String get editShift => _l.bizEditShift;
  static String get cancelShift => _l.bizCancelShift;
  static String get cancelShiftTitle => _l.bizCancelShiftTitle;
  static String get cancelShiftText => _l.bizCancelShiftText;
  static String get shiftCancelled => _l.bizShiftCancelled;
  static String get workersTitle => _l.bizWorkersTitle;
  static String get favorites => _l.bizFavorites;
  static String get recentWorkers => _l.bizRecentWorkers;
  static String get workersTabs => _l.bizWorkersTabs;
  static String get searchPlaceholder => _l.bizSearchPlaceholder;
  static String get searchLabel => _l.bizSearchLabel;
  static String unfavorite(String name) => _l.bizUnfavorite(name);
  static String favorite(String name) => _l.bizFavorite(name);
  static String get requestAgain => _l.bizRequestAgain;
  static String requested(String name) => _l.bizRequested(name);
  static String get noFavorites => _l.bizNoFavorites;
  static String get noFavoritesHint => _l.bizNoFavoritesHint;
  static String get noWorkers => _l.bizNoWorkers;
  static String get noResults => _l.bizNoResults;
  static String get reportTitle => _l.bizReportTitle;
  static String get csv => _l.bizCsv;
  static String get period => _l.bizPeriod;
  static String get thisWeek => _l.bizThisWeek;
  static String get thisMonth => _l.bizThisMonth;
  static String get lastMonth => _l.bizLastMonth;
  static String periodSummary(String period) => _l.bizPeriodSummary(period);
  static String paidCount(int n) => _l.bizPaidCount(n);
  static String pendingCount(int n) => _l.bizPendingCount(n);
  static String get byShift => _l.bizByShift;
  static String count(int n) => _l.bizCount(n);
  static String get paid => _l.bizPaid;
  static String get pending => _l.bizPending;
  static String get markPaid => _l.bizMarkPaid;
  static String get markPending => _l.bizMarkPending;
  static String get noReport => _l.bizNoReport;
  static String get csvHeader => _l.bizCsvHeader;
  static String get reviewPendingTitle => _l.bizReviewPendingTitle;
  static String get reviewPendingText => _l.bizReviewPendingText;
  static String get reviewRejectedTitle => _l.bizReviewRejectedTitle;
  static String get reviewRejectedText => _l.bizReviewRejectedText;
  static String get notificationsTitle => _l.bizNotificationsTitle;
  static String get yesterday => _l.bizYesterday;
  static String get noNotifications => _l.bizNoNotifications;
  static String get notifNewApplicant => _l.bizNotifNewApplicant;
  static String get notifCancelled => _l.bizNotifCancelled;
  static String get notifNoShow => _l.bizNotifNoShow;
  static String get notifMessage => _l.bizNotifMessage;
  static String notifNewApplicantText(String worker, String shift) => _l.bizNotifNewApplicantText(worker, shift);
  static String get notifAutoConfirmed => _l.bizNotifAutoConfirmed;
  static String notifAutoConfirmedText(String worker, String shift) => _l.bizNotifAutoConfirmedText(worker, shift);
  static String notifCancelledText(String worker, String shift) => _l.bizNotifCancelledText(worker, shift);
  static String notifNoShowText(String worker, String shift) => _l.bizNotifNoShowText(worker, shift);
  static String notifMessageText(String worker, String shift) => _l.bizNotifMessageText(worker, shift);
  static String get offlineTitle => _l.bizOfflineTitle;
  static String get offlineText => _l.bizOfflineText;
  static String get loadFailed => _l.bizLoadFailed;
  static String get retry => _l.bizRetry;
  static String get shiftNotFound => _l.bizShiftNotFound;
  static String get language => _l.bizLanguage;

  // ---------------------------------------------------------------------
  // Built from pieces
  // ---------------------------------------------------------------------

  /// «11월 10일 (화) · 11:20 기준».
  static String asOf(DateTime now) => _l.bizAsOf('${monthDay(now)} (${weekdayShort(now)})', Kst.hm(now));

  /// «알림 2건» / «알림».
  static String bell(int unread) => _l.bizBell(unread);

  /// «마감 정리 보조 · 미출근 1명, 빈자리 1 (지원자 2명)».
  static String attention(String title, {required int noShows, required int open, required int waiting}) {
    final parts = <String>[
      if (noShows > 0) _l.bizAttnNoShows(noShows),
      if (open > 0) waiting > 0 ? _l.bizAttnOpenWaiting(open, waiting) : _l.bizAttnOpen(open),
      if (open == 0 && waiting > 0) _l.bizAttnWaiting(waiting),
    ];
    return '$title · ${parts.join(', ')}';
  }

  /// «확정 3/4명 · 지원자 2».
  static String crewLine(int confirmed, int slots, int waiting) =>
      '${_l.bizCrew(confirmed, slots)}${waiting > 0 ? _l.bizCrewWaiting(waiting) : ''}';

  /// A unit after a number: «3명» in Korean, «3 kishi» / «1 чел.» in the
  /// others (a space before it); an empty unit stays empty.
  static String unitAfter(String unit) => unit.isEmpty || _ko ? unit : ' $unit';

  /// BA2's headcount box: «3명», «3 kishi», «3 чел.», «3».
  static String headcount(int n) => _l.bizHeadcountValue(n);

  /// «10,500원» (Korean), «10,500 won» / «10,500 вон» / «10,500 KRW».
  static String money(int amount) => _ko ? Won.employer(amount) : '${Won.employerDigits(amount)} $won';

  static String minimumWageOk(int minimum) => _l.bizMinimumWageOk(money(minimum));

  static String minimumWageLow(int minimum) => _l.bizMinimumWageLow(money(minimum));

  /// «3명 · 5시간 · 예상 인건비 » + «157,500원».
  static String costLead(int slots, int minutes) => _l.bizCostLead(people(slots), duration(minutes));

  /// «5시간», «4시간 30분», «30분».
  static String duration(int minutes) {
    if (!_ko) return HiDates.duration(minutes, _lang);
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '$m분';
    return m == 0 ? '$h시간' : '$h시간 $m분';
  }

  /// «117시간», «4시간 30분».
  static String hours(int minutes) => duration(minutes);

  static String shiftWhen(DateTime start, DateTime end, DateTime now) =>
      '${dayWord(start, now)} ${Kst.hm(start)}–${Kst.hm(end)} · ${duration(end.difference(start).inMinutes)}';

  static String shiftTerms(int wage, int confirmed, int slots, bool auto) =>
      _l.bizShiftTerms(money(wage), confirmed, slots, auto ? _l.bizOn : _l.bizOff);

  static String topik(int level) => level > 0 ? _l.bizTopik(level) : _l.bizTopikNone;

  static String checkedInAt(DateTime at) => _l.bizCheckedInAt(Kst.hm(at));

  static String checkedInOut(DateTime inAt, DateTime outAt) => _l.bizCheckedInOut(Kst.hm(inAt), Kst.hm(outAt));

  static String timesHere(int n, int topikLevel) => _l.bizTimesHere(n, topik(topikLevel));

  static String totalPaid(DateTime from, DateTime to) => _l.bizTotalPaid(range(from, to));

  static String reportCounts(int shifts, int minutes, int persons) =>
      _l.bizReportCounts(shifts, hours(minutes), persons);

  /// «2명 · 9시간».
  static String rowCrew(int workers, int minutes) => '${people(workers)} · ${hours(minutes)}';

  static String csvTitle(String business, DateTime from, DateTime to) => _l.bizCsvTitle(business, range(from, to));

  /// «20:15 기준» (BA3 출퇴근 현황).
  static String asOfTime(DateTime now) => _l.bizAsOfTime(Kst.hm(now));

  static const _spokenKo = {
    'uz': '우즈베크어', 'ru': '러시아어', 'en': '영어', 'ko': '한국어', 'kk': '카자흐어', 'ky': '키르기스어',
    'tg': '타지크어', 'tr': '튀르키예어', 'vi': '베트남어', 'mn': '몽골어', 'zh': '중국어', 'ja': '일본어',
  };
  static const _spokenMore = {
    'uz': {'tr': 'Turkcha', 'vi': 'Vyetnamcha', 'mn': "Mo'g'ulcha", 'zh': 'Xitoycha', 'ja': 'Yaponcha'},
    'ru': {'tr': 'Турецкий', 'vi': 'Вьетнамский', 'mn': 'Монгольский', 'zh': 'Китайский', 'ja': 'Японский'},
    'en': {'tr': 'Turkish', 'vi': 'Vietnamese', 'mn': 'Mongolian', 'zh': 'Chinese', 'ja': 'Japanese'},
  };

  /// A worker's language by its code: «우즈베크어» / «O'zbekcha» / «Узбекский» / «Uzbek».
  static String spokenLanguage(String code) {
    if (_ko) return _spokenKo[code] ?? code;
    return switch (code) {
      'uz' => _l.langUzbek,
      'ru' => _l.langRussian,
      'en' => _l.langEnglish,
      'ko' => _l.langKorean,
      'kk' => _l.langKazakh,
      'ky' => _l.langKyrgyz,
      'tg' => _l.langTajik,
      _ => _spokenMore[_lang]?[code] ?? code,
    };
  }

  // ---------------------------------------------------------------------
  // Loading and errors
  // ---------------------------------------------------------------------

  /// Whether [error] is a lost connection.
  static bool isOffline(Object error) => error is OfflineException;

  static String error(Object error) => switch (_code(error)) {
        'SHIFT_FULL' => _l.bizErrShiftFull,
        'NOT_PENDING' => _l.bizErrNotPending,
        'SHIFT_ENDED' => _l.bizErrShiftEnded,
        'SHIFT_STARTED' => _l.bizErrShiftStarted,
        'SHIFT_CLOSED' => _l.bizErrShiftClosed,
        'IN_THE_PAST' => _l.bizErrInThePast,
        'INVALID_TIME' => _l.bizErrInvalidTime,
        'TOO_LONG' => _l.bizErrTooLong,
        'WAGE_BELOW_MINIMUM' => _l.bizErrWageBelowMinimum,
        'NOT_FOUND' => shiftNotFound,
        'HAS_CREW' => timeLocked,
        'SLOTS_BELOW_CREW' => _l.bizErrSlotsBelowCrew,
        'BUSINESS_NOT_VERIFIED' => _l.bizErrBusinessNotVerified,
        'INVALID' => _l.bizErrInvalid,
        'NOT_AUTHENTICATED' => _l.bizErrNotAuthenticated,
        'FORBIDDEN' => _l.bizErrForbidden,
        'CODE_INVALID' => _l.bizErrCodeInvalid,
        'TOO_MANY_REQUESTS' => _l.bizErrTooManyRequests,
        'PHONE_INVALID' => _l.bizErrPhoneInvalid,
        'SMS_FAILED' => _l.bizErrSmsFailed,
        'SIGN_IN_UNAVAILABLE' => _l.bizErrSignInUnavailable,
        'BIZ_NO_INVALID' => bizNoInvalid,
        'BIZ_NO_UNKNOWN' => _l.bizErrBizNoUnknown,
        'BIZ_NO_TAKEN' => _l.bizErrBizNoTaken,
        'BUSINESS_CLOSED' => _l.bizErrBusinessClosed,
        'OFFLINE' => _l.bizErrOffline,
        _ => _l.bizErrOther,
      };

  static String _code(Object error) {
    final text = error.toString();
    final match = RegExp(r'\(([A-Z_]+)\)').firstMatch(text);
    if (match != null) return match.group(1)!;
    return error is OfflineException ? 'OFFLINE' : '';
  }

  // ---------------------------------------------------------------------
  // Dates (Korean clock)
  // ---------------------------------------------------------------------

  static const _weekdays = {
    'ko': ['월', '화', '수', '목', '금', '토', '일'],
    'uz': ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
    'ru': ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
    'en': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  };
  static const _months = {
    'uz': ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
    'ru': ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    'en': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };

  /// «화» / «Se» / «вт» / «Tue» for [at] on the Korean clock.
  static String weekdayShort(DateTime at) => (_weekdays[_lang] ?? _weekdays['ko']!)[Kst.wallClock(at).weekday - 1];

  /// «화요일» / «Seshanba» / «Вторник» / «Tuesday».
  static String weekdayLong(DateTime at) => _ko ? '${weekdayShort(at)}요일' : HiDates.weekday(at, _lang);

  /// The weekday under a date in a narrow column (BA5): «화요일» in Korean,
  /// as in the prototype; «Se» / «Вт» / «Tue» in the others.
  static String weekdayUnderDate(DateTime at) {
    if (_ko) return weekdayLong(at);
    final short = weekdayShort(at);
    return short[0].toUpperCase() + short.substring(1);
  }

  /// «11월 10일» / «10-noyabr» / «10 ноября» / «Nov 10».
  static String monthDay(DateTime at) {
    final w = Kst.wallClock(at);
    return _date(w.month, w.day);
  }

  static String _date(int month, int day) => switch (_lang) {
        'uz' => '$day-${_months['uz']![month - 1]}',
        'ru' => '$day ${_months['ru']![month - 1]}',
        'en' => '${_months['en']![month - 1]} $day',
        _ => '$month월 $day일',
      };

  /// «11.10» (Korean, month first), «10.11» (uz, ru), «11/10» (en).
  static String dotDate(DateTime at) {
    final w = Kst.wallClock(at);
    String two(int v) => v < 10 ? '0$v' : '$v';
    return switch (_lang) {
      'uz' || 'ru' => '${two(w.day)}.${two(w.month)}',
      'en' => '${two(w.month)}/${two(w.day)}',
      _ => '${two(w.month)}.${two(w.day)}',
    };
  }

  /// «오늘», «내일», «어제» or «11월 12일 (목)».
  static String dayWord(DateTime at, DateTime now) {
    final a = Kst.wallClock(at);
    final n = Kst.wallClock(now);
    final days = DateTime.utc(a.year, a.month, a.day).difference(DateTime.utc(n.year, n.month, n.day)).inDays;
    return switch (days) {
      0 => today,
      1 => tomorrow,
      -1 => yesterday,
      _ => '${monthDay(at)} (${weekdayShort(at)})',
    };
  }

  /// «11월 1일–10일», «10월 27일–11월 2일» — [from] and [to] are Korean
  /// calendar dates (their fields read like the Korean date).
  static String range(DateTime from, DateTime to) {
    final sameMonth = from.year == to.year && from.month == to.month;
    if (sameMonth && from.day == to.day) return _date(from.month, from.day);
    return switch (_lang) {
      'uz' when sameMonth => '${from.day}–${to.day}-${_months['uz']![from.month - 1]}',
      'ru' when sameMonth => '${from.day}–${to.day} ${_months['ru']![from.month - 1]}',
      'en' when sameMonth => '${_months['en']![from.month - 1]} ${from.day}–${to.day}',
      'uz' || 'ru' || 'en' => '${_date(from.month, from.day)} – ${_date(to.month, to.day)}',
      _ when sameMonth => '${from.month}월 ${from.day}일–${to.day}일',
      _ => '${from.month}월 ${from.day}일–${to.month}월 ${to.day}일',
    };
  }
}
