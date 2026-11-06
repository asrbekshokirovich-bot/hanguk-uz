import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../../onboarding/data/quiz_repository.dart';
import '../../onboarding/domain/eligibility_engine.dart';
import '../domain/assessment.dart';

/// How many universities the board weighs (design screen 11).
const int kAssessmentUniversities = 3;

/// Where the answers live between visits (plan P05): the phone's secure
/// storage, like the ♥ slots. Tests swap it.
abstract class AssessmentStore {
  Future<String?> read();
  Future<void> write(String? value);
}

class _SecureAssessmentStore implements AssessmentStore {
  const _SecureAssessmentStore();
  static const _storage = FlutterSecureStorage();
  static const _key = 'assessment_input_v1';

  @override
  Future<String?> read() async {
    try {
      return await _storage.read(key: _key);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String? value) async {
    try {
      if (value == null) {
        await _storage.delete(key: _key);
      } else {
        await _storage.write(key: _key, value: value);
      }
    } catch (_) {}
  }
}

/// The board's answers. They are kept on the phone, so a guest who comes
/// back sees the same chances instead of "?%" and does not answer again
/// (2026-11-06: 18 of the 33 returning guests who had answered did so twice).
class AssessmentNotifier extends Notifier<AssessmentInput> {
  @visibleForTesting
  static AssessmentStore store = const _SecureAssessmentStore();

  /// Whether the student changed anything before the stored answers came
  /// back; then the stored ones are not laid over them.
  bool _changed = false;

  @override
  AssessmentInput build() {
    _load();
    return const AssessmentInput();
  }

  Future<void> _load() async {
    final raw = await store.read();
    if (raw == null || !ref.mounted || _changed) return;
    try {
      final j = jsonDecode(raw);
      if (j is! Map<String, dynamic>) return;
      state = AssessmentInput.fromJson(j);
      if (j['touched'] == true) ref.read(assessmentTouchedProvider.notifier).mark();
    } catch (e) {
      debugPrint('[Assessment] stored answers unreadable: $e');
    }
  }

  void _persist() {
    final touched = ref.read(assessmentTouchedProvider);
    unawaited(store.write(jsonEncode({...state.toJson(), 'touched': touched})));
  }

  /// A change the student made on the board.
  void set(AssessmentInput next) {
    _changed = true;
    state = next;
    ref.read(assessmentTouchedProvider.notifier).mark();
    _persist();
  }

  /// Back to the defaults ("?%"), and forgotten on the phone.
  void clear() {
    _changed = true;
    state = const AssessmentInput();
    ref.read(assessmentTouchedProvider.notifier).reset();
    unawaited(store.write(null));
  }

  /// The universities to weigh, chosen elsewhere (the slots, the saved list,
  /// the comparison); the board's other answers stay as they are.
  void useUniversities(List<String> ids) {
    state = state.copyWith(universityIds: ids.take(kAssessmentUniversities).toList());
    _persist();
  }

  /// The universities to weigh, starting from [startId] (the card or page the
  /// student came from), then the saved ones, then the catalogue's first for
  /// the route — three in all.
  void startFrom(String? startId, List<CatalogUniversity> catalog, List<String> saved) {
    final degree = state.route.catalogDegree;
    bool fits(CatalogUniversity u) => degree == null || u.hasDegree(degree);
    final known = {for (final u in catalog) u.institutionId: u};
    final ids = <String>[];
    void add(String id) {
      final u = known[id];
      if (u != null && fits(u) && !ids.contains(id) && ids.length < kAssessmentUniversities) ids.add(id);
    }

    if (startId != null) add(startId);
    for (final id in state.universityIds) {
      add(id);
    }
    for (final id in saved) {
      add(id);
    }
    for (final u in catalog) {
      add(u.institutionId);
    }
    state = state.copyWith(universityIds: ids);
    _persist();
  }
}

final assessmentProvider = NotifierProvider<AssessmentNotifier, AssessmentInput>(AssessmentNotifier.new);

/// Whether the student has answered anything on the board yet: until then an
/// admission chance would rest on the defaults, so screens show "?%".
class AssessmentTouchedNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void mark() {
    if (!state) state = true;
  }

  void reset() => state = false;
}

final assessmentTouchedProvider = NotifierProvider<AssessmentTouchedNotifier, bool>(AssessmentTouchedNotifier.new);

/// The board's outcome for the current answers; null until the catalogue is
/// read.
final assessmentOutcomeProvider = Provider<AssessmentOutcome?>((ref) {
  final catalog = ref.watch(catalogProvider).value;
  if (catalog == null) return null;
  final rules = ref.watch(eligibilityRulesProvider).value ?? const EligibilityRules();
  return assess(ref.watch(assessmentProvider), catalog: catalog, rules: rules);
});

/// What the report's form sent (design screen 12 → 13).
typedef AssessmentSent = ({String name, String phone, String? linkCode});

class AssessmentSentNotifier extends Notifier<AssessmentSent?> {
  @override
  AssessmentSent? build() => null;

  void set(AssessmentSent sent) => state = sent;
}

final assessmentSentProvider = NotifierProvider<AssessmentSentNotifier, AssessmentSent?>(AssessmentSentNotifier.new);
