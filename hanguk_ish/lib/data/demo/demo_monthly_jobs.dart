import '../models/monthly_job.dart';
import '../repositories/monthly_job_repository.dart';

/// Three example monthly jobs (demo build; the real ones come from the staff).
const demoMonthlyJobs = <MonthlyJob>[
  MonthlyJob(
    id: 'demo-monthly-1',
    title: '카페 바리스타 (정규)',
    company: '달빛카페 신촌점',
    area: '서울 마포구',
    address: '서울 마포구 신촌로 12길 15',
    lat: 37.5563,
    lng: 126.9372,
    category: 'cafe',
    workTime: 'day',
    monthlyWage: 2300000,
    daysPerWeek: 5,
    hoursPerDay: 8,
    description: '주 5일, 하루 8시간. 음료 제조와 매장 관리. 4대 보험, 식사 제공.',
    translations: {
      'uz': {
        'title': 'Kafe baristasi (doimiy)',
        'company': 'Dalbit Kafe · Sinchon',
        'area': 'Mapo-gu, Seul',
        'description': 'Haftasiga 5 kun, kuniga 8 soat. Ichimliklar tayyorlash va do\'konni yuritish. Ijtimoiy sug\'urta, ovqat beriladi.',
      },
      'ru': {
        'title': 'Бариста в кафе (постоянно)',
        'company': 'Dalbit Cafe · Синчхон',
        'area': 'Мапхо-гу, Сеул',
        'description': '5 дней в неделю, 8 часов в день. Приготовление напитков и уход за залом. Страховка, питание.',
      },
      'en': {
        'title': 'Café barista (full-time)',
        'company': 'Dalbit Cafe · Sinchon',
        'area': 'Mapo-gu, Seoul',
        'description': '5 days a week, 8 hours a day. Making drinks and looking after the shop. Insurance and meals included.',
      },
    },
  ),
  MonthlyJob(
    id: 'demo-monthly-2',
    title: '물류센터 상하차',
    company: '상암물류',
    area: '서울 마포구',
    address: '서울 마포구 상암동',
    category: 'logistics',
    workTime: 'day',
    monthlyWage: 2600000,
    daysPerWeek: 5,
    hoursPerDay: 9,
    description: '주 5일 주간 근무. 상하차와 분류 작업. 기숙사 제공 가능.',
    translations: {
      'uz': {
        'title': 'Logistika markazi: yuk ortish va tushirish',
        'company': 'Sangam Logistika',
        'area': 'Mapo-gu, Seul',
        'description': 'Haftasiga 5 kun, kunduzgi smena. Yuk ortish-tushirish va saralash. Yotoqxona berilishi mumkin.',
      },
      'ru': {
        'title': 'Логистический центр: погрузка и разгрузка',
        'company': 'Sangam Logistics',
        'area': 'Мапхо-гу, Сеул',
        'description': '5 дней в неделю, дневная смена. Погрузка, разгрузка, сортировка. Возможно общежитие.',
      },
      'en': {
        'title': 'Logistics centre: loading and unloading',
        'company': 'Sangam Logistics',
        'area': 'Mapo-gu, Seoul',
        'description': '5 days a week, day shift. Loading, unloading and sorting. A dormitory may be provided.',
      },
    },
  ),
  MonthlyJob(
    id: 'demo-monthly-3',
    title: '식당 홀 서빙',
    company: '뚝배기 식당',
    area: '서울 마포구',
    address: '서울 마포구 도화동',
    lat: 37.5400,
    lng: 126.9500,
    category: 'restaurant',
    workTime: 'night',
    monthlyWage: 2100000,
    daysPerWeek: 6,
    hoursPerDay: 7,
    description: '주 6일, 하루 7시간 (저녁 위주). 서빙과 정리. 식사 제공.',
    translations: {
      'uz': {
        'title': 'Restoran zalida xizmat',
        'company': 'Ttukbaegi Sikdang',
        'area': 'Mapo-gu, Seul',
        'description': 'Haftasiga 6 kun, kuniga 7 soat (asosan kechqurun). Xizmat va tozalash. Ovqat beriladi.',
      },
      'ru': {
        'title': 'Официант в ресторане',
        'company': 'Ttukbaegi Sikdang',
        'area': 'Мапхо-гу, Сеул',
        'description': '6 дней в неделю, 7 часов в день (в основном вечером). Обслуживание и уборка. Питание.',
      },
      'en': {
        'title': 'Restaurant waiter',
        'company': 'Ttukbaegi Sikdang',
        'area': 'Mapo-gu, Seoul',
        'description': '6 days a week, 7 hours a day (mostly evenings). Serving and tidying. Meals included.',
      },
    },
  ),
];

/// In-memory [MonthlyJobRepository].
class DemoMonthlyJobRepository implements MonthlyJobRepository {
  DemoMonthlyJobRepository();

  final Set<String> _applied = {};

  @override
  Future<List<MonthlyJob>> list() async => [for (final j in demoMonthlyJobs) j.copyWith(applied: _applied.contains(j.id))];

  @override
  Future<void> apply(String jobId) async => _applied.add(jobId);

  @override
  Future<void> withdraw(String jobId) async => _applied.remove(jobId);
}
