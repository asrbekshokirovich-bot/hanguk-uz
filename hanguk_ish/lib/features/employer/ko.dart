import '../../core/money/won.dart';
import '../../core/time/kst.dart';

/// Texts of the employer app («Hanguk Ish 사장님»), which is Korean only.
/// Copied from the prototype screen by screen; texts for states the
/// prototype does not show (empty lists, errors, confirmations) follow its
/// wording.
abstract final class Ko {
  // BA0 — 로그인
  static const ownerBadge = '사장님용';
  static const loginSubtitle = '오늘 필요한 근무자, 바로 구하세요';
  static const phoneLabel = '휴대폰 번호';
  static const phonePlaceholder = '010-0000-0000';
  static const bizNoLabel = '사업자등록번호';
  static const bizNoPlaceholder = '000-00-00000';
  static const bizNoHint = '처음 한 번만 입력해요';
  static const start = '시작하기';
  static const termsPrefix = '시작하면 ';
  static const termsLink = '이용약관';
  static const termsSuffix = '에 동의하게 됩니다';
  static const loginIncomplete = '휴대폰 번호와 사업자등록번호를 모두 입력해 주세요';
  static const bizNoInvalid = '사업자등록번호를 확인해 주세요';

  // Sign-in code (T2; not in the prototype — drawn for approval)
  static const codeTopTitle = '로그인';
  static const codeTitle = '인증번호 입력';
  static String codeSentTo(String phone) => '$phone 번호로 보낸 6자리 숫자를 입력해 주세요.';
  static const codeLabel = '인증번호';
  static const codeConfirm = '확인';
  static const codeResend = '인증번호 다시 받기';
  static String codeResendIn(String time) => '$time 후 다시 받을 수 있어요';
  static const codeResent = '새 인증번호를 보냈어요.';

  // Menu
  static const navHome = '홈';
  static const navWorkers = '근무자';
  static const navCreate = '근무 올리기';
  static const navReport = '리포트';
  static const menuLabel = '사장님 메뉴';

  // BA1 — 홈
  static const todayTitle = '오늘의 근무';
  static String asOf(DateTime now) => '${monthDay(now)} (${weekdayShort(now)}) · ${Kst.hm(now)} 기준';
  static String bell(int unread) => unread > 0 ? '알림 $unread건' : '알림';
  static const storeSwitch = '매장 선택';
  static const attentionTitle = '확인이 필요해요';
  static const checkApplicants = '지원자 확인하기';
  static const checkShift = '근무 확인하기';
  static const todaySummary = '오늘 요약';
  static const attentionLabel = '확인 필요';
  static const statShifts = '오늘 근무';
  static const statConfirmed = '확정';
  static const statOpen = '남은 자리';
  static const statNoShow = '미출근';
  static const unitCount = '건';
  static const unitPeople = '명';
  static const today = '오늘';
  static const upcoming = '다가오는 근무';
  static const noShiftsToday = '오늘 올린 근무가 없어요';
  static const noShiftsTodayHint = '필요한 시간과 인원을 정해 근무를 올려 보세요';

  /// «마감 정리 보조 · 미출근 1명, 빈자리 1 (지원자 2명)».
  static String attention(String title, {required int noShows, required int open, required int waiting}) {
    final parts = <String>[
      if (noShows > 0) '미출근 $noShows명',
      if (open > 0) '빈자리 $open${waiting > 0 ? ' (지원자 $waiting명)' : ''}',
      if (open == 0 && waiting > 0) '지원자 $waiting명',
    ];
    return '$title · ${parts.join(', ')}';
  }

  /// «확정 3/4명 · 지원자 2».
  static String crewLine(int confirmed, int slots, int waiting) =>
      '확정 $confirmed/$slots명${waiting > 0 ? ' · 지원자 $waiting' : ''}';

  // Status chips
  static const stateDone = '완료';
  static const stateInProgress = '진행 중';
  static const stateUrgent = '긴급';
  static const stateScheduled = '예정';
  static const stateRecruiting = '모집 중';
  static const stateCancelled = '취소됨';
  static String urgentSlots(int open) => '긴급 $open자리';
  static String recruitingSlots(int open) => '모집 중 $open자리';

  // BA2 — 근무 올리기
  static const createTitle = '근무 올리기';
  static const editTitle = '근무 수정';
  static const close = '닫기';
  static const template = '템플릿';
  static const templateContent = '템플릿 내용';
  static const shiftContent = '근무 내용';
  static const shiftName = '근무명';
  static const edit = '수정';
  static const duties = '업무';
  static const dress = '복장';
  static const address = '주소';
  static const date = '날짜';
  static const tomorrow = '내일';
  static const otherDay = '다른 날';
  static const pickDate = '날짜 선택';
  static const time = '시간';
  static const startTime = '시작 시간';
  static const endTime = '종료 시간';
  static const wage = '시급';
  static const won = '원';
  static String minimumWageOk(int minimum) => '최저시급 ${Won.employer(minimum)} 이상';
  static String minimumWageLow(int minimum) => '최저시급 ${Won.employer(minimum)}보다 낮아요';
  static const headcount = '인원';
  static const fewer = '인원 줄이기';
  static const more = '인원 늘리기';
  static const autoConfirm = '자동 확정';
  static const autoConfirmHint = '지원하면 바로 확정돼요';
  static const post = '근무 올리기';
  static const save = '저장하기';
  static const posted = '근무를 올렸어요';
  static const saved = '근무를 수정했어요';
  static const templateSaved = '템플릿을 저장했어요';
  static const editTemplate = '템플릿 수정';
  static const cancel = '취소';
  static const timeLocked = '확정된 근무자가 있어 날짜와 시간은 바꿀 수 없어요';
  static String slotsLocked(int confirmed) => '이미 $confirmed명이 확정돼서 더 줄일 수 없어요';

