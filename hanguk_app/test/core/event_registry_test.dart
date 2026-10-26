import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Every event the app sends is in the server's registry (app_event_types,
/// supabase/migrations): an event that is not is rejected by the server and
/// only counted in app_events_rejected — the plan's «Reestr tekshiruvi»
/// (app analytics plan v2, section 11). The registry is read from the
/// migrations in this checkout; where they are not here yet, the check waits.
void main() {
  test('every event name in the code is in the registry', () {
    final registry = registryNames(Directory('../supabase/migrations'));
    if (registry.isEmpty) return;
    final sent = sentNames(Directory('lib'));
    expect(sent, isNotEmpty);
    expect(
      sent.difference(registry).toList()..sort(),
      isEmpty,
      reason: 'Add these to app_event_types (a migration) before the app sends them.',
    );
  });

  test('the readers find names in code and in a registry insert', () {
    final dir = Directory.systemTemp.createTempSync('registry');
    File('${dir.path}/1.sql').writeAsStringSync(
      "insert into public.app_event_types (event, family) values\n  ('tap', 'tap'),\n  ('report_view', 'x');",
    );
    expect(registryNames(dir), {'tap', 'report_view'});
    dir.deleteSync(recursive: true);
  });
}

/// The event names the migrations put into app_event_types.
Set<String> registryNames(Directory migrations) {
  final out = <String>{};
  if (!migrations.existsSync()) return out;
  final insert = RegExp(r'insert into public\.app_event_types[^;]*?values(.*?);', caseSensitive: false, dotAll: true);
  final row = RegExp(r"\(\s*'([a-z][a-z0-9_]*)'\s*,");
  for (final f in migrations.listSync().whereType<File>().where((f) => f.path.endsWith('.sql'))) {
    for (final block in insert.allMatches(f.readAsStringSync())) {
      out.addAll(row.allMatches(block.group(1)!).map((m) => m.group(1)!));
    }
  }
  return out;
}

/// The event names the app's code sends: `AppEvents.track('…'` (and the SDK's
/// own `track('…'`), a tap and a long press.
Set<String> sentNames(Directory lib) {
  final out = <String>{};
  final track = RegExp(r"\btrack\(\s*'([a-z][a-z0-9_]*)'");
  for (final f in lib.listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
    final s = f.readAsStringSync();
    out.addAll(track.allMatches(s).map((m) => m.group(1)!));
    if (s.contains('AppEvents.tap(')) out.add('tap');
    if (s.contains('AppEvents.longPress(')) out.add('long_press');
  }
  return out;
}
