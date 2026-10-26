import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';

/// Every button in the app is named for the analytics: a tap handler given
/// as `onTap`, `onPressed` or `onLongPress` is wrapped in
/// `tracked('<screen>.<what>', …)` / `trackedLong(…)` (see
/// lib/core/analytics/tracked.dart), or is null, a no-op, or takes a value
/// (TabBar's `onTap(int)` and the like). The CRM shows what was pressed by
/// these names; an unnamed button is only "a tap at x, y".
void main() {
  test('every tap handler is named for the analytics', () {
    final arg = RegExp(r'(?<![\w.])(onTap|onPressed|onLongPress)\s*:\s*');
    final fine = RegExp(r'^(?:(?:tracked|trackedLong|trackedValue)\b|null\b|\(\s*\w+\s*[,)]|\(\)\s*\{\s*\})');
    final offenders = <String>[];
    final files = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => !f.path.endsWith('.g.dart') && !f.path.endsWith('.freezed.dart'))
        .where((f) => !f.path.contains('${Platform.pathSeparator}l10n${Platform.pathSeparator}'))
        // The design-system gallery is a debug-only page.
        .where((f) => !f.path.endsWith('seoul_night_gallery.dart'));
    for (final f in files) {
      final src = codeOnly(f.readAsStringSync());
      for (final m in arg.allMatches(src)) {
        // "enabled ? onTap : null" — the false branch of a choice, not an argument.
        if (RegExp(r'\?\s*$').hasMatch(src.substring(max(0, m.start - 3), m.start))) continue;
        final rest = src.substring(m.end, min(src.length, m.end + 80));
        if (fine.hasMatch(rest)) continue;
        final line = '\n'.allMatches(src.substring(0, m.start)).length + 1;
        offenders.add('${f.path}:$line  ${m.group(0)}${rest.split('\n').first.trim()}');
      }
    }
    expect(
      offenders,
      isEmpty,
      reason:
          "Name these for the analytics — onTap: tracked('<screen>.<what>', …) (lib/core/analytics/tracked.dart):\n"
          '${offenders.join('\n')}',
    );
  });

  test('codeOnly blanks strings and comments, keeping lines', () {
    const src = "a(onTap: x); // onTap: y\nb('onTap: z', \"\${c('q')}\"); /* onTap:\n w */ d";
    final out = codeOnly(src);
    expect(out.length, src.length);
    expect(RegExp('onTap').allMatches(out).length, 1);
    expect('\n'.allMatches(out).length, 2);
  });
}

/// [src] with the text of strings and comments replaced by spaces (line
/// breaks kept), so a pattern finds only code.
String codeOnly(String src) {
  final out = StringBuffer();
  var i = 0;

  void blank(int from, int to) {
    for (var k = from; k < to; k++) {
      out.write(src[k] == '\n' ? '\n' : ' ');
    }
  }

  bool isString(int j) {
    if (j >= src.length) return false;
    final c = src[j];
    if (c == "'" || c == '"') return true;
    if (c == 'r' && j + 1 < src.length && (src[j + 1] == "'" || src[j + 1] == '"')) {
      return j == 0 || !RegExp(r'[\w$]').hasMatch(src[j - 1]);
    }
    return false;
  }

  late int Function(int) skipString;

  int skipBraces(int j) {
    var depth = 0;
    while (j < src.length) {
      if (isString(j)) {
        j = skipString(j);
        continue;
      }
      if (src[j] == '{') depth++;
      if (src[j] == '}') {
        depth--;
        if (depth == 0) return j + 1;
      }
      j++;
    }
    return j;
  }

  skipString = (int j) {
    final raw = src[j] == 'r';
    if (raw) j++;
    final q = src[j];
    final triple = src.startsWith(q * 3, j);
    final end = triple ? q * 3 : q;
    j += triple ? 3 : 1;
    while (j < src.length) {
      if (!raw && src[j] == r'\') {
        j += 2;
        continue;
      }
      if (src.startsWith(end, j)) return j + end.length;
      if (!raw && src[j] == r'$' && j + 1 < src.length && src[j + 1] == '{') {
        j = skipBraces(j + 1);
        continue;
      }
      if (!triple && src[j] == '\n') return j;
      j++;
    }
    return j;
  };

  while (i < src.length) {
    if (src.startsWith('//', i)) {
      final e = src.indexOf('\n', i);
      final j = e < 0 ? src.length : e;
      blank(i, j);
      i = j;
    } else if (src.startsWith('/*', i)) {
      final e = src.indexOf('*/', i + 2);
      final j = e < 0 ? src.length : e + 2;
      blank(i, j);
      i = j;
    } else if (isString(i)) {
      final j = min(skipString(i), src.length);
      blank(i, j);
      i = j;
    } else {
      out.write(src[i]);
      i++;
    }
  }
  return out.toString();
}
