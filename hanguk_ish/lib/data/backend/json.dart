/// Turns what the Supabase functions return (supabase/migrations/…, JSON in
/// the shapes `json_samples.sh` records) into the app's models.
///
/// Pure functions, so they are tested against the recorded responses
/// (test/fixtures/backend_samples.json) without a server.
library;

import '../models/account.dart';
import '../models/business.dart';
import '../models/employer.dart';
import '../models/my_shift.dart';
import '../models/shift.dart';
import '../../features/worker/profile/worker_profile_draft.dart';

typedef Json = Map<String, dynamic>;

/// Builds the public URL of a file in a Storage bucket (null for no file).
typedef PublicUrl = String? Function(String bucket, String? path);

String? _noUrl(String bucket, String? path) => null;

/// The app languages whose sentences are built from these values.
const appLanguages = ['uz', 'ru', 'en', 'ko'];

// ---------------------------------------------------------------------------
// Small readers: tolerant of nulls and of ints sent as doubles.
// ---------------------------------------------------------------------------

String _str(Object? v, [String fallback = '']) => v is String ? v : fallback;

String? _strOrNull(Object? v) => v is String && v.isNotEmpty ? v : null;

int _int(Object? v, [int fallback = 0]) => v is num ? v.toInt() : (v is String ? int.tryParse(v) ?? fallback : fallback);

int? _intOrNull(Object? v) => v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);

double? _double(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);

bool _bool(Object? v, [bool fallback = false]) => v is bool ? v : fallback;

DateTime? _date(Object? v) => v is String && v.isNotEmpty ? DateTime.parse(v).toUtc() : null;

DateTime _dateOr(Object? v, DateTime fallback) => _date(v) ?? fallback;

Json _obj(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};

List<Object?> _list(Object? v) => v is List ? v : const [];

/// `{"uz": "…"}` → `Map<String, String>`, skipping empty values.
Map<String, String> _texts(Object? v) => {
      for (final e in _obj(v).entries)
        if (e.value is String && (e.value as String).isNotEmpty) e.key: e.value as String,
    };

/// One field of a {"uz": {"area": …}, …} translations object, per language.
Map<String, String> _field(Object? translations, String key) => {
      for (final e in _obj(translations).entries)
        if (_obj(e.value)[key] case final String text when text.isNotEmpty) e.key: text,
    };

/// 'HH:MM[:SS]' → minutes after midnight.
int? _minutes(Object? v) {
  if (v is! String) return null;
  final parts = v.split(':');
  if (parts.length < 2) return null;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  return h == null || m == null ? null : h * 60 + m;
}

// ---------------------------------------------------------------------------
// Businesses and shifts (worker app)
// ---------------------------------------------------------------------------

/// `business_brief` / `business_card` / `my_businesses` → [Business].
Business businessFromJson(Json json, {PublicUrl publicUrl = _noUrl}) {
  final name = _str(json['name']);
  final area = _str(json['area']);
  final address = _str(json['address']);
  final detail = _str(json['address_detail']);
  final translations = json['translations'];
  // The Korean originals are what Korean readers see (the model falls back
  // to English for a missing language).
  return Business(
    id: _str(json['id']),
    name: name,
    names: {'ko': name, ..._texts(json['name_i18n'])},
    area: area,
    areas: {if (area.isNotEmpty) 'ko': area, ..._field(translations, 'area')},
    category: businessCategoryFrom(_strOrNull(json['category'])),
    verified: _bool(json['verified'], true),
    address: address,
    addresses: {if (address.isNotEmpty) 'ko': address, ..._field(translations, 'address')},
    addressDetail: detail,
    addressDetails: {if (detail.isNotEmpty) 'ko': detail, ..._field(translations, 'address_detail')},
    lat: _double(json['lat']),
    lng: _double(json['lng']),
    photoUrl: publicUrl('businesses', _strOrNull(json['photo_path'])),
    rating: _double(json['rating']),
    ratingCount: _int(json['rating_count']),
    completedShifts: _int(json['completed_shifts']),
  );
}

