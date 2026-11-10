/// Sample shifts for the app's demo mode (no backend configured) and for the
/// screen tests. They reproduce the prototype's example data (Dalbit Kafe
/// 14:00–19:00, 10 500 ₩ …) and are never shown when a backend is set up.
library;

import '../../core/money/won.dart';
import '../../core/time/kst.dart';
import '../models/account.dart';
import '../models/business.dart';
import '../models/my_shift.dart';
import '../models/shift.dart';
import '../repositories/shift_repository.dart';

/// The moment the prototype's worker screens are drawn at: Tuesday
/// 10 November 2026, 11:20 in Seoul (2 h 40 min before Dalbit Kafe's 14:00).
final prototypeNow = Kst.instantOf(2026, 11, 10, 11, 20);

/// Unread notifications in the demo (the bell's dot on A03 and A04).
const demoUnreadNotifications = 2;

// Business positions are placed around the demo location (Sinchon) so that
// the stylised map (A04) draws their pins where the prototype has them.

/// Dalbit Kafe (달빛카페 신촌점): the business of both prototypes.
const demoDalbit = Business(
  id: 'demo-dalbit',
  name: '달빛카페 신촌점',
  names: {'uz': 'Dalbit Kafe', 'ru': 'Dalbit Kafe', 'en': 'Dalbit Cafe', 'ko': '달빛카페'},
  area: '신촌',
  areas: {'uz': 'Sinchon', 'ru': 'Синчхон', 'en': 'Sinchon', 'ko': '신촌'},
  category: BusinessCategory.cafe,
  address: '마포구 신촌로12길 15',
  addresses: {
    'uz': 'Mapo-gu, Sinchon-ro 12-gil',
    'ru': 'Мапхо-гу, Синчхон-ро 12-гиль',
    'en': 'Sinchon-ro 12-gil, Mapo-gu',
    'ko': '마포구 신촌로12길 15',
  },
  addressDetail: '2층',
  addressDetails: {'uz': '2-qavat', 'ru': '2 этаж', 'en': '2F', 'ko': '2층'},
  lat: 37.55798,
  lng: 126.950147,
  logoIcon: 'moon',
  rating: 4.8,
  ratingCount: 41,
  completedShifts: 126,
);

const _ttukbaegi = Business(
  id: 'demo-ttukbaegi',
  name: '뚝배기식당 마포점',
  names: {'uz': 'Ttukbaegi Sikdang', 'ru': 'Ttukbaegi Sikdang', 'en': 'Ttukbaegi Sikdang', 'ko': '뚝배기식당'},
  area: '마포',
  areas: {'uz': 'Mapo', 'ru': 'Мапхо', 'en': 'Mapo', 'ko': '마포'},
  category: BusinessCategory.restaurant,
  address: '마포구 도화동',
  addresses: {'uz': 'Mapo-gu, Dohwa-dong', 'ru': 'Мапхо-гу, Тохва-дон', 'en': 'Dohwa-dong, Mapo-gu', 'ko': '마포구 도화동'},
  lat: 37.564883,
  lng: 126.932637,
  rating: 4.6,
  ratingCount: 18,
  completedShifts: 64,
);

const _bomMart = Business(
  id: 'demo-bommart',
  name: '봄마트 홍대점',
  names: {'uz': 'Bom Mart', 'ru': 'Bom Mart', 'en': 'Bom Mart', 'ko': '봄마트'},
  area: '홍대',
  areas: {'uz': 'Hongdae', 'ru': 'Хондэ', 'en': 'Hongdae', 'ko': '홍대'},
  category: BusinessCategory.retail,
  address: '마포구 양화로 160',
  addresses: {'uz': 'Mapo-gu, Yanghwa-ro 160', 'ru': 'Мапхо-гу, Янхва-ро 160', 'en': 'Yanghwa-ro 160, Mapo-gu', 'ko': '마포구 양화로 160'},
  lat: 37.5559,
  lng: 126.912944,
  rating: 4.7,
  ratingCount: 22,
  completedShifts: 80,
);

