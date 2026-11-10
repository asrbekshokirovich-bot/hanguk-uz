import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/data/backend/backend.dart';
import 'package:hanguk_ish/data/backend/json.dart';
import 'package:hanguk_ish/data/models/account.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/employer.dart';
import 'package:hanguk_ish/data/models/my_shift.dart';
import 'package:hanguk_ish/data/models/shift.dart';

/// What the real database functions return (supabase/tests/json_samples.sh).
final Map<String, dynamic> samples =
    jsonDecode(File('test/fixtures/backend_samples.json').readAsStringSync()) as Map<String, dynamic>;

List<Json> sampleList(String name) => [for (final e in samples[name] as List) e as Json];

const a1 = '00000000-0000-0000-0000-0000000000a1';
const config = BackendConfig(url: 'https://ish.supabase.co', publishableKey: 'anon');

void main() {
  group('worker app', () {
    test('feed cards: the shift, its business and my application', () {
      final feed = [for (final c in sampleList('shift_feed')) shiftListingFromJson(c, publicUrl: config.publicUrl)];
      expect(feed, hasLength(5));
      final s4 = feed.firstWhere((s) => s.id.endsWith('04'));
      expect(s4.myStatus, ApplicationStatus.confirmed);
      expect(s4.holdsMyPlace, isTrue);
      expect(s4.myApplicationId, '30000000-0000-0000-0000-000000000004');
      expect(s4.slots, 3);
      expect(s4.slotsLeft, 2);
      expect(s4.hourlyWage, 10500);
      expect(s4.autoConfirm, isTrue);
      expect(s4.distanceKm, closeTo(1.195, 0.001));
      expect(s4.endsAt.isAfter(s4.startsAt), isTrue);
      expect(s4.startsAt.isUtc, isTrue);

      final b = s4.business;
      expect(b.name, '달빛카페 신촌점');
      expect(b.category, BusinessCategory.cafe);
      expect(b.verified, isTrue);
      expect(b.nameWithArea('uz'), 'Dalbit Kafe · Sinchon');
      expect(b.nameWithArea('ru'), 'Кафе Дальбит · Синчон');
      expect(b.nameWithArea('ko'), '달빛카페 · 신촌');
      expect(b.fullAddress('uz'), 'Mapo-gu, Sinchon-ro 12-gil 15, 2-qavat');
      expect(b.fullAddress('ko'), '마포구 신촌로12길 15, 2층');
      expect(b.rating, 5.0);
      expect(b.ratingCount, 1);
      expect(b.completedShifts, 1);
      expect(b.lat, closeTo(37.5559, 1e-6));
      expect(b.photoUrl,
          'https://ish.supabase.co/storage/v1/object/public/businesses/10000000-0000-0000-0000-000000000001/photo.jpg');
      expect(b.initial, '달');
    });

    test('a translated shift reads in the app language', () {
      final s1 = shiftListingFromJson(samples['shift_details'] as Json);
      expect(s1.id, '20000000-0000-0000-0000-000000000001');
      expect(s1.displayTitle('uz'), 'Zal va kassa yordamchisi');
      expect(s1.displayTitle('ru'), '홀·카운터 보조', reason: 'no Russian yet: the Korean original');
      expect(s1.displayDuties('uz'), ['Buyurtma qabul qilish', 'Ichimliklar', 'Zalni tartibga solish']);
      expect(s1.displayDuties('ko'), ['주문 접수', '음료 보조', '홀 정리']);
      expect(s1.displayDress('uz'), 'Qora shim, krossovka');
      expect(s1.placeAddress('uz'), 'Mapo-gu, Sinchon-ro 12-gil 15, 2-qavat');
      expect(s1.totalPay, 52500);
    });

    test('my shifts: statuses, pay, my rating', () {
      final a1Shifts = [for (final c in sampleList('my_shifts_a1')) myShiftFromJson(c)];
      expect([for (final s in a1Shifts) s.status],
          [ApplicationStatus.noShow, ApplicationStatus.confirmed, ApplicationStatus.confirmed]);
      expect(a1Shifts.first.isDone, isTrue);
      expect(a1Shifts[1].isUpcoming, isTrue);

      final done = [for (final c in sampleList('my_shifts_a2')) myShiftFromJson(c)]
          .firstWhere((s) => s.status == ApplicationStatus.completed);
      expect(done.payAmount, 66000);
      expect(done.pay, 66000);
      expect(done.workedMinutes, 360);
      expect(done.lateMinutes, 0);
      expect(done.isPaid, isTrue);
      expect(done.checkInAt, isNotNull);
      expect(done.checkOutAt, isNotNull);
      expect(done.myStars, 5);
      expect(done.myTags, {RatingTag.onTime, RatingTag.polite, RatingTag.wouldReturn});
      expect(done.shift.title, '주말 브런치 보조');

      final one = myShiftFromJson(samples['my_shift'] as Json);
      expect(one.applicationId, '30000000-0000-0000-0000-000000000004');
      expect(one.myStars, isNull);
      expect(one.myTags, isEmpty);
      expect(one.lateCancel, isFalse);
    });

    test('notifications: every kind the worker sees, with its values', () {
      final all = [for (final c in sampleList('my_notifications_worker')) hiNotificationFromJson(c)];
      expect(all.whereType<HiNotification>(), hasLength(7));
      HiNotification of(NotificationKind kind) => all.whereType<HiNotification>().firstWhere((n) => n.kind == kind);

      final reminder = of(NotificationKind.shiftReminder);
      expect(reminder.minutesBefore, 120);
      expect(reminder.startsAt, isNotNull);
      expect(reminder.endsAt, isNotNull);
      expect(reminder.businessName('uz'), 'Dalbit Kafe · Sinchon');
      expect(reminder.lat, closeTo(37.5559, 1e-6));
      expect(reminder.read, isFalse);

      final confirmed = of(NotificationKind.confirmed);
      expect(confirmed.shiftId, '20000000-0000-0000-0000-000000000002');
      expect(confirmed.businessName('ko'), '달빛카페 · 신촌');

      final match = all.whereType<HiNotification>().firstWhere(
          (n) => n.kind == NotificationKind.newShift && n.distanceKm != null);
      expect(match.distanceKm, 3.8);
      expect(match.wage, 10500);

      final digest = of(NotificationKind.nearbyShifts);
      expect(digest.count, 3);
      expect(digest.areaName('uz'), 'Hongdae');
      expect(digest.areaName('ko'), '홍대');
      expect(digest.categories, ['cafe', 'retail']);
      expect(digest.wage, 10500);
      expect(digest.wageMax, 11500);
      expect(digest.businessNames, isEmpty);

      final paid = of(NotificationKind.paid);
      expect(paid.amount, 66000);

      final message = of(NotificationKind.message);
      expect(message.applicationId, '30000000-0000-0000-0000-000000000004');

      final invite = all.whereType<HiNotification>().firstWhere(
          (n) => n.kind == NotificationKind.newShift && n.distanceKm == null);
      expect(invite.shiftId, '20000000-0000-0000-0000-000000000001');
    });

    test('the evening digest names the worker\'s district by its code', () {
      final digest = hiNotificationFromJson({
        'id': 20,
        'kind': 'nearby_digest',
        'data': {'count': 4, 'area_code': 'mapo', 'categories': ['cafe'], 'wage_min': 10500, 'wage_max': 11000},
        'created_at': '2026-11-10T09:00:00+00:00',
      })!;
      expect(digest.areaName('uz'), 'Mapo-gu, Seul');
      expect(digest.areaName('ko'), '서울 마포구');
      expect(digest.count, 4);
      final typed = hiNotificationFromJson({
        'id': 21,
        'kind': 'nearby_digest',
        'data': {'count': 1, 'area_code': 'Mapo-gu'},
        'created_at': '2026-11-10T09:00:00+00:00',
      })!;
      expect(typed.areaName('ru'), 'Mapo-gu', reason: 'typed text is shown as typed');
    });

    test('a cancelled shift and an unmarked payment', () {
      final cancelled = hiNotificationFromJson({
        'id': 9,
        'kind': 'application_rejected',
        'data': {'reason': 'shift_cancelled', 'shift_id': 's'},
        'created_at': '2026-11-10T03:00:00+00:00',
        'read_at': null,
      });
      expect(cancelled?.kind, NotificationKind.cancelled);
      expect(cancelled?.shiftId, 's');
      final full = hiNotificationFromJson({
        'id': 10,
        'kind': 'application_rejected',
        'data': {'reason': 'full'},
        'created_at': '2026-11-10T03:00:00+00:00',
      });
      expect(full?.kind, NotificationKind.rejected);
      expect(
          hiNotificationFromJson({
            'id': 11,
            'kind': 'payment_marked',
            'data': {'paid': false},
            'created_at': '2026-11-10T03:00:00+00:00',
          }),
          isNull);
      expect(hiNotificationFromJson({'id': 12, 'kind': 'new_applicant', 'data': {}}), isNull,
          reason: 'employer kinds are not shown to workers');
    });

    test('profile, stats and chat', () {
      final profile = workerProfileFromJson(samples['my_profile_worker'] as Json, publicUrl: config.publicUrl)!;
      expect(profile.firstName, 'Aziz');
      expect(profile.lastName, 'Karimov');
      expect(profile.languages.toList(), ['uz', 'ru', 'en', 'ko']);
      expect(profile.topik, 4);
      expect(profile.university, 'Sogang');
      expect(profile.district, 'Mapo-gu');
      expect(profile.availability, 268435455);
      expect(profile.photoPath, isNull);
      expect(workerProfileFromJson(null), isNull);
      expect(workerProfileFromJson({'first_name': 'A', 'worker': null}), isNull, reason: 'before A02');
      expect(workerProfileFromJson({'first_name': 'A', 'worker': {'onboarded_at': null}}), isNull);
      expect(
          workerProfileFromJson({
            'first_name': 'A',
            'last_name': 'B',
            'avatar_path': '$a1/avatar-1.jpg',
            'worker': {'onboarded_at': '2026-11-10T00:00:00+00:00', 'languages': ['uz']},
          }, publicUrl: config.publicUrl)?.photoPath,
          'https://ish.supabase.co/storage/v1/object/public/avatars/$a1/avatar-1.jpg');

      final stats = workerStatsFromJson(sampleList('worker_stats').single);
      expect(stats.reliability, 80, reason: 'a1 missed s7 (−20)');
      expect(stats.completedShifts, 0);
      expect(stats.ratingCount, 0);
      expect(stats.ratingAverage, isNull);

      final chat = [for (final m in sampleList('messages')) chatMessageFromJson(m, myId: a1)];
      expect(chat.map((m) => m.fromMe), [true, false]);
      expect(chat.first.lang, 'uz');
      expect(chat.last.body, '네, 기다릴게요');
      expect(chat.last.translations, {'uz': "Xo'p, kutamiz"});
      expect(chat.first.id, isNotEmpty);
    });

    test('taking a shift and the QR payload', () {
      final row = samples['apply_to_shift'] as Json;
      expect(applicationStatusFrom(row['status'] as String), ApplicationStatus.pending);
      final qr = ShiftQr.parse(samples['shift_qr'] as String)!;
      expect(qr.shiftId, '20000000-0000-0000-0000-000000000004');
      expect(qr.token, hasLength(24));
    });
  });

  group('employer app', () {
    test('the owner\'s businesses', () {
      final businesses = [for (final c in sampleList('my_businesses')) businessFromJson(c)];
      expect(businesses.single.name, '달빛카페 신촌점');
      expect(businesses.single.verified, isTrue);
      expect(businesses.single.review, BusinessReview.verified);
      expect(businesses.single.bizNo, '1234567890');
    });

    test("a business still waiting for 국세청, or refused", () {
      Business card(String status) => businessFromJson({'id': 'b', 'name': '사업장 999-00-00054', 'status': status});
      expect(card('pending').review, BusinessReview.pending);
      expect(card('rejected').review, BusinessReview.rejected);
      expect(businessFromJson({'id': 'b', 'name': 'n', 'verified': false}).review, BusinessReview.pending,
          reason: "a worker's card says only whether it is verified");
      expect(businessFromJson({'id': 'b', 'name': 'n'}).bizNo, isNull);
    });

    test('the board: shifts with applicants and what is known about them', () {
      final board = [for (final c in sampleList('business_board')) employerShiftFromJson(c)];
      expect(board, hasLength(7));
      expect(board.map((s) => s.startsAt), orderedEquals([...board.map((s) => s.startsAt)]..sort()));
      final s5 = employerShiftFromJson(samples['employer_shift'] as Json);
      expect(s5.title, '마감 정리 보조');
      expect(s5.hourlyWage, 12000);
      expect(s5.autoConfirm, isFalse);
      expect(s5.cancelled, isFalse);
      final malika = s5.applicants.single;
      expect(malika.status, ApplicationStatus.checkedIn);
      expect(malika.lateMinutes, 2);
      expect(malika.checkInAt, isNotNull);
      expect(malika.decidedAt, isNotNull);
      expect(malika.appliedAt, isNotNull);
      expect(malika.worker.fullName, 'Malika Yusupova');
      expect(malika.worker.languages, ['uz', 'ru', 'ko']);
      expect(malika.worker.topik, 5);
      expect(malika.worker.rating, 5.0);
      expect(malika.worker.favorite, isTrue);
      expect(s5.confirmed, 1);

      final s2 = board.firstWhere((s) => s.id.endsWith('02'));
      expect(s2.applicants.single.status, ApplicationStatus.confirmed);
      expect(s2.applicants.single.worker.firstName, 'Aziz');
      final s3 = board.firstWhere((s) => s.id.endsWith('03'));
      expect(s3.applicants.single.status, ApplicationStatus.cancelled);
      final s7 = board.firstWhere((s) => s.id.endsWith('07'));
      expect(s7.applicants.map((a) => a.status), containsAll([ApplicationStatus.completed, ApplicationStatus.noShow]));
      expect(s7.applicants.firstWhere((a) => a.status == ApplicationStatus.completed).paidAt, isNotNull);
    });

    test('workers, report, templates', () {
      final worker = workerCardFromJson(sampleList('business_workers').single);
      expect(worker.fullName, 'Malika Yusupova');
      expect(worker.timesHere, 1);
      expect(worker.completedShifts, 1);
      expect(worker.favorite, isTrue);
      expect(worker.lastWorkedAt, isNotNull);

      final row = reportRowFromJson(sampleList('business_report').single);
      expect(row.title, '주말 브런치 보조');
      expect(row.workers, 1);
      expect(row.minutes, 360);
      expect(row.amount, 66000);
      expect(row.paid, isTrue);

      final templates = [for (final t in sampleList('shift_templates')) shiftTemplateFromJson(t)];
      expect(templates.first.title, '홀·카운터 보조');
      expect(templates.first.startMinute, 14 * 60);
      expect(templates.first.endMinute, 19 * 60);
      expect(templates.first.hourlyWage, 10500);
      expect(templates.first.slots, 3);
      expect(templates.last.startMinute, isNull);
      expect(templates.last.hourlyWage, isNull);

      final back = shiftTemplateToJson('biz', templates.first);
      expect(back['start_time'], '14:00');
      expect(back['end_time'], '19:00');
      expect(back['business_id'], 'biz');
      expect(shiftTemplateFromJson(back).startMinute, 840);
      expect(samples['minimum_wage'], 10320);
    });

    test('the bell', () {
      final bell = [
        for (final c in sampleList('my_notifications_employer')) ?employerNotificationFromJson(c),
      ];
      expect(bell.map((n) => n.kind), [
        EmployerNotificationKind.noShow,
        EmployerNotificationKind.chatMessage,
        EmployerNotificationKind.workerCancelled,
        EmployerNotificationKind.newApplicant,
        EmployerNotificationKind.newApplicant,
      ]);
      expect(bell.first.workerName, 'Aziz Karimov');
      expect(bell.first.shiftTitle, '주말 브런치 보조');
      expect(bell[2].workerName, 'Timur Kim');
      expect(bell.every((n) => !n.read), isTrue);
      expect(bell.every((n) => n.shiftId.isNotEmpty), isTrue);
    });

    test('a new shift as BA2 sends it', () {
      final draft = ShiftDraft(
        businessId: 'biz',
        title: '홀',
        startsAt: DateTime.utc(2026, 11, 12, 5),
        endsAt: DateTime.utc(2026, 11, 12, 10),
        hourlyWage: 10500,
        slots: 3,
        templateId: 't',
      );
      expect(shiftDraftToJson(draft), {
        'business_id': 'biz',
        'template_id': 't',
        'title': '홀',
        'duties': '',
        'dress': '',
        'address': '',
        'starts_at': '2026-11-12T05:00:00.000Z',
        'ends_at': '2026-11-12T10:00:00.000Z',
        'hourly_wage': 10500,
        'slots': 3,
        'auto_confirm': true,
      });
      expect(shiftDraftToJson(draft, includeBusiness: false).containsKey('business_id'), isFalse);
    });
  });

  group('backend', () {
    test('error codes', () {
      expect(backendErrorCode('SHIFT_FULL', 'P0001'), 'SHIFT_FULL');
      expect(backendErrorCode('new row for relation "worker_profiles" violates check constraint', '23514'), 'INVALID');
      expect(backendErrorCode('permission denied for function my_shifts', '42501'), 'FORBIDDEN');
      expect(backendErrorCode('JSON object requested, multiple (or no) rows returned', 'PGRST116'), 'NOT_FOUND');
      expect(backendErrorCode('duplicate key value', '23505'), 'CONFLICT');
      expect(backendErrorCode('something else', null), 'UNKNOWN');
    });

    test('public file URLs', () {
      expect(config.publicUrl('avatars', 'u/a b.jpg'), 'https://ish.supabase.co/storage/v1/object/public/avatars/u/a%20b.jpg');
      expect(const BackendConfig(url: 'https://x.co/', publishableKey: 'k').publicUrl('b', 'p'),
          'https://x.co/storage/v1/object/public/b/p');
      expect(config.publicUrl('avatars', null), isNull);
      expect(BackendConfig.none.publicUrl('avatars', 'p'), isNull);
      expect(BackendConfig.none.isConfigured, isFalse);
      expect(config.isConfigured, isTrue);
    });
  });
}
