import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../applications/data/applications_repository.dart';
import '../../../map/data/map_repository.dart';
import '../../../map/domain/university.dart';

/// Target-university picker shared by the interview, personal-statement and
/// study-plan setup flows.
///
/// Product decision (2026-07): a student can practice for ANY university,
/// not only ones they have an application for.
///   - If the student has applications, the picker lists those universities.
///   - If they have none, it falls back to the full university list so they
///     can still choose a target and start preparing.
///
/// `onPick` reports the chosen institution id + display name; both the
/// applied-universities and the all-universities rows are `University`
/// objects, so the id is always a valid `institutions.id`.
class TargetUniversityPicker extends ConsumerWidget {
  const TargetUniversityPicker({
    super.key,
    required this.selectedId,
    required this.onPick,
  });

  final String? selectedId;
  final void Function(String id, String name) onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final appsAsync = ref.watch(applicationsProvider);

    return appsAsync.when(
      loading: _loading,
      error: (e, _) => _error(l, e),
      data: (apps) {
        final applied = apps
            .map((a) => a.university)
            .whereType<University>()
            .toList();

        // Has applications → pick among the applied universities.
        if (applied.isNotEmpty) {
          return _list(applied);
        }

        // No applications → let the student pick any university.
        final allAsync = ref.watch(universitiesProvider);
        return allAsync.when(
          loading: _loading,
          error: (e, _) => _error(l, e),
          data: _list,
        );
      },
    );
  }

  Widget _loading() => const Padding(
    padding: EdgeInsets.symmetric(vertical: 8),
    child: Center(child: CircularProgressIndicator(color: SeoulColors.lime)),
  );

  Widget _error(AppLocalizations l, Object e) => Text(
    l.genericError(e),
    style: SeoulType.caption.copyWith(color: SeoulColors.dangerText),
  );

  Widget _list(List<University> unis) {
    return Container(
      height: 190,
      width: double.maxFinite,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: SeoulColors.neutralFill,
        borderRadius: SeoulRadii.tileR,
        border: Border.all(color: SeoulColors.glassBorder),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.all(6),
        itemCount: unis.length,
        separatorBuilder: (_, _) => const SizedBox(height: 6),
        itemBuilder: (context, i) {
          final uni = unis[i];
          return _UniRow(
            uni: uni,
            selected: selectedId == uni.id,
            onTap: () => onPick(uni.id, uni.name),
          );
        },
      ),
    );
  }
}

/// One selectable row: hangul glyph tile + name, lime-tinted with a 선택
/// status word when it is the current target (spec §3.5).
class _UniRow extends StatelessWidget {
  const _UniRow({
    required this.uni,
    required this.selected,
    required this.onTap,
  });

  final University uni;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Prefer the Korean label for the avatar so the tile carries a real
    // hangul syllable (서 / 연 / 고) rather than a Latin initial.
    final glyphSource = (uni.nameKoShort?.isNotEmpty ?? false)
        ? uni.nameKoShort
        : uni.nameKo;

    return Semantics(
      button: true,
      selected: selected,
      label: uni.name,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: SeoulMotion.fast,
          curve: SeoulMotion.smooth,
          constraints: const BoxConstraints(minHeight: SeoulSizes.minTapTarget),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? SeoulColors.limeFill : SeoulColors.glass,
            borderRadius: SeoulRadii.controlR,
            border: Border.all(
              color: selected ? SeoulColors.lime : SeoulColors.glassBorder,
            ),
          ),
          child: Row(
            children: [
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(glyphSource),
                size: 32,
                radius: SeoulRadii.button,
                active: selected,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  uni.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.bodySecondary.copyWith(
                    color: selected
                        ? SeoulColors.lime
                        : SeoulColors.textPrimary,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              if (selected) ...[
                const SizedBox(width: 8),
                Text(
                  '선택',
                  style: SeoulType.hangulStatus.copyWith(
                    color: SeoulColors.lime,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