const _sangam = Business(
  id: 'demo-sangam',
  name: '상암물류센터',
  names: {'uz': 'Sangam Logistika', 'ru': 'Sangam Logistics', 'en': 'Sangam Logistics', 'ko': '상암물류'},
  area: '상암',
  areas: {'uz': 'Sangam', 'ru': 'Санам', 'en': 'Sangam', 'ko': '상암'},
  category: BusinessCategory.logistics,
  address: '마포구 상암동',
  addresses: {'uz': 'Mapo-gu, Sangam-dong', 'ru': 'Мапхо-гу, Санам-дон', 'en': 'Sangam-dong, Mapo-gu', 'ko': '마포구 상암동'},
  lat: 37.567342,
  lng: 126.95697,
  rating: 4.5,
  ratingCount: 12,
  completedShifts: 51,
);

const _nanum = Business(
  id: 'demo-nanum',
  name: '나눔이벤트',
  names: {'uz': 'Nanum Tadbirlar', 'ru': 'Nanum Events', 'en': 'Nanum Events', 'ko': '나눔이벤트'},
  area: '합정',
  areas: {'uz': 'Hapjeong', 'ru': 'Хапчжон', 'en': 'Hapjeong', 'ko': '합정'},
  category: BusinessCategory.event,
  address: '마포구 합정동',
  addresses: {'uz': 'Mapo-gu, Hapjeong-dong', 'ru': 'Мапхо-гу, Хапчжон-дон', 'en': 'Hapjeong-dong, Mapo-gu', 'ko': '마포구 합정동'},
  lat: 37.549375,
  lng: 126.934069,
  rating: 4.4,
  ratingCount: 9,
  completedShifts: 30,
);

const _haeoreum = Business(
  id: 'demo-haeoreum',
  name: '해오름분식',
  names: {'uz': 'Haeoreum Bunsik', 'ru': 'Haeoreum Bunsik', 'en': 'Haeoreum Bunsik', 'ko': '해오름분식'},
  area: '망원',
  areas: {'uz': 'Mangwon', 'ru': 'Манвон', 'en': 'Mangwon', 'ko': '망원'},
  category: BusinessCategory.restaurant,
  address: '마포구 망원동',
  addresses: {'uz': 'Mapo-gu, Mangwon-dong', 'ru': 'Мапхо-гу, Манвон-дон', 'en': 'Mangwon-dong, Mapo-gu', 'ko': '마포구 망원동'},
  lat: 37.55051,
  lng: 126.956254,
);

const _yeonnam = Business(
  id: 'demo-yeonnam',
  name: '연남베이커리',
  names: {'uz': 'Yeonnam Bakery', 'ru': 'Yeonnam Bakery', 'en': 'Yeonnam Bakery', 'ko': '연남베이커리'},
  area: '연남',
  areas: {'uz': 'Yeonnam', 'ru': 'Ённам', 'en': 'Yeonnam', 'ko': '연남'},
  category: BusinessCategory.cafe,
  address: '마포구 연남동',
  addresses: {'uz': 'Mapo-gu, Yeonnam-dong', 'ru': 'Мапхо-гу, Ённам-дон', 'en': 'Yeonnam-dong, Mapo-gu', 'ko': '마포구 연남동'},
  lat: 37.545215,
  lng: 126.944565,
);

ShiftListing _shift(
  String id,
  Business business, {
  required DateTime day,
  required int startHour,
  int startMinute = 0,
  required int hours,
  required int wage,
  required int slots,
  required int left,
  required double? km,
  bool auto = true,
  required String ko,
  required Map<String, String> title,
  String duties = '',
  Map<String, String> dutiesI18n = const {},
  String dress = '',
  Map<String, String> dressI18n = const {},
}) {
  final w = Kst.wallClock(day);
  final start = Kst.instantOf(w.year, w.month, w.day, startHour, startMinute);
  return ShiftListing(
    id: id,
    business: business,
    title: ko,
    duties: duties,
    dress: dress,
    address: business.address,
    translations: {
      for (final lang in const ['uz', 'ru', 'en'])
        lang: ShiftText(
          title: title[lang],
          duties: dutiesI18n[lang],
          dress: dressI18n[lang],
          address: business.addresses[lang],
        ),
    },
    startsAt: start,
    endsAt: start.add(Duration(hours: hours)),
    hourlyWage: wage,
    slots: slots,
    slotsLeft: left,
    autoConfirm: auto,
    distanceKm: km,
    lat: business.lat,
    lng: business.lng,
  );
}

