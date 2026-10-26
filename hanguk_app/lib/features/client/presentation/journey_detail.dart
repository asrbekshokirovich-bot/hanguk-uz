import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../l10n/app_localizations.dart';
import '../../applications/domain/application_journey.dart';
import 'widgets/client_parts.dart';
import 'widgets/journey_parts.dart';

/// Design 8a: one university's application as a boarding pass to Korea —
/// Tashkent to the airport nearest the university, the intake, the status
/// and the days left to the estimated departure — and the eight stamps of
/// the passport, with "Imzolash" while the Study Plan is wanted.
class JourneyDetail extends ConsumerWidget {
  const JourneyDetail({
    super.key,
    required this.progress,
    required this.index,
    required this.total,
    required this.now,
    required this.onBack,
  });

  final UniversityProgress progress;
  final int index;
  final int total;
  final DateTime now;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final u = progress.university;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 16),
          child: Row(
            children: [
              Semantics(
                button: true,
                label: l.ajBack,
                excludeSemantics: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: tracked('journey_detail.back', onBack),
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: FdColors.card, borderRadius: BorderRadius.circular(13)),
                    child: const Icon(Icons.arrow_back, size: 22, color: FdColors.ink),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l.ajDetailKicker(index, total),
                      style: fdText(11, FontWeight.w800, FdColors.pageMuted, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      u.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: fdText(22, FontWeight.w800, FdColors.onPage, height: 1.15, letterSpacing: -0.4),
                    ),
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
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                child: _BoardingPass(progress: progress, now: now),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                child: Row(
                  children: [
                    Expanded(child: Text(l.ajStampsTitle, style: fdText(16, FontWeight.w800, FdColors.onPage))),
                    Text(l.ajStampsCount(progress.doneCount), style: fdText(12, FontWeight.w700, FdColors.pageMuted)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
                child: _Stamps(progress: progress),
              ),
              if (progress.needsStudyPlan)
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 14),
                  child: _StudyPlanBar(onSign: tracked('journey_detail.study_plan_bar_sign', () => openStudyPlan(context, ref))),
                ),
            ],
          ),
        ),
        const ConsultantRow(),
      ],
    );
  }
}

class _BoardingPass extends StatelessWidget {
  const _BoardingPass({required this.progress, required this.now});

  final UniversityProgress progress;
  final DateTime now;

  static const double _notchY = 128;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final u = progress.university;
    final airport = airportFor(u.city);
    final intake = u.intakeYear == null || (u.semester != 'bahor' && u.semester != 'kuz')
        ? 'HANGUK AIR'
        : l.ajTicketIntake(u.intakeYear!, u.semester == 'bahor' ? l.ajSpring : l.ajAutumn);
    final departure = u.departureEstimate;
    final days = departure == null ? null : math.max(0, daysUntil(departure, now));

    return ClipPath(
      clipper: const _TicketClipper(notchY: _notchY),
      child: Container(
        color: FdColors.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: _notchY,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(intake, style: fdText(11, FontWeight.w800, FdColors.blue, letterSpacing: 0.8)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(999)),
                          child: Text(l.ajTicketVisa(u.visaType), style: fdText(11, FontWeight.w800, FdColors.blue, height: 1.1)),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Airport(code: 'TAS', city: l.ajTashkent),
                        const Expanded(child: Padding(padding: EdgeInsets.only(top: 12), child: _FlightLine())),
                        _Airport(code: airport, city: kAirportCity[airport] ?? '', end: true),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: DashedDivider()),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(flex: 4, child: _Field(label: l.ajTicketUniversity, value: u.name)),
                  const SizedBox(width: 10),
                  Expanded(flex: 5, child: _Field(label: l.ajTicketStatus, value: journeyState(context, progress, now, ticket: true))),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(l.ajTicketCountdown, style: fdText(9, FontWeight.w800, FdColors.muted, letterSpacing: 0.6)),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: FdColors.lime,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: FdColors.ink, width: 1.5),
                        ),
                        child: Text(days == null ? '—' : l.ajDays(days), style: fdText(17, FontWeight.w900, FdColors.onLime, height: 1.1)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
              child: SizedBox(height: 34, child: CustomPaint(painter: _BarcodePainter(u.institutionId))),
            ),
          ],
        ),
      ),
    );
  }
}

class _Airport extends StatelessWidget {
  const _Airport({required this.code, required this.city, this.end = false});

  final String code;
  final String city;
  final bool end;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
    children: [
      Text(code, style: fdText(32, FontWeight.w900, FdColors.ink, height: 1, letterSpacing: -0.5)),
      const SizedBox(height: 3),
      Text(city, style: fdText(11, FontWeight.w600, FdColors.muted)),
    ],
  );
}

/// TAS ——✈- - - - CJJ: solid to the plane, dashed after.
class _FlightLine extends StatelessWidget {
  const _FlightLine();

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 18,
    child: CustomPaint(
      painter: const _FlightLinePainter(),
      child: const Align(
        alignment: Alignment(0.1, 0),
        child: ColoredBox(
          color: FdColors.card,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 4),
            child: Lucide(LucideIcons.plane, size: 18, color: FdColors.blue),
          ),
        ),
      ),
    ),
  );
}

