import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/pdf_url_service.dart';
import '../data/uni_db_providers.dart';
import '../domain/document_requirement_row.dart';
import '../domain/institution_summary.dart';
import '../domain/requirements_row.dart';
import '../domain/scholarship_row.dart';
import '../domain/upcoming_deadline.dart';
import 'widgets/coming_soon_card.dart';

/// `/institutions/:id` — per-institution detail page.
///
/// Sections:
///   * Header (name_ko + name_en + name_uz + chips for city/tier/IEQAS/partner)
///   * Track / un-track switch (writes to user_tracked_universities)
///   * Upcoming deadlines (cycle_dates joined with admission_cycles)
///
/// Tuition / requirements / scholarships / document checklist sections
/// are scaffolded with TODO markers; the data is in Supabase but the
/// rendering layer for each is its own piece of work.
class InstitutionDetailScreen extends ConsumerWidget {
  const InstitutionDetailScreen({super.key, required this.institutionId});

  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(institutionDetailProvider(institutionId));

    return Scaffold(
      appBar: AppBar(title: const Text('Institution')),
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load: $e')),
        data: (summary) {
          if (summary == null) {
            return const ComingSoonCard(
              title: 'Institution not found',
              subtitle:
                  'The id you opened does not match a row in '
                  'v_institutions_for_map. If the discovery worker just '
                  'crawled it, give it a few minutes.',
            );
          }
          return _DetailContent(institutionId: institutionId, summary: summary);
        },
      ),
    );
  }
}

class _DetailContent extends ConsumerWidget {
  const _DetailContent({required this.institutionId, required this.summary});