/// The prototype's sample shifts on the Korean date of [now] (and the next
/// days), nearest first.
List<ShiftListing> demoShifts(DateTime now) {
  final today = now;
  final tomorrow = now.add(const Duration(days: 1));
  return [
    _shift('demo-1', demoDalbit,
        day: today, startHour: 14, hours: 5, wage: 10500, slots: 3, left: 2, km: 1.2,
        ko: '홀·카운터 보조',
        title: {'uz': 'Kassa va zal yordamchisi', 'ru': 'Помощник на кассе и в зале', 'en': 'Counter and floor assistant'},
        duties: '주문 접수\n음료 제조 보조\n홀·테이블 정리',
        dutiesI18n: {
          'uz': 'Kassada buyurtma qabul qilish\nIchimlik tayyorlashga yordam berish\nStol va zalni tartibga keltirish',
          'ru': 'Приём заказов на кассе\nПомощь в приготовлении напитков\nУборка столов и зала',
          'en': 'Taking orders at the counter\nHelping prepare drinks\nTidying tables and the floor',
        },
        dress: '검은색 바지, 운동화 (앞치마 제공)',
        dressI18n: {
          'uz': 'Qora shim va yopiq poyabzal. Fartuk joyida beriladi.',
          'ru': 'Чёрные брюки и закрытая обувь. Фартук выдают на месте.',
          'en': 'Black trousers and closed shoes. An apron is provided.',
        }),
    _shift('demo-2', _ttukbaegi,
        day: today, startHour: 17, hours: 5, wage: 11000, slots: 2, left: 1, km: 2.4, auto: false,
        ko: '홀 서빙',
        title: {'uz': 'Zal yordamchisi', 'ru': 'Помощник в зале', 'en': 'Floor assistant'},
        duties: '서빙\n테이블 정리',
        dutiesI18n: {
          'uz': 'Taom tortish\nStollarni tozalash',
          'ru': 'Подача блюд\nУборка столов',
          'en': 'Serving dishes\nClearing tables',
        }),
    _shift('demo-3', _bomMart,
        day: today, startHour: 15, hours: 4, wage: 11000, slots: 2, left: 2, km: 2.6,
        ko: '매장 진열 보조',
        title: {'uz': 'Tokchalarni tartiblash', 'ru': 'Выкладка товара', 'en': 'Shelf stocking'}),
    _shift('demo-4', _sangam,
        day: today, startHour: 18, hours: 5, wage: 12000, slots: 6, left: 3, km: 2.7,
        ko: '물류 분류',
        title: {'uz': 'Yuk saralash', 'ru': 'Сортировка грузов', 'en': 'Parcel sorting'}),
    _shift('demo-5', _nanum,
        day: today, startHour: 16, hours: 5, wage: 13000, slots: 4, left: 2, km: 2.8,
        ko: '행사 진행 보조',
        title: {'uz': 'Tadbir yordamchisi', 'ru': 'Помощник на мероприятии', 'en': 'Event assistant'}),
    _shift('demo-6', _haeoreum,
        day: today, startHour: 12, startMinute: 30, hours: 4, wage: 11500, slots: 2, left: 1, km: 2.8,
        ko: '주방 보조',
        title: {'uz': 'Oshxona yordamchisi', 'ru': 'Помощник на кухне', 'en': 'Kitchen assistant'}),
    _shift('demo-7', _yeonnam,
        day: today, startHour: 13, hours: 5, wage: 10800, slots: 2, left: 2, km: 2.9,
        ko: '베이커리 판매 보조',
        title: {'uz': 'Novvoyxonada sotuvchi', 'ru': 'Продавец в пекарне', 'en': 'Bakery sales assistant'}),
    _shift('demo-8', demoDalbit,
        day: tomorrow, startHour: 18, hours: 4, wage: 11000, slots: 4, left: 1, km: 1.2, auto: false,
        ko: '마감 정리 보조',
        title: {'uz': 'Yopilishdagi tozalash', 'ru': 'Помощник на закрытии', 'en': 'Closing assistant'}),
    _shift('demo-9', _bomMart,
        day: today, startHour: 19, hours: 3, wage: 10500, slots: 2, left: 2, km: 2.6,
        ko: '계산대 보조',
        title: {'uz': 'Kassir yordamchisi', 'ru': 'Помощник кассира', 'en': 'Cashier assistant'}),
    _shift('demo-10', _ttukbaegi,
        day: tomorrow, startHour: 12, hours: 3, wage: 10500, slots: 2, left: 1, km: 2.4,
        ko: '점심 홀 서빙',
        title: {'uz': 'Tushlikda zal yordamchisi', 'ru': 'Помощник в зале на обед', 'en': 'Lunch floor assistant'}),
    _shift('demo-11', _yeonnam,
        day: today, startHour: 20, hours: 2, wage: 10800, slots: 1, left: 1, km: 2.9,
        ko: '마감 청소',
        title: {'uz': 'Kechki tozalash', 'ru': 'Вечерняя уборка', 'en': 'Evening cleaning'}),
    _shift('demo-12', _nanum,
        day: today, startHour: 21, hours: 2, wage: 13000, slots: 3, left: 3, km: 2.8,
        ko: '행사장 정리',
        title: {'uz': 'Tadbir joyini yig\'ishtirish', 'ru': 'Уборка площадки', 'en': 'Venue clean-up'}),
    _shift('demo-15', _sangam,
        day: today, startHour: 21, hours: 3, wage: 12000, slots: 4, left: 4, km: 2.7,
        ko: '야간 상하차',
        title: {'uz': 'Kechki yuk tushirish', 'ru': 'Вечерняя разгрузка', 'en': 'Evening unloading'}),
    _shift('demo-16', _haeoreum,
        day: today, startHour: 17, startMinute: 30, hours: 4, wage: 11500, slots: 2, left: 2, km: 2.8,
        ko: '저녁 주방 보조',
        title: {'uz': 'Kechki oshxona yordamchisi', 'ru': 'Помощник на кухне вечером', 'en': 'Evening kitchen assistant'}),
    _shift('demo-13', _ttukbaegi,
        day: tomorrow, startHour: 17, hours: 5, wage: 11000, slots: 2, left: 1, km: 2.4, auto: false,
        ko: '홀 서빙',
        title: {'uz': 'Zal yordamchisi', 'ru': 'Помощник в зале', 'en': 'Floor assistant'}),
    _shift('demo-14', demoDalbit,
        day: tomorrow, startHour: 14, hours: 5, wage: 10500, slots: 3, left: 3, km: 1.2,
        ko: '홀·카운터 보조',
        title: {'uz': 'Kassa va zal yordamchisi', 'ru': 'Помощник на кассе и в зале', 'en': 'Counter and floor assistant'}),
  ]..sort((a, b) {
      final d = (a.distanceKm ?? 99).compareTo(b.distanceKm ?? 99);
      return d != 0 ? d : a.startsAt.compareTo(b.startsAt);
    });
}

