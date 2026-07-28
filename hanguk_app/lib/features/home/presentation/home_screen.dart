import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../design_system/seoul_night/seoul_night.dart';
import '../../../../l10n/app_localizations.dart';
import '../../applications/presentation/applications_tab.dart';
import '../../map/presentation/map_tab.dart';
import '../../documents/presentation/documents_tab.dart';
import '../../chat/presentation/chat_tab.dart';
import '../../training/presentation/interview_screen.dart';
import '../../training/presentation/study_plan_screen.dart';
import '../../uni_db/data/admin_review_providers.dart';
import '../../updater/data/updater_repository.dart';
import '../../updater/presentation/update_dialog.dart';
import 'home_tab_provider.dart';
import 'onboarding_overlay.dart';
import 'seoul_home_tab.dart';
import 'widgets/han_orb.dart';

/// Index of each persistent section in the shell's [IndexedStack].
class SeoulSection {
  const SeoulSection._();

  static const int home = 0;
  static const int applications = 1;
  static const int map = 2;
  static const int documents = 3;

  static const int count = 4;
}

/// The Seoul Night shell (DESIGN_SPEC §2).
///
/// There is no bottom tab bar — the 한 orb in the bottom-right corner is the
/// only global navigation. It opens a speed-dial over a blurred scrim; picking
/// a section swaps the [IndexedStack] beneath.
///
/// Two kinds of destination:
///  * **Sections** live in the IndexedStack and keep their state (Home,
///    Applications, Map, Documents).
///  * **Task flows** are pushed as routes (AI Interview, Study Plan, Personal
///    Statement). The interview in particular must never sit alive in a
///    background tab — it holds a live WebRTC call and the microphone — so it
///    is pushed and torn down like any other screen, exactly as before.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // First-run orientation (audit A9) before the update prompt so a new
      // student is oriented before anything else competes for attention.
      await _maybeShowOnboarding();
      await _checkForUpdates();
    });
  }

  Future<void> _maybeShowOnboarding() async {
    if (await OnboardingStore.hasSeen() || !mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const OnboardingOverlay(),
      ),
    );
  }

  Future<void> _checkForUpdates() async {
    final repo = ref.read(updaterRepositoryProvider);
    final versionInfo = await repo.checkForUpdate();
    if (!mounted) return;
    if (versionInfo is UpdateAvailable) {
      showDialog(
        context: context,
        barrierDismissible: !versionInfo.effectivelyForced,
        builder: (context) => const UpdateDialog(),
      );
    }
  }

  void _openAIChat(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: const BoxDecoration(
          color: Color(0xFF071221),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: const ChatTab(),
        ),
      ),
    );
  }

  void _goToSection(int index) {
    ref.read(homeTabProvider.notifier).setTab(index);
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  List<HanOrbItem> _dialItems(AppLocalizations l, int current) {
    return [
      HanOrbItem(
        label: l.navHome,
        ko: '홈',
        glyph: '홈',
        active: current == SeoulSection.home,
        onTap: () => _goToSection(SeoulSection.home),
      ),
      HanOrbItem(
        label: l.navApplications,
        ko: '지원',
        glyph: '지',
        active: current == SeoulSection.applications,
        onTap: () => _goToSection(SeoulSection.applications),
      ),
      HanOrbItem(
        label: l.navMap,
        ko: '지도',
        glyph: '도',
        active: current == SeoulSection.map,
        onTap: () => _goToSection(SeoulSection.map),
      ),
      HanOrbItem(
        label: l.navDocs,
        ko: '서류',
        glyph: '서',
        active: current == SeoulSection.documents,
        onTap: () => _goToSection(SeoulSection.documents),
      ),
      // Task flows — pushed, not stacked (see the class doc).
      HanOrbItem(
        label: l.interviewCardTitle,
        ko: '면접',
        glyph: '면',
        onTap: () => _push(const InterviewScreen()),
      ),
      HanOrbItem(
        label: l.studyPlanCardTitle,
        ko: '학업',
        glyph: '학',
        onTap: () => _push(const StudyPlanScreen(documentType: 'study_plan')),
      ),
      HanOrbItem(
        label: l.personalStatementCardTitle,
        ko: '자기',
        glyph: '자',
        onTap: () =>
            _push(const StudyPlanScreen(documentType: 'personal_statement')),
      ),
    ];
  }

  /// Header shown on every section except Home: a glass back-circle to Home
  /// plus the section title with its hangul label (spec §2).
  Widget? _sectionHeader(AppLocalizations l, int index) {
    if (index == SeoulSection.home) return null;

    late final String title;
    late final String ko;
    switch (index) {
      case SeoulSection.applications:
        title = l.navApplications;
        ko = '지원 현황';
      case SeoulSection.map:
        title = l.navMap;
        ko = '대학 지도';
      case SeoulSection.documents:
        title = l.navDocs;
        ko = '서류 목록';
      default:
        return null;
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(SeoulSizes.screenPadding, 12, 20, 4),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: l.navHome,
            child: GestureDetector(
              onTap: () => _goToSection(SeoulSection.home),
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
                  Icons.arrow_back_rounded,
                  size: 20,
                  color: SeoulColors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: HangulTag(en: title, ko: ko, titleStyle: SeoulType.title),
          ),
        ],
      ),
    );
  }

  Widget _buildAiChatButton(BuildContext context, AppLocalizations l) {
    // Staff-only entry to the university-data review queue. Hidden for
    // students; gated server-side by fn_can_review_uni_db.
    final canReview = ref.watch(canReviewUniDbProvider).value ?? false;
    final pending = ref.watch(reviewQueueCountProvider).value ?? 0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (canReview) ...[
          FloatingActionButton.extended(
            heroTag: 'staff_review_fab',
            onPressed: () => context.push('/admin/review'),
            backgroundColor: Colors.white,
            icon: const Icon(Icons.fact_check_outlined, color: Colors.black),
            label: Text(
              pending > 0 ? 'Review ($pending)' : 'Review',
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        // The AI chat sits opposite the orb so the two never overlap.
        Semantics(
          button: true,
          label: l.a11yTooltipAskAi,
          child: GestureDetector(
            onTap: () => _openAIChat(context),
            child: Container(
              width: 52,
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: SeoulColors.glass,
                border: Border.all(color: SeoulColors.glassBorder),
                boxShadow: SeoulShadows.card,
              ),
              child: const Icon(
                Icons.smart_toy_outlined,
                color: SeoulColors.lime,
                size: 24,
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    // Clamp: the tab index is shared with deep links written before the shell
    // gained a Home section.
    final current = ref.watch(homeTabProvider).clamp(0, SeoulSection.count - 1);
    final header = _sectionHeader(l, current);

    return SeoulNightScaffold(
      body: Stack(
        children: [
          Column(
            children: [
              if (header != null) header,
              Expanded(
                child: IndexedStack(
                  index: current,
                  children: [
                    SeoulHomeTab(onOpenSection: _goToSection),
                    const ApplicationsTab(),
                    const MapTab(),
                    const DocumentsTab(),
                  ],
                ),
              ),
            ],
          ),

          Positioned(
            left: SeoulSizes.screenPadding,
            bottom: SeoulSizes.orbBottom,
            child: _buildAiChatButton(context, l),
          ),

          HanOrb(items: _dialItems(l, current), tooltip: l.navHome),
        ],
      ),
    );
  }
}
