import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../data/pdf_url_service.dart';
import '../data/uni_db_providers.dart';
import '../domain/document_requirement_row.dart';
import '../domain/institution_summary.dart';
import '../domain/requirements_row.dart';
import '../domain/scholarship_row.dart';
import '../domain/upcoming_deadline.dart';

/// `/institutions/:id` — per-institution detail page.
///
/// Sections:
///   * Hero header (name_ko + name_en + name_uz + chips for city/tier/IEQAS/
///     partner) per DESIGN_SPEC §1 Surfaces — the one hero card on the screen
///   * Track / un-track switch (writes to user_tracked_universities)
///   * "Open admission guide PDF" — the screen's single lime action (§4)
///   * Upcoming deadlines (cycle_dates joined with admission_cycles)
///   * Tuition / requirements / scholarships / document checklist as glass
///     sections
class InstitutionDetailScreen extends ConsumerWidget {
  const InstitutionDetailScreen({super.key, required this.institutionId});

  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(institutionDetailProvider(institutionId));
    final l = AppLocalizations.of(context)!;

    return SeoulNightScaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Pushed route → the shell header (and the 한 orb) are not here, so
          // the screen carries its own glass back circle + hangul-tagged title.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SeoulSizes.screenPadding,
              12,
              SeoulSizes.screenPadding,
              4,
            ),
            child: Row(
              children: [
                _GlassCircleButton(
                  icon: Icons.arrow_back_rounded,
                  tooltip: l.a11yTooltipBack,
                  onTap: () => Navigator.of(context).maybePop(),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: HangulTag(
                    en: l.uniDbInstitutionTitle,
                    ko: '대학 정보',
                    titleStyle: SeoulType.title,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: detailAsync.when(
              loading: () => const _CenteredSpinner(),
              error: (e, _) => _CenteredMessage(
                icon: Icons.error_outline,
                title: l.genericError(e),
              ),
              data: (summary) {
                if (summary == null) {
                  return _CenteredMessage(
                    icon: Icons.school_outlined,
                    title: l.uniDbNotFoundTitle,
                    body: l.uniDbNotFoundBody,
                  );
                }
                return _DetailContent(
                  institutionId: institutionId,
                  summary: summary,
                );
              },
            ),
          ),
        ],
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
    final l = AppLocalizations.of(context)!;
    final tracking = ref.watch(institutionTrackingProvider(institutionId));
    final deadlines = ref.watch(institutionDeadlinesProvider(institutionId));

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        8,
        SeoulSizes.screenPadding,
        32,
      ),
      children: [
        _HeaderHero(summary: summary),
        const SizedBox(height: 16),
        _TrackToggle(institutionId: institutionId, tracking: tracking),
        const SizedBox(height: 12),
        _OpenGuidelineButton(institutionId: institutionId),
        const SizedBox(height: 24),
        Text(l.uniDbUpcomingDeadlines, style: SeoulType.title),
        const SizedBox(height: 12),
        deadlines.when(
          loading: () => const _SectionLoading(),
          error: (e, _) => _SectionError(error: '$e'),
          data: (rows) {
            if (rows.isEmpty) {
              return _SectionEmpty(message: l.uniDbNoDeadlines);
            }
            return Column(
              children: rows.map((d) => _DeadlineTile(deadline: d)).toList(),
            );
          },
        ),
        const SizedBox(height: 24),
        Text(l.uniDbTuitionHeading, style: SeoulType.title),
        const SizedBox(height: 12),
        _TuitionSection(institutionId: institutionId),
        const SizedBox(height: 24),
        Text(l.uniDbRequirementsHeading, style: SeoulType.title),
        const SizedBox(height: 12),
        _RequirementsSection(institutionId: institutionId),
        const SizedBox(height: 24),
        Text(l.uniDbScholarshipsHeading, style: SeoulType.title),
        const SizedBox(height: 12),
        _ScholarshipsSection(institutionId: institutionId),
        const SizedBox(height: 24),
        Text(l.uniDbDocumentChecklistHeading, style: SeoulType.title),
        const SizedBox(height: 12),
        _DocumentsSection(institutionId: institutionId),
      ],
    );
  }
}