/// The worker's finished shifts in the demo: the prototype's November on
/// A09 (1, 3, 5, 7 and 8 November, the first four already paid).
List<MyShift> demoHistory(DateTime now) {
  final today = Kst.wallClock(now);
  DateTime day(int back) => Kst.instantOf(today.year, today.month, today.day - back);
  MyShift done(String id, Business b, int back, int hour, int hours, int wage, String ko, Map<String, String> title,
      {required bool paid, int? stars}) {
    final shift = _shift('demo-past-$id', b,
        day: day(back), startHour: hour, hours: hours, wage: wage, slots: 2, left: 0, km: null, ko: ko, title: title);
    return MyShift(
      applicationId: 'demo-app-past-$id',
      shift: shift.copyWith(myStatus: ApplicationStatus.completed, myApplicationId: 'demo-app-past-$id'),
      status: ApplicationStatus.completed,
      checkInAt: shift.startsAt,
      checkOutAt: shift.endsAt,
      lateMinutes: 0,
      workedMinutes: shift.plannedMinutes,
      payAmount: shift.totalPay,
      paidAt: paid ? shift.endsAt.add(const Duration(hours: 2)) : null,
      myStars: stars,
    );
  }

  return [
    done('1', demoDalbit, 9, 14, 4, 10500, '홀·카운터 보조',
        {'uz': 'Kassa va zal yordamchisi', 'ru': 'Помощник на кассе и в зале', 'en': 'Counter and floor assistant'},
        paid: true, stars: 5),
    done('2', _nanum, 7, 10, 6, 13000, '행사 진행 보조',
        {'uz': 'Tadbir yordamchisi', 'ru': 'Помощник на мероприятии', 'en': 'Event assistant'},
        paid: true, stars: 4),
    done('3', _ttukbaegi, 5, 17, 5, 11000, '홀 서빙',
        {'uz': 'Zal yordamchisi', 'ru': 'Помощник в зале', 'en': 'Floor assistant'},
        paid: true),
    done('4', _bomMart, 3, 15, 4, 11000, '매장 진열 보조',
        {'uz': 'Tokchalarni tartiblash', 'ru': 'Выкладка товара', 'en': 'Shelf stocking'},
        paid: true, stars: 5),
    done('5', _sangam, 2, 9, 6, 12000, '물류 분류',
        {'uz': 'Yuk saralash', 'ru': 'Сортировка грузов', 'en': 'Parcel sorting'},
        paid: false),
  ];
}