/// `shifts.translations` → per-language texts.
Map<String, ShiftText> _shiftTexts(Object? v) => {
      for (final e in _obj(v).entries)
        e.key: ShiftText(
          title: _strOrNull(_obj(e.value)['title']),
          duties: _strOrNull(_obj(e.value)['duties']),
          dress: _strOrNull(_obj(e.value)['dress']),
          address: _strOrNull(_obj(e.value)['address']),
        ),
    };

/// `shift_card` (feed, details, my shifts) → [ShiftListing].
ShiftListing shiftListingFromJson(Json json, {PublicUrl publicUrl = _noUrl}) {
  final startsAt = _dateOr(json['starts_at'], DateTime.utc(1970));
  return ShiftListing(
    id: _str(json['id']),
    business: businessFromJson(_obj(json['business']), publicUrl: publicUrl),
    title: _str(json['title']),
    duties: _str(json['duties']),
    dress: _str(json['dress']),
    address: _str(json['address']),
    translations: _shiftTexts(json['translations']),
    startsAt: startsAt,
    endsAt: _dateOr(json['ends_at'], startsAt),
    hourlyWage: _int(json['hourly_wage']),
    slots: _int(json['slots']),
    slotsLeft: _int(json['slots_left']),
    autoConfirm: _bool(json['auto_confirm']),
    distanceKm: _double(json['distance_km']),
    lat: _double(json['lat']),
    lng: _double(json['lng']),
    myStatus: applicationStatusFrom(_strOrNull(json['my_status'])),
    myApplicationId: _strOrNull(json['my_application_id']),
  );
}

/// `application_card` (my_shifts / my_shift) → [MyShift].
MyShift myShiftFromJson(Json json, {PublicUrl publicUrl = _noUrl}) => MyShift(
      applicationId: _str(json['application_id']),
      shift: shiftListingFromJson(_obj(json['shift']), publicUrl: publicUrl),
      status: applicationStatusFrom(_strOrNull(json['status'])) ?? ApplicationStatus.pending,
      checkInAt: _date(json['check_in_at']),
      checkOutAt: _date(json['check_out_at']),
      lateMinutes: _intOrNull(json['late_minutes']),
      workedMinutes: _intOrNull(json['worked_minutes']),
      payAmount: _intOrNull(json['pay_amount']),
      paidAt: _date(json['paid_at']),
      cancelledAt: _date(json['cancelled_at']),
      lateCancel: _bool(json['late_cancel']),
      myStars: _intOrNull(json['my_stars']),
      myTags: {
        for (final t in _list(json['my_tags']))
          if (t is String) ?RatingTag.fromDb(t),
      },
    );

/// `worker_stats` row → [WorkerStats].
WorkerStats workerStatsFromJson(Json json) => WorkerStats(
      completedShifts: _int(json['completed_shifts']),
      ratingCount: _int(json['ratings']),
      ratingAverage: _double(json['rating']),
      reliability: _int(json['reliability'], 100),
    );

/// A `messages` row → [ChatMessage]; [myId] tells which side sent it.
ChatMessage chatMessageFromJson(Json json, {required String myId}) => ChatMessage(
      id: '${json['id']}',
      applicationId: _str(json['application_id']),
      fromMe: json['sender_id'] == myId,
      body: _str(json['body']),
      createdAt: _dateOr(json['created_at'], DateTime.utc(1970)),
      lang: _strOrNull(json['lang']),
      translations: _texts(json['translations']),
    );

/// Notification kinds the worker app shows.
const workerNotificationKinds = [
  'shift_reminder',
  'application_confirmed',
  'application_rejected',
  'new_shift_match',
  'nearby_digest',
  'request_again',
  'chat_message',
  'payment_marked',
];

