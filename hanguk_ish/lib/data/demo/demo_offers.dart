import '../backend/backend.dart' show ishTestLogin;
import '../models/account.dart';
import '../models/job_offer.dart';
import '../repositories/offer_repository.dart';
import '../repositories/shift_repository.dart';
import 'demo_account.dart';

/// Four example offers in Mapo-gu (the demo build only; real ones come from
/// Hanguk's staff). Times are from [now].
List<JobOffer> demoOffers(DateTime now) {
  DateTime day(int d, int h) {
    final kst = now.toUtc().add(const Duration(hours: 9));
    return DateTime.utc(kst.year, kst.month, kst.day + d, h).subtract(const Duration(hours: 9));
  }

  JobOffer offer(String id, int minutesLeft, int sent, int pay, String title, Map<String, String> titles, int wage,
          int d, int s, int e, double km, int slots, int taken, String street, int checkedAgo) =>
      JobOffer(
        offerId: 'demo-offer-$id',
        shiftId: 'demo-job-$id',
        status: JobOfferStatus.sent,
        expiresAt: now.add(Duration(minutes: minutesLeft)),
        title: title,
        titles: titles,
        pay: pay,
        hourlyWage: wage,
        startsAt: day(d, s),
        endsAt: day(d, e),
        price: unlockPrice(pay),
        sentCount: sent,
        slots: slots,
        taken: taken,
        checkedAt: now.subtract(Duration(minutes: checkedAgo)),
        area: 'Mapo-gu',
        maskedAddress: '$street •••',
        distanceKm: km,
      );

  return [
    offer('1', 24, 4, 60000, '주방 보조', const {'uz': 'Restoran oshxonasiga yordamchi', 'ru': 'Помощник на кухне ресторана', 'en': 'Restaurant kitchen helper'},
        11000, 0, 18, 23, 1.2, 3, 2, '마포구 독막로', 41),
    offer('2', 30, 3, 55000, '홀·카운터 보조', const {'uz': 'Kafe — zal va kassa yordamchisi', 'ru': 'Кафе — помощь в зале и на кассе', 'en': 'Café — floor and counter help'},
        10500, 0, 16, 21, 0.4, 2, 0, '마포구 신촌로12길', 116),
    offer('3', 5, 4, 130000, '물류 상하차', const {'uz': 'Ombor — quti tashish', 'ru': 'Склад — перенос коробок', 'en': 'Warehouse — moving boxes'},
        13000, 2, 8, 18, 2.4, 5, 3, '마포구 망원로', 201),
    offer('4', 13, 3, 75000, '호텔 객실 청소', const {'uz': 'Mehmonxona — xona tozalash', 'ru': 'Отель — уборка номеров', 'en': 'Hotel — cleaning rooms'},
        14500, 1, 9, 14, 4.1, 2, 1, '마포구 양화로', 286),
  ];
}

/// The full card of a demo offer once opened.
OpenedJob _opened(JobOffer o, int n) => OpenedJob(
      applicationId: 'demo-opened-${o.offerId}',
      shiftId: o.shiftId,
      title: o.title,
      titles: o.titles,
      pay: o.pay,
      hourlyWage: o.hourlyWage,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      phone: '010-4821-77${30 + n}',
      address: '${o.maskedAddress.replaceAll(' •••', '')} ${4 + n}, 1층',
      business: '',
      price: o.price,
      distanceKm: o.distanceKm,
    );

/// [OfferRepository] in memory (demo build). Opening spends the demo
/// account's puyl when [account] is given.
class DemoOfferRepository implements OfferRepository {
  DemoOfferRepository({DateTime? now, DateTime Function()? clock, this.account})
      : _clock = clock ?? DateTime.now,
        _offers = ishTestLogin ? [] : demoOffers(now ?? DateTime.now());

  final DateTime Function() _clock;
  final DemoAccountRepository? account;
  final List<JobOffer> _offers;
  final List<OpenedJob> _jobs = [];

  @override
  Future<List<JobOffer>> offers() async {
    final now = _clock();
    return [
      for (final o in _offers)
        o.status == JobOfferStatus.sent && !o.liveAt(now) ? o.copyWith(status: JobOfferStatus.expired) : o,
    ];
  }

  @override
  Future<OpenedJob> unlock(String shiftId) async {
    final i = _offers.indexWhere((o) => o.shiftId == shiftId);
    if (i < 0) throw const ShiftActionException('NOT_FOUND');
    final o = _offers[i];
    if (o.status == JobOfferStatus.applied) return _jobs.firstWhere((j) => j.shiftId == shiftId);
    if (!o.liveAt(_clock())) throw const ShiftActionException('OFFER_EXPIRED');
    final wallet = account?.wallet;
    if (wallet != null) {
      if (wallet.balance < o.price) throw const ShiftActionException('NO_COINS');
      account!.wallet = CoinWallet(
        balance: wallet.balance - o.price,
        history: [
          CoinMove(
            delta: -o.price,
            balance: wallet.balance - o.price,
            reason: CoinReason.unlock,
            createdAt: _clock().toUtc(),
            shiftTitle: o.title,
          ),
          ...wallet.history,
        ],
      );
    }
    _offers[i] = o.copyWith(status: JobOfferStatus.applied);
    final job = _opened(o, _jobs.length);
    _jobs.insert(0, job);
    return job;
  }

  @override
  Future<List<OpenedJob>> jobs() async => List.of(_jobs);

  @override
  Future<void> setStep(String applicationId, JobStep step) async {
    final i = _jobs.indexWhere((j) => j.applicationId == applicationId);
    if (i < 0) throw const ShiftActionException('NOT_FOUND');
    _jobs[i] = _jobs[i].copyWith(step: step);
  }

  @override
  Future<void> rate(String applicationId, int stars) async {
    final i = _jobs.indexWhere((j) => j.applicationId == applicationId);
    if (i < 0 || _jobs[i].step != JobStep.wentToWork) throw const ShiftActionException('NOT_FOUND');
    _jobs[i] = _jobs[i].copyWith(stars: stars);
  }
}