/// In-memory [ShiftRepository] over [demoShifts].
///
/// [clock] is the time check-in and check-out use. With [strictTimes] the QR
/// windows of the real backend apply (from 30 minutes before the start to the
/// end; check-out until 2 hours after it); the demo app leaves them off so
/// the whole flow can be tried at any hour.
class DemoShiftRepository implements ShiftRepository {
  DemoShiftRepository({
    DateTime? now,
    this.latency = Duration.zero,
    DateTime Function()? clock,
    this.strictTimes = false,
    bool history = true,
  })  : _clock = clock ?? DateTime.now,
        _shifts = {for (final s in demoShifts(now ?? DateTime.now())) s.id: s} {
    if (history) {
      for (final past in demoHistory(now ?? DateTime.now())) {
        _apps[past.applicationId] = past;
        _shifts[past.shift.id] = past.shift;
      }
    }
  }

  final Map<String, ShiftListing> _shifts;
  final Map<String, MyShift> _apps = {};
  final Map<String, List<ChatMessage>> _chats = {};
  final DateTime Function() _clock;

  /// Pretend network delay (the demo app shows the loading state with it).
  final Duration latency;

  /// Enforce the backend's check-in and check-out windows.
  final bool strictTimes;

  /// The token the demo's printed QR codes carry.
  static const qrToken = 'demo';

  int _nextApplication = 1;

  Future<void> _wait() => latency == Duration.zero ? Future.value() : Future.delayed(latency);

  @override
  Future<List<ShiftListing>> feed(FeedQuery query) async {
    await _wait();
    return _shifts.values.where((s) {
      if (s.startsAt.isBefore(query.from) || !s.startsAt.isBefore(query.to)) return false;
      if (query.minWage != null && s.hourlyWage < query.minWage!) return false;
      if (query.radiusKm != null && (s.distanceKm ?? 0) > query.radiusKm!) return false;
      if (query.categories.isNotEmpty && !query.categories.contains(s.business.category)) return false;
      if (query.dayParts.isNotEmpty && !query.dayParts.contains(FeedQuery.dayPartOf(s.startsAt))) return false;
      return true;
    }).toList()
      ..sort((a, b) {
        final d = (a.distanceKm ?? 99).compareTo(b.distanceKm ?? 99);
        return d != 0 ? d : a.startsAt.compareTo(b.startsAt);
      });
  }

  @override
  Future<ShiftListing?> shift(String id) async {
    await _wait();
    return _shifts[id];
  }

  @override
  Future<ApplyResult> apply(String shiftId) async {
    await _wait();
    final shift = _shifts[shiftId];
    if (shift == null) throw const ShiftActionException('SHIFT_CLOSED');
    if (shift.myStatus == ApplicationStatus.pending || shift.myStatus == ApplicationStatus.confirmed) {
      throw const ShiftActionException('ALREADY_APPLIED');
    }
    if (shift.slotsLeft <= 0) throw const ShiftActionException('SHIFT_FULL');
    final status = shift.autoConfirm ? ApplicationStatus.confirmed : ApplicationStatus.pending;
    final id = 'demo-app-${_nextApplication++}';
    final updated = shift.copyWith(
      myStatus: status,
      myApplicationId: id,
      slotsLeft: shift.autoConfirm ? shift.slotsLeft - 1 : shift.slotsLeft,
    );
    _shifts[shiftId] = updated;
    _apps[id] = MyShift(applicationId: id, shift: updated, status: status);
    return ApplyResult(applicationId: id, status: status);
  }

