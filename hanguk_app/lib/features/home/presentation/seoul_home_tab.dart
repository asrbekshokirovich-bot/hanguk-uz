import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design_system/seoul_night/seoul_night.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/data/auth_repository.dart';
import 'home_tab_provider.dart';
import '../../applications/data/applications_repository.dart';
import '../../applications/domain/application.dart';
import '../../documents/data/documents_repository.dart';
import '../../documents/domain/document.dart';
import '../../documents/domain/document_type.dart';

/// Length of the application pipeline.
///
/// The pipeline itself is owned by
/// `applications/presentation/widgets/process_tracker.dart`: it declares the
/// nine ordered steps (Document preparation → Waiting for visa issue) and the
/// status → step mapping. Home mirrors that mapping in [_journeyStep] so the
/// two screens can never disagree about where a student stands. If the tracker
/// gains or reorders a step, change it there first and follow here.
const int _kJourneySteps = 9;

/// Number of pipeline steps a given application status has completed.
///
/// Mirrors `ProcessTracker._currentStep` exactly (that getter is private to its
/// library, so it cannot be reused directly).
int _journeyStep(String status) {
  switch (status) {
    case 'rejected':
    case 'visa_issue':
      return 9;
    case 'visa_documents':
      return 8;
    case 'university_response':
      return 7;
    case 'tuition_payment':
      return 6;
    case 'waiting_invoice':
      return 5;
    case 'interview':
      return 4;
    case 'offline_application':
      return 3;
    case 'online_application':
      return 2;
    case 'documents_collection':
      return 1;
    // 'pending' / 'pending_approval' and anything unrecognised: the process
    // has not started.
    default:
      return 0;
  }
}

/// The application the hero card reports on: the one that has travelled
/// furthest down the pipeline.
///
/// A rejected file never leads — `ProcessTracker` puts it at the last node but
/// paints it as a failure, so counting it as the student's live front line
/// would overstate their progress. When every application is rejected this
/// returns null and the hero falls back to step 0; the preview cards below
/// still carry each rejection.
StudentApplication? _leadApplication(List<StudentApplication> apps) {
  StudentApplication? lead;
  var leadStep = -1;
  for (final app in apps) {
    if (app.status == 'rejected') continue;
    final step = _journeyStep(app.status);
    // `applicationsProvider` orders newest first, so `>` keeps the most recent
    // application when two sit on the same step.
    if (step > leadStep) {
      lead = app;
      leadStep = step;
    }
  }
  return lead;
}

/// How many of the required document types the student has actually uploaded.
///
/// Uses the same match rule as `DocumentsTab` — the uploader stamps the type id
/// into both the display name and the storage path — so the count Home shows is
/// the count the Documents section shows.
int _collectedDocuments(List<AppDocument> uploaded) {
  var collected = 0;
  for (final type in DocumentConstants.requiredDocuments) {
    for (final doc in uploaded) {
      if (doc.name.contains('[${type.id}]') ||
          doc.filePath.contains('${type.id}-')) {
        collected++;
        break;
      }
    }
  }
  return collected;
}

/// Matches a string that opens with a hangul syllable (U+AC00–U+D7A3).
final RegExp _hangulStart = RegExp(r'^[가-힣]');

/// Glyph for a university's avatar tile.
///
/// Keyed off `name_ko`, exactly as `ApplicationCard` does — the same
/// application has to wear the same tile on both screens. Deriving it from the
/// city instead would give every Seoul university an identical 서, which
/// defeats the point of an avatar.
///
/// Falls back to the 한 brand mark rather than putting a stray Latin letter in
/// a hangul tile, since `name_ko` can be null for a partner that has not been
/// translated yet.
String _glyphForKoreanName(String? nameKo) {
  final trimmed = (nameKo ?? '').trim();
  if (!_hangulStart.hasMatch(trimmed)) return '한';
  return HangulGlyphTile.firstSyllable(trimmed);
}

/// Home section of the Seoul Night shell (DESIGN_SPEC §3.3).
///
/// Greeting header, then the student's real dashboard:
///  1. the "Your Journey" hero card — how far the furthest application has
///     travelled down the pipeline, with a lime action into Applications;
///  2. the next-step card — required documents collected so far, with the 할 일
///     chip, routing to Documents;
///  3. up to two application previews, routing to Applications.
///
/// Every number on this screen is derived from `applicationsProvider` or
/// `documentsProvider`; nothing is placeholder.
class SeoulHomeTab extends ConsumerWidget {
  const SeoulHomeTab({super.key, required this.onOpenSection});