  /// «3명 · 5시간 · 예상 인건비 » + «157,500원».
  static String costLead(int slots, int minutes) => '$slots명 · ${duration(minutes)} · 예상 인건비 ';

  /// «5시간», «4시간 30분», «30분».
  static String duration(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '$m분';
    return m == 0 ? '$h시간' : '$h시간 $m분';
  }

  static String people(int n) => '$n명';

  // BA3 — 근무 상세
  static const back = '뒤로';
  static String applicants(int n) => '지원자 $n명';
  static const decideYourself = '직접 확정해 주세요';
  static const reject = '거절';
  static const confirm = '확정';
  static String shiftWhen(DateTime start, DateTime end, DateTime now) =>
      '${dayWord(start, now)} ${Kst.hm(start)}–${Kst.hm(end)} · ${duration(end.difference(start).inMinutes)}';
  static String shiftTerms(int wage, int confirmed, int slots, bool auto) =>
      '시급 ${Won.employer(wage)} · 확정 $confirmed/$slots명 · 자동 확정 ${auto ? '켜짐' : '꺼짐'}';
  static String completedCount(int n) => '근무 $n회';
  static String topik(int level) => level > 0 ? 'TOPIK $level급' : 'TOPIK 없음';
  static const attendance = '출퇴근 현황';
  static const noCrew = '아직 확정된 근무자가 없어요';
  static String checkedInAt(DateTime at) => '출근 ${Kst.hm(at)}';
  static String checkedInOut(DateTime inAt, DateTime outAt) => '출근 ${Kst.hm(inAt)} · 퇴근 ${Kst.hm(outAt)}';
  static const notInYet = '아직 출근 전';
  static const atWork = '근무 중';
  static String late(int minutes) => '지각 $minutes분';
  static String missing(int minutes) => '미출근 · $minutes분';
  static const noShow = '미출근';
  static const beforeStart = '출근 전';
  static const leftWork = '퇴근';
  static const qrTitle = '출퇴근 QR';
  static const qrNote = '출근·퇴근 공용 · 이 근무에서만 사용';
  static const qrShare = 'QR 인쇄·공유';
  static String qrShareText(String business, String title, String when) => '$business · $title · $when 출퇴근 QR';
  static String confirmed(String name) => '$name님을 확정했어요';
  static String rejected(String name) => '$name님의 지원을 거절했어요';
  static const editShift = '근무 수정';
  static const cancelShift = '근무 취소';
  static const cancelShiftTitle = '근무를 취소할까요?';
  static const cancelShiftText = '확정된 근무자와 지원자에게 알림이 가요.';
  static const shiftCancelled = '근무를 취소했어요';

  // BA4 — 근무자
  static const workersTitle = '근무자';
  static const favorites = '즐겨찾기';
  static const recentWorkers = '최근 근무자';
  static const workersTabs = '근무자 목록';
  static const searchPlaceholder = '이름으로 검색';
  static const searchLabel = '근무자 검색';
  static String timesHere(int n, int topik) => '우리 매장 $n회 · ${Ko.topik(topik)}';
  static String unfavorite(String name) => '$name 즐겨찾기 해제';
  static String favorite(String name) => '$name 즐겨찾기 추가';
  static const requestAgain = '다시 요청';
  static String requested(String name) => '$name님에게 요청을 보냈어요';
  static const noFavorites = '즐겨찾기한 근무자가 없어요';
  static const noFavoritesHint = '최근 근무자에서 ★를 눌러 추가해 보세요';
  static const noWorkers = '아직 함께 일한 근무자가 없어요';
  static const noResults = '검색 결과가 없어요';

  // BA5 — 리포트
  static const reportTitle = '리포트';
  static const csv = 'CSV 다운로드';
  static const period = '기간';
  static const thisWeek = '이번 주';
  static const thisMonth = '이번 달';
  static const lastMonth = '지난달';
  static String periodSummary(String period) => '$period 요약';
  static String totalPaid(DateTime from, DateTime to) => '${range(from, to)} 총 지급액';
  static String reportCounts(int shifts, int minutes, int persons) =>
      '근무 $shifts건 · ${hours(minutes)} · 연인원 $persons명';
  static String paidCount(int n) => '지급 완료 · $n건';
  static String pendingCount(int n) => '지급 대기 · $n건';
  static const byShift = '근무별 내역';
  static String count(int n) => '$n건';
  static String rowCrew(int workers, int minutes) => '$workers명 · ${hours(minutes)}';
  static const paid = '지급 완료';
  static const pending = '지급 대기';
  static const markPaid = '지급 완료로 표시';
  static const markPending = '지급 대기로 되돌리기';
  static const noReport = '이 기간에 완료된 근무가 없어요';
  static const csvHeader = '날짜,요일,근무,인원,시간,금액(원),지급';
  static String csvTitle(String business, DateTime from, DateTime to) => '$business 리포트 ${range(from, to)}';