  /// Applications with their shift as it is now.
  MyShift _fresh(MyShift app) => app.copyWith(shift: _shifts[app.shift.id] ?? app.shift);

  @override
  Future<List<MyShift>> myShifts() async {
    await _wait();
    return [for (final app in _apps.values) _fresh(app)]..sort((a, b) => a.shift.startsAt.compareTo(b.shift.startsAt));
  }

  @override
  Future<MyShift?> myShift(String applicationId) async {
    await _wait();
    final app = _apps[applicationId];
    return app == null ? null : _fresh(app);
  }

  void _store(MyShift app) {
    _apps[app.applicationId] = app;
    final shift = _shifts[app.shift.id];
    if (shift != null) _shifts[shift.id] = shift.copyWith(myStatus: app.status);
  }

  @override
  Future<MyShift> cancelApplication(String applicationId) async {
    await _wait();
    final app = _apps[applicationId];
    if (app == null) throw const ShiftActionException('NOT_FOUND');
    if (app.status != ApplicationStatus.pending && app.status != ApplicationStatus.confirmed) {
      throw const ShiftActionException('CANNOT_CANCEL');
    }
    final now = _clock();
    final shift = _shifts[app.shift.id] ?? app.shift;
    if (!shift.startsAt.isAfter(now)) throw const ShiftActionException('SHIFT_STARTED');
    final late = app.status == ApplicationStatus.confirmed && shift.startsAt.difference(now) < const Duration(hours: 24);
    final freed = app.status == ApplicationStatus.confirmed;
    _shifts[shift.id] = shift.copyWith(slotsLeft: freed ? shift.slotsLeft + 1 : shift.slotsLeft);
    final cancelled = app.copyWith(status: ApplicationStatus.cancelled, cancelledAt: now, lateCancel: late);
    _store(cancelled);
    return _fresh(cancelled);
  }

  MyShift _appForQr(String payload) {
    final qr = ShiftQr.parse(payload);
    if (qr == null || qr.token != qrToken || !_shifts.containsKey(qr.shiftId)) {
      throw const ShiftActionException('QR_INVALID');
    }
    final app = _apps.values.where((a) =>
        a.shift.id == qr.shiftId &&
        (a.status == ApplicationStatus.confirmed ||
            a.status == ApplicationStatus.checkedIn ||
            a.status == ApplicationStatus.completed));
    if (app.isEmpty) throw const ShiftActionException('NOT_CONFIRMED');
    return app.first;
  }

  @override
  Future<MyShift> checkIn(String payload) async {
    await _wait();
    final app = _appForQr(payload);
    if (app.status != ApplicationStatus.confirmed) throw const ShiftActionException('ALREADY_CHECKED_IN');
    final shift = _shifts[app.shift.id]!;
    final now = _clock();
    if (strictTimes) {
      if (now.isBefore(shift.startsAt.subtract(const Duration(minutes: 30)))) {
        throw const ShiftActionException('TOO_EARLY');
      }
      if (!now.isBefore(shift.endsAt)) throw const ShiftActionException('TOO_LATE');
    }
    final late = now.isAfter(shift.startsAt) ? now.difference(shift.startsAt).inMinutes : 0;
    final updated = app.copyWith(status: ApplicationStatus.checkedIn, checkInAt: now, lateMinutes: late);
    _store(updated);
    return _fresh(updated);
  }

  @override
  Future<MyShift> checkOut(String payload) async {
    await _wait();
    final app = _appForQr(payload);
    if (app.status == ApplicationStatus.confirmed) throw const ShiftActionException('NOT_CHECKED_IN');
    if (app.status == ApplicationStatus.completed) throw const ShiftActionException('ALREADY_CHECKED_OUT');
    final shift = _shifts[app.shift.id]!;
    final now = _clock();
    if (strictTimes && now.isAfter(shift.endsAt.add(const Duration(hours: 2)))) {
      throw const ShiftActionException('TOO_LATE');
    }
    final planned = shift.plannedMinutes;
    final checkIn = app.checkInAt ?? now;
    // The backend counts inside the planned window only; the lenient demo
    // counts the time actually spent, still never more than planned.
    final from = strictTimes && checkIn.isBefore(shift.startsAt) ? shift.startsAt : checkIn;
    final to = strictTimes && now.isAfter(shift.endsAt) ? shift.endsAt : now;
    final worked = to.difference(from).inMinutes.clamp(0, planned);
    final updated = app.copyWith(
      status: ApplicationStatus.completed,
      checkOutAt: now,
      workedMinutes: worked,
      payAmount: Pay.forMinutes(shift.hourlyWage, worked),
    );
    _store(updated);
    return _fresh(updated);
  }

