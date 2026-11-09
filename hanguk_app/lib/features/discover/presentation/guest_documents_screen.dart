import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/analytics/tracked.dart';
import '../../../design_system/seoul_night/widgets/fd_kit.dart';
import '../../../l10n/app_localizations.dart';
import '../../catalog/data/catalog_filters.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../catalog/domain/catalog_models.dart';
import '../data/slots.dart';
import 'guest_application_path_screen.dart';

/// The document names a guest sees: their language where there is a
/// translation.
String docName(CatalogDoc d, String lang) => (d.nameIn(lang) ?? '').trim();

/// The ticks a guest made, per guideline, on this phone only.
abstract final class GuestDocTicks {
  static const _storage = FlutterSecureStorage();
  static String _key(String guidelineId) => 'guest_doc_ticks_$guidelineId';

  static Future<Set<int>> load(String guidelineId) async {
    try {
      final raw = await _storage.read(key: _key(guidelineId));
      if (raw == null) return {};
      return {for (final v in jsonDecode(raw) as List) (v as num).toInt()};
    } catch (_) {
      return {};
    }
  }

  static Future<void> save(String guidelineId, Set<int> ticks) async {
    try {
      await _storage.write(key: _key(guidelineId), value: jsonEncode(ticks.toList()..sort()));
    } catch (_) {}
  }
}

/// «Hujjatlar ro'yxati» (ushlab qolish P21, Claude Design D6): the documents
/// of the chosen ♥ university's guideline (v_app_university_docs), ticked off
/// on the phone.
class GuestDocumentsScreen extends ConsumerStatefulWidget {
  const GuestDocumentsScreen({super.key});

  @override
  ConsumerState<GuestDocumentsScreen> createState() => _GuestDocumentsScreenState();
}

class _GuestDocumentsScreenState extends ConsumerState<GuestDocumentsScreen> {
  String? _loadedFor;
  Set<int> _ticks = {};

  Future<void> _load(String guidelineId) async {
    _loadedFor = guidelineId;
    final t = await GuestDocTicks.load(guidelineId);
    if (mounted && _loadedFor == guidelineId) setState(() => _ticks = t);
  }

  void _toggle(String guidelineId, int i) {
    setState(() {
      _ticks = {..._ticks};
      if (!_ticks.remove(i)) _ticks.add(i);
    });
    GuestDocTicks.save(guidelineId, _ticks);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final lang = Localizations.localeOf(context).languageCode;
    final catalog = ref.watch(catalogProvider).value ?? const <CatalogUniversity>[];
    final hearted = heartedUniversities(ref.watch(slotsProvider), catalog);
    final picked = ref.watch(guestPathSelectionProvider);
    final u = hearted.where((x) => x.institutionId == picked).firstOrNull ?? hearted.firstOrNull;
    final g = u == null ? null : (u.forDegree(CatalogDegree.bachelor) ?? u.primary);
    if (g != null && _loadedFor != g.id) _load(g.id);
    final docs = g == null ? const <CatalogDoc>[] : (ref.watch(catalogDetailProvider(g.id)).value?.docs ?? const <CatalogDoc>[]);
    final degree = g?.degree == CatalogDegree.master ? l.guestPathMaster : l.guestPathBachelor;

    return Container(
      color: FdColors.page,
      child: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 120),
          children: [
            if (u != null) Text('${u.displayName} · $degree', style: fdText(12, FontWeight.w700, FdColors.pageMuted)),
            const SizedBox(height: 4),
            Text(l.guestDocsTitle, style: fdText(24, FontWeight.w800, FdColors.onPage)),
            const SizedBox(height: 4),
            Text.rich(
              TextSpan(children: [
                TextSpan(text: '${_ticks.where((i) => i < docs.length).length} / ${docs.length} ',
                    style: fdText(13, FontWeight.w600, FdColors.lime)),
                TextSpan(text: l.guestDocsReady, style: fdText(13, FontWeight.w600, FdColors.pageMuted)),
              ]),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: const BoxDecoration(
                color: FdColors.card,
                borderRadius: BorderRadius.all(Radius.circular(22)),
                border: Border.fromBorderSide(BorderSide(color: FdColors.ink, width: 1.5)),
                boxShadow: [BoxShadow(color: FdColors.ink, offset: Offset(4, 4))],
              ),
              child: docs.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Text(u == null ? l.guestPathEmpty : l.guestDocsNone,
                          style: fdText(13.5, FontWeight.w500, FdColors.muted, height: 1.4)),
                    )
                  : Column(
                      children: [
                        for (var i = 0; i < docs.length; i++)
                          InkWell(
                            onTap: tracked('guest_docs.tick', () => _toggle(g!.id, i)),
                            child: Container(
                              constraints: const BoxConstraints(minHeight: 44),
                              decoration: BoxDecoration(
                                border: i == docs.length - 1 ? null : const Border(bottom: BorderSide(color: FdColors.tint)),
                              ),
                              child: Row(
                                children: [
                                  Checkbox(
                                    value: _ticks.contains(i),
                                    onChanged: (_) => _toggle(g!.id, i),
                                    activeColor: FdColors.blue,
                                  ),
                                  Expanded(
                                    child: Text(docName(docs[i], lang),
                                        style: fdText(13.5, FontWeight.w600, FdColors.ink, height: 1.3)),
                                  ),
                                  if (docs[i].needsApostille)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(color: FdColors.tint, borderRadius: BorderRadius.circular(999)),
                                      child: Text(l.guestDocsApostille, style: fdText(11, FontWeight.w800, FdColors.blueDeep)),
                                    ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
            const SizedBox(height: 14),
            Text(l.guestDocsNote, style: fdText(12, FontWeight.w600, FdColors.pageMuted, height: 1.4)),
          ],
        ),
      ),
    );
  }
}
