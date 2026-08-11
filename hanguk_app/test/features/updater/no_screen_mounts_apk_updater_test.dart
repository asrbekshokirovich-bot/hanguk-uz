// Nothing outside the updater feature may mount the APK self-updater.
//
// The self-updater read `app_versions`, downloaded a build from Supabase
// Storage and handed it to the OS installer. Play blocked version 2041 over
// the `REQUEST_INSTALL_PACKAGES` that requires, and students met a blocking
// "Update Failed" dialog on launch because there was nothing it could ever
// install.
//
// It was removed once, from `UpdateGate` — and came straight back, because
// welcome_screen and home_screen each ran their own copy of the same check
// and those two are the screens a student actually lands on. A comment in
// update_gate.dart even asserted "nothing mounts them" while two screens did.
//
// So this is a source-level guard rather than a widget test: the failure mode
// is a call site reappearing somewhere in the tree, which no single screen's
// widget test would catch. Updates come from Play now, via
// `features/updater/data/play_in_app_update.dart`.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The updater feature owns these symbols; everywhere else is a call site.
const _updaterFeatureDir = 'lib/features/updater';

/// Entry points into the APK download/install path.
const _forbidden = <String>[
  'UpdateDialog(',
  'updaterRepositoryProvider',
  'checkForUpdate(',
];

Iterable<File> _dartFilesOutsideUpdater() sync* {
  final lib = Directory('lib');
  if (!lib.existsSync()) {
    fail('run this test from hanguk_app/ — lib/ not found');
  }
  for (final entity in lib.listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    // Normalise so the check works on Windows checkouts too.
    if (entity.path.replaceAll(r'\', '/').startsWith(_updaterFeatureDir)) {
      continue;
    }
    yield entity;
  }
}

void main() {
  test('no screen outside lib/features/updater mounts the APK updater', () {
    final offenders = <String>[];

    for (final file in _dartFilesOutsideUpdater()) {
      final source = file.readAsStringSync();
      for (final symbol in _forbidden) {
        if (source.contains(symbol)) {
          offenders.add('${file.path} → $symbol');
        }
      }
    }

    expect(
      offenders,
      isEmpty,
      reason:
          'These files reach into the APK self-updater:\n'
          '  ${offenders.join('\n  ')}\n\n'
          'Play blocks the install path, so this dialog can only ever fail in '
          "front of a student. If the app needs to prompt for an update, use "
          'features/updater/data/play_in_app_update.dart instead.',
    );
  });
}