  @override
  Future<void> rateBusiness(String applicationId, int stars, Set<RatingTag> tags) async {
    await _wait();
    final app = _apps[applicationId];
    if (app == null || app.status != ApplicationStatus.completed) throw const ShiftActionException('NOT_FOUND');
    if (stars < 1 || stars > 5) throw const ShiftActionException('INVALID');
    _store(app.copyWith(myStars: stars, myTags: tags));
  }

  @override
  Future<List<ChatMessage>> messages(String applicationId) async {
    await _wait();
    final app = _apps[applicationId];
    if (app == null) throw const ShiftActionException('NOT_FOUND');
    return List.unmodifiable(_chats.putIfAbsent(applicationId, () => _seedChat(app)));
  }

  @override
  Future<ChatMessage> sendMessage(String applicationId, String text) async {
    await _wait();
    final app = _apps[applicationId];
    final body = text.trim();
    if (app == null) throw const ShiftActionException('NOT_FOUND');
    if (body.isEmpty || body.length > 2000) throw const ShiftActionException('INVALID');
    final chat = _chats.putIfAbsent(applicationId, () => _seedChat(app));
    final message = ChatMessage(
      id: 'demo-m-${chat.length + 1}-$applicationId',
      applicationId: applicationId,
      fromMe: true,
      body: body,
      createdAt: _clock(),
      lang: RegExp('[\uAC00-\uD7A3]').hasMatch(body) ? 'ko' : null,
    );
    chat.add(message);
    return message;
  }

  /// Dalbit Kafe's welcome chat of the prototype (A10); empty elsewhere.
  List<ChatMessage> _seedChat(MyShift app) {
    if (app.shift.id != 'demo-1') return [];
    final d = Kst.wallClock(app.shift.startsAt);
    DateTime at(int minute) => Kst.instantOf(d.year, d.month, d.day, 11, minute);
    ChatMessage m(int n, bool mine, int minute, String ko, [Map<String, String> tr = const {}]) => ChatMessage(
          id: 'demo-m-$n-${app.applicationId}',
          applicationId: app.applicationId,
          fromMe: mine,
          body: ko,
          createdAt: at(minute),
          lang: 'ko',
          translations: tr,
        );
    return [
      m(1, false, 24, '안녕하세요! 오늘 14시 근무 신청 감사합니다. 13시 50분까지 와 주세요.', {
        'uz': 'Assalomu alaykum! Bugungi 14:00 smenasiga yozilganingiz uchun rahmat. 13:50 gacha keling.',
        'ru': 'Здравствуйте! Спасибо, что записались на сегодняшнюю смену в 14:00. Приходите к 13:50.',
        'en': "Hello! Thank you for signing up for today's 14:00 shift. Please come by 13:50.",
      }),
      m(2, true, 26, '네, 알겠습니다! 13시 50분까지 갈게요.'),
      m(3, false, 27, '검은색 바지 입고 오세요. 앞치마는 가게에서 드려요.', {
        'uz': "Qora shim kiyib keling. Fartukni do'konda beramiz.",
        'ru': 'Приходите в чёрных брюках. Фартук дадим в кафе.',
        'en': "Please wear black trousers. We'll give you an apron at the shop.",
      }),
      m(4, false, 27, '입구 옆 QR 코드로 출근 체크해 주세요.', {
        'uz': 'Kirish yonidagi QR kod orqali ishga kirishni belgilang.',
        'ru': 'Отметьте приход по QR-коду у входа.',
        'en': 'Please check in with the QR code by the entrance.',
      }),
      m(5, true, 28, '감사합니다! 이따 뵐게요.'),
    ];
  }
}
