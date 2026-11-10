import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Which of the two apps this build is (one codebase, decision 2026-11-10).
enum Flavor {
  /// «Hanguk Ish» — uz.hanguk.ish — people looking for shifts (uz/ru/en/ko).
  worker(appName: 'Hanguk Ish'),

  /// «Hanguk Ish 사장님» — uz.hanguk.ish.biz — businesses posting shifts
  /// (Korean).
  employer(appName: 'Hanguk Ish 사장님');

  const Flavor({required this.appName});

  final String appName;
}

/// The running app. Overridden in `main_worker.dart` / `main_employer.dart`.
final flavorProvider = Provider<Flavor>(
  (ref) => throw UnimplementedError(
    'flavorProvider must be overridden by the entry point',
  ),
);
