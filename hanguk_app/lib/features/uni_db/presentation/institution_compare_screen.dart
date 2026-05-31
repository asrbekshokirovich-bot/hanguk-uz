import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/uni_db_providers.dart';
import '../domain/institution_summary.dart';
import 'widgets/coming_soon_card.dart';

/// `/institutions/compare?ids=a,b` — 2-up institution comparison.
///
/// Phase 3 fills out the side-by-side grid that Phase 2 stubbed. Per
/// PHASE_3_DESIGN.md §6 this is one of the lighter Phase 3 deliverables;
/// the heavy lifting happens server-side in `v_institutions_for_map`.
class InstitutionCompareScreen extends ConsumerWidget {
  const InstitutionCompareScreen({super.key, required this.ids});

  final List<String> ids;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(compareInstitutionsProvider(ids));
    return Scaffold(
      appBar: AppBar(title: const Text('Compare')),
      body: asyncRows.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (rows) {
          if (rows.isEmpty) {
            return const ComingSoonCard(
              title: 'Compare universities',
              subtitle:
                  'Track at least two institutions, then return here to compare them.',
              icon: Icons.compare_arrows,
            );
          }
          if (rows.length == 1) {
            return _SingleInstitutionHint(institution: rows.first);
          }
          return _CompareGrid(institutions: rows);
        },
      ),
    );
  }
}

class _SingleInstitutionHint extends StatelessWidget {
  const _SingleInstitutionHint({required this.institution});
  final InstitutionSummary institution;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Need a second university to compare against.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Currently selected: ${institution.nameKo}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _CompareGrid extends StatelessWidget {
  const _CompareGrid({required this.institutions});
  final List<InstitutionSummary> institutions;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _CompareHeaderRow(institutions: institutions),
          const Divider(height: 24),
          _CompareRow(
            label: 'English name',
            values: institutions.map((i) => i.nameEn ?? '—').toList(),
          ),
          _CompareRow(
            label: 'Uzbek name',
            values: institutions.map((i) => i.nameUz ?? '—').toList(),
          ),
          _CompareRow(
            label: 'City',
            values: institutions.map((i) => i.cityKo ?? '—').toList(),
          ),
          _CompareRow(
            label: 'Tier',
            values: institutions.map((i) => i.tier?.toString() ?? '—').toList(),
          ),
          _CompareRow(
            label: 'IEQAS status',
            values: institutions.map((i) => i.ieqasStatus ?? '—').toList(),
          ),
          _CompareRow(
            label: 'Hanguk partner',
            values: institutions
                .map((i) => i.isPartner ? 'Yes' : 'No')
                .toList(),
          ),
          _CompareRow(
            label: 'Last verified',
            values: institutions
                .map(
                  (i) =>
                      i.lastVerifiedAt?.toIso8601String().split('T').first ??
                      '—',
                )
                .toList(),
          ),
          _CompareRow(
            label: 'Next deadline',
            values: institutions
                .map(
                  (i) =>
                      i.nextEventAt?.toIso8601String().split('T').first ?? '—',
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _CompareHeaderRow extends StatelessWidget {
  const _CompareHeaderRow({required this.institutions});
  final List<InstitutionSummary> institutions;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(width: 140),
        ...institutions.map(
          (i) => Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    i.nameKo,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (i.nameKoShort != null && i.nameKoShort != i.nameKo)
                    Text(
                      i.nameKoShort!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.label, required this.values});
  final String label;
  final List<String> values;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: Theme.of(context).textTheme.labelLarge),
          ),
          ...values.map(
            (v) => Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(v),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
