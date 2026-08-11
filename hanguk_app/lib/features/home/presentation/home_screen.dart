import 'dart:async';

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
import 'home_tab_provider.dart';
import 'onboarding_overlay.dart';
import 'seoul_home_tab.dart';
import 'widgets/han_orb.dart';

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
  final HanOrbController _orb = HanOrbController();

  /// Sections the student has actually opened.
  ///
  /// [IndexedStack] builds *every* child, so listing MapTab here
  /// unconditionally would spin up the Kakao WebView (and its JS engine) at
  /// cold start and keep it running for the whole session. Sections mount on
  /// first visit and keep their state from then on.
  ///
  /// Map is the one exception: it's pre-warmed a few seconds after Home
  /// settles (see [_preloadMapTimer] below), trading some background
  /// battery/memory for an instant-feeling tab instead of the multi-second
  /// wait for the Kakao/Leaflet WebView to fetch its SDK over the network.
  final Set<int> _visited = <int>{SeoulSection.home};
  Timer? _preloadMapTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // First-run orientation (audit A9). The APK self-updater used to run
      // right after this; see _checkForUpdates' removal note below.
      await _maybeShowOnboarding();
    });
    // Give the Home screen's own first paint (and the onboarding check
    // above) a head start before spending network + a JS engine on a tab
    // the student hasn't asked for yet.
    _preloadMapTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _visited.add(SeoulSection.map));
    });
  }

  @override
  void dispose() {
    _preloadMapTimer?.cancel();
    _orb.dispose();
    super.dispose();
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

  // No _checkForUpdates here. It read `app_versions` and opened UpdateDialog
  // to download a build from Supabase Storage — the APK self-updater Play
  // blocked version 2041 over, and the source of the "Update Failed" dialog
  // students met on launch. Pulling it out of `UpdateGate` (a3370d5) missed
  // this call site and welcome_screen's, so it kept running on both screens a
  // student lands on. Updates come from Play now, through
  // `features/updater/data/play_in_app_update.dart`.

  void _openAIChat(BuildContext context) {
    const corners = BorderRadius.vertical(
      top: Radius.circular(SeoulRadii.hero),
    );
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: const BoxDecoration(
          // The same background as the app itself, so the sheet reads as the
          // screen sliding up rather than a foreign panel.
          gradient: SeoulGradients.appBackground,
          borderRadius: corners,
          border: Border(top: BorderSide(color: SeoulColors.glassBorder)),
        ),
        child: const ClipRRect(borderRadius: corners, child: ChatTab()),
      ),
    );
  }

  void _goToSection(int index) {
    ref.read(homeTabProvider.notifier).setTab(index);
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  /// One section of the [IndexedStack], built lazily.
  ///
  /// Hidden sections also have their tickers stopped: a spinner in a section
  /// nobody is looking at should not keep the app in a permanent animation
  /// frame loop.
  Widget _section(int index, int current, Widget Function() build) {
    if (!_visited.contains(index)) return const SizedBox.shrink();
    return TickerMode(enabled: index == current, child: build());
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
          SeoulOutlineButton(
            label: pending > 0 ? 'Review ($pending)' : 'Review',
            icon: Icons.fact_check_outlined,
            height: SeoulSizes.minTapTarget,
            // Must self-size: this sits in a Positioned with only left/bottom,
            // so the incoming width constraint is unbounded and the default
            // `expand` (width: infinity + MainAxisSize.max) would throw.
            expand: false,
            onPressed: () => context.push('/admin/review'),
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

    // Deep links write the index straight into the provider, so first-visit
    // bookkeeping happens here rather than only in `_goToSection`. Mutating a
    // plain Set during build notifies nothing, so this cannot loop.
    _visited.add(current);

    final shell = Stack(
      children: [
        Column(
          children: [
            ?header,
            Expanded(
              child: IndexedStack(
                index: current,
                children: [
                  _section(
                    SeoulSection.home,
                    current,
                    () => SeoulHomeTab(onOpenSection: _goToSection),
                  ),
                  _section(
                    SeoulSection.applications,
                    current,
                    () => const ApplicationsTab(),
                  ),
                  _section(SeoulSection.map, current, () => const MapTab()),
                  _section(
                    SeoulSection.documents,
                    current,
                    () => const DocumentsTab(),
                  ),
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

        HanOrb(
          items: _dialItems(l, current),
          tooltip: l.navMenu,
          controller: _orb,
        ),
      ],
    );

    // Android hardware BACK. The section header now draws an explicit
    // back-arrow to Home, so the system button has to honour the same
    // hierarchy instead of dropping the student out of the app. One PopScope
    // for both cases: two of them in a single route would each fire on a
    // blocked pop, closing the dial *and* navigating.
    return SeoulNightScaffold(
      body: ValueListenableBuilder<bool>(
        valueListenable: _orb,
        builder: (context, orbOpen, child) => PopScope(
          canPop: !orbOpen && current == SeoulSection.home,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            if (_orb.value) {
              _orb.close();
              return;
            }
            _goToSection(SeoulSection.home);
          },
          child: child!,
        ),
        child: shell,
      ),
    );
  }
}
