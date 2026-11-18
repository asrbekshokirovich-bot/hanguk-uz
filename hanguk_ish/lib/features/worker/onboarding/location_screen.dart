import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../design/icons.dart';
import '../../../design/insets.dart';
import '../../../design/tokens.dart';
import '../../../design/typography.dart';
import '../../../design/widgets/backdrop.dart';
import '../../../design/widgets/buttons.dart';
import '../../../l10n/gen/worker_l10n.dart';

/// Asks the phone for the location permission (A03 sorts shifts by distance).
/// A provider so tests can answer without the platform; a refusal or an error
/// is not a problem — the feed then works without distances.
final locationPermissionRequestProvider = Provider<Future<void> Function()>(
  (ref) => () async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) await Geolocator.requestPermission();
    } on Object {
      // Nothing to do: the worker can allow it later in the phone's settings.
    }
  },
);

/// After A02: «Joylashuvingizni yoqing». «Ruxsat berish» opens the system
/// question, «Keyinroq» goes on without it; both continue to the feed.
class LocationPermissionScreen extends ConsumerStatefulWidget {
  const LocationPermissionScreen({super.key, required this.onContinue});

  final VoidCallback onContinue;

  @override
  ConsumerState<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends ConsumerState<LocationPermissionScreen> {
  bool _asking = false;

  Future<void> _allow() async {
    setState(() => _asking = true);
    await ref.read(locationPermissionRequestProvider)();
    if (mounted) widget.onContinue();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = WorkerL10n.of(context);
    return Scaffold(
      backgroundColor: HiColors.navy,
      body: HiBackdrop(
        child: Padding(
          padding: EdgeInsets.fromLTRB(18, HiInsets.top(context, 56), 22, HiInsets.bottom(context, 30)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2),
              ExcludeSemantics(
                child: Container(
                  width: 96,
                  height: 96,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(color: HiColors.white12, shape: BoxShape.circle),
                  child: const HiIcon(HiIcons.mapPin, size: 44, strokeWidth: 2, color: HiColors.lime),
                ),
              ),
              const SizedBox(height: 28),
              Semantics(
                header: true,
                child: HiText(
                  l10n.locationTitle,
                  textAlign: TextAlign.center,
                  style: hiStyle(28, FontWeight.w800, height: 1.2, letterSpacingEm: -0.02),
                ),
              ),
              const SizedBox(height: 12),
              HiText(
                l10n.locationSubtitle,
                textAlign: TextAlign.center,
                style: hiStyle(16, FontWeight.w500, height: 1.45, color: HiColors.textSoft),
              ),
              const Spacer(flex: 3),
              HiButton(label: l10n.locationAllow, onPressed: _asking ? null : _allow),
              const SizedBox(height: 12),
              HiButton(label: l10n.locationLater, style: HiButtonStyle.ghost, onPressed: _asking ? null : widget.onContinue),
            ],
          ),
        ),
      ),
    );
  }
}
