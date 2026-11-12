import '../time/kst.dart';

/// Dates and durations as the worker app writes them, in its four
/// languages, always on the Korean clock.
///
///   uz  Bugun, 10-noyabr · 14:00–19:00 · 5 soat
///   ru  Сегодня, 10 ноября · 14:00–19:00 · 5 ч
///   en  Today, Nov 10 · 14:00–19:00 · 5 h
///   ko  오늘, 11월 10일 · 14:00–19:00 · 5시간
abstract final class HiDates {
  static const _monthsUz = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
  ];
  // Genitive, as Russian writes a date ("10 ноября").
  static const _monthsRu = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  static const _monthsRuNominative = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  static const _monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  static const _monthsEnShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  static const _monthsShortUz = [
    'yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
  ];
  static const _monthsShortRu = [
    'янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
  ];

  // Monday first (DateTime.weekday 1..7).
  static const _weekdaysUz = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
  static const _weekdaysRu = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  static const _weekdaysEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  static const _weekdaysKo = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
  static const _weekdaysShortKo = ['월', '화', '수', '목', '금', '토', '일'];

  static const _today = {'uz': 'Bugun', 'ru': 'Сегодня', 'en': 'Today', 'ko': '오늘'};
  static const _tomorrow = {'uz': 'Ertaga', 'ru': 'Завтра', 'en': 'Tomorrow', 'ko': '내일'};
  static const _yesterday = {'uz': 'Kecha', 'ru': 'Вчера', 'en': 'Yesterday', 'ko': '어제'};

  /// Days between the Korean calendar dates of [now] and [instant].
  static int dayOffset(DateTime instant, DateTime now) {
    final a = Kst.wallClock(instant);
    final b = Kst.wallClock(now);
    return DateTime.utc(a.year, a.month, a.day).difference(DateTime.utc(b.year, b.month, b.day)).inDays;
  }

  /// «Bugun», «Ertaga», «Kecha» or the weekday name.
  static String dayName(DateTime instant, DateTime now, String lang) {
    final offset = dayOffset(instant, now);
    if (offset == 0) return _today[lang] ?? _today['uz']!;
    if (offset == 1) return _tomorrow[lang] ?? _tomorrow['uz']!;
    if (offset == -1) return _yesterday[lang] ?? _yesterday['uz']!;
    return weekday(instant, lang);
  }

  static String weekday(DateTime instant, String lang) {
    final i = Kst.wallClock(instant).weekday - 1;
    return switch (lang) {
      'ru' => _weekdaysRu[i],
      'en' => _weekdaysEn[i],
      'ko' => _weekdaysKo[i],
      _ => _weekdaysUz[i],
    };
  }

  /// Korean short weekday (화) — employer app.
  static String weekdayShortKo(DateTime instant) => _weekdaysShortKo[Kst.wallClock(instant).weekday - 1];

  /// «10-noyabr» / «10 ноября» / «Nov 10» / «11월 10일».
  static String dayMonth(DateTime instant, String lang) {
    final w = Kst.wallClock(instant);
    return switch (lang) {
      'ru' => '${w.day} ${_monthsRu[w.month - 1]}',
      'en' => '${_monthsEnShort[w.month - 1]} ${w.day}',
      'ko' => '${w.month}월 ${w.day}일',
      _ => '${w.day}-${_monthsUz[w.month - 1]}',
    };
  }

  /// «Bugun, 10-noyabr» (A05).
  static String dayAndDate(DateTime instant, DateTime now, String lang) {
    final offset = dayOffset(instant, now);
    final name = offset.abs() <= 1 ? dayName(instant, now, lang) : weekday(instant, lang);
    return '$name, ${dayMonth(instant, lang)}';
  }

  /// «14:00–19:00».
  static String timeRange(DateTime start, DateTime end) => '${Kst.hm(start)}–${Kst.hm(end)}';

  /// «Noyabr 2026» (A09 month switch).
  static String monthYear(DateTime instant, String lang) {
    final w = Kst.wallClock(instant);
    return switch (lang) {
      'ru' => '${_monthsRuNominative[w.month - 1]} ${w.year}',
      'en' => '${_monthsEn[w.month - 1]} ${w.year}',
      'ko' => '${w.year}년 ${w.month}월',
      _ => '${_capitalize(_monthsUz[w.month - 1])} ${w.year}',
    };
  }

  /// Month name alone, for «Noyabr bo'yicha jami».
  static String monthName(DateTime instant, String lang) {
    final w = Kst.wallClock(instant);
    return switch (lang) {
      'ru' => _monthsRuNominative[w.month - 1],
      'en' => _monthsEn[w.month - 1],
      'ko' => '${w.month}월',
      _ => _capitalize(_monthsUz[w.month - 1]),
    };
  }

  /// Short month under a day number (A09: 10 / noy).
  static String monthShort(DateTime instant, String lang) {
    final w = Kst.wallClock(instant);
    return switch (lang) {
      'ru' => _monthsShortRu[w.month - 1],
      'en' => _monthsEnShort[w.month - 1].toLowerCase(),
      'ko' => '${w.month}월',
      _ => _monthsShortUz[w.month - 1],
    };
  }

  /// «5 soat», «4 soat 30 daq» / «5 ч» / «5 h» / «5시간».
  static String duration(int minutes, String lang) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    final (hu, mu) = switch (lang) {
      'ru' => ('ч', 'мин'),
      'en' => ('h', 'min'),
      'ko' => ('시간', '분'),
      _ => ('soat', 'daq'),
    };
    final sep = lang == 'ko' ? '' : ' ';
    if (m == 0) return '$h$sep$hu';
    if (h == 0) return '$m$sep$mu';
    return '$h$sep$hu $m$sep$mu';
  }

  /// «2 soat 40 daqiqa» / «2 ч 40 мин» / «2 h 40 min» / «2시간 40분» —
  /// how long until something (A05 «…dan keyin boshlanadi»).
  static String durationWords(int minutes, String lang) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    final (hu, mu) = switch (lang) {
      'ru' => ('ч', 'мин'),
      'en' => ('h', 'min'),
      'ko' => ('시간', '분'),
      _ => ('soat', 'daqiqa'),
    };
    final sep = lang == 'ko' ? '' : ' ';
    if (h == 0) return '$m$sep$mu';
    if (m == 0) return '$h$sep$hu';
    return '$h$sep$hu $m$sep$mu';
  }

  /// Time left or gone: «1 kun 5 soat», «2 soat 40 daq», «4 daq» — minutes
  /// are dropped once there is a whole day (A06, A07).
  static String countdown(int minutes, String lang) {
    final m = minutes.abs();
    final days = m ~/ (24 * 60);
    final hours = (m % (24 * 60)) ~/ 60;
    final mins = m % 60;
    final (du, hu, mu) = switch (lang) {
      'ru' => ('д', 'ч', 'мин'),
      'en' => ('d', 'h', 'min'),
      'ko' => ('일', '시간', '분'),
      _ => ('kun', 'soat', 'daq'),
    };
    final sep = lang == 'ko' ? '' : ' ';
    if (days > 0) return hours == 0 ? '$days$sep$du' : '$days$sep$du $hours$sep$hu';
    if (hours > 0) return mins == 0 ? '$hours$sep$hu' : '$hours$sep$hu $mins$sep$mu';
    return '$mins$sep$mu';
  }

  /// Worked time with two-digit minutes: «5 soat 00 daq» (A07, A09).
  static String durationHm(int minutes, String lang) {
    final h = minutes ~/ 60;
    final m = (minutes % 60).toString().padLeft(2, '0');
    return switch (lang) {
      'ru' => '$h ч $m мин',
      'en' => '$h h $m min',
      'ko' => '$h시간 $m분',
      _ => '$h soat $m daq',
    };
  }

  /// A running timer: «02:14:37».
  static String clock(Duration d) {
    final s = d.inSeconds < 0 ? 0 : d.inSeconds;
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(s ~/ 3600)}:${two(s % 3600 ~/ 60)}:${two(s % 60)}';
  }

  /// The weekday inside a sentence: «payshanba» / «четверг» / «Thursday» /
  /// «목요일» (A12).
  static String weekdayInSentence(DateTime instant, String lang) {
    final name = weekday(instant, lang);
    return lang == 'en' || lang == 'ko' ? name : name.toLowerCase();
  }

  /// «shanba, 14-noyabr» / «суббота, 14 ноября» / «Saturday, Nov 14» /
  /// «11월 14일 토요일» (A12).
  static String weekdayAndDate(DateTime instant, String lang) {
    final date = dayMonth(instant, lang);
    final day = weekdayInSentence(instant, lang);
    return lang == 'ko' ? '$date $day' : '$day, $date';
  }

  static const _todayLower = {'uz': 'bugun', 'ru': 'сегодня', 'en': 'today', 'ko': '오늘'};
  static const _tomorrowLower = {'uz': 'ertaga', 'ru': 'завтра', 'en': 'tomorrow', 'ko': '내일'};

  /// The day inside a sentence: «bugun», «ertaga», else the date
  /// (A05 «… sizni bugun 14:00 da kutadi»).
  static String dayInSentence(DateTime instant, DateTime now, String lang) {
    final offset = dayOffset(instant, now);
    if (offset == 0) return _todayLower[lang] ?? _todayLower['uz']!;
    if (offset == 1) return _tomorrowLower[lang] ?? _tomorrowLower['uz']!;
    final date = dayMonth(instant, lang);
    return lang == 'en' ? 'on $date' : date;
  }

  static String _capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

/// Distances: «1,2 km» (comma in uz/ru), «1.2 km» (en), «1.2km» (ko).
String formatKm(double km, String lang) {
  final value = km < 10 ? km.toStringAsFixed(1) : km.round().toString();
  final local = (lang == 'uz' || lang == 'ru') ? value.replaceAll('.', ',') : value;
  return switch (lang) {
    'ru' => '$local км',
    'ko' => '${local}km',
    _ => '$local km',
  };
}