/// The one hero surface on the screen: glyph tile, trilingual name and the
/// tier / IEQAS / partner signals as status chips.
class _HeaderHero extends StatelessWidget {
  const _HeaderHero({required this.summary});
  final InstitutionSummary summary;

  /// Korean accent under the title. When the English name is the title the
  /// short Korean name goes here; falls back to the decorative 대학.
  String get _koLabel {
    for (final candidate in <String?>[summary.nameKoShort, summary.nameKo]) {
      final trimmed = (candidate ?? '').trim();
      if (trimmed.isNotEmpty && trimmed != _title) return trimmed;
    }
    return '대학';
  }

  String get _title {
    final en = (summary.nameEn ?? '').trim();
    return en.isNotEmpty ? en : summary.nameKo;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final nameUz = (summary.nameUz ?? '').trim();

    final chips = <Widget>[
      if (summary.cityKo != null && summary.cityKo!.trim().isNotEmpty)
        StatusChip(label: summary.cityKo!),
      if (summary.tier != null)
        StatusChip(label: l.universityTier(summary.tier!), tone: StatusTone.info),
      if (summary.ieqasStatus != null)
        StatusChip(
          label: 'IEQAS · ${summary.ieqasStatus}',
          tone: StatusTone.info,
        ),
      if (summary.isPartner)
        StatusChip(label: l.filterPartner, tone: StatusTone.lime, ko: '파트너'),
    ];

    return HeroCard(
      watermark: '대학',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HangulGlyphTile(
                glyph: HangulGlyphTile.firstSyllable(
                  summary.nameKoShort ?? summary.nameKo,
                ),
                size: 56,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    HangulTag(
                      en: _title,
                      ko: _koLabel,
                      titleStyle: SeoulType.title,
                      maxLines: 3,
                    ),
                    if (nameUz.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        nameUz,
                        style: SeoulType.bodySecondary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: chips),
          ],
          if (summary.lastVerifiedAt != null) ...[
            const SizedBox(height: 10),
            Text(
              l.uniDbLastVerified(
                summary.lastVerifiedAt!.toIso8601String().split('T').first,
              ),
              style: SeoulType.caption,
            ),
          ],
        ],
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
    final l = AppLocalizations.of(context)!;
    return widget.tracking.when(
      loading: () => _card(
        context,
        subtitle: null,
        trailing: const SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
          ),
        ),
      ),
      error: (e, _) => _card(
        context,
        subtitle: Text(
          '$e',
          style: SeoulType.caption.copyWith(color: SeoulColors.dangerText),
        ),
        trailing: const Icon(
          Icons.error_outline,
          color: SeoulColors.dangerText,
        ),
      ),
      data: (row) {
        final tracking = row != null;
        return _card(
          context,
          subtitle: Text(
            tracking ? l.uniDbTrackOnDesc : l.uniDbTrackOffDesc,
            style: SeoulType.caption,
          ),
          trailing: Switch(
            value: tracking,
            onChanged: _busy ? null : (v) => _toggle(v),
            activeColor: SeoulColors.ink,
            activeTrackColor: SeoulColors.lime,
            inactiveThumbColor: SeoulColors.textSecondary,
            inactiveTrackColor: SeoulColors.neutralFill,
            trackOutlineColor: const WidgetStatePropertyAll<Color>(
              SeoulColors.glassBorder,
            ),
          ),
        );
      },
    );
  }

  Widget _card(
    BuildContext context, {
    required Widget? subtitle,
    required Widget trailing,
  }) {
    final l = AppLocalizations.of(context)!;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      radius: SeoulRadii.tile,
      blur: false,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.uniDbTrackTitle, style: SeoulType.subtitle),
                if (subtitle != null) ...[const SizedBox(height: 3), subtitle],
              ],
            ),
          ),
          const SizedBox(width: 12),
          trailing,
        ],
      ),
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
      final l = AppLocalizations.of(context)!;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l.uniDbTrackError(err))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _DeadlineTile extends StatelessWidget {
  const _DeadlineTile({required this.deadline});
  final UpcomingDeadline deadline;

  /// Days within which a deadline reads as urgent (warning tone) — same
  /// threshold as VerifiedDeadlineCard.
  static const int _urgentDays = 7;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final cycleLabel = _cycleLabel(l, deadline.cycleTrack);
    // Same string the legacy tile showed — the raw timestamp without seconds.
    final when = deadline.startsAt
        .toIso8601String()
        .replaceFirst('T', ' ')
        .substring(0, 16);

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      radius: SeoulRadii.tile,
      blur: false,
      child: Row(
        children: [
          Icon(
            _iconFor(deadline.eventType),
            size: 20,
            color: SeoulColors.textSecondary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _eventLabel(l, deadline.eventType),
                  style: SeoulType.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  cycleLabel == null ? when : '$when · $cycleLabel',
                  style: SeoulType.caption,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _countdownChip(l),
        ],
      ),
    );
  }

  /// Countdown chip, toned by urgency — mirrors VerifiedDeadlineCard so the
  /// same deadline reads identically on both surfaces.
  StatusChip _countdownChip(AppLocalizations l) {
    final delta = deadline.startsAt.difference(DateTime.now());
    if (delta.isNegative) {
      return StatusChip(
        label: l.deadlineClosed,
        ko: '마감',
        tone: StatusTone.danger,
        dense: true,
      );
    }
    final String label;
    if (delta.inDays >= 1) {
      label = l.deadlineInDays(delta.inDays);
    } else if (delta.inHours >= 1) {
      label = l.deadlineInHours(delta.inHours);
    } else {
      label = l.deadlineInMinutes(delta.inMinutes);
    }
    return StatusChip(
      label: label,
      tone: delta.inDays < _urgentDays ? StatusTone.warning : StatusTone.lime,
      dense: true,
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
}

/// event_type → localized label. Same mapping as VerifiedDeadlineCard, plus
/// the two calendar-tail events only this screen surfaces.
String _eventLabel(AppLocalizations l, String eventType) => switch (eventType) {
  'apply_open' => l.eventApplyOpen,
  'apply_close' => l.eventApplyClose,
  'document_submission_deadline' => l.eventDocumentsDue,
  'first_stage_results' => l.eventFirstStageResults,
  'interview' => l.eventInterviewLabel,
  'practical_exam' => l.eventPracticalExam,
  'final_results' => l.eventFinalResults,
  'additional_admit' => l.eventAdditionalAdmit,
  'registration_open' => l.eventRegistrationOpen,
  'registration_close' => l.eventRegistrationClose,
  'orientation' => l.eventOrientation,
  'semester_start' => l.eventSemesterStart,
  // An event type the DB writes that this app does not model yet — the raw
  // value is the honest thing to show.
  _ => eventType.replaceAll('_', ' '),
};

/// cycle_track / applicant_category → localized label, raw value as fallback.
/// Same mapping as VerifiedDeadlineCard.
String? _cycleLabel(AppLocalizations l, String? track) {
  if (track == null) return null;
  return switch (track) {
    'foreign' => l.cycleForeign,
    'overseas_korean_full' => l.cycleOverseasKoreanFull,
    'overseas_korean_partial' => l.cycleOverseasKoreanPartial,
    'susi' => l.cycleSusi,
    'jeongsi' => l.cycleJeongsi,
    'transfer' => l.cycleTransfer,
    'grad_general' => l.cycleGradGeneral,
    'grad_foreign' => l.cycleGradForeign,
    _ => track,
  };
}

/// "Open admission guide PDF" button — the screen's one lime action (§4).
/// Calls get-pdf-url to mint a 15-minute signed URL, then launches it in the
/// user's preferred PDF reader. The Edge Function writes a pdf_access_log
/// audit row server-side; the client never touches that table directly.
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
    final l = AppLocalizations.of(context)!;
    final docId = ref.watch(
      institutionPrimaryGuidelineProvider(widget.institutionId),
    );
    return docId.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (id) {
        if (id == null) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(l.uniDbNoGuidePdf, style: SeoulType.caption),
          );
        }
        return LimeButton(
          label: l.uniDbOpenGuidePdf,
          icon: Icons.picture_as_pdf,
          loading: _busy,
          onPressed: _busy ? null : () => _open(id),
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
        final l = AppLocalizations.of(context)!;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l.uniDbPdfNoApp)));
      }
    } catch (err) {
      if (!mounted) return;
      final l = AppLocalizations.of(context)!;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l.uniDbPdfError(err))));
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
    return GlassCard(
      radius: SeoulRadii.tile,
      blur: false,
      child: Text(message, style: SeoulType.bodySecondary),
    );
  }
}

