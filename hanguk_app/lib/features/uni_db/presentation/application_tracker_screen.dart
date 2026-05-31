import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/uni_db_providers.dart';
import 'widgets/coming_soon_card.dart';

class ApplicationTrackerScreen extends ConsumerWidget {
  const ApplicationTrackerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(userTrackedProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Application tracker')),
      body: asyncRows.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (rows) {
          if (rows.isEmpty) {
            return const ComingSoonCard(
              title: 'Track your applications',
              subtitle:
                  'Phase 1 lights up the cycle-aware tracker. The home '
                  'banner ("Adiga calendar") ships first as a quick win.',
              icon: Icons.event_note,
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            itemBuilder: (_, i) {
              final r = rows[i];
              return ListTile(
                title: Text(r.nameKo),
                subtitle: Text('${r.eventType} · ${r.startsAt.toLocal()}'),
                trailing: Text(r.cycleTrack ?? ''),
              );
            },
          );
        },
      ),
    );
  }
}
