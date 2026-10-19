import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/applications/domain/application_journey.dart';

/// The design's own example (7b / 8a): Keimyung at its interview, Sun Moon
/// waiting for the Study Plan, Dongseo under review — on 19 October 2026.
final now = DateTime(2026, 10, 19, 10);

const facts = {
  'contract_date': '2026-09-12',
  'docs_complete': true,
  'docs_at': '2026-09-20T09:00:00',
  'translations_complete': true,
  'translations_at': '2026-10-03T09:00:00',
  'study_plan_ready': false,
};

Map<String, dynamic> uni(String id, Map<String, dynamic> extra) => {
  'institution_id': id,
  'status': 'documents',
  'name_en': id,
  'intake_year': 2027,
  'semester': 'bahor',
  'degree': 'bakalavr',
  ...extra,
};

final design = ApplicationJourney.fromJson({
  ...facts,
  'universities': [
    uni('Keimyung University', {
      'name_ko': '계명대학교',
      'city': 'Daegu',
      'status': 'interview',
      'online_submitted_at': '2026-10-10T09:00:00',
      'interview_at': '2026-10-24T14:00:00',
    }),
    uni('Sun Moon University', {'name_ko': '선문대학교', 'city': 'Asan', 'online_deadline': '2026-10-28'}),
    uni('Dongseo University', {
      'name_ko': '동서대학교',
      'city': 'Busan',
      'status': 'application_submitted',
      'online_submitted_at': '2026-10-12T09:00:00',
      'result_round': '2026-11-02',
    }),
  ],
});

List<UniversityProgress> progressOf(ApplicationJourney j) => [
  for (final u in j.universities) UniversityProgress.of(u, j.facts, now),
];

void main() {
  test('the design example: 4, 3 and 3 stamps, 48% and the interview in 5 days', () {
    final all = progressOf(design);
    expect(all.map((p) => p.doneCount), [4, 3, 3]);
    expect(all.map((p) => p.current), [JourneyStamp.interview, JourneyStamp.submission, JourneyStamp.submission]);
    final s = JourneySummary.of(all, now);
    expect(s.count, 3);
    expect(s.bestDone, 4);
    expect(s.percent, 48);
    expect(s.nearest!.stamp, JourneyStamp.interview);
    expect(s.nearest!.days, 5);
  });

  test('the five-part bar follows the stamps', () {
    final all = progressOf(design);
    expect(
      [for (final p in JourneyPhase.values) all[0].phaseState(p)],
      [StampState.done, StampState.done, StampState.current, StampState.ahead, StampState.ahead],
    );
    expect(
      [for (final p in JourneyPhase.values) all[2].phaseState(p)],
      [StampState.done, StampState.current, StampState.ahead, StampState.ahead, StampState.ahead],
    );
  });

  test('only the university still waiting for the application asks for the Study Plan', () {
    final all = progressOf(design);
    expect(all.map((p) => p.needsStudyPlan), [false, true, false]);
    final ready = ApplicationJourney.fromJson({
      ...facts,
      'study_plan_ready': true,
      'universities': [uni('Sun Moon University', {})],
    });
    expect(progressOf(ready).single.needsStudyPlan, isFalse);
  });

  test('stamp dates: the day it happened, the deadline, or the month expected', () {
    final sunMoon = progressOf(design)[1];
    expect(sunMoon.view(JourneyStamp.contract).date, DateTime(2026, 9, 12));
    expect(sunMoon.view(JourneyStamp.submission).dateKind, StampDateKind.until);
    expect(sunMoon.view(JourneyStamp.submission).date, DateTime(2026, 10, 28));
    // Departure estimated from the 2027 spring intake.
    expect(sunMoon.view(JourneyStamp.flight).date, DateTime(2027, 2, 20));
    expect(sunMoon.view(JourneyStamp.flight).dateKind, StampDateKind.month);
    expect(sunMoon.view(JourneyStamp.visa).date, DateTime(2026, 12));
  });

  test('a submission with no contract date entered still counts the earlier stamps', () {
    final j = ApplicationJourney.fromJson({
      'universities': [uni('X', {'status': 'application_submitted', 'online_submitted_at': '2026-10-12T09:00:00'})],
    });
    final p = progressOf(j).single;
    expect(p.doneCount, 3);
    expect(p.current, JourneyStamp.submission);
  });

  test('visa: in progress, waiting, received', () {
    ApplicationJourney visa(String status, String? visa) => ApplicationJourney.fromJson({
      ...facts,
      'universities': [
        uni('X', {
          'status': status,
          'online_submitted_at': '2026-10-10T09:00:00',
          'result': 'accepted',
          'result_at': '2026-11-10T09:00:00',
          'final_at': '2026-11-12T09:00:00',
          'visa_status': visa,
          'visa_status_at': visa == null ? null : '2026-12-20T09:00:00',
        }),
      ],
    });
    final process = progressOf(visa('visa_documents', 'process')).single;
    expect(process.doneCount, 6);
    expect(process.current, JourneyStamp.visa);
    final received = progressOf(visa('completed', 'received')).single;
    expect(received.doneCount, 7);
    expect(received.current, JourneyStamp.flight);
    expect(received.view(JourneyStamp.visa).date, DateTime(2026, 12, 20, 9));
  });

  test('a legacy completed application has every stamp', () {
    final j = ApplicationJourney.fromJson({'universities': [uni('X', {'status': 'completed'})]});
    expect(progressOf(j).single.finished, isTrue);
  });

  test('not admitted: the admission stamp is refused and nothing is current', () {
    final j = ApplicationJourney.fromJson({
      ...facts,
      'universities': [
        uni('X', {'status': 'rejected', 'online_submitted_at': '2026-10-10T09:00:00', 'result': 'rejected'}),
      ],
    });
    final p = progressOf(j).single;
    expect(p.rejected, isTrue);
    expect(p.hasCurrent, isFalse);
    expect(p.view(JourneyStamp.admission).state, StampState.refused);
    expect(p.phaseState(JourneyPhase.admission), StampState.refused);
  });

  test('the tile shows two hangul syllables of the name', () {
    final u = design.universities;
    expect(u.map((x) => x.tileText), ['계명', '선문', '동서']);
    expect(JourneyUniversity.fromJson({'institution_id': 'x', 'name_en': 'Kongju National University'}).tileText, 'KN');
  });

  test('the airport nearest the university', () {
    expect(airportFor('Asan'), 'CJJ');
    expect(airportFor('Daegu'), 'TAE');
    expect(airportFor('Gyeongsan (Gyeongsangbuk-do)'), 'TAE');
    expect(airportFor('Busan'), 'PUS');
    expect(airportFor('Seoul'), 'ICN');
    expect(airportFor('Gongju'), 'CJJ');
    expect(airportFor('Jeju'), 'CJU');
    expect(airportFor(null), 'ICN');
  });

  test('the city loses its province in brackets; the language course is D-4', () {
    expect(JourneyUniversity.fromJson({'institution_id': 'x', 'city': 'Gyeongsan (Gyeongsangbuk-do)'}).cityShort, 'Gyeongsan');
    expect(JourneyUniversity.fromJson({'institution_id': 'x', 'degree': 'til_kursi'}).visaType, 'D-4');
    expect(JourneyUniversity.fromJson({'institution_id': 'x', 'degree': 'magistratura'}).visaType, 'D-2');
  });
}
