/// The four parts of the Study Plan builder (design screen 19), and how they
/// are kept as one draft: the trainer and the history screens work on a
/// single text, so the parts are joined under fixed markers.
const int kPlanStepCount = 4;

/// Longest a single part may be (the design's "184 / 300").
const int kPlanMaxChars = 300;

/// A part counts as written from this many characters on.
const int kPlanMinChars = 40;

const List<String> kPlanMarkers = ['Goal', 'Why Korea', 'Why this university', 'Future plan'];

String _marker(int i) => '## ${kPlanMarkers[i]}';

/// The draft text for [parts] (always [kPlanStepCount] long). Empty parts are
/// left out, so a plan with nothing written is an empty string.
String serializePlan(List<String> parts) {
  assert(parts.length == kPlanStepCount);
  final out = <String>[];
  for (var i = 0; i < kPlanStepCount; i++) {
    final text = parts[i].trim();
    if (text.isEmpty) continue;
    out.add('${_marker(i)}\n$text');
  }
  return out.join('\n\n');
}

/// The parts of a draft. A draft written elsewhere (no markers) goes whole
/// into the first part rather than being lost.
List<String> parsePlan(String content) {
  final parts = List<String>.filled(kPlanStepCount, '');
  final lines = content.split('\n');
  var current = -1;
  final buffers = List.generate(kPlanStepCount, (_) => <String>[]);
  final loose = <String>[];
  for (final line in lines) {
    final at = kPlanMarkers.indexWhere((m) => line.trim() == '## $m');
    if (at >= 0) {
      current = at;
      continue;
    }
    (current < 0 ? loose : buffers[current]).add(line);
  }
  for (var i = 0; i < kPlanStepCount; i++) {
    parts[i] = buffers[i].join('\n').trim();
  }
  final head = loose.join('\n').trim();
  if (head.isNotEmpty) {
    parts[0] = parts[0].isEmpty ? head : '$head\n${parts[0]}';
  }
  return parts;
}

/// How many parts are written.
int writtenParts(List<String> parts) => parts.where((p) => p.trim().length >= kPlanMinChars).length;

/// [base] with [spoken] appended after a space, cut to [max] characters:
/// what the box holds while the student dictates.
String appendDictation(String base, String spoken, int max) {
  final words = spoken.trim();
  if (words.isEmpty) return base.length > max ? base.substring(0, max) : base;
  final glue = base.isEmpty || base.endsWith(' ') || base.endsWith('\n') ? '' : ' ';
  final text = '$base$glue$words';
  return text.length > max ? text.substring(0, max) : text;
}