  /// «117시간», «4시간 30분».
  static String hours(int minutes) => duration(minutes);

  // Notifications
  static const notificationsTitle = '알림';
  static const yesterday = '어제';
  static const noNotifications = '새 알림이 없어요';
  static const notifNewApplicant = '새 지원자';
  static const notifCancelled = '근무 취소';
  static const notifNoShow = '미출근';
  static const notifMessage = '새 메시지';
  static String notifNewApplicantText(String worker, String shift) => '$worker님이 $shift에 지원했어요';
  static String notifCancelledText(String worker, String shift) => '$worker님이 $shift 근무를 취소했어요';
  static String notifNoShowText(String worker, String shift) => '$worker님이 $shift에 출근하지 않았어요';
  static String notifMessageText(String worker, String shift) => '$worker님이 메시지를 보냈어요 · $shift';

  // Errors
  static String error(Object error) => switch (_code(error)) {
        'SHIFT_FULL' => '자리가 모두 찼어요',
        'NOT_PENDING' => '이미 처리된 지원이에요',
        'SHIFT_ENDED' => '이미 끝난 근무예요',
        'SHIFT_STARTED' => '이미 시작한 근무는 취소할 수 없어요',
        'SHIFT_CLOSED' => '지금은 요청할 수 없는 근무예요',
        'IN_THE_PAST' => '이미 지난 시간이에요',
        'INVALID_TIME' => '종료 시간이 시작 시간보다 늦어야 해요',
        'TOO_LONG' => '근무는 16시간을 넘을 수 없어요',
        'WAGE_BELOW_MINIMUM' => '최저시급보다 낮아요',
        'NOT_FOUND' => '근무를 찾을 수 없어요',
        'HAS_CREW' => timeLocked,
        'SLOTS_BELOW_CREW' => '확정된 인원보다 적게 줄일 수 없어요',
        'BUSINESS_NOT_VERIFIED' => '사업자 확인이 끝나면 근무를 올릴 수 있어요',
        'INVALID' => '입력한 내용을 확인해 주세요',
        'NOT_AUTHENTICATED' => '다시 로그인해 주세요',
        'FORBIDDEN' => '이 사업장의 근무가 아니에요',
        'CODE_INVALID' => '인증번호가 틀렸거나 만료됐어요. 다시 입력해 주세요',
        'TOO_MANY_REQUESTS' => '시도가 너무 많아요. 잠시 후 다시 시도해 주세요',
        'PHONE_INVALID' => '휴대폰 번호를 확인해 주세요',
        'SMS_FAILED' => '문자를 보내지 못했어요. 번호를 확인해 주세요',
        'SIGN_IN_UNAVAILABLE' => '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요',
        'BIZ_NO_INVALID' => bizNoInvalid,
        'BIZ_NO_UNKNOWN' => '국세청에 등록되지 않은 사업자등록번호예요',
        'BIZ_NO_TAKEN' => '이미 다른 계정에 등록된 사업자등록번호예요',
        'BUSINESS_CLOSED' => '폐업한 사업자는 등록할 수 없어요',
        'OFFLINE' => '인터넷 연결을 확인해 주세요',
        _ => '다시 시도해 주세요',
      };

  static String _code(Object error) {
    final text = error.toString();
    final match = RegExp(r'\(([A-Z_]+)\)').firstMatch(text);
    if (match != null) return match.group(1)!;
    return text.contains('Offline') ? 'OFFLINE' : '';
  }

  // Dates (Korean clock)
  static const _weekdays = ['월', '화', '수', '목', '금', '토', '일'];

  /// «화» for [at] on the Korean clock.
  static String weekdayShort(DateTime at) => _weekdays[Kst.wallClock(at).weekday - 1];

  /// «화요일».
  static String weekdayLong(DateTime at) => '${weekdayShort(at)}요일';

  /// «11월 10일».
  static String monthDay(DateTime at) {
    final w = Kst.wallClock(at);
    return '${w.month}월 ${w.day}일';
  }

  /// «11.10».
  static String dotDate(DateTime at) {
    final w = Kst.wallClock(at);
    String two(int v) => v < 10 ? '0$v' : '$v';
    return '${two(w.month)}.${two(w.day)}';
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
    if (from.year == to.year && from.month == to.month) {
      return from.day == to.day ? '${from.month}월 ${from.day}일' : '${from.month}월 ${from.day}일–${to.day}일';
    }
    return '${from.month}월 ${from.day}일–${to.month}월 ${to.day}일';
  }
}
