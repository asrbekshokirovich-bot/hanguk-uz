import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../map/data/map_repository.dart';
import '../../map/presentation/widgets/university_map_view.dart';

/// Guest map (DESIGN_SPEC screen 9) — the same dark Korea card the
/// signed-in map uses, with every institution pinned.
///
/// The spec's open/closed pin brightness is not implemented: it keys off an
/// admission cycle, and `next_event_at` is null for all 204 rows, so every
/// pin would be "closed". A uniform pin is honest; a dimmed one would be a
/// claim about admissions nobody has data for.
class GuestMapScreen extends ConsumerWidget {
  const GuestMapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final unisAsync = ref.watch(universitiesProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        2,
        SeoulSizes.screenPadding,
        SeoulSizes.orbBottom + 8,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: SeoulColors.mapWater,
          borderRadius: SeoulRadii.cardR,
          border: Border.all(color: SeoulColors.glassBorder),
          boxShadow: SeoulShadows.card,
        ),
        child: ClipRRect(
          borderRadius: SeoulRadii.cardR,
          child: unisAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: SeoulColors.lime),
            ),
            error: (_, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(SeoulSizes.screenPadding),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l.appsLoadError,
                      textAlign: TextAlign.center,
                      style: SeoulType.bodySecondary,
                    ),
                    const SizedBox(height: 16),
                    SeoulOutlineButton(
                      label: l.commonRetry,
                      onPressed: () => ref.invalidate(universitiesProvider),
                    ),
                  ],
                ),
              ),
            ),
            data: (unis) => UniversityMapView(universities: unis),
          ),
        ),
      ),
    );
  }
}
