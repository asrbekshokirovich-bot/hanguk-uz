import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/money/won.dart';
import '../../../core/time/clock.dart';
import '../../../data/models/shift.dart';
import '../../../data/repositories/shift_repository.dart';
import '../../../design/icons.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/pressable.dart';
import '../../../l10n/gen/worker_l10n.dart';
import '../feed/feed_area.dart';
import '../feed/feed_controller.dart';
import '../feed/feed_screen.dart';
import '../settings/app_language.dart';
import '../shift/shift_widgets.dart';

/// Screen position of the worker on the prototype's 390 × 844 map.
const _userPoint = Offset(110, 400);

/// Map scale of the stylised map.
const _pxPerKm = 95.0;

/// Where a point lies on the stylised map, relative to [area]'s position.
/// The stylised map is drawn around a known position: [area] when located,
/// otherwise the prototype's Sinchon.
Offset mapOffset(FeedArea area, double lat, double lng) {
  const kmPerDegree = 111.32;
  final centerLat = area.lat ?? sinchonArea.lat!;
  final centerLng = area.lng ?? sinchonArea.lng!;
  final dxKm = (lng - centerLng) * kmPerDegree * math.cos(centerLat * math.pi / 180);
  final dyKm = (lat - centerLat) * kmPerDegree;
  return _userPoint + Offset(dxKm * _pxPerKm, -dyKm * _pxPerKm);
}

/// One pin: a workplace and its shifts in the current filters.
class _Pin {
  _Pin(this.shifts);

  final List<ShiftListing> shifts;

  ShiftListing get first => shifts.first;
  int get wage => shifts.map((s) => s.hourlyWage).reduce(math.max);
}

/// A04 «Xarita»: the feed's shifts as price pins around the worker.
///
/// Until a map provider key is configured this draws the prototype's
/// stylised map; pins are placed from the workplaces' coordinates.
class WorkerMapScreen extends ConsumerStatefulWidget {
  const WorkerMapScreen({super.key, required this.actions});

  final FeedActions actions;

  @override
  ConsumerState<WorkerMapScreen> createState() => _WorkerMapScreenState();
}

class _WorkerMapScreenState extends ConsumerState<WorkerMapScreen> {
  String? _selectedBusiness;

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    final lang = ref.watch(appLanguageProvider).code;
    final now = ref.watch(clockProvider)();
    final area = ref.watch(feedAreaProvider).value ?? sinchonArea;
    final feed = ref.watch(feedProvider);
    final shifts = feed.value ?? const <ShiftListing>[];
    final offline = !feed.isLoading && feed.hasError && feed.error is OfflineException;

    final pins = <String, _Pin>{};
    for (final s in shifts) {
      // A shift whose place is not known yet (a business registered with
      // only its number) cannot be put on the map; the list has it.
      if ((s.lat ?? s.business.lat) == null || (s.lng ?? s.business.lng) == null) continue;
      (pins[s.business.id] ??= _Pin([])).shifts.add(s);
    }
    final selectedId = pins.containsKey(_selectedBusiness) ? _selectedBusiness : (pins.isEmpty ? null : pins.keys.first);
    final selected = selectedId == null ? null : pins[selectedId]!.first;