  /// Jump to a section of the shell by its `SeoulSection` index.
  final void Function(int index) onOpenSection;

  String _greeting(AppLocalizations l, int hour) {
    if (hour < 12) return l.greetingMorning;
    if (hour < 18) return l.greetingAfternoon;
    return l.greetingEvening;
  }

  /// Matching hangul for the greeting — decorative, so it stays Korean in
  /// every locale (spec §1 Korean voice).
  String _greetingKo(int hour) {
    if (hour < 12) return '좋은 아침';
    if (hour < 18) return '좋은 오후';
    return '좋은 저녁';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    // Read the clock once so the greeting and its hangul can never disagree
    // across a noon/midnight boundary.
    final hour = DateTime.now().hour;

    final appsAsync = ref.watch(applicationsProvider);
    final docsAsync = ref.watch(documentsProvider);

    // ── 1. Journey hero ────────────────────────────────────────────────────
    final Widget journeyCard = appsAsync.when(
      loading: () => const _LoadingCard(),
      error: (_, _) => _ErrorCard(
        message: l.appsLoadError,
        onRetry: () => ref.invalidate(applicationsProvider),
      ),
      data: (apps) {
        if (apps.isEmpty) {
          return _EmptyJourneyCard(
            onTap: () => onOpenSection(SeoulSection.applications),
          );
        }
        final lead = _leadApplication(apps);
        return _JourneyHeroCard(
          step: lead == null ? 0 : _journeyStep(lead.status),
          universityName: lead?.university?.name,
          onContinue: () => onOpenSection(SeoulSection.applications),
        );
      },
    );

    // ── 2. Next step: the required-document checklist ──────────────────────
    final Widget nextStepCard = docsAsync.when(
      loading: () => const _LoadingCard(),
      error: (_, _) => _ErrorCard(
        message: l.documentLoadError,
        onRetry: () => ref.invalidate(documentsProvider),
      ),
      data: (uploaded) => _NextStepCard(
        collected: _collectedDocuments(uploaded),
        total: DocumentConstants.requiredDocuments.length,
        onTap: () => onOpenSection(SeoulSection.documents),
      ),
    );

    // ── 3. Up to two application previews ──────────────────────────────────
    // Loading and error are already reported by the hero above; repeating them
    // here would put the same spinner on screen twice.
    final List<Widget> previews = appsAsync.when(
      loading: () => <Widget>[],
      error: (_, _) => <Widget>[],
      data: (apps) {
        if (apps.isEmpty) return <Widget>[];
        return <Widget>[
          const SizedBox(height: 20),
          _SectionHeader(onTap: () => onOpenSection(SeoulSection.applications)),
          const SizedBox(height: 10),
          // Newest first — that is the order `applicationsProvider` returns.
          for (final app in apps.take(2)) ...[
            _ApplicationPreviewCard(
              application: app,
              onTap: () => onOpenSection(SeoulSection.applications),
            ),
            const SizedBox(height: 12),
          ],
        ];
      },
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SeoulSizes.screenPadding,
        24,
        SeoulSizes.screenPadding,
        // Clear of the 한 orb.
        SeoulSizes.orbClearance,
      ),
      children: [
        // Top bar (spec §3.3): avatar, greeting + name, notification bell.
        // The name comes from `profiles.full_name` via the DB; while it loads
        // (or if the profile has none) the header shows the greeting alone.
        _HomeTopBar(
          greetingLine: '${_greetingKo(hour)} · ${_greeting(l, hour)}',
          name: ref.watch(studentFullNameProvider).value ?? '',
        ),
        const SizedBox(height: 22),

        journeyCard,
        const SizedBox(height: 14),
        nextStepCard,

        ...previews,
      ],
    );
  }
}

/// The Home top bar (spec §3.3): a profile avatar, the greeting with the
/// student's name, and the notification bell. The avatar opens the account
/// screen; the bell opens the notification settings.
class _HomeTopBar extends StatelessWidget {
  const _HomeTopBar({required this.greetingLine, required this.name});

  /// "좋은 저녁 · Good evening" — the hangul greeting and its translation.
  final String greetingLine;