/// `notification_card` → an A12 entry; null for kinds the worker app does not
/// show (and «pay unmarked», which is not news).
HiNotification? hiNotificationFromJson(Json json) {
  final data = _obj(json['data']);
  final kindName = _str(json['kind']);
  final kind = switch (kindName) {
    'shift_reminder' => NotificationKind.shiftReminder,
    'application_confirmed' => NotificationKind.confirmed,
    'application_rejected' when data['reason'] == 'shift_cancelled' => NotificationKind.cancelled,
    'application_rejected' => NotificationKind.rejected,
    'payment_marked' when data['paid'] == true => NotificationKind.paid,
    'chat_message' => NotificationKind.message,
    'new_shift_match' || 'request_again' => NotificationKind.newShift,
    'nearby_digest' => NotificationKind.nearbyShifts,
    _ => null,
  };
  if (kind == null) return null;
  final shift = _obj(json['shift']);
  final businessJson = _obj(json['business']);
  final business = businessJson.isEmpty ? null : businessFromJson(businessJson);
  final application = _obj(json['application']);
  final digest = kind == NotificationKind.nearbyShifts;
  final area = _str(data['area']);
  return HiNotification(
    id: '${json['id']}',
    kind: kind,
    createdAt: _dateOr(json['created_at'], DateTime.utc(1970)),
    read: json['read_at'] != null,
    businessNames: business == null ? const {} : {for (final l in appLanguages) l: business.nameWithArea(l)},
    businessId: business?.id ?? _strOrNull(data['business_id']),
    shiftId: _strOrNull(shift['id']) ?? _strOrNull(data['shift_id']),
    applicationId: _strOrNull(application['id']) ?? _strOrNull(data['application_id']),
    startsAt: _date(shift['starts_at']),
    endsAt: _date(shift['ends_at']),
    minutesBefore: _intOrNull(data['minutes_before']),
    wage: digest ? _intOrNull(data['wage_min']) : _intOrNull(shift['hourly_wage']),
    wageMax: digest ? _intOrNull(data['wage_max']) : null,
    amount: _intOrNull(application['pay_amount']),
    distanceKm: _double(data['distance_km']),
    count: _intOrNull(data['count']),
    areaNames: {if (area.isNotEmpty) 'ko': area, ..._texts(data['area_i18n'])},
    categories: [for (final c in _list(data['categories'])) if (c is String) c],
    lat: _double(shift['lat']) ?? _double(data['lat']),
    lng: _double(shift['lng']) ?? _double(data['lng']),
  );
}

/// `my_profile` → the A02 form as saved; null before onboarding. The photo
/// comes back as its public URL.
WorkerProfileDraft? workerProfileFromJson(Json? json, {PublicUrl publicUrl = _noUrl}) {
  if (json == null) return null;
  final worker = _obj(json['worker']);
  if (worker.isEmpty || worker['onboarded_at'] == null) return null;
  return WorkerProfileDraft(
    firstName: _str(json['first_name']),
    lastName: _str(json['last_name']),
    photoPath: publicUrl('avatars', _strOrNull(json['avatar_path'])),
    languages: {for (final l in _list(worker['languages'])) if (l is String) l},
    topik: _int(worker['topik']),
    university: _strOrNull(worker['university']),
    district: _strOrNull(worker['district']),
    availability: _int(worker['availability']),
    visa: _strOrNull(worker['visa']),
  );
}

// ---------------------------------------------------------------------------
// Employer app
// ---------------------------------------------------------------------------

/// `worker_card` → [WorkerCard].
WorkerCard workerCardFromJson(Json json) => WorkerCard(
      id: _str(json['id']),
      firstName: _str(json['first_name']),
      lastName: _str(json['last_name']),
      rating: _double(json['rating']),
      completedShifts: _int(json['completed_shifts']),
      timesHere: _int(json['shifts_here']),
      topik: _int(json['topik']),
      languages: [for (final l in _list(json['languages'])) if (l is String) l],
      favorite: _bool(json['favorite']),
      lastWorkedAt: _date(json['last_worked_at']),
    );

/// One `applicants` entry of `shift_board` → [ShiftApplicant].
ShiftApplicant shiftApplicantFromJson(Json json) => ShiftApplicant(
      applicationId: _str(json['application_id']),
      worker: workerCardFromJson(_obj(json['worker'])),
      status: applicationStatusFrom(_strOrNull(json['status'])) ?? ApplicationStatus.pending,
      appliedAt: _date(json['created_at']),
      decidedAt: _date(json['decided_at']),
      checkInAt: _date(json['check_in_at']),
      checkOutAt: _date(json['check_out_at']),
      lateMinutes: _intOrNull(json['late_minutes']),
      workedMinutes: _intOrNull(json['worked_minutes']),
      payAmount: _intOrNull(json['pay_amount']),
      paidAt: _date(json['paid_at']),
    );

