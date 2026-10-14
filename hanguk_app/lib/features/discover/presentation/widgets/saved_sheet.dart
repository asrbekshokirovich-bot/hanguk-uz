import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/analytics/app_events.dart';
import '../../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../../design_system/seoul_night/widgets/lucide.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../catalog/data/catalog_repository.dart';
import '../../../catalog/domain/catalog_models.dart';
import '../../data/saved_universities.dart';
import '../discover_routes.dart';
import '../saved_screen.dart' show SavedCompareCard, SavedRow;

/// How much of the sheet shows while it rests: a thin handle above the tabs.
const double kSavedPeek = 30;

/// The home screen's saved universities, as a sheet under the page: at rest
/// only a thin, quiet handle shows above the bottom tabs; pulled up (or
/// tapped) it lists every saved university. It lives inside the page, so the
/// tabs below never move. Nothing shows while nothing is saved.
class SavedPullSheet extends ConsumerStatefulWidget {
  const SavedPullSheet({super.key});

  @override
  ConsumerState<SavedPullSheet> createState() => _SavedPullSheetState();
}

class _SavedPullSheetState extends ConsumerState<SavedPullSheet> {
  final _sheet = DraggableScrollableController();
  bool _open = false;

  @override
  void dispose() {
    _sheet.dispose();
    super.dispose();
  }

  void _toggle(double peek, double max) {
    if (!_sheet.isAttached) return;
    _sheet.animateTo(_open ? peek : max, duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final all = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final byId = {for (final u in all) u.institutionId: u};
    final saved = [for (final id in ref.watch(savedUniversitiesProvider)) ?byId[id]];
    if (saved.isEmpty) return const SizedBox.shrink();
    final firstThree = [for (final u in saved.take(3)) u.institutionId];

    return LayoutBuilder(
      builder: (context, box) {
        final peek = (kSavedPeek / box.maxHeight).clamp(0.02, 0.2);
        const max = 0.88;
        return PopScope(
          canPop: !_open,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _toggle(peek, max);
          },
          child: NotificationListener<DraggableScrollableNotification>(
            onNotification: (n) {
              final open = n.extent > peek + 0.05;
              if (open != _open) {
                setState(() => _open = open);
                if (open) AppEvents.track('saved_sheet_open', props: {'saved': saved.length});
              }
              return false;
            },
            child: DraggableScrollableSheet(
              controller: _sheet,
              initialChildSize: peek,
              minChildSize: peek,
              maxChildSize: max,
              snap: true,
              snapSizes: [peek, max],
              builder: (context, scroll) => DecoratedBox(
                decoration: BoxDecoration(
                  color: _open ? FdColors.page : FdColors.page.withValues(alpha: 0.96),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                  border: Border(top: BorderSide(color: _open ? FdColors.ink : FdColors.ghost, width: 1.5)),
                  boxShadow: _open
                      ? const [BoxShadow(color: Color(0x330A1A34), blurRadius: 24, offset: Offset(0, -6))]
                      : null,
                ),
                child: ListView(
                  controller: scroll,
                  padding: EdgeInsets.zero,
                  children: [
                    Semantics(
                      button: true,
                      label: _open ? l.fdSavedSheetClose : l.fdSavedPeek(saved.length),
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: () => _toggle(peek, max),
                        behavior: HitTestBehavior.opaque,
                        child: SizedBox(
                          height: kSavedPeek,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 34,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: _open ? FdColors.ink : FdColors.ghost,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              if (!_open) ...[
                                const SizedBox(height: 3),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Lucide(LucideIcons.heart, size: 10, color: FdColors.muted),
                                    const SizedBox(width: 4),
                                    Text(
                                      l.fdSavedPeek(saved.length),
                                      style: fdText(10, FontWeight.w600, FdColors.muted, height: 1),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 2, 18, 12),
                      child: Row(
                        children: [
                          LimeMark(
                            l.fdSavedTitle,
                            style: fdText(22, FontWeight.w800, FdColors.ink, letterSpacing: -0.5),
                          ),
                          const Spacer(),
                          Text(l.fdCountTa(saved.length), style: fdText(13, FontWeight.w800, FdColors.muted)),
                        ],
                      ),
                    ),
                    const ColoredBox(color: FdColors.ink, child: SizedBox(height: 1.5)),
                    for (final u in saved)
                      SavedRow(
                        university: u,
                        onOpen: () => context.push(universityPath(u.institutionId)),
                        onUnsave: () => ref.read(savedUniversitiesProvider.notifier).remove(u.institutionId),
                      ),
                    if (saved.length >= 2)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                        child: SavedCompareCard(
                          title: saved.length >= 3 ? l.fdSavedCompareThree : l.fdSavedCompareTwo,
                          onTap: () => context.push(kDiscoverComparePath, extra: firstThree),
                        ),
                      ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
