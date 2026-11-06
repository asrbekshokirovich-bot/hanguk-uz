import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/discover/data/guest_ai_usage.dart';

void main() {
  test('D4: questions left from the server count, never below zero', () {
    final u = GuestAiUsage.fromJson({'ai_used': 3, 'ai_limit': 10, 'interview_used': 0, 'interview_limit': 1});
    expect(u.aiLeft, 7);
    expect(u.interviewFree, isTrue);
    final over = GuestAiUsage.fromJson({'ai_used': 12, 'ai_limit': 10, 'interview_used': 1, 'interview_limit': 1});
    expect(over.aiLeft, 0);
    expect(over.interviewFree, isFalse);
  });

  test('D4: missing fields fall back to the plan limits (10 a day, 1 a week)', () {
    final u = GuestAiUsage.fromJson({});
    expect(u.aiLeft, 10);
    expect(u.interviewFree, isTrue);
  });
}
