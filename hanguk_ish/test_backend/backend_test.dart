// The apps' repositories against a real local Supabase stack: sign-in with
// the test phone numbers (supabase/config.toml), every screen's read, every
// rule the database enforces, Storage. Run by .github/workflows/
// ish-integration.yml after `supabase start`:
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_KEY=… flutter test test_backend
//
// Without those variables every test is skipped.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/supabase_account_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_employer_repository.dart';
import 'package:hanguk_ish/data/backend/supabase_live_updates.dart';
import 'package:hanguk_ish/data/backend/supabase_shift_repository.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/models/shift.dart';
import 'package:hanguk_ish/data/repositories/shift_repository.dart';
import 'package:hanguk_ish/features/worker/profile/worker_profile_draft.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

final _env = Platform.environment;
final _url = _env['SUPABASE_URL'] ?? '';
final _anonKey = _env['SUPABASE_ANON_KEY'] ?? '';
final _serviceKey = _env['SUPABASE_SERVICE_KEY'] ?? '';
final _skip = _url.isEmpty || _anonKey.isEmpty || _serviceKey.isEmpty
    ? 'set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY (a local supabase start)'
    : null;

final config = BackendConfig(url: _url, publishableKey: _anonKey);

SupabaseClient _client(String key) =>
    SupabaseClient(_url, key, authOptions: const AuthClientOptions(autoRefreshToken: false));

/// Signs in with a test number: its code is fixed in supabase/config.toml.
Future<SupabaseClient> _signIn(String phone) async {
  final client = _client(_anonKey);
  await client.auth.signInWithOtp(phone: phone);
  await client.auth.verifyOTP(phone: phone, token: '123456', type: OtpType.sms);
  return client;
}

Matcher _refused(String code) => throwsA(isA<ShiftActionException>().having((e) => e.code, 'code', code));

// A 1×1 PNG.
final _png = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

