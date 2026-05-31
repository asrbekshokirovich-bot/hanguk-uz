import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/uni_db/domain/review_queue_item.dart';

void main() {
  group('ReviewQueueItem.fromMap', () {
    test('parses every column from a fully-populated row', () {
      final map = {
        'id': 'q1',
        'priority': 1,
        'reason': 'low_confidence',
        'entity_type': 'extraction_jobs',
        'entity_id': 't1',
        'created_at': '2026-05-08T10:00:00Z',
        'parsed_output': {'foo': 'bar'},
        'name_ko': '서울대학교',
        'name_en': 'Seoul National University',
        'source_url_ko': 'https://admission.snu.ac.kr/notice',
        'storage_path': 'guideline-blobs/abc',
        'accuracy_self_score': 0.92,
      };

      final item = ReviewQueueItem.fromMap(map);

      expect(item.id, 'q1');
      expect(item.priority, 1);
      expect(item.reason, 'low_confidence');
      expect(item.entityType, 'extraction_jobs');
      expect(item.entityId, 't1');
      expect(item.createdAt, DateTime.utc(2026, 5, 8, 10));
      expect(item.parsedOutput, {'foo': 'bar'});
      expect(item.nameKo, '서울대학교');
      expect(item.nameEn, 'Seoul National University');
      expect(item.sourceUrlKo, 'https://admission.snu.ac.kr/notice');
      expect(item.storagePath, 'guideline-blobs/abc');
      expect(item.accuracySelfScore, 0.92);
      expect(item.institutionLabel, '서울대학교');
    });

    test('defaults priority to 5 when missing', () {
      final item = ReviewQueueItem.fromMap({
        'id': 'q2',
        'entity_type': 'extraction_jobs',
        'created_at': '2026-05-08T10:00:00Z',
      });
      expect(item.priority, 5);
    });

    test('defaults parsedOutput to empty map when missing', () {
      final item = ReviewQueueItem.fromMap({
        'id': 'q3',
        'entity_type': 'extraction_jobs',
        'created_at': '2026-05-08T10:00:00Z',
      });
      expect(item.parsedOutput, isEmpty);
    });

    test('createdAt falls back to now() when malformed', () {
      final before = DateTime.now();
      final item = ReviewQueueItem.fromMap({
        'id': 'q4',
        'entity_type': 'extraction_jobs',
        'created_at': 'not-a-date',
      });
      expect(
        item.createdAt.isAfter(before.subtract(const Duration(seconds: 5))),
        isTrue,
      );
    });

    test('institutionLabel falls back name_ko -> name_en -> placeholder', () {
      final enOnly = ReviewQueueItem.fromMap({
        'id': 'q5',
        'name_en': 'KAIST',
        'created_at': '2026-05-08T10:00:00Z',
      });
      expect(enOnly.institutionLabel, 'KAIST');

      final neither = ReviewQueueItem.fromMap({
        'id': 'q6',
        'created_at': '2026-05-08T10:00:00Z',
      });
      expect(neither.institutionLabel, '(unknown institution)');
    });
  });

  group('ReviewQueueItem.priorityLabel', () {
    test('P1 carries the 4-hour SLA copy', () {
      final item = _itemWithPriority(1);
      expect(item.priorityLabel, contains('P1'));
      expect(item.priorityLabel, contains('4h'));
    });

    test('P2 carries the 12-hour SLA copy', () {
      final item = _itemWithPriority(2);
      expect(item.priorityLabel, contains('P2'));
      expect(item.priorityLabel, contains('12h'));
    });

    test('P5 carries the 96-hour SLA copy', () {
      final item = _itemWithPriority(5);
      expect(item.priorityLabel, contains('P5'));
      expect(item.priorityLabel, contains('96h'));
    });

    test('out-of-range priority falls back to P5 label', () {
      final item = _itemWithPriority(99);
      expect(item.priorityLabel, contains('P5'));
    });
  });

  group('ReviewQueueItem.isOverdue (created_at + priority SLA budget)', () {
    test('true when created_at is older than the priority budget', () {
      // P2 budget is 12h; created 20h ago -> overdue.
      final old = DateTime.now().subtract(const Duration(hours: 20));
      final item = ReviewQueueItem.fromMap({
        'id': 'q1',
        'priority': 2,
        'created_at': old.toIso8601String(),
      });
      expect(item.isOverdue, isTrue);
    });

    test('false when created_at is within the priority budget', () {
      final recent = DateTime.now().subtract(const Duration(hours: 1));
      final item = ReviewQueueItem.fromMap({
        'id': 'q1',
        'priority': 2,
        'created_at': recent.toIso8601String(),
      });
      expect(item.isOverdue, isFalse);
    });
  });
}

ReviewQueueItem _itemWithPriority(int p) {
  return ReviewQueueItem.fromMap({
    'id': 'q1',
    'entity_type': 'extraction_jobs',
    'priority': p,
    'created_at': '2026-05-08T10:00:00Z',
  });
}
