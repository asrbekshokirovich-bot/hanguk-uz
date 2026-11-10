/// Sample shifts for the app's demo mode (no backend configured) and for the
/// screen tests. They reproduce the prototype's example data (Dalbit Kafe
/// 14:00–19:00, 10 500 ₩ …) and are never shown when a backend is set up.
library;

import '../../core/time/kst.dart';
import '../models/business.dart';
import '../models/shift.dart';
import '../repositories/shift_repository.dart';

/// The moment the prototype's worker screens are drawn at: Tuesday
/// 10 November 2026, 11:20 in Seoul (2 h 40 min before Dalbit Kafe's 14:00).
final prototypeNow = Kst.instantOf(2026, 11, 10, 11, 20);

/// Unread notifications in the demo (the bell's dot on A03 and A04).
const demoUnreadNotifications = 2;

// Business positions are placed around the demo location (Sinchon) so that
// the stylised map (A04) draws their pins where the prototype has them.

const _dalbit = Business(
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
  required double km,
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
    _shift('demo-1', _dalbit,
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
    _shift('demo-8', _dalbit,
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
    _shift('demo-14', _dalbit,
        day: tomorrow, startHour: 14, hours: 5, wage: 10500, slots: 3, left: 3, km: 1.2,
        ko: '홀·카운터 보조',
        title: {'uz': 'Kassa va zal yordamchisi', 'ru': 'Помощник на кассе и в зале', 'en': 'Counter and floor assistant'}),
  ]..sort((a, b) {
      final d = (a.distanceKm ?? 99).compareTo(b.distanceKm ?? 99);
      return d != 0 ? d : a.startsAt.compareTo(b.startsAt);
    });
}

/// In-memory [ShiftRepository] over [demoShifts].
class DemoShiftRepository implements ShiftRepository {
  DemoShiftRepository({DateTime? now, this.latency = Duration.zero})
      : _shifts = {for (final s in demoShifts(now ?? DateTime.now())) s.id: s};

  final Map<String, ShiftListing> _shifts;

  /// Pretend network delay (the demo app shows the loading state with it).
  final Duration latency;

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
      if (query.dayParts.isNotEmpty) {
        final h = Kst.wallClock(s.startsAt).hour;
        final part = h >= 6 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : h >= 18 ? 2 : 3;
        if (!query.dayParts.contains(part)) return false;
      }
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
    _shifts[shiftId] = shift.copyWith(
      myStatus: status,
      myApplicationId: id,
      slotsLeft: shift.autoConfirm ? shift.slotsLeft - 1 : shift.slotsLeft,
    );
    return ApplyResult(applicationId: id, status: status);
  }
}