/// `shift_board` (business_board / employer_shift) → [EmployerShift].
EmployerShift employerShiftFromJson(Json json) {
  final startsAt = _dateOr(json['starts_at'], DateTime.utc(1970));
  return EmployerShift(
    id: _str(json['id']),
    businessId: _str(json['business_id']),
    title: _str(json['title']),
    duties: _str(json['duties']),
    dress: _str(json['dress']),
    address: _str(json['address']),
    startsAt: startsAt,
    endsAt: _dateOr(json['ends_at'], startsAt),
    hourlyWage: _int(json['hourly_wage']),
    slots: _int(json['slots']),
    autoConfirm: _bool(json['auto_confirm']),
    cancelled: json['status'] == 'cancelled',
    templateId: _strOrNull(json['template_id']),
    applicants: [for (final a in _list(json['applicants'])) shiftApplicantFromJson(_obj(a))],
  );
}

/// A `shift_templates` row → [ShiftTemplate].
ShiftTemplate shiftTemplateFromJson(Json json) => ShiftTemplate(
      id: _str(json['id']),
      title: _str(json['title']),
      duties: _str(json['duties']),
      dress: _str(json['dress']),
      address: _str(json['address']),
      startMinute: _minutes(json['start_time']),
      endMinute: _minutes(json['end_time']),
      hourlyWage: _intOrNull(json['hourly_wage']),
      slots: _intOrNull(json['slots']),
    );

/// [ShiftTemplate] → a `shift_templates` row of [businessId].
Json shiftTemplateToJson(String businessId, ShiftTemplate t) {
  String? time(int? minutes) => minutes == null
      ? null
      : '${(minutes ~/ 60 % 24).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
  return {
    'id': t.id,
    'business_id': businessId,
    'title': t.title,
    'duties': t.duties,
    'dress': t.dress,
    'address': t.address,
    'start_time': time(t.startMinute),
    'end_time': time(t.endMinute),
    'hourly_wage': t.hourlyWage,
    'slots': t.slots,
  };
}

/// [ShiftDraft] → the columns of `shifts` a member may write.
Json shiftDraftToJson(ShiftDraft d, {bool includeBusiness = true}) => {
      if (includeBusiness) 'business_id': d.businessId,
      if (includeBusiness) 'template_id': d.templateId,
      'title': d.title,
      'duties': d.duties,
      'dress': d.dress,
      'address': d.address,
      'starts_at': d.startsAt.toUtc().toIso8601String(),
      'ends_at': d.endsAt.toUtc().toIso8601String(),
      'hourly_wage': d.hourlyWage,
      'slots': d.slots,
      'auto_confirm': d.autoConfirm,
    };

/// A `business_report` row → [ReportRow].
ReportRow reportRowFromJson(Json json) => ReportRow(
      shiftId: _str(json['shift_id']),
      startsAt: _dateOr(json['starts_at'], DateTime.utc(1970)),
      title: _str(json['title']),
      workers: _int(json['workers']),
      minutes: _int(json['worked_minutes']),
      amount: _int(json['total_pay']),
      paid: _bool(json['paid']),
    );

/// Notification kinds the employer app shows.
const employerNotificationKinds = ['new_applicant', 'worker_cancelled', 'no_show', 'chat_message'];

/// `notification_card` → a bell entry; null for kinds the employer app does
/// not show.
EmployerNotification? employerNotificationFromJson(Json json) {
  final kind = employerNotificationKindFrom(_strOrNull(json['kind']));
  if (kind == null) return null;
  final data = _obj(json['data']);
  final shift = _obj(json['shift']);
  final worker = _obj(json['worker']);
  return EmployerNotification(
    id: '${json['id']}',
    kind: kind,
    createdAt: _dateOr(json['created_at'], DateTime.utc(1970)),
    shiftId: _strOrNull(shift['id']) ?? _str(data['shift_id']),
    shiftTitle: _str(shift['title']),
    workerName: '${_str(worker['first_name'])} ${_str(worker['last_name'])}'.trim(),
    read: json['read_at'] != null,
  );
}