  final String institutionId;
  final InstitutionSummary summary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tracking = ref.watch(institutionTrackingProvider(institutionId));
    final deadlines = ref.watch(institutionDeadlinesProvider(institutionId));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _HeaderCard(summary: summary),
        const SizedBox(height: 16),
        _TrackToggle(institutionId: institutionId, tracking: tracking),
        const SizedBox(height: 12),
        _OpenGuidelineButton(institutionId: institutionId),
        const SizedBox(height: 24),
        Text(
          'Upcoming deadlines',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        deadlines.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => Text('Could not load deadlines: $e'),
          data: (rows) {
            if (rows.isEmpty) {
              return const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'No upcoming deadlines on file. The discovery worker '
                    'fills these in once the cycle is announced.',
                  ),
                ),
              );
            }
            return Column(
              children: rows.map((d) => _DeadlineTile(deadline: d)).toList(),
            );
          },
        ),
        const SizedBox(height: 24),
        Text('Tuition', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        _TuitionSection(institutionId: institutionId),
        const SizedBox(height: 24),
        Text('Requirements', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        _RequirementsSection(institutionId: institutionId),
        const SizedBox(height: 24),
        Text('Scholarships', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        _ScholarshipsSection(institutionId: institutionId),
        const SizedBox(height: 24),
        Text(
          'Document checklist',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        _DocumentsSection(institutionId: institutionId),
      ],
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.summary});
  final InstitutionSummary summary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(summary.nameKo, style: theme.textTheme.headlineSmall),
            if (summary.nameKoShort != null &&
                summary.nameKoShort != summary.nameKo)
              Text(summary.nameKoShort!, style: theme.textTheme.bodySmall),
            const SizedBox(height: 4),
            if (summary.nameEn != null) Text(summary.nameEn!),
            if (summary.nameUz != null)
              Text(summary.nameUz!, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (summary.cityKo != null) Chip(label: Text(summary.cityKo!)),
                if (summary.tier != null)
                  Chip(label: Text('Tier ${summary.tier}')),
                if (summary.ieqasStatus != null)
                  Chip(label: Text('IEQAS · ${summary.ieqasStatus}')),
                if (summary.isPartner)
                  Chip(
                    avatar: const Icon(Icons.handshake_outlined, size: 16),
                    label: const Text('Hanguk partner'),
                    backgroundColor: theme.colorScheme.primaryContainer,
                  ),
              ],
            ),
            if (summary.lastVerifiedAt != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Last verified: ${summary.lastVerifiedAt!.toIso8601String().split("T").first}',
                  style: theme.textTheme.bodySmall,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TrackToggle extends ConsumerStatefulWidget {
  const _TrackToggle({required this.institutionId, required this.tracking});

  final String institutionId;
  final AsyncValue<Map<String, dynamic>?> tracking;

  @override
  ConsumerState<_TrackToggle> createState() => _TrackToggleState();
}

class _TrackToggleState extends ConsumerState<_TrackToggle> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    return widget.tracking.when(
      loading: () => const ListTile(
        leading: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        title: Text('Track this institution'),
      ),
      error: (e, _) => ListTile(
        leading: const Icon(Icons.error_outline),
        title: const Text('Track this institution'),
        subtitle: Text('$e', style: const TextStyle(color: Colors.red)),
      ),
      data: (row) {
        final tracking = row != null;
        return Card(
          child: SwitchListTile(
            value: tracking,
            onChanged: _busy ? null : (v) => _toggle(v),
            title: const Text('Track this institution'),
            subtitle: Text(
              tracking
                  ? 'You will see deadlines on the home banner and get push '
                        'notifications when something changes.'
                  : 'Turn on to follow deadlines, correction notices, and '
                        'requirement changes.',
            ),
          ),
        );
      },
    );
  }

  Future<void> _toggle(bool track) async {
    setState(() => _busy = true);
    try {
      await setInstitutionTracking(
        institutionId: widget.institutionId,
        track: track,
      );
      ref.invalidate(institutionTrackingProvider(widget.institutionId));
      ref.invalidate(notificationSettingsProvider);
      ref.invalidate(userTrackedProvider);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not update tracking: $err')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _DeadlineTile extends StatelessWidget {
  const _DeadlineTile({required this.deadline});
  final UpcomingDeadline deadline;

  @override
  Widget build(BuildContext context) {
    final days = deadline.daysUntil;
    final urgency = days <= 0
        ? 'TODAY'
        : days == 1
        ? 'in 1 day'
        : days <= 7
        ? 'in $days days'
        : 'in $days days';
    final urgencyColor = days <= 1
        ? Colors.red
        : days <= 7
        ? Colors.orange
        : Theme.of(context).colorScheme.onSurfaceVariant;
    return Card(
      child: ListTile(
        leading: Icon(_iconFor(deadline.eventType), color: urgencyColor),
        title: Text(_labelFor(deadline.eventType)),
        subtitle: Text(
          deadline.startsAt
                  .toIso8601String()
                  .replaceFirst('T', ' ')
                  .substring(0, 16) +
              (deadline.cycleTrack != null ? ' · ${deadline.cycleTrack}' : ''),
        ),
        trailing: Text(
          urgency,
          style: TextStyle(color: urgencyColor, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  IconData _iconFor(String eventType) => switch (eventType) {
    'apply_open' => Icons.lock_open,
    'apply_close' => Icons.lock_outline,
    'document_submission_deadline' => Icons.upload_file,
    'first_stage_results' => Icons.assignment_turned_in,
    'interview' => Icons.record_voice_over,
    'practical_exam' => Icons.science,
    'final_results' => Icons.emoji_events,
    'additional_admit' => Icons.add_circle_outline,
    'registration_open' => Icons.app_registration,
    'registration_close' => Icons.lock_clock,
    'orientation' => Icons.school,
    'semester_start' => Icons.calendar_today,
    _ => Icons.event,
  };

  String _labelFor(String eventType) => switch (eventType) {
    'apply_open' => 'Application opens',
    'apply_close' => 'Application closes',
    'document_submission_deadline' => 'Documents due',
    'first_stage_results' => 'First-stage results',
    'interview' => 'Interview',
    'practical_exam' => 'Practical exam',
    'final_results' => 'Final results',
    'additional_admit' => 'Additional admission',
    'registration_open' => 'Registration opens',
    'registration_close' => 'Registration closes',
    'orientation' => 'Orientation',
    'semester_start' => 'Semester starts',
    _ => eventType.replaceAll('_', ' '),
  };
}

/// "Open admission guide PDF" button. Calls get-pdf-url to mint a
/// 15-minute signed URL, then launches it in the user's preferred
/// PDF reader. The Edge Function writes a pdf_access_log audit row
/// server-side; the client never touches that table directly.
class _OpenGuidelineButton extends ConsumerStatefulWidget {
  const _OpenGuidelineButton({required this.institutionId});
  final String institutionId;

  @override
  ConsumerState<_OpenGuidelineButton> createState() =>
      _OpenGuidelineButtonState();
}

class _OpenGuidelineButtonState extends ConsumerState<_OpenGuidelineButton> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final docId = ref.watch(
      institutionPrimaryGuidelineProvider(widget.institutionId),
    );
    return docId.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (id) {
        if (id == null) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: Text(
              'No admission guide PDF on file yet — the discovery worker '
              'hasn’t crawled this institution’s 모집요강.',
              style: TextStyle(fontStyle: FontStyle.italic, fontSize: 12),
            ),
          );
        }
        return Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            icon: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf),
            label: Text(_busy ? 'Opening...' : 'Open admission guide PDF'),
            onPressed: _busy ? null : () => _open(id),
          ),
        );
      },
    );
  }

  Future<void> _open(String documentId) async {
    setState(() => _busy = true);
    try {
      final service = ref.read(pdfUrlServiceProvider);
      final signed = await service.getSignedUrl(documentId);
      final uri = Uri.tryParse(signed.signedUrl);
      if (uri == null) throw StateError('Signed URL was not parseable');
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Could not launch PDF — no app available to handle the URL.',
            ),
          ),
        );
      }
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not open PDF: $err')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _SectionEmpty extends StatelessWidget {
  const _SectionEmpty({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(message, style: Theme.of(context).textTheme.bodySmall),
      ),
    );
  }
}

