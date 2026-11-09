import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/chat/domain/chat_message.dart';

void main() {
  test('the AI question envelope becomes a question and its answers', () {
    final c = ClarifyReply.parse('{"type":"clarify","question":"Qaysi daraja?","options":["Bakalavr","Magistratura"]}');
    expect(c?.question, 'Qaysi daraja?');
    expect(c?.options, ['Bakalavr', 'Magistratura']);
    expect(ClarifyReply.parse('```json\n{"type":"clarify","question":"Q?","options":["a"]}\n```')?.options, ['a']);
  });

  test('an ordinary answer is left alone; half an envelope waits', () {
    expect(ClarifyReply.parse('Seulda 49 ta universitet bor.'), isNull);
    expect(ClarifyReply.isPartial('{"type":"clar'), isTrue);
    expect(ClarifyReply.isPartial('Seulda 49 ta universitet bor.'), isFalse);
  });
}
