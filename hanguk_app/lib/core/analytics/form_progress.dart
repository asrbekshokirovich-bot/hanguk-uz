import 'app_events.dart';

/// `form_leave`: how far a form or an assessment page got when it was left —
/// how many of its questions were answered on this visit, out of how many,
/// and whether it was sent. Only the opening and the send were recorded
/// before, so a form left half-way looked the same as one never touched
/// (plan R0.5). Reported once, from the page's dispose.
class FormProgress {
  FormProgress(this.form, {this.props});

  /// 'lead', 'survey', 'visa', 'university'.
  final String form;
  final Map<String, Object?>? props;

  final _answered = <String>{};
  bool _sent = false;
  bool _reported = false;

  void answered(String key) => _answered.add(key);

  /// The keys whose value differs between [before] and [after].
  void compare(Map<String, Object?> before, Map<String, Object?> after) {
    for (final e in after.entries) {
      if (before[e.key] != e.value) _answered.add(e.key);
    }
  }

  void sent() => _sent = true;

  void leave({required int total}) {
    if (_reported) return;
    _reported = true;
    AppEvents.track('form_leave', props: {
      'form': form,
      'answered': _answered.length,
      'total': total,
      'sent': _sent,
      ...?props,
    });
  }
}