class _TuitionSection extends ConsumerWidget {
  const _TuitionSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(institutionTuitionProvider(institutionId));
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return const _SectionEmpty(
            message:
                'No tuition rows extracted yet. They land here once the '
                'extractor processes a verified guideline PDF.',
          );
        }
        // Group by academic_year, take the most recent year.
        final mostRecentYear = rows.first.academicYear;
        final currentRows = rows
            .where((r) => r.academicYear == mostRecentYear)
            .toList();
        return Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(
                  '$mostRecentYear academic year',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const Divider(height: 1),
              ...currentRows.map(
                (r) => ListTile(
                  dense: true,
                  title: Text(_humaniseFacultyGroup(r.facultyGroup)),
                  subtitle: Text(
                    'Semester ${r.semesterNumber}'
                    '${r.isFirstSemester ? " · first semester" : ""}',
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '₩${_thousands(r.amountKrw)}',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      if (r.admissionFeeKrw != null && r.admissionFeeKrw! > 0)
                        Text(
                          '+ ₩${_thousands(r.admissionFeeKrw!)} fee',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _humaniseFacultyGroup(String raw) {
    return switch (raw) {
      'humanities' => 'Humanities',
      'social_science' => 'Social Science',
      'natural_science' => 'Natural Science',
      'engineering' => 'Engineering',
      'medical' => 'Medical / Pharma',
      'arts' => 'Arts',
      'pe' => 'Physical Education',
      _ => raw,
    };
  }

  static String _thousands(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _RequirementsSection extends ConsumerWidget {
  const _RequirementsSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(institutionRequirementsProvider(institutionId));
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return const _SectionEmpty(
            message:
                'No requirements rows extracted yet for any verified cycle.',
          );
        }
        return Column(
          children: rows.map((r) => _RequirementsCard(r: r)).toList(),
        );
      },
    );
  }
}

class _RequirementsCard extends StatelessWidget {
  const _RequirementsCard({required this.r});
  final RequirementsRow r;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              r.applicantCategory,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (r.topikLabel != null) Chip(label: Text(r.topikLabel!)),
                if (r.englishTestLabel != null)
                  Chip(label: Text(r.englishTestLabel!)),
                if (r.gpaFloorPct != null)
                  Chip(
                    label: Text('GPA ≥ ${r.gpaFloorPct!.toStringAsFixed(0)}%'),
                  ),
                if (r.interviewRequired)
                  const Chip(
                    avatar: Icon(Icons.record_voice_over, size: 16),
                    label: Text('Interview'),
                  ),
                if (r.practicalExamRequired)
                  const Chip(
                    avatar: Icon(Icons.science, size: 16),
                    label: Text('Practical exam'),
                  ),
              ],
            ),
            if (r.proseKo != null && r.proseKo!.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(r.proseKo!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class _ScholarshipsSection extends ConsumerWidget {
  const _ScholarshipsSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(institutionScholarshipsProvider(institutionId));
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return const _SectionEmpty(
            message: 'No scholarships extracted yet for this institution.',
          );
        }
        return Column(
          children: rows.map((s) => _ScholarshipCard(s: s)).toList(),
        );
      },
    );
  }
}

