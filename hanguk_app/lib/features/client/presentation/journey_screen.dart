import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart' show HardButton;
import '../../../l10n/app_localizations.dart';
import '../../applications/data/applications_repository.dart';
import '../../applications/domain/application.dart';
import '../../applications/presentation/widgets/process_tracker.dart';
import '../../applications/presentation/widgets/university_room_modal.dart';
import '../../assessment/presentation/assessment_widgets.dart';
import '../../auth/data/auth_repository.dart';
import '../../university_choices/presentation/university_choices_entry.dart';
import 'widgets/client_parts.dart';

/// The furthest-along application. A rejected one sits on the last stage,
/// so it only speaks when it is the only one left.
StudentApplication leadingApplication(List<StudentApplication> apps) {
  final live = apps.where((a) => a.status != 'rejected').toList();
  final pool = live.isEmpty ? apps : live;
  var best = pool.first;
  var bestStep = ProcessTracker.stepFor(best.status);
  for (final a in pool.skip(1)) {
    final step = ProcessTracker.stepFor(a.status);
    if (step > bestStep) {
      best = a;
      bestStep = step;
    }
  }
  return best;
}

/// Design screen 15, "Ariza jarayoni — mijoz": where the student's
/// application stands. The stages and what each status means are the CRM's
/// (see [ProcessTracker]); the applications are the ones staff attached
/// from the CRM. With several universities the chips pick which one's
/// journey is shown; the furthest-along one is shown first.
class JourneyScreen extends ConsumerStatefulWidget {
  const JourneyScreen({super.key, required this.onBrowse});

  /// "Universitetlarni ko'rish" on the empty screen.
  final VoidCallback onBrowse;

  @override
  ConsumerState<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends ConsumerState<JourneyScreen> {
  String? _pickedId;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final appsAsync = ref.watch(applicationsProvider);
    final name = ref.watch(studentFullNameProvider).value;

    return SafeArea(
      bottom: false,
      child: appsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: FdColors.lime)),
        error: (_, _) => Column(
          children: [
            ClientHeader(title: l.fdJourneyTitle, subtitle: name),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(l.appsLoadError, textAlign: TextAlign.center, style: fdText(14, FontWeight.w700, FdColors.onPage)),
                      const SizedBox(height: 4),
                      Text(l.checkConnectionRetry, textAlign: TextAlign.center, style: fdText(12, FontWeight.w400, FdColors.pageMuted)),
                      const SizedBox(height: 14),
                      HardChoice(
                        label: l.commonRetry,
                        selected: false,
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        onTap: () => ref.invalidate(applicationsProvider),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        data: (apps) {
          if (apps.isEmpty) return _Empty(name: name, onBrowse: widget.onBrowse);
          final app = apps.where((a) => a.id == _pickedId).firstOrNull ?? leadingApplication(apps);
          return _Body(
            apps: apps,
            app: app,
            name: name,
            onPick: (a) => setState(() => _pickedId = a.id),
          );
        },
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.name, required this.onBrowse});

  final String? name;
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Column(
      children: [
        ClientHeader(title: l.fdJourneyTitle, subtitle: name),
        const UniversityChoicesEntry(),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(l.fdJourneyEmpty, style: fdText(20, FontWeight.w800, FdColors.onPage)),
                  const SizedBox(height: 6),
                  Text(
                    l.fdJourneyEmptyBody,
                    textAlign: TextAlign.center,
                    style: fdText(13, FontWeight.w400, FdColors.pageMuted, height: 1.45),
                  ),
                  const SizedBox(height: 18),
                  HardButton(label: l.fdJourneyBrowse, onPressed: onBrowse),
                ],
              ),
            ),
          ),
        ),
        const ConsultantRow(),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.apps, required this.app, required this.name, required this.onPick});

  final List<StudentApplication> apps;
  final StudentApplication app;
  final String? name;
  final ValueChanged<StudentApplication> onPick;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final status = app.status;
    final labels = ProcessTracker.stepLabels(l);
    final total = ProcessTracker.stepCount;
    final completed = ProcessTracker.isCompleted(status);
    final step = completed ? total : ProcessTracker.stepFor(status);
    final universityName = app.university?.name.isNotEmpty ?? false ? shortUniversityName(app.university!.name) : null;

    // Under the current stage: what the status says if it is finer than the
    // stage, otherwise what comes next (or that the answer is awaited).
    final note = ProcessTracker.isPending(status)
        ? l.fdJourneyWaiting
        : step < total
        ? l.fdJourneyNext(labels[step])
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClientHeader(
          title: l.fdJourneyTitle,
          subtitle: [if (name != null && name!.isNotEmpty) name!, ?universityName].join(' · '),
          badge: '$step / $total',
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              const UniversityChoicesEntry(),
              if (apps.length > 1)
                SizedBox(
                  height: 40,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    scrollDirection: Axis.horizontal,
                    itemCount: apps.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 6),
                    itemBuilder: (context, i) {
                      final a = apps[i];
                      final n = a.university?.name ?? '';
                      return HardChoice(
                        label: n.isEmpty ? l.unknownUniversity : shortUniversityName(n),
                        selected: a.id == app.id,
                        height: 28,
                        radius: 999,
                        fontSize: 11,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        onTap: () => onPick(a),
                      );
                    },
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                  decoration: BoxDecoration(
                    color: FdColors.card,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: FdColors.ink, width: 1.5),
                    boxShadow: const [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < total; i++) ...[
                        if (i > 0) const DashedDivider(),
                        _Step(
                          number: i + 1,
                          label: labels[i],
                          state: i + 1 < step || completed
                              ? _StepState.done
                              : i + 1 == step
                              ? _StepState.current
                              : _StepState.ahead,
                          sub: i + 1 == step && !completed ? (_sub(status, labels[i], l) ?? note) : null,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                child: HardChoice(
                  label: l.fdJourneyRoom,
                  selected: false,
                  height: 44,
                  onTap: () => UniversityRoomModal.show(context, app, initialTabIndex: 1),
                ),
              ),
            ],
          ),
        ),
        const ConsultantRow(),
      ],
    );
  }

  /// What the status says when it is finer than its stage ("Documents
  /// translated" within "Documents").
  static String? _sub(String status, String stage, AppLocalizations l) {
    final text = ProcessTracker.statusLabel(status, l);
    return text == stage ? null : text;
  }
}

enum _StepState { done, current, ahead }

/// One stage of the timeline (prototype 9): the circle — lime ✓, the number on
/// blue with a hard shadow, or the number outlined on white — and the stage's
/// name, faded while it is still ahead.
class _Step extends StatelessWidget {
  const _Step({required this.number, required this.label, required this.state, this.sub});

  final int number;
  final String label;
  final _StepState state;
  final String? sub;

  static const Color _faded = Color(0xFFB8C4DC);

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (state) {
      _StepState.done => (FdColors.lime, FdColors.onLime),
      _StepState.current => (FdColors.blue, Colors.white),
      _StepState.ahead => (FdColors.card, _faded),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: bg,
              border: Border.all(color: FdColors.ink, width: 1.5),
              boxShadow: state == _StepState.current ? const [BoxShadow(color: FdColors.ink, offset: Offset(2, 2))] : null,
            ),
            child: Text(state == _StepState.done ? '✓' : '$number', style: fdText(15, FontWeight.w800, fg, height: 1)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: fdText(17, FontWeight.w800, state == _StepState.ahead ? _faded : FdColors.ink, height: 1.2)),
                if (sub != null) Text(sub!, style: fdText(13, FontWeight.w400, FdColors.muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
