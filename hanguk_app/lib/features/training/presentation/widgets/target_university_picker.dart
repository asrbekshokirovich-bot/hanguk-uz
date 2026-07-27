import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../design_system/theme/app_colors.dart';
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
    child: Center(
      child: CircularProgressIndicator(color: AppColors.vibrantLime),
    ),
  );

  Widget _error(AppLocalizations l, Object e) => Text(
    l.genericError(e),
    style: const TextStyle(color: Colors.redAccent, fontSize: 12),
  );

  Widget _list(List<University> unis) {
    return Container(
      height: 150,
      width: double.maxFinite,
      decoration: BoxDecoration(
        border: Border.all(color: Colors.white10),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListView.builder(
        shrinkWrap: true,
        itemCount: unis.length,
        itemBuilder: (context, i) {
          final uni = unis[i];
          final isSelected = selectedId == uni.id;
          return ListTile(
            dense: true,
            leading: Icon(
              Icons.school,
              color: isSelected ? AppColors.vibrantLime : Colors.white24,
            ),
            title: Text(
              uni.name,
              style: TextStyle(
                color: isSelected ? AppColors.vibrantLime : Colors.white,
              ),
            ),
            trailing: isSelected
                ? const Icon(Icons.check_circle, color: AppColors.vibrantLime)
                : null,
            onTap: () => onPick(uni.id, uni.name),
          );
        },
      ),
    );
  }
}
