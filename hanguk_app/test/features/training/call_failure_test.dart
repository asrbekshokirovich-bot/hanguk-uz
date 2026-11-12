import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/training/data/call_failure.dart';
import 'package:vapi/vapi.dart';

void main() {
  test('the provider refusing the call: its status and its words', () {
    const e = VapiStartCallException(
      'Failed to create call: {"message":"Your Wallet Balance is -0.21. Please Purchase More Credits or Upgrade Your Plan Before Proceeding.","error":"Bad Request","statusCode":400}',
    );
    final props = callFailureProps(e);
    expect(props['error'], 'VapiStartCallException');
    expect(props['status'], 400);
    expect(
      props['reason'],
      'Your Wallet Balance is -0.21. Please Purchase More Credits or Upgrade Your Plan Before Proceeding.',
    );
    expect(props.containsKey('cause'), isFalse);
  });

  test('a list of validation messages is one line, cut to what an event keeps', () {
    final e = VapiStartCallException(
      'Failed to create call: {"message":["assistant.voice.voiceId must be a string","${'x' * 200}"],"statusCode":400}',
    );
    final props = callFailureProps(e);
    expect(props['status'], 400);
    final reason = props['reason']! as String;
    expect(reason.startsWith('assistant.voice.voiceId must be a string; xxx'), isTrue);
    expect(reason.length, 120);
  });

  test('an answer that is not JSON is the reason as it is', () {
    const e = VapiStartCallException('Call URL not found in response');
    expect(callFailureProps(e), {'error': 'VapiStartCallException', 'reason': 'Call URL not found in response'});
    const broken = VapiStartCallException('Failed to create call: {not json');
    expect(callFailureProps(broken)['reason'], 'Failed to create call: {not json');
    expect(callFailureProps(broken).containsKey('status'), isFalse);
  });

  test('a failure underneath the provider is named by its kind', () {
    final e = VapiStartCallException(TimeoutException('join'));
    expect(callFailureProps(e), {'error': 'VapiStartCallException', 'cause': 'TimeoutException'});
  });

  test('only the provider saying no is "the service is down"', () {
    expect(
      providerRefused(const VapiStartCallException('Failed to create call: {"message":"Wallet","statusCode":400}')),
      isTrue,
    );
    expect(providerRefused(const VapiStartCallException('Call URL not found in response')), isFalse);
    expect(providerRefused(VapiStartCallException(TimeoutException('join'))), isFalse);
    expect(providerRefused(TimeoutException('handshake')), isFalse);
  });

  test('nothing more is known: the type alone, as before', () {
    expect(callFailureProps(const VapiStartCallException()), {'error': 'VapiStartCallException'});
    expect(callFailureProps(TimeoutException('handshake')), {'error': 'TimeoutException'});
    expect(callFailureProps(StateError('x')), {'error': 'StateError'});
  });
}
