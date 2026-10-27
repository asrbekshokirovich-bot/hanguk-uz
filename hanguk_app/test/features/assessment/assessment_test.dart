import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/assessment/domain/assessment.dart';
import 'package:hanguk_app/features/catalog/data/catalog_filters.dart';
import 'package:hanguk_app/features/catalog/domain/catalog_models.dart';
import 'package:hanguk_app/features/onboarding/domain/eligibility_engine.dart';
import 'package:hanguk_app/features/onboarding/domain/quiz_answers.dart';

CatalogUniversity uni(
  String id, {
  num? topik,
  String city = 'Daegu',
  String? type,
  bool? partner,
  num? tuition,
}) => CatalogUniversity(
  institutionId: id,
  guidelines: [
    CatalogGuideline(
      id: 'g-$id',
      institutionId: id,
      univNameEn: '$id University',
      city: city,
      degree: 'bakalavr',
      koreanTrack: true,
      topikMin: topik,
      institutionType: type,
      isPartner: partner,
      currency: 'KRW',
      tuitionMin: tuition,
      tuitionMax: tuition,
      ieqasStatus: 'accredited',
      isActive: true,
    ),
  ],
);

void main() {
  const rules = EligibilityRules();

  group('admissionPercent', () {
    final g = uni('a', topik: 3).primary;
    int at(int topik, {double gpa = 3.5}) => admissionPercent(AssessmentInput(topik: topik, gpa: gpa), g);

    test('by the TOPIK difference', () {
      expect(at(1), 15);
      expect(at(2), 30);
      expect(at(3), 55);
      expect(at(4), 68);
      expect(at(5), 78);
      expect(at(6), 78);
    });

    test('the certificate moves it by 10 a point, at most 15', () {
      expect(at(3, gpa: 4.5), 65);
      expect(at(3, gpa: 5.0), 70);
      expect(at(3, gpa: 3.0), 50);
    });

    test('a partner adds 5, and it stays within 5–95', () {
      final p = uni('p', topik: 3, partner: true).primary;
      expect(admissionPercent(const AssessmentInput(topik: 3, gpa: 3.5), p), 60);
      final hard = uni('h', topik: 6).primary;
      expect(admissionPercent(const AssessmentInput(topik: 0, gpa: 1.0), hard), 5);
    });

    test('no requirement in the Excel: the route\'s own', () {
      final none = uni('n').primary;
      expect(
        admissionPercent(const AssessmentInput(topik: 3, gpa: 3.5), none),
        admissionPercent(const AssessmentInput(topik: 3, gpa: 3.5), uni('r', topik: rules.bachelorTopikMin).primary),
      );
    });
  });

  test('requiredBank: the capital area\'s deposit when any university is there', () {
    final daegu = requiredBank(StudyRoute.bachelor, [uni('d')]);
    final seoul = requiredBank(StudyRoute.bachelor, [uni('d'), uni('s', city: 'Seoul')]);
    expect(daegu, (rules.degreeKdbUsd.$1 * rules.krwPerUsd).round());
    expect(seoul, (rules.degreeKdbUsd.$2 * rules.krwPerUsd).round());
  });

  group('assess', () {
    final catalog = [uni('a', topik: 3), uni('b', topik: 4), uni('c', topik: 2)];
    final need = requiredBank(StudyRoute.bachelor, catalog);

    test('enough bank and TOPIK alone: a fair chance, not yet a high one', () {
      final o = assess(
        AssessmentInput(topik: 4, gpa: 4.2, bankKrw: need, universityIds: const ['a', 'b', 'c']),
        catalog: catalog,
      );
      // 30 + TOPIK 4 (12) + the bank (15) + a 4.2 certificate (3).
      expect(o.band, EligibilityBand.mid);
      expect(o.visaPercent, 60);
      expect(o.visaWithConsultantPercent, greaterThan(o.visaPercent));
      expect(o.chances.map((c) => c.university.institutionId), ['a', 'b', 'c']);
      expect(o.openCount, 3);
      expect(o.fixes.where((f) => f.kind == FixKind.bank), isEmpty);
    });

    test('short of the bank: a fix that names the amount and what it adds', () {
      final o = assess(
        const AssessmentInput(topik: 4, gpa: 4.2, bankKrw: 0, universityIds: ['a']),
        catalog: catalog,
      );
      final bank = o.fixes.firstWhere((f) => f.kind == FixKind.bank);
      expect(bank.value, need);
      expect(bank.gain, greaterThan(0));
      expect(o.visaPercent + bank.gain, lessThanOrEqualTo(95));
    });

    test('a prior refusal never raises the visa chance', () {
      AssessmentOutcome run(bool refused) => assess(
        AssessmentInput(topik: 3, bankKrw: need, visaRefused: refused, universityIds: const ['a']),
        catalog: catalog,
      );
      expect(run(true).visaPercent, lessThanOrEqualTo(run(false).visaPercent));
    });

    test('the TOPIK fix is one level up, gaining admission on average', () {
      final o = assess(
        const AssessmentInput(topik: 2, gpa: 4.0, universityIds: ['a', 'b']),
        catalog: catalog,
      );
      final t = o.fixes.firstWhere((f) => f.kind == FixKind.topik);
      expect(t.value, 3);
      expect(t.gain, greaterThan(0));
    });

    test('the answers and the result the CRM reads', () {
      const input = AssessmentInput(topik: 3, gpa: 4.2, bankKrw: 1000000, visaRefused: true, universityIds: ['a']);
      final a = input.toAnswers(requiredBankKrw: need);
      expect(a['source'], 'assessment_v1');
      expect(a['route'], 'bachelor');
      expect(a['korean'], KoreanLevel.topik3.code);
      expect(a['kdb'], KdbDeposit.byIntake.code);
      expect(a['gpa'], 4.2);
      expect(a['bank_krw'], 1000000);
      expect(a['visa_refused'], true);
      final r = assess(input, catalog: catalog).toResult();
      expect(r['band'], isIn(['high', 'mid', 'low']));
      expect((r['universities'] as List).single['id'], 'a');
    });
  });

  group('visaHints: the old quiz\'s tariff and weak point', () {
    final catalog = [uni('a', topik: 3)];
    final need = requiredBank(StudyRoute.bachelor, catalog);
    VisaHints hints(AssessmentInput i) => visaHints(i, catalog: catalog, requiredBankKrw: need, now: DateTime(2026, 10, 26));

    test('TOPIK 2 for a bachelor\'s, income documented, money in the bank: language, Premium', () {
      final h = hints(AssessmentInput(topik: 2, incomeDocumented: true, bankKrw: need));
      expect(h.low, 'language');
      expect(h.tariff, Tariff.premium);
      expect(h.formalIncome, isTrue);
    });

    test('TOPIK 1 and nothing in the bank: Hanbox', () {
      final h = hints(const AssessmentInput(topik: 1, incomeDocumented: true));
      expect(h.low, 'language');
      expect(h.tariff, Tariff.hanbox);
    });

    test('the language met, money short and no income papers: NO RISK, the income first', () {
      final h = hints(const AssessmentInput(topik: 3, bankKrw: 1000000));
      expect(h.low, 'income');
      expect(h.tariff, Tariff.noRisk);
    });

    test('nothing against: no weak point', () {
      final h = hints(AssessmentInput(topik: 4, incomeDocumented: true, bankKrw: need));
      expect(h.low, isNull);
      expect(h.tariff, Tariff.premium);
    });

    test('the result the CRM reads carries the tariff (leads.tariff_interest)', () {
      final r = assess(AssessmentInput(topik: 2, incomeDocumented: true, bankKrw: need, universityIds: const ['a']), catalog: catalog)
          .toResult();
      expect(r['tariff'], 'premium');
      expect(r['low'], 'language');
    });
  });

  test('segmentsOf follows the design\'s thresholds', () {
    expect([10, 25, 44, 45, 64, 65, 81, 82].map(segmentsOf), [1, 2, 2, 3, 3, 4, 4, 5]);
  });

  group('filter board', () {
    test('catalogRegionOf groups the Excel\'s cities', () {
      expect(catalogRegionOf('Seoul'), CatalogRegion.seoul);
      expect(catalogRegionOf('Suwon (Gyeonggi-do)'), CatalogRegion.gyeonggi);
      expect(catalogRegionOf('Yongin'), CatalogRegion.gyeonggi);
      expect(catalogRegionOf('Gwangju (Gyeonggi-do)'), CatalogRegion.gyeonggi);
      expect(catalogRegionOf('Gwangju'), CatalogRegion.gwangju);
      expect(catalogRegionOf('Gongju'), CatalogRegion.other);
      expect(catalogRegionOf(null), CatalogRegion.other);
    });

    final all = [
      uni('seoul-state', topik: 3, city: 'Seoul', type: 'national', tuition: 2000000),
      uni('daegu-private', topik: 4, city: 'Daegu', type: 'private', tuition: 3000000),
      uni('busan-none', city: 'Busan', type: 'private', tuition: 1500000),
    ];
    List<String> ids(CatalogFilter f, {Set<String>? field}) =>
        applyCatalogFilter(all, f, fieldMatches: field).map((u) => u.institutionId).toList();

    test('region, TOPIK, type and field', () {
      expect(ids(const CatalogFilter(regions: {CatalogRegion.seoul})), ['seoul-state']);
      expect(ids(const CatalogFilter(topik: '3')), ['busan-none', 'seoul-state']);
      expect(ids(const CatalogFilter(topik: CatalogTopik.none)), ['busan-none']);
      expect(ids(const CatalogFilter(type: 'state')), ['seoul-state']);
      expect(ids(const CatalogFilter(type: 'private')), ['busan-none', 'daegu-private']);
      expect(ids(const CatalogFilter(field: 'it'), field: {'daegu-private'}), ['daegu-private']);
      // The field search still loading: the field does not filter yet.
      expect(ids(const CatalogFilter(field: 'it')).length, 3);
    });
  });
}
