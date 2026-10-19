import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/hard_shadow.dart' show HardButton;
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../applications/data/journey_repository.dart';
import '../../applications/domain/application_journey.dart';
import '../../auth/data/auth_repository.dart';
import '../../university_choices/presentation/university_choices_entry.dart';
import 'journey_detail.dart';
import 'widgets/client_parts.dart';
import 'widgets/journey_parts.dart';

/// Design 7b, "Ariza jarayoni": every university the student applies to as a
/// card — where it stands on the five-part bar, what is wanted from the
/// student — under a ring with the overall progress. A card opens that
/// university's page (design 8a, [JourneyDetail]) in place, so the tab bar
/// stays. The stages are the eight stamps of [UniversityProgress].
class JourneyScreen extends ConsumerStatefulWidget {
  const JourneyScreen({super.key, required this.onBrowse, this.now});

  /// "Universitetlarni ko'rish" on the empty screen.
  final VoidCallback onBrowse;

  /// Today, for tests; the clock otherwise.
  final DateTime? now;

  @override
  ConsumerState<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends ConsumerState<JourneyScreen> {
  String? _openId;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final journeyAsync = ref.watch(applicationJourneyProvider);
    final name = ref.watch(studentFullNameProvider).value;
    final now = widget.now ?? DateTime.now();

    return SafeArea(
      bottom: false,
      child: journeyAsync.when(
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
                        onTap: () => ref.invalidate(applicationJourneyProvider),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        data: (journey) {
          if (journey.universities.isEmpty) return _Empty(name: name, onBrowse: widget.onBrowse);
          final all = [for (final u in journey.universities) UniversityProgress.of(u, journey.facts, now)];
          final open = all.indexWhere((p) => p.university.institutionId == _openId);
          if (open >= 0) {
            return PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, _) {
                if (!didPop) setState(() => _openId = null);
              },
              child: JourneyDetail(
                progress: all[open],
                index: open + 1,
                total: all.length,
                now: now,
                onBack: () => setState(() => _openId = null),
              ),
            );
          }
          return _List(
            all: all,
            now: now,
            onOpen: (p) => setState(() => _openId = p.university.institutionId),
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

class _List extends StatelessWidget {
  const _List({required this.all, required this.now, required this.onOpen});

  final List<UniversityProgress> all;
  final DateTime now;
  final ValueChanged<UniversityProgress> onOpen;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final summary = JourneySummary.of(all, now);
    final nearest = summary.nearest;
    final nearestText = nearest == null
        ? null
        : switch ((nearest.stamp, nearest.days)) {
            (JourneyStamp.interview, 0) => l.ajNearestInterviewToday,
            (JourneyStamp.interview, final d) => l.ajNearestInterview(d),
            (_, 0) => l.ajNearestSubmissionToday,
            (_, final d) => l.ajNearestSubmission(d),
          };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  l.fdJourneyTitle,
                  style: fdText(30, FontWeight.w800, FdColors.onPage, height: 1.1, letterSpacing: -0.6),
                ),
              ),
              HardIconButton(
                glyph: LucideIcons.userRound,
                semanticLabel: l.accountTooltip,
                size: 44,
                radius: 13,
                iconSize: 20,
                onTap: () => context.push('/account'),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Row(
            children: [
              _Ring(percent: summary.percent),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l.ajSummary(summary.count, summary.bestDone),
                      style: fdText(16, FontWeight.w800, FdColors.onPage, height: 1.25),
                    ),
                    if (nearestText != null) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: FdColors.lime, borderRadius: BorderRadius.circular(999)),
                        child: Text(nearestText, style: fdText(12, FontWeight.w800, FdColors.onLime, height: 1.2)),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 4),
            children: [
              const UniversityChoicesEntry(),
              for (final p in all) _Card(progress: p, now: now, onOpen: () => onOpen(p)),
            ],
          ),
        ),
        const ConsultantRow(),
      ],
    );
  }
}

/// The overall progress: a lime arc on a dim track, the percent inside.
class _Ring extends StatelessWidget {
  const _Ring({required this.percent});

  final int percent;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: 66,
    child: CustomPaint(
      painter: _RingPainter(percent / 100),
      child: Center(child: Text('$percent%', style: fdText(17, FontWeight.w800, FdColors.lime, height: 1))),
    ),
  );
}

class _RingPainter extends CustomPainter {
  const _RingPainter(this.value);

  final double value;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 7.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    canvas.drawArc(
      rect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.16)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
    if (value <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 2 * value.clamp(0, 1),
      false,
      Paint()
        ..color = FdColors.lime
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = stroke,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value;
}

class _Card extends ConsumerWidget {
  const _Card({required this.progress, required this.now, required this.onOpen});

  final UniversityProgress progress;
  final DateTime now;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final u = progress.university;
    final chip = journeyChip(context, progress, now);
    final line = journeyLine(context, progress, now);
    final sub = [?u.cityShort, journeyState(context, progress, now)].join(' · ');
    final action = progress.needsStudyPlan;

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
      child: Semantics(
        button: true,
        label: l.ajOpenUniversity(u.name),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onOpen,
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
            decoration: BoxDecoration(
              color: FdColors.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: FdColors.ink, width: 1.5),
              boxShadow: [
                BoxShadow(color: action ? FdColors.lime : FdColors.blueNight, offset: const Offset(5, 5)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    UniversityTile(text: u.tileText),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(u.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(16, FontWeight.w800, FdColors.ink)),
                          const SizedBox(height: 2),
                          Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(12, FontWeight.w500, FdColors.muted)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    JourneyChip(text: chip.text, kind: chip.kind),
                    const SizedBox(width: 4),
                    const Lucide(LucideIcons.chevronRight, size: 18, color: FdColors.muted),
                  ],
                ),
                const SizedBox(height: 14),
                _PhaseBar(progress: progress),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        line.text,
                        style: line.strong
                            ? fdText(13, FontWeight.w800, FdColors.ink, height: 1.3)
                            : fdText(13, FontWeight.w600, FdColors.muted, height: 1.3),
                      ),
                    ),
                    if (action) ...[
                      const SizedBox(width: 10),
                      _SignButton(onTap: () => openStudyPlan(context, ref)),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Hujjat · Topshirish · Suhbat · Qabul · Viza: blue when done, lime for the
/// one in progress, grey ahead (red where the university said no).
class _PhaseBar extends StatelessWidget {
  const _PhaseBar({required this.progress});

  final UniversityProgress progress;

  static const Color _ahead = Color(0xFFDDE3EE);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Row(
      children: [
        for (final p in JourneyPhase.values) ...[
          if (p.index > 0) const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 7,
                  decoration: BoxDecoration(
                    color: switch (progress.phaseState(p)) {
                      StampState.done => FdColors.blue,
                      StampState.current => FdColors.lime,
                      StampState.refused => FdColors.bad,
                      StampState.ahead => _ahead,
                    },
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  phaseLabel(l, p),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: fdText(10, FontWeight.w700, FdColors.muted, height: 1.1),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _SignButton extends StatelessWidget {
  const _SignButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: l.ajSign,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: FdColors.lime,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: FdColors.ink, width: 1.5),
          ),
          child: Text('${l.ajSign} →', style: fdText(13, FontWeight.w800, FdColors.onLime, height: 1.1)),
        ),
      ),
    );
  }
}