class _TuitionSection extends ConsumerWidget {
  const _TuitionSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final asyncRows = ref.watch(institutionTuitionProvider(institutionId));
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return _SectionEmpty(message: l.uniDbTuitionEmpty);
        }
        // Group by academic_year, take the most recent year.
        final mostRecentYear = rows.first.academicYear;
        final currentRows = rows
            .where((r) => r.academicYear == mostRecentYear)
            .toList();
        return GlassCard(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          blur: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.uniDbAcademicYear(mostRecentYear), style: SeoulType.eyebrow),
              const SizedBox(height: 8),
              const Divider(color: SeoulColors.glassBorder, height: 1),
              ...currentRows.map(
                (r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _facultyLabel(l, r.facultyGroup),
                              style: SeoulType.subtitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              r.isFirstSemester
                                  ? '${l.uniDbSemesterLabel(r.semesterNumber)}'
                                        ' · ${l.uniDbFirstSemester}'
                                  : l.uniDbSemesterLabel(r.semesterNumber),
                              style: SeoulType.caption,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₩${_thousands(r.amountKrw)}',
                            style: SeoulType.subtitle,
                          ),
                          if (r.admissionFeeKrw != null &&
                              r.admissionFeeKrw! > 0)
                            Text(
                              l.uniDbAdmissionFee(
                                '₩${_thousands(r.admissionFeeKrw!)}',
                              ),
                              style: SeoulType.caption,
                            ),
                        ],
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

  String _facultyLabel(AppLocalizations l, String raw) {
    return switch (raw) {
      'humanities' => l.facultyHumanities,
      'social_science' => l.facultySocialScience,
      'natural_science' => l.facultyNaturalScience,
      'engineering' => l.facultyEngineering,
      'medical' => l.facultyMedical,
      'arts' => l.facultyArts,
      'pe' => l.facultyPhysicalEducation,
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
    final l = AppLocalizations.of(context)!;
    final asyncRows = ref.watch(institutionRequirementsProvider(institutionId));
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return _SectionEmpty(message: l.uniDbRequirementsEmpty);
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
    final l = AppLocalizations.of(context)!;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      blur: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _cycleLabel(l, r.applicantCategory) ?? r.applicantCategory,
            style: SeoulType.subtitle,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (r.topikLabel != null)
                StatusChip(label: r.topikLabel!, tone: StatusTone.info),
              if (r.englishTestLabel != null)
                StatusChip(label: r.englishTestLabel!, tone: StatusTone.info),
              if (r.gpaFloorPct != null)
                StatusChip(
                  label: l.uniDbGpaChip(r.gpaFloorPct!.toStringAsFixed(0)),
                ),
              if (r.interviewRequired)
                StatusChip(
                  label: l.eventInterviewLabel,
                  tone: StatusTone.warning,
                  ko: '면접',
                ),
              if (r.practicalExamRequired)
                StatusChip(label: l.eventPracticalExam, tone: StatusTone.warning),
            ],
          ),
          if (r.proseKo != null && r.proseKo!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(r.proseKo!, style: SeoulType.caption),
          ],
        ],
      ),
    );
  }
}