    return Scaffold(
      backgroundColor: const Color(0xFF0E1A4C),
      body: Stack(
        children: [
          const Positioned.fill(child: CustomPaint(painter: _StylizedMapPainter())),
          // The worker.
          Positioned(
            left: _userPoint.dx - 14,
            top: _userPoint.dy - 14,
            child: ExcludeSemantics(
              child: Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(color: Color.fromRGBO(36, 71, 214, 0.35), shape: BoxShape.circle),
                alignment: Alignment.center,
                child: Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: HiColors.blue,
                    shape: BoxShape.circle,
                    border: Border.all(color: HiColors.white, width: 2),
                  ),
                ),
              ),
            ),
          ),
          for (final entry in pins.entries.where((e) => e.key != selectedId))
            _placedPin(area, entry.value, selected: false, lang: lang, l10n: l10n),
          if (selectedId != null) _placedPin(area, pins[selectedId]!, selected: true, lang: lang, l10n: l10n),
          // «Mening joylashuvim».
          Positioned(
            right: 18,
            top: 482,
            child: HiPressable(
              onTap: () => ref.invalidate(feedAreaProvider),
              semanticsLabel: l10n.myLocation,
              builder: (context, pressed) => Transform.translate(
                offset: pressed ? const Offset(1, 1) : Offset.zero,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: HiColors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.fromBorderSide(HiBorders.ink),
                    boxShadow: [BoxShadow(color: HiColors.ink, offset: pressed ? const Offset(2, 2) : const Offset(3, 3))],
                  ),
                  alignment: Alignment.center,
                  child: const HiIcon(HiIcons.locateFixed, size: 22, strokeWidth: 2, color: HiColors.ink),
                ),
              ),
            ),
          ),
          // Header over the map, fading out at the bottom.
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [HiColors.navy, HiColors.navy, Color.fromRGBO(10, 20, 64, 0)],
                  stops: [0, 0.7, 1],
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 22),
                child: FeedHeader(
                  title: l10n.mapTitle,
                  mapSelected: true,
                  onList: widget.actions.openFeed,
                  onMap: () {},
                  onNotifications: widget.actions.openNotifications,
                  showLocation: false,
                  chipBackground: HiColors.navy,
                  offline: offline,
                ),
              ),
            ),
          ),
          if (selected != null)
            Positioned(
              left: 18,
              right: 22,
              bottom: 14,
              child: Semantics(
                container: true,
                label: l10n.selectedShift,
                child: ShiftCard(
                  shift: selected,
                  lang: lang,
                  now: now,
                  divider: false,
                  onOpen: () => widget.actions.openShift(selected),
                  onTake: () => widget.actions.takeShift(selected),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _placedPin(FeedArea area, _Pin pin, {required bool selected, required String lang, required WorkerL10n l10n}) {
    final first = pin.first;
    final b = first.business;
    final at = mapOffset(area, (first.lat ?? b.lat)!, (first.lng ?? b.lng)!);
    return Positioned(
      left: at.dx,
      top: at.dy,
      child: FractionalTranslation(
        translation: const Offset(-0.5, -0.5),
        child: _MapPin(
          label: Won.worker(pin.wage),
          selected: selected,
          semanticsLabel: '${b.displayName(lang)}, ${Won.worker(pin.wage)} ${l10n.perHour}',
          onTap: () {
            if (selected) {
              widget.actions.openShift(pin.first);
            } else {
              setState(() => _selectedBusiness = b.id);
            }
          },
        ),
      ),
    );
  }
}

/// A price pin: white 34 px pill in a 44 px target, or the lime selected one.
class _MapPin extends StatelessWidget {
  const _MapPin({required this.label, required this.selected, required this.semanticsLabel, required this.onTap});

  final String label;
  final bool selected;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HiPressable(
      onTap: onTap,
      selected: selected,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed) {
        final text = HiText(
          label,
          textScaler: TextScaler.noScaling,
          style: hiStyle(
            selected ? 16 : 14,
            FontWeight.w800,
            color: selected ? HiColors.onLime : HiColors.ink,
            family: HiFamily.mono,
          ),
        );
        if (selected) {
          return Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: HiColors.lime,
              borderRadius: BorderRadius.circular(HiRadii.pill),
              border: Border.fromBorderSide(HiBorders.ink),
              boxShadow: HiShadows.hard,
            ),
            alignment: Alignment.center,
            child: text,
          );
        }
        return Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          alignment: Alignment.center,
          child: Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: pressed ? HiColors.surface : HiColors.white,
              borderRadius: BorderRadius.circular(HiRadii.pill),
              border: Border.fromBorderSide(HiBorders.ink),
              boxShadow: const [BoxShadow(color: HiColors.ink, offset: Offset(3, 3))],
            ),
            alignment: Alignment.center,
            child: text,
          ),
        );
      },
    );
  }
}

/// The prototype's map drawing: blocks, a river, roads and area names.
class _StylizedMapPainter extends CustomPainter {
  const _StylizedMapPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF0E1A4C));
    final block = Paint()..color = const Color(0xFF122C5C);
    canvas.drawRRect(RRect.fromLTRBR(250, 560, 420, 680, const Radius.circular(18)), block);
    canvas.drawRRect(RRect.fromLTRBR(-20, 520, 100, 610, const Radius.circular(18)), block);
    final river = Path()
      ..moveTo(-20, 700)
      ..cubicTo(80, 660, 220, 750, 410, 690)
      ..lineTo(410, 860)
      ..lineTo(-20, 860)
      ..close();
    canvas.drawPath(river, Paint()..color = const Color(0xFF0B2E73));
    final road = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..color = const Color(0xFF1A2A68)
      ..strokeWidth = 6;
    for (final (a, b) in const [
      (Offset(-20, 150), Offset(410, 110)),
      (Offset(-20, 470), Offset(410, 420)),
      (Offset(60, -20), Offset(80, 860)),
      (Offset(300, -20), Offset(330, 860)),
      (Offset(-20, 780), Offset(410, 800)),
    ]) {
      canvas.drawLine(a, b, road);
    }
    road
      ..color = const Color(0xFF22337A)
      ..strokeWidth = 14;
    for (final (a, b) in const [
      (Offset(-20, 340), Offset(410, 230)),
      (Offset(150, -20), Offset(190, 860)),
      (Offset(-20, 610), Offset(410, 650)),
    ]) {
      canvas.drawLine(a, b, road);
    }
    for (final (name, x, y) in const [('SINCHON', 290.0, 334.0), ('HONGDAE', 22.0, 424.0), ('MAPO', 284.0, 530.0)]) {
      final painter = TextPainter(
        text: TextSpan(
          text: name,
          style: hiStyle(12, FontWeight.w800, color: const Color.fromRGBO(255, 255, 255, 0.42), height: 1, letterSpacingEm: 0.12),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final baseline = painter.computeDistanceToActualBaseline(TextBaseline.alphabetic);
      painter.paint(canvas, Offset(x, y - baseline));
      painter.dispose();
    }
  }

  @override
  bool shouldRepaint(_StylizedMapPainter oldDelegate) => false;
}