class _ScholarshipCard extends StatelessWidget {
  const _ScholarshipCard({required this.s});
  final ScholarshipRow s;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.nameKo,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      if (s.nameEn != null)
                        Text(
                          s.nameEn!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
                Chip(label: Text(s.scope)),
              ],
            ),
            const SizedBox(height: 8),
            Text(s.awardLabel, style: Theme.of(context).textTheme.bodyMedium),
            if (s.topikTierTable != null && s.topikTierTable!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'TOPIK tier table',
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: s.topikTierTable!.entries
                    .map(
                      (e) => Chip(label: Text('TOPIK ${e.key} → ${e.value}%')),
                    )
                    .toList(),
              ),
            ],
            if (s.applicantCategories != null &&
                s.applicantCategories!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 4,
                children: s.applicantCategories!
                    .map(
                      (c) => Chip(
                        label: Text(c, style: const TextStyle(fontSize: 11)),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DocumentsSection extends ConsumerWidget {
  const _DocumentsSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(
      institutionDocumentsRequiredProvider(institutionId),
    );
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return const _SectionEmpty(
            message: 'No document checklist extracted yet.',
          );
        }
        // Group by applicant_category
        final byCategory = <String, List<DocumentRequirementRow>>{};
        for (final r in rows) {
          byCategory.putIfAbsent(r.applicantCategory, () => []).add(r);
        }
        return Column(
          children: byCategory.entries
              .map(
                (entry) => Card(
                  child: ExpansionTile(
                    title: Text(entry.key),
                    subtitle: Text('${entry.value.length} documents'),
                    children: entry.value
                        .map((d) => _DocumentTile(d: d))
                        .toList(),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.d});
  final DocumentRequirementRow d;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(
        d.isRequired ? Icons.check_box : Icons.check_box_outline_blank,
        color: d.isRequired
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.outline,
      ),
      title: Text(d.documentType),
      subtitle: d.notesKo != null && d.notesKo!.trim().isNotEmpty
          ? Text(d.notesKo!)
          : null,
      trailing: d.isApostilleRequired
          ? const Tooltip(
              message: 'Apostille required',
              child: Icon(Icons.verified_user_outlined),
            )
          : null,
    );
  }
}

class _SectionLoading extends StatelessWidget {
  const _SectionLoading();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 16),
    child: Center(child: CircularProgressIndicator()),
  );
}

class _SectionError extends StatelessWidget {
  const _SectionError({required this.error});
  final String error;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Text(
        'Could not load: $error',
        style: const TextStyle(color: Colors.red),
      ),
    ),
  );
}