class _FlightLinePainter extends CustomPainter {
  const _FlightLinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height / 2;
    final mid = size.width * 0.55;
    final solid = Paint()
      ..color = FdColors.blue
      ..strokeWidth = 2;
    canvas.drawLine(Offset(10, y), Offset(mid, y), solid);
    final dash = Paint()
      ..color = const Color(0xFFB8C4DC)
      ..strokeWidth = 2;
    for (var x = mid; x < size.width - 10; x += 8) {
      canvas.drawLine(Offset(x, y), Offset(math.min(x + 4, size.width - 10), y), dash);
    }
  }

  @override
  bool shouldRepaint(_FlightLinePainter old) => false;
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, maxLines: 1, style: fdText(9, FontWeight.w800, FdColors.muted, letterSpacing: 0.6)),
      const SizedBox(height: 4),
      Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(13, FontWeight.w800, FdColors.ink)),
    ],
  );
}

/// A white pass with a half-circle bitten out of each side at [notchY].
class _TicketClipper extends CustomClipper<Path> {
  const _TicketClipper({required this.notchY});

  final double notchY;

  @override
  Path getClip(Size size) {
    const r = 11.0;
    final card = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(18)));
    final notches = Path()
      ..addOval(Rect.fromCircle(center: Offset(0, notchY), radius: r))
      ..addOval(Rect.fromCircle(center: Offset(size.width, notchY), radius: r));
    return Path.combine(PathOperation.difference, card, notches);
  }

  @override
  bool shouldReclip(_TicketClipper old) => old.notchY != notchY;
}

/// Decoration only: bars whose widths come from the university's id, so a
/// pass always shows the same code.
class _BarcodePainter extends CustomPainter {
  const _BarcodePainter(this.seed);

  final String seed;

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(seed.hashCode);
    final paint = Paint()..color = FdColors.ink;
    var x = 0.0;
    while (x < size.width) {
      final w = 1.0 + rnd.nextInt(3);
      if (x + w > size.width) break;
      canvas.drawRect(Rect.fromLTWH(x, 0, w, size.height), paint);
      x += w + 1.5 + rnd.nextInt(3);
    }
  }

  @override
  bool shouldRepaint(_BarcodePainter old) => old.seed != seed;
}

class _Stamps extends StatelessWidget {
  const _Stamps({required this.progress});

  final UniversityProgress progress;

  // The pressed stamps sit a little askew, as real ones do.
  static const _tilt = [-0.06, 0.05, -0.035, 0.045, -0.05, 0.04, -0.045, 0.06];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        const gap = 10.0;
        final w = (c.maxWidth - gap * 3) / 4;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final v in progress.stamps)
              SizedBox(
                width: w,
                height: w * 1.05,
                child: Transform.rotate(
                  angle: v.state == StampState.done ? _tilt[v.stamp.index] : 0,
                  child: _Stamp(view: v, university: progress.university),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Stamp extends StatelessWidget {
  const _Stamp({required this.view, required this.university});

  final StampView view;
  final JourneyUniversity university;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final label = stampLabel(l, view.stamp, university).toUpperCase();
    final date = view.state == StampState.refused ? l.ajChipRejected : stampDate(context, view);
    final (fg, sub, icon) = switch (view.state) {
      StampState.done => (FdColors.lime, FdColors.lime, const Icon(Icons.check, size: 18, color: FdColors.lime)),
      StampState.current => (Colors.white, Colors.white, const Icon(Icons.autorenew, size: 18, color: Colors.white)),
      StampState.refused => (FdColors.bad, FdColors.bad, const Icon(Icons.close, size: 18, color: FdColors.bad)),
      StampState.ahead => (
        const Color(0xFF6F7FA6),
        const Color(0xFF56658A),
        const Icon(Icons.radio_button_unchecked, size: 16, color: Color(0xFF56658A)),
      ),
    };
    final body = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 6),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          icon,
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: fdText(8, FontWeight.w900, fg, height: 1.15),
          ),
          if (date != null) ...[
            const SizedBox(height: 3),
            Text(date, maxLines: 1, overflow: TextOverflow.ellipsis, style: fdText(9, FontWeight.w600, sub, height: 1.1)),
          ],
        ],
      ),
    );
    return switch (view.state) {
      StampState.done || StampState.refused => Container(
        decoration: BoxDecoration(
          color: (view.state == StampState.done ? FdColors.lime : FdColors.bad).withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: fg, width: 2),
        ),
        child: body,
      ),
      StampState.current => CustomPaint(
        painter: const DashedPillPainter(color: Colors.white, radius: 12),
        child: ColoredBox(color: Colors.white.withValues(alpha: 0.06), child: body),
      ),
      StampState.ahead => CustomPaint(
        painter: const DashedPillPainter(color: Color(0xFF3A4A78), radius: 12),
        child: body,
      ),
    };
  }
}

class _StudyPlanBar extends StatelessWidget {
  const _StudyPlanBar({required this.onSign});

  final VoidCallback onSign;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: FdColors.lime,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: FdColors.ink, width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            width: 16,
            height: 16,
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: FdColors.ink, width: 1.5)),
            child: Container(
              width: 7,
              height: 7,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: FdColors.ink),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(l.ajActionStudyPlan, style: fdText(13, FontWeight.w800, FdColors.onLime, height: 1.3)),
          ),
          const SizedBox(width: 10),
          Semantics(
            button: true,
            excludeSemantics: true,
            label: l.ajSign,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: tracked('journey_detail.study_plan_bar_sign', onSign),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(color: FdColors.ink, borderRadius: BorderRadius.circular(999)),
                child: Text(l.ajSign, style: fdText(13, FontWeight.w800, FdColors.lime, height: 1.1)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
