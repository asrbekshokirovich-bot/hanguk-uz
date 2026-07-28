// A university name is interpolated straight into a single-quoted JS string
// literal inside the map's generated <script> block. Escaping only quotes was
// not enough: a trailing backslash turned the closing quote into a literal and
// the ENTIRE script failed to parse — no markers, no fallback, not even an
// error message, just an empty rectangle.
import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_app/features/map/presentation/widgets/university_map_html.dart';

void main() {
  // Each of these, unescaped, either breaks parsing or corrupts the label.
  const hostile = <String, String>{
    'trailing backslash': r'Seoul National University \',
    'embedded backslash': r'Korea\University',
    'single quote': "Korea's University",
    'double quote': 'Korea "Main" Campus',
    'newline': 'Korea\nUniversity',
    'carriage return': 'Korea\rUniversity',
    'line separator': 'Korea University',
    'script tag': '<script>alert(1)</script>',
    'html entity': 'Korea & Seoul <b>Main</b>',
    'korean': '서울대학교',
  };

  hostile.forEach((label, raw) {
    test('jsEscape survives: $label', () {
      final escaped = jsEscape(raw);

      // Nothing that terminates or escapes out of a '...' literal survives raw.
      expect(escaped.contains('\n'), isFalse, reason: 'raw newline remains');
      expect(escaped.contains('\r'), isFalse, reason: 'raw CR remains');
      expect(escaped.contains(' '), isFalse);
      expect(escaped.contains('<'), isFalse, reason: 'raw < reaches innerHTML');

      // Every surviving quote is backslash-escaped, and every backslash run is
      // even — so the literal cannot be terminated early.
      for (var i = 0; i < escaped.length; i++) {
        if (escaped[i] != "'") continue;
        var slashes = 0;
        for (var j = i - 1; j >= 0 && escaped[j] == r'\'; j--) {
          slashes++;
        }
        expect(
          slashes.isOdd,
          isTrue,
          reason: 'unescaped quote at $i in: $escaped',
        );
      }
    });
  });

  test('jsEscape leaves ordinary names untouched', () {
    expect(jsEscape('Yonsei University'), 'Yonsei University');
    expect(jsEscape('서울대학교'), '서울대학교');
  });
}
