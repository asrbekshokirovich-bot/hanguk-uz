import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hanguk_ish/app/employer_app.dart';
import 'package:hanguk_ish/core/links/share.dart';
import 'package:hanguk_ish/core/time/clock.dart';
import 'package:hanguk_ish/data/demo/demo_employer.dart';
import 'package:hanguk_ish/data/repositories/employer_repository.dart';

import 'phone.dart';

/// What the share sheet would have received.
class RecordingSharer implements FileSharer {
  final List<({Uint8List bytes, String fileName, String mimeType, String? text})> shared = [];

  @override
  Future<void> share({required Uint8List bytes, required String fileName, required String mimeType, String? text}) async {
    shared.add((bytes: bytes, fileName: fileName, mimeType: mimeType, text: text));
  }
}

/// The employer app opened at [location] at the prototype's moment
/// (Tuesday 10 November 2026, 18:20 in Seoul) with its demo data.
ProviderContainer employerContainer({
  String location = EmployerRoutes.home,
  DemoEmployerRepository? repository,
  DateTime Function()? clock,
  FileSharer? sharer,
  List<Override> overrides = const [],
}) {
  final now = clock ?? () => employerPrototypeNow;
  return ProviderContainer(overrides: [
    employerInitialLocationProvider.overrideWithValue(location),
    clockProvider.overrideWithValue(now),
    employerRepositoryProvider.overrideWithValue(
      repository ?? DemoEmployerRepository(now: employerPrototypeNow, clock: now),
    ),
    fileSharerProvider.overrideWithValue(sharer ?? RecordingSharer()),
    ...overrides,
  ]);
}

/// [EmployerApp] on [container], wrapped for screen captures.
Widget employerHarness(ProviderContainer container) =>
    capture(UncontrolledProviderScope(container: container, child: const EmployerApp()));