class _ScholarshipsSection extends ConsumerWidget {
  const _ScholarshipsSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final asyncRows = ref.watch(institutionScholarshipsProvider(institutionId));
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return _SectionEmpty(message: l.uniDbScholarshipsEmpty);
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
    final l = AppLocalizations.of(context)!;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      blur: false,
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
                      style: SeoulType.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (s.nameEn != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        s.nameEn!,
                        style: SeoulType.caption,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              StatusChip(label: s.scope, dense: true),
            ],
          ),
          const SizedBox(height: 8),
          Text(s.awardLabel, style: SeoulType.bodySecondary),
          if (s.topikTierTable != null && s.topikTierTable!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(l.uniDbTopikTierTable, style: SeoulType.eyebrow),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: s.topikTierTable!.entries
                  .map(
                    (e) => StatusChip(
                      label: 'TOPIK ${e.key} → ${e.value}%',
                      tone: StatusTone.lime,
                      dense: true,
                    ),
                  )
                  .toList(),
            ),
          ],
          if (s.applicantCategories != null &&
              s.applicantCategories!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: s.applicantCategories!
                  .map(
                    (c) =>
                        StatusChip(label: _cycleLabel(l, c) ?? c, dense: true),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _DocumentsSection extends ConsumerWidget {
  const _DocumentsSection({required this.institutionId});
  final String institutionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final asyncRows = ref.watch(
      institutionDocumentsRequiredProvider(institutionId),
    );
    return asyncRows.when(
      loading: () => const _SectionLoading(),
      error: (e, _) => _SectionError(error: '$e'),
      data: (rows) {
        if (rows.isEmpty) {
          return _SectionEmpty(message: l.uniDbDocumentsEmpty);
        }
        // Group by applicant_category.
        final byCategory = <String, List<DocumentRequirementRow>>{};
        for (final r in rows) {
          byCategory.putIfAbsent(r.applicantCategory, () => []).add(r);
        }
        return Column(
          children: byCategory.entries
              .map(
                (entry) => GlassCard(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: EdgeInsets.zero,
                  radius: SeoulRadii.tile,
                  blur: false,
                  child: Theme(
                    // Strip the ExpansionTile's divider lines; every colour it
                    // paints is set explicitly below.
                    data: Theme.of(
                      context,
                    ).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      title: Text(
                        _cycleLabel(l, entry.key) ?? entry.key,
                        style: SeoulType.subtitle,
                      ),
                      subtitle: Text(
                        l.uniDbDocumentsCount(entry.value.length),
                        style: SeoulType.caption,
                      ),
                      iconColor: SeoulColors.lime,
                      collapsedIconColor: SeoulColors.textSecondary,
                      childrenPadding: const EdgeInsets.only(bottom: 8),
                      children: entry.value
                          .map((d) => _DocumentTile(d: d))
                          .toList(),
                    ),
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
    final l = AppLocalizations.of(context)!;
    final notes = (d.notesKo ?? '').trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            d.isRequired
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked,
            size: 18,
            color: d.isRequired ? SeoulColors.lime : SeoulColors.textFaint,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(d.documentType, style: SeoulType.body),
                if (notes.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(notes, style: SeoulType.caption),
                ],
              ],
            ),
          ),
          if (d.isApostilleRequired) ...[
            const SizedBox(width: 10),
            Tooltip(
              message: l.uniDbApostilleRequired,
              child: const Icon(
                Icons.verified_user_outlined,
                size: 18,
                color: SeoulColors.infoText,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionLoading extends StatelessWidget {
  const _SectionLoading();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 16),
    child: Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
      ),
    ),
  );
}

class _SectionError extends StatelessWidget {
  const _SectionError({required this.error});
  final String error;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return GlassCard(
      radius: SeoulRadii.tile,
      blur: false,
      child: Text(
        l.genericError(error),
        style: SeoulType.bodySecondary.copyWith(color: SeoulColors.dangerText),
      ),
    );
  }
}

class _CenteredSpinner extends StatelessWidget {
  const _CenteredSpinner();
  @override
  Widget build(BuildContext context) => const Center(
    child: CircularProgressIndicator(
      valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
    ),
  );
}

class _CenteredMessage extends StatelessWidget {
  const _CenteredMessage({required this.icon, required this.title, this.body});

  final IconData icon;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SeoulSizes.screenPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: SeoulColors.textFaint),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: SeoulType.subtitle,
            ),
            if (body != null) ...[
              const SizedBox(height: 8),
              Text(
                body!,
                textAlign: TextAlign.center,
                style: SeoulType.bodySecondary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Glass back circle — the section-header affordance from DESIGN_SPEC §2.
class _GlassCircleButton extends StatelessWidget {
  const _GlassCircleButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: Tooltip(
        message: tooltip,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: SeoulSizes.minTapTarget,
            height: SeoulSizes.minTapTarget,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: SeoulColors.glass,
              border: Border.all(color: SeoulColors.glassBorder),
            ),
            child: Icon(icon, size: 20, color: SeoulColors.textPrimary),
          ),
        ),
      ),
    );
  }
}