  /// The student's name, or empty when it isn't known.
  final String name;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final initial = name.isNotEmpty ? name.characters.first.toUpperCase() : '한';

    return Row(
      children: [
        Semantics(
          button: true,
          label: name.isNotEmpty ? name : l.navHome,
          child: GestureDetector(
            onTap: () => context.push('/account'),
            child: Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: SeoulGradients.heroCard,
                borderRadius: SeoulRadii.controlR,
                border: Border.all(color: SeoulColors.heroBorder),
              ),
              child: Text(
                initial,
                style: SeoulType.subtitle.copyWith(
                  color: SeoulColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greetingLine,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: SeoulType.caption,
              ),
              if (name.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.title,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 12),
        Semantics(
          button: true,
          label: l.homeNotifications,
          child: GestureDetector(
            onTap: () => context.push('/notifications'),
            child: Container(
              width: SeoulSizes.minTapTarget,
              height: SeoulSizes.minTapTarget,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: SeoulColors.glass,
                border: Border.all(color: SeoulColors.glassBorder),
              ),
              child: const Icon(
                Icons.notifications_none_rounded,
                size: 20,
                color: SeoulColors.textSecondary,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The one hero surface on Home: where the student stands in the application
/// pipeline, and the single lime action on the screen (spec §4).
class _JourneyHeroCard extends StatelessWidget {
  const _JourneyHeroCard({
    required this.step,
    required this.universityName,
    required this.onContinue,
  });

  /// Completed pipeline steps, 0–[_kJourneySteps].
  final int step;

  /// Name of the leading application's university, when it joined.
  final String? universityName;

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final name = universityName;

    return HeroCard(
      watermark: '한국',
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
                    // 나의 여정 — "my journey". Decorative accent (spec §1).
                    Text(l.homeJourneyEyebrow, style: SeoulType.eyebrow),
                    const SizedBox(height: 2),
                    const Text('나의 여정', style: SeoulType.hangulLabel),
                    const SizedBox(height: 6),
                    // Step 0 is not a step. A brand-new application sits at
                    // 'pending' until a counselor approves it, so say that
                    // instead of counting a stage the student hasn't reached.
                    Text(
                      step == 0
                          ? l.appsPendingHeading
                          : l.sessionStepLabel(step),
                      style: SeoulType.headline,
                    ),
                    if (name != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: SeoulType.bodySecondary,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 14),
              ConicProgressRing(
                value: step / _kJourneySteps,
                size: 84,
                label: '$step/$_kJourneySteps',
              ),
            ],
          ),
          const SizedBox(height: 18),
          Align(
            alignment: Alignment.centerLeft,
            child: LimeButton(
              label: l.homeContinueJourney,
              icon: Icons.arrow_forward_rounded,
              iconAfterLabel: true,
              expand: false,
              onPressed: onContinue,
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown instead of the hero when the student has no applications at all —
/// there is no journey to report yet, so nothing is invented.
///
/// It occupies the hero slot rather than sitting in it as a quiet glass row.
/// A new student's Home is otherwise two small cards over most of a screen of
/// empty navy, and the one surface with real presence — gradient, watermark,
/// lime bloom — was reserved for students who already have an application,
/// which is to say the ones who need the encouragement least. Same card, two
/// moods: the eyebrow and 나의 여정 label are carried over from
/// [_JourneyHeroCard] so the screen reads as one thing filling in rather than
/// two different layouts.
///
/// No progress ring and no lime button. The ring would draw a journey that has
/// not started, and the whole card is already the way in — the chevron says so
/// without a second, competing target.
class _EmptyJourneyCard extends StatelessWidget {
  const _EmptyJourneyCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return HeroCard(
      onTap: onTap,
      watermark: '한국',
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
                    Text(l.homeJourneyEyebrow, style: SeoulType.eyebrow),
                    const SizedBox(height: 2),
                    const Text('나의 여정', style: SeoulType.hangulLabel),
                    const SizedBox(height: 8),
                    Text(l.appsEmptyTitle, style: SeoulType.headline),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              // 지원 — "application". Hero scale, matching the ring it stands
              // in for on the other side of this card.
              const HangulGlyphTile(glyph: '지', size: 64),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(l.appsEmptyBody, style: SeoulType.bodySecondary),
              ),
              const SizedBox(width: 10),
              const Padding(
                padding: EdgeInsets.only(top: 3),
                child: Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 15,
                  color: SeoulColors.textFaint,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The next-step card: how much of the required document set is in, with the
/// 할 일 chip. Routes to Documents.
class _NextStepCard extends StatelessWidget {
  const _NextStepCard({
    required this.collected,
    required this.total,
    required this.onTap,
  });

  final int collected;
  final int total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final done = total > 0 && collected >= total;
    final value = total == 0 ? 0.0 : collected / total;

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Row(
        children: [
          // The lime "next step" dot from the prototype.
          const SizedBox(
            width: 10,
            height: 10,
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: SeoulColors.lime,
                boxShadow: SeoulShadows.limeGlowSmall,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.documentsRequiredHeading,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                const SizedBox(height: 9),
                GlowProgressBar(value: value, height: 5),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // 완료 done · 할 일 to-do — the spec's status words (§1).
          StatusChip(
            label: '$collected/$total',
            tone: StatusTone.lime,
            ko: done ? '완료' : '할 일',
            dense: true,
          ),
        ],
      ),
    );
  }
}

/// "Applications · 지원 현황 ›" — the whole row is the link into the section,
/// so no extra "View All" copy is needed.
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return Semantics(
      button: true,
      label: l.navApplications,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          // A floor, not a ceiling: HangulTag is two lines (~37px at scale
          // 1.0) and overflows a fixed 44px box at the OS's larger font
          // settings. This keeps the 44px tap target without capping height.
          constraints: const BoxConstraints(minHeight: SeoulSizes.minTapTarget),
          child: Row(
            children: [
              Expanded(
                child: HangulTag(
                  en: l.navApplications,
                  ko: '지원 현황',
                  titleStyle: SeoulType.subtitle,
                ),
              ),
              // The prototype's "View All" on the right of the section header.
              Text(
                l.homeViewAll,
                style: SeoulType.caption.copyWith(
                  color: SeoulColors.textSecondary,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.arrow_forward_ios_rounded,
                size: 13,
                color: SeoulColors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One application, compressed: hangul city tile, university, pipeline
/// progress, and the step it has reached.
class _ApplicationPreviewCard extends StatelessWidget {
  const _ApplicationPreviewCard({
    required this.application,
    required this.onTap,
  });

  final StudentApplication application;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    final university = application.university;
    final step = _journeyStep(application.status);
    final rejected = application.status == 'rejected';

    // A rejected application sits on the last node but is not progressing, so
    // it never gets a lime bar — the warning-toned chip carries the state.
    final value = rejected ? 0.0 : step / _kJourneySteps;

    final StatusTone tone;
    if (rejected) {
      tone = StatusTone.danger;
    } else if (step == 0) {
      tone = StatusTone.neutral;
    } else {
      tone = StatusTone.info;
    }

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Row(
        children: [
          HangulGlyphTile(glyph: _glyphForKoreanName(university?.nameKo)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  university?.name ?? l.unknownUniversity,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SeoulType.subtitle,
                ),
                const SizedBox(height: 9),
                GlowProgressBar(value: value, height: 5),
              ],
            ),
          ),
          const SizedBox(width: 12),
          StatusChip(
            label: l.sessionStepLabel(step),
            tone: tone,
            // 대기 pending — nothing has started on this file yet (spec §1).
            ko: (!rejected && step == 0) ? '대기' : null,
            dense: true,
          ),
        ],
      ),
    );
  }
}

/// Placeholder while a provider is still resolving. Deliberately shows no
/// numbers — an empty ring would read as "zero progress" rather than "unknown".
class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              valueColor: AlwaysStoppedAnimation<Color>(SeoulColors.lime),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(child: Text(l.loadingLabel, style: SeoulType.bodySecondary)),
        ],
      ),
    );
  }
}

/// A provider failed. Says so and offers a retry rather than rendering a
/// dashboard full of zeroes.
class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;

    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 20,
                color: SeoulColors.warningText,
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(message, style: SeoulType.bodySecondary)),
            ],
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: SeoulOutlineButton(
              label: l.commonRetry,
              icon: Icons.refresh_rounded,
              expand: false,
              height: SeoulSizes.minTapTarget,
              onPressed: onRetry,
            ),
          ),
        ],
      ),
    );
  }
}