void main() {
  late SupabaseClient admin;
  late SupabaseClient aziz;
  late SupabaseClient malika;
  late SupabaseClient owner;
  late String businessId;
  late SupabaseShiftRepository azizShifts;
  late SupabaseShiftRepository malikaShifts;
  late SupabaseEmployerRepository employer;

  // Shifts the owner posts: «now» starts in 10 minutes (QR opens), «tomorrow»
  // waits for the owner's decision, «later» confirms at once.
  late EmployerShift now;
  late EmployerShift tomorrow;
  late EmployerShift later;
  late String azizNow;

  setUpAll(() async {
    if (_skip != null) return;
    admin = _client(_serviceKey);
    aziz = await _signIn('+821000000001');
    malika = await _signIn('+821000000002');
    owner = await _signIn('+821000000011');
    final business = await admin.rpc('register_business', params: {
      'p_owner': owner.auth.currentUser!.id,
      'p_biz_no': '1234567890',
      'p_name': '달빛카페 신촌점',
      'p_nts_status': '01',
      'p_category': 'cafe',
      'p_address': '마포구 신촌로12길 15',
      'p_district': 'Mapo-gu',
      'p_lat': 37.5559,
      'p_lng': 126.9368,
    }) as Map<String, dynamic>;
    businessId = business['id'] as String;
    await admin.from('businesses').update({
      'area': '신촌',
      'address_detail': '2층',
      'name_i18n': {'uz': 'Dalbit Kafe', 'en': 'Dalbit Cafe', 'ko': '달빛카페'},
      'translations': {
        'uz': {'area': 'Sinchon', 'address': 'Mapo-gu, Sinchon-ro 12-gil 15', 'address_detail': '2-qavat'},
      },
    }).eq('id', businessId);
    azizShifts = SupabaseShiftRepository(aziz, config);
    malikaShifts = SupabaseShiftRepository(malika, config);
    employer = SupabaseEmployerRepository(owner, config);
  });

  group('A02 profile', skip: _skip, () {
    test('a new worker cannot take shifts before the profile', () async {
      final profile = SupabaseWorkerProfileRepository(aziz, config);
      expect(await profile.load(), isNull);
    });

    test('saving uploads the photo and marks onboarding done', () async {
      final dir = Directory.systemTemp.createTempSync('ish');
      final photo = File('${dir.path}/me.png')..writeAsBytesSync(_png);
      final profile = SupabaseWorkerProfileRepository(aziz, config);
      await profile.save(WorkerProfileDraft(
        firstName: 'Aziz',
        lastName: 'Karimov',
        photoPath: photo.path,
        languages: const {'uz', 'ru', 'ko'},
        topik: 4,
        university: 'sogang',
        district: 'mapo',
        availability: WorkerProfileDraft.bit(0, 1) | WorkerProfileDraft.bit(5, 0),
        visa: 'D-2',
      ));
      final saved = (await profile.load())!;
      expect(saved.firstName, 'Aziz');
      expect(saved.languages.toList(), ['uz', 'ru', 'ko']);
      expect(saved.isAvailable(5, 0), isTrue);
      expect(saved.photoPath, startsWith('$_url/storage/v1/object/public/avatars/${aziz.auth.currentUser!.id}/'));
      final download = await http.get(Uri.parse(saved.photoPath!));
      expect(download.statusCode, 200, reason: 'the avatars bucket is public');
      expect(download.bodyBytes, _png);

      // Saving again keeps the photo (its URL is not uploaded again).
      await profile.save(saved.copyWith(topik: 5));
      expect((await profile.load())!.photoPath, saved.photoPath);
      dir.deleteSync(recursive: true);
    });

    test('a photo cannot go into someone else\'s folder', () async {
      await expectLater(
        aziz.storage
            .from('avatars')
            .uploadBinary('${owner.auth.currentUser!.id}/x.png', _png, fileOptions: const FileOptions(contentType: 'image/png')),
        throwsA(isA<StorageException>()),
      );
    });

    test('Malika too (no photo)', () async {
      await SupabaseWorkerProfileRepository(malika, config).save(const WorkerProfileDraft(
        firstName: 'Malika',
        lastName: 'Yusupova',
        languages: {'uz', 'ru'},
        district: 'mapo',
      ));
      expect((await SupabaseAccountRepository(malika).stats()).reliability, 100);
      // Her phone's approximate position (P9): near Sinchon.
      await SupabaseAccountRepository(malika).savePosition(37.5581, 126.9502);
    });
  });

  group('BA2 posting', skip: _skip, () {
    test('the owner\'s business, templates and the minimum wage', () async {
      final businesses = await employer.businesses();
      expect(businesses.single.id, businessId);
      expect(businesses.single.nameWithArea('ko'), '달빛카페 · 신촌');
      final saved = await employer.saveTemplate(
        businessId,
        const ShiftTemplate(
          id: '40000000-0000-0000-0000-000000000001',
          title: '홀·카운터 보조',
          duties: '주문 접수 · 음료 보조 · 홀 정리',
          startMinute: 14 * 60,
          endMinute: 19 * 60,
          hourlyWage: 10500,
          slots: 3,
        ),
      );
      await employer.saveTemplate(businessId, saved.copyWith(dress: '검은색 바지'));
      final templates = await employer.templates(businessId);
      expect(templates.single.dress, '검은색 바지');
      expect(templates.single.startMinute, 840);
      expect(await employer.minimumWage(DateTime.utc(2026, 11, 12)), 10320);
      expect(await employer.minimumWage(DateTime.utc(2027, 3, 1)), 10700);
    });

    test('three shifts; the database refuses what breaks a rule', () async {
      final t = DateTime.now().toUtc();
      ShiftDraft draft(DateTime start, {int hours = 5, int wage = 10500, int slots = 2, bool auto = true}) => ShiftDraft(
            businessId: businessId,
            title: '홀·카운터 보조',
            duties: '주문 접수',
            address: '마포구 신촌로12길 15, 2층',
            startsAt: start,
            endsAt: start.add(Duration(hours: hours)),
            hourlyWage: wage,
            slots: slots,
            autoConfirm: auto,
            templateId: '40000000-0000-0000-0000-000000000001',
          );
      now = await employer.createShift(draft(t.add(const Duration(minutes: 10))));
      tomorrow = await employer.createShift(draft(t.add(const Duration(days: 1)), slots: 1, auto: false, wage: 11000));
      later = await employer.createShift(draft(t.add(const Duration(days: 2)), slots: 3));
      expect(now.applicants, isEmpty);
      expect(tomorrow.autoConfirm, isFalse);
      expect(later.slots, 3);
      await expectLater(employer.createShift(draft(t.add(const Duration(days: 3)), wage: 9000)), _refused('WAGE_BELOW_MINIMUM'));
      await expectLater(employer.createShift(draft(t.subtract(const Duration(hours: 1)))), _refused('IN_THE_PAST'));
      final board = await employer.shifts(businessId, t.subtract(const Duration(hours: 1)), t.add(const Duration(days: 4)));
      expect(board.map((s) => s.id), [now.id, tomorrow.id, later.id]);
    });

    test('a worker cannot read the board', () async {
      await expectLater(
        SupabaseEmployerRepository(aziz, config).shifts(businessId, DateTime.utc(2026), DateTime.utc(2028)),
        _refused('NOT_FOUND'),
      );
    });
  });

  group('A03–A05 taking shifts', skip: _skip, () {
    test('the feed shows the shifts with the business as workers read it', () async {
      final t = DateTime.now().toUtc();
      final feed = await azizShifts.feed(FeedQuery(from: t, to: t.add(const Duration(days: 4)), lat: 37.558, lng: 126.95));
      expect(feed.map((s) => s.id), containsAll([now.id, tomorrow.id, later.id]));
      final card = feed.firstWhere((s) => s.id == now.id);
      expect(card.business.nameWithArea('uz'), 'Dalbit Kafe · Sinchon');
      expect(card.business.fullAddress('uz'), 'Mapo-gu, Sinchon-ro 12-gil 15, 2-qavat');
      expect(card.distanceKm, closeTo(1.2, 0.1));
      expect(card.slotsLeft, 2);
      expect(card.myStatus, isNull);
      final restaurants = await azizShifts.feed(FeedQuery(
          from: t,
          to: t.add(const Duration(days: 4)),
          lat: 37.558,
          lng: 126.95,
          categories: const {BusinessCategory.restaurant}));
      expect(restaurants, isEmpty);
      final details = await azizShifts.shift(tomorrow.id);
      expect(details?.hourlyWage, 11000);
      expect(details?.distanceKm, isNotNull, reason: 'from where the feed was read');
    });

    test('a worker nearby who is free then hears of the new shifts (at most 3 a day)', () async {
      final news = await SupabaseAccountRepository(malika).notifications();
      final matches = [for (final n in news) if (n.kind == NotificationKind.newShift) n];
      expect(matches, hasLength(3));
      expect(matches.every((n) => n.distanceKm != null && n.distanceKm! < 5), isTrue);
      expect(matches.map((n) => n.shiftId), containsAll([now.id, tomorrow.id, later.id]));
      expect(matches.first.businessName('uz'), 'Dalbit Kafe · Sinchon');
      final azizNews = await SupabaseAccountRepository(aziz).notifications();
      expect(azizNews.where((n) => n.kind == NotificationKind.newShift), isEmpty,
          reason: 'Aziz shared no position');
    });

    test('taking: at once, or waiting for the owner', () async {
      final taken = await azizShifts.apply(now.id);
      expect(taken.status, ApplicationStatus.confirmed);
      azizNow = taken.applicationId;
      expect((await azizShifts.apply(tomorrow.id)).status, ApplicationStatus.pending);
      expect((await malikaShifts.apply(tomorrow.id)).status, ApplicationStatus.pending);
      await expectLater(azizShifts.apply(now.id), _refused('ALREADY_APPLIED'));
      expect((await azizShifts.shift(now.id))?.holdsMyPlace, isTrue);
    });

    test('the owner hears of the applicants and confirms one', () async {
      final bell = await employer.notifications();
      expect(bell.where((n) => n.kind == EmployerNotificationKind.newApplicant).map((n) => n.workerName),
          containsAll(['Aziz Karimov', 'Malika Yusupova']));
      final shift = (await employer.shift(tomorrow.id))!;
      expect(shift.waiting, hasLength(2));
      final azizApp = shift.waiting.firstWhere((a) => a.worker.firstName == 'Aziz');
      expect(azizApp.worker.languages, ['uz', 'ru', 'ko']);
      expect(azizApp.worker.topik, 5);
      final decided = await employer.decide(azizApp.applicationId, accept: true);
      expect(decided.confirmed, 1);
      expect(decided.waiting, isEmpty, reason: 'the last place filled: Malika was turned down');
      await expectLater(employer.decide(azizApp.applicationId, accept: true), _refused('NOT_PENDING'));
      final malikaNews = await SupabaseAccountRepository(malika).notifications();
      expect(malikaNews.map((n) => n.kind), contains(NotificationKind.rejected));
      final azizNews = await SupabaseAccountRepository(aziz).notifications();
      final confirmed = azizNews.firstWhere((n) => n.kind == NotificationKind.confirmed);
      expect(confirmed.businessName('uz'), 'Dalbit Kafe · Sinchon');
      expect(confirmed.startsAt, isNotNull);
    });

    test('cancelling: free a day ahead; the owner is told', () async {
      final taken = await malikaShifts.apply(later.id);
      final cancelled = await malikaShifts.cancelApplication(taken.applicationId);
      expect(cancelled.status, ApplicationStatus.cancelled);
      expect(cancelled.lateCancel, isFalse);
      expect((await SupabaseAccountRepository(malika).stats()).reliability, 100);
      final bell = await employer.notifications();
      expect(bell.first.kind, EmployerNotificationKind.workerCancelled);
      expect(bell.first.workerName, 'Malika Yusupova');
    });
  });

  group('A07 the working day', skip: _skip, () {
    test('QR in: early is fine from 30 minutes before', () async {
      final qr = await employer.shiftQr(now.id);
      expect(ShiftQr.parse(qr)?.shiftId, now.id);
      await expectLater(azizShifts.checkIn('hanguk-ish:v1:${now.id}:000000000000000000000000'), _refused('QR_INVALID'));
      final atWork = await azizShifts.checkIn(qr);
      expect(atWork.status, ApplicationStatus.checkedIn);
      expect(atWork.lateMinutes, 0);
      await expectLater(azizShifts.checkIn(qr), _refused('ALREADY_CHECKED_IN'));
      expect((await employer.shift(now.id))!.crew.single.status, ApplicationStatus.checkedIn);
    });

    test('QR out: pay for the time inside the planned window', () async {
      // Two hours of work, as if the shift had started then.
      final t = DateTime.now().toUtc();
      await admin.from('shifts').update({
        'starts_at': t.subtract(const Duration(hours: 2)).toIso8601String(),
        'ends_at': t.add(const Duration(hours: 3)).toIso8601String(),
      }).eq('id', now.id);
      await admin.from('applications').update({
        'check_in_at': t.subtract(const Duration(hours: 2)).toIso8601String(),
      }).eq('id', azizNow);
      final done = await azizShifts.checkOut(await employer.shiftQr(now.id));
      expect(done.status, ApplicationStatus.completed);
      expect(done.workedMinutes, inInclusiveRange(119, 120));
      expect(done.payAmount, 10500 * done.workedMinutes! ~/ 60);
      expect(done.isPaid, isFalse);
    });

    test('A08 rating, BA5 report and payment', () async {
      await azizShifts.rateBusiness(azizNow, 5, {RatingTag.onTime, RatingTag.polite});
      final mine = (await azizShifts.myShift(azizNow))!;
      expect(mine.myStars, 5);
      expect(mine.myTags, {RatingTag.onTime, RatingTag.polite});
      expect(mine.shift.business.rating, 5.0);

      final w = DateTime.now().toUtc().add(const Duration(hours: 9));
      final today = DateTime.utc(w.year, w.month, w.day);
      var report = await employer.report(businessId, today.subtract(const Duration(days: 1)), today);
      final row = report.rows.single;
      expect(row.shiftId, now.id);
      expect(row.amount, mine.payAmount);
      expect(row.paid, isFalse);
      await employer.setShiftPaid(now.id, paid: true);
      report = await employer.report(businessId, today.subtract(const Duration(days: 1)), today);
      expect(report.paidAmount, mine.payAmount);
      final news = await SupabaseAccountRepository(aziz).notifications();
      expect(news.firstWhere((n) => n.kind == NotificationKind.paid).amount, mine.payAmount);
      expect((await SupabaseAccountRepository(aziz).stats()).completedShifts, 1);
    });
  });

  group('A10 chat, BA4 workers, A11/A12', skip: _skip, () {
    test('a message reaches the owner\'s bell once', () async {
      final sent = await azizShifts.sendMessage(azizNow, 'Rahmat, yaxshi kun bo\'ldi');
      expect(sent.fromMe, isTrue);
      await azizShifts.sendMessage(azizNow, 'Yana kelaman');
      final thread = await azizShifts.messages(azizNow);
      expect(thread.map((m) => m.body), ['Rahmat, yaxshi kun bo\'ldi', 'Yana kelaman']);
      final bell = await employer.notifications();
      expect(bell.where((n) => n.kind == EmployerNotificationKind.chatMessage), hasLength(1));
      await employer.markNotificationsRead();
      expect((await employer.notifications()).every((n) => n.read), isTrue);
    });

    test('the owner\'s workers, a favourite, an invitation', () async {
      final workers = await employer.workers(businessId);
      final azizCard = workers.single;
      expect(azizCard.fullName, 'Aziz Karimov');
      expect(azizCard.timesHere, 1);
      expect(azizCard.rating, isNull, reason: 'the business has not rated him');
      expect(await employer.toggleFavorite(businessId, azizCard.id), isTrue);
      expect((await employer.workers(businessId)).single.favorite, isTrue);
      await employer.requestAgain(later.id, azizCard.id);
      final news = await SupabaseAccountRepository(aziz).notifications();
      expect(news.where((n) => n.kind == NotificationKind.newShift && n.shiftId == later.id), isNotEmpty);
      await expectLater(employer.requestAgain(later.id, malika.auth.currentUser!.id), _refused('NOT_FOUND'));
    });

    test('live: a change reaches the person at once (Realtime)', () async {
      final events = <void>[];
      final subscription = SupabaseLiveUpdates(aziz).changes().listen(events.add);
      addTearDown(subscription.cancel);
      await Future<void>.delayed(const Duration(seconds: 3));
      await employer.requestAgain(tomorrow.id, aziz.auth.currentUser!.id);
      final deadline = DateTime.now().add(const Duration(seconds: 20));
      while (events.isEmpty && DateTime.now().isBefore(deadline)) {
        await Future<void>.delayed(const Duration(milliseconds: 200));
      }
      expect(events, isNotEmpty, reason: 'the invitation arrives while the app is open');
    });

    test('A12 is marked read; A11 reports are stored', () async {
      final account = SupabaseAccountRepository(aziz);
      await account.markNotificationsRead();
      expect((await account.notifications()).every((n) => n.read), isTrue);
      await account.report(ReportSubject.safety, 'Sinov xabari');
      final mine = await aziz.from('reports').select('reason, body');
      expect(mine.single, {'reason': 'safety', 'body': 'Sinov xabari'});
    });

    test('the owner calls a shift off; its workers are told', () async {
      await malikaShifts.apply(later.id);
      final cancelled = await employer.cancelShift(later.id);
      expect(cancelled.cancelled, isTrue);
      final news = await SupabaseAccountRepository(malika).notifications();
      expect(news.first.kind, NotificationKind.cancelled);
      expect(await malikaShifts.shift(later.id), isNotNull, reason: 'she applied, so she still sees it');
    });
  });

  group('BA0 registration (business-register edge function)', skip: _skip, () {
    late SupabaseEmployerRepository minjun;

    setUpAll(() async {
      if (_skip != null) return;
      minjun = SupabaseEmployerRepository(await _signIn('+821000000012'), config);
    });

    test('a new owner registers a number; without a 국세청 key it waits', () async {
      expect(await minjun.businesses(), isEmpty);
      final business = await minjun.registerBusiness('124-81-00998');
      expect(business.name, '사업장 124-81-00998');
      expect(business.verified, isFalse, reason: 'pending until 국세청 or a person confirms it');
      expect((await minjun.registerBusiness('1248100998')).id, business.id, reason: 'the same owner again');
      final start = DateTime.now().toUtc().add(const Duration(days: 1));
      await expectLater(
        minjun.createShift(ShiftDraft(
          businessId: business.id,
          title: '주방 보조',
          startsAt: start,
          endsAt: start.add(const Duration(hours: 4)),
          hourlyWage: 10500,
          slots: 1,
        )),
        _refused('BUSINESS_NOT_VERIFIED'),
      );
    });

    test('someone else\'s number is refused; a wrong check digit never leaves the phone', () async {
      await expectLater(employer.registerBusiness('124-81-00998'), _refused('BIZ_NO_TAKEN'));
      await expectLater(employer.registerBusiness('123-45-67890'), _refused('BIZ_NO_INVALID'));
    });

    test('the function refuses a caller who is not signed in', () async {
      final anonymous = SupabaseEmployerRepository(_client(_anonKey), config);
      await expectLater(anonymous.registerBusiness('1234567891'), throwsA(isA<ShiftActionException>()));
    });
  });

  group('signed out and offline', skip: _skip, () {
    test('nothing without signing in', () async {
      final anonymous = SupabaseShiftRepository(_client(_anonKey), config);
      final t = DateTime.now().toUtc();
      await expectLater(anonymous.feed(FeedQuery(from: t, to: t.add(const Duration(days: 1)))), throwsA(isA<ShiftActionException>()));
    });

    test('an unreachable server is an OfflineException', () async {
      final nowhere = SupabaseClient('http://127.0.0.1:9', _anonKey);
      final repo = SupabaseEmployerRepository(nowhere, config);
      await expectLater(repo.businesses(), throwsA(isA<OfflineException>()));
    });
  });
}
