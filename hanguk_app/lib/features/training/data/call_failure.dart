import 'dart:convert';

import 'package:vapi/vapi.dart' show VapiException;

/// What `interview_connect` says about a call that did not start.
///
/// The call provider answers a refused call with a body such as
/// `{"message":"Your Wallet Balance is -0.21. …","error":"Bad Request","statusCode":400}`,
/// which the SDK passes on as "Failed to create call: {…}". On 2026-11-12 the
/// provider's balance ran out and every interview failed; the app sent only
/// the exception's type, so nothing told that from a bad connection.
///
/// `status` and `reason` are the provider's own answer; `cause` is the kind
/// of failure underneath when it was not the provider (the microphone
/// client, the join). The reason is the provider's text, never the student's.
Map<String, Object> callFailureProps(Object error) {
  final props = <String, Object>{'error': error.runtimeType.toString()};
  final details = error is VapiException ? error.details : null;
  if (details == null) return props;
  if (details is! String) {
    props['cause'] = details.runtimeType.toString();
    return props;
  }

  final text = details.trim();
  final at = text.indexOf('{');
  if (at >= 0) {
    try {
      final body = jsonDecode(text.substring(at));
      if (body is Map) {
        final status = body['statusCode'];
        if (status is int) props['status'] = status;
        final message = body['message'];
        final said = (message is List ? message.join('; ') : message?.toString())?.trim();
        if (said != null && said.isNotEmpty) props['reason'] = _clip(said);
      }
    } on FormatException {
      // Not JSON after all: the text itself is the reason, below.
    }
  }
  if (!props.containsKey('reason') && text.isNotEmpty) props['reason'] = _clip(text);
  return props;
}

/// The provider itself answered "no" (its balance, its limits, a request it
/// does not accept) — as opposed to the phone not reaching it.
bool providerRefused(Object error) => callFailureProps(error).containsKey('status');

/// As long as an event's text may be (AppEvents keeps 120 characters).
String _clip(String s) => s.length > 120 ? s.substring(0, 120) : s;
